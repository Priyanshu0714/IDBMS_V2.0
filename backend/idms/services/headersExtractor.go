package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

type Financial struct {
	Revenue string `json:"revenue" bson:"revenue"`
	Profit  string `json:"profit" bson:"profit"`
}

type Data struct {
	Title      string    `json:"title" bson:"title"`
	Company    string    `json:"company" bson:"company"`
	Date       string    `json:"date" bson:"date"`
	People     []string  `json:"people" bson:"people"`
	Location   []string  `json:"location" bson:"location"`
	Financials Financial `json:"financials" bson:"financials"`
}

type GroqResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func AIHeader(txt string) (Data, error) {
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
	- If a field is not present, return null
	- Do not add extra text
	- Do not explain anything
	- Only JSON
	Text:%s`, txt)

	body := map[string]interface{}{
		"model": os.Getenv("modelname"),
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"temperature": 0.2,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return Data{}, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return Data{}, err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return Data{}, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return Data{}, err
	}

	var groqResp GroqResponse
	if err := json.Unmarshal(respBody, &groqResp); err != nil {
		return Data{}, err
	}
	if len(groqResp.Choices) == 0 {
		return Data{}, fmt.Errorf("empty response from groq")
	}

	content := groqResp.Choices[0].Message.Content
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}") + 1
	if start == -1 || end == 0 {
		return Data{}, fmt.Errorf("no json found in output: %s", content)
	}

	cleanData := content[start:end]
	var result Data
	if err := json.Unmarshal([]byte(cleanData), &result); err != nil {
		return Data{}, err
	}
	return result, nil
}
