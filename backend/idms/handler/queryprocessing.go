package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"backend/idms/services"
	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type QueryHandler struct {
	Minio *services.MinIOService
	Mongo *mongo.Client
}

type QueryPayload struct {
	Query string `json:"query"`
}

func (h *QueryHandler) QueryProcessing(c echo.Context) error {
	var query string

	// support both json body and form value
	var req QueryPayload
	if err := c.Bind(&req); err == nil && req.Query != "" {
		query = req.Query
	} else {
		query = c.FormValue("query")
	}

	query = strings.TrimSpace(query)
	if query == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "query cannot be empty",
		})
	}

	url := "https://api.groq.com/openai/v1/chat/completions"
	prompt := fmt.Sprintf(`Return ONLY valid JSON in this exact format:
	{
		"title": "",
		"company": "",
		"date": "",
		"people": [],
		"location": [],
		"financials": {
			"revenue": "",
			"profit": ""
		}
	}
	Rules:
	- If a field is not present in the user request, return null
	- Extract entity names, organization names (e.g. "rekhi foundation" -> company), dates, or titles
	- Do not add extra text
	- Only JSON
	Text:%s`, query)

	body := map[string]interface{}{
		"model": os.Getenv("modelname"),
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"temperature": 0.1,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to encode query"})
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to build request"})
	}
	httpReq.Header.Set("Authorization", "Bearer "+os.Getenv("API_KEY"))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "groq service unavailable"})
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed reading groq response"})
	}

	var groqResp services.GroqResponse
	if err := json.Unmarshal(respBody, &groqResp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed parsing groq response"})
	}
	if len(groqResp.Choices) == 0 {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "empty groq response"})
	}

	content := groqResp.Choices[0].Message.Content
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}") + 1

	var result services.Data
	if start != -1 && end > start {
		cleanData := content[start:end]
		_ = json.Unmarshal([]byte(cleanData), &result)
	}

	username := getUsername(c)
	coll := h.Mongo.Database("CollabSphere").Collection("FilesData")

	var orfilter []bson.M

	// match groq extracted entities with case-insensitive regex
	if result.Company != "" && result.Company != "null" {
		orfilter = append(orfilter, bson.M{"aiData.company": bson.M{"$regex": result.Company, "$options": "i"}})
	}
	if result.Title != "" && result.Title != "null" {
		orfilter = append(orfilter, bson.M{"aiData.title": bson.M{"$regex": result.Title, "$options": "i"}})
	}
	if result.Date != "" && result.Date != "null" {
		orfilter = append(orfilter, bson.M{"aiData.date": bson.M{"$regex": result.Date, "$options": "i"}})
	}
	for _, p := range result.People {
		if p != "" && p != "null" {
			orfilter = append(orfilter, bson.M{"aiData.people": bson.M{"$regex": p, "$options": "i"}})
		}
	}
	for _, l := range result.Location {
		if l != "" && l != "null" {
			orfilter = append(orfilter, bson.M{"aiData.location": bson.M{"$regex": l, "$options": "i"}})
		}
	}
	if result.Financials.Revenue != "" && result.Financials.Revenue != "null" {
		orfilter = append(orfilter, bson.M{"aiData.financials.revenue": bson.M{"$regex": result.Financials.Revenue, "$options": "i"}})
	}
	if result.Financials.Profit != "" && result.Financials.Profit != "null" {
		orfilter = append(orfilter, bson.M{"aiData.financials.profit": bson.M{"$regex": result.Financials.Profit, "$options": "i"}})
	}

	// fallback keyword match in filename and ai fields
	tokens := strings.Fields(query)
	for _, token := range tokens {
		cleanToken := strings.ToLower(token)
		if len(cleanToken) > 2 && cleanToken != "find" && cleanToken != "list" && cleanToken != "files" && cleanToken != "containing" && cleanToken != "want" {
			orfilter = append(orfilter, bson.M{"name": bson.M{"$regex": token, "$options": "i"}})
			orfilter = append(orfilter, bson.M{"aiData.company": bson.M{"$regex": token, "$options": "i"}})
			orfilter = append(orfilter, bson.M{"aiData.title": bson.M{"$regex": token, "$options": "i"}})
		}
	}

	filter := bson.M{}
	// restrict to authenticated user's folder
	if username != "" {
		filter["name"] = bson.M{"$regex": "^" + username + "/"}
	}

	if len(orfilter) > 0 {
		filter["$or"] = orfilter
	}

	cursor, err := coll.Find(context.TODO(), filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(context.TODO())

	var files []bson.M
	if err := cursor.All(context.TODO(), &files); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed decoding files"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"query":     query,
		"extracted": result,
		"count":     len(files),
		"files":     files,
	})
}
