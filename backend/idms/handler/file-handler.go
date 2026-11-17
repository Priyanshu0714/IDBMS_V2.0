package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"backend/idms/services"
	"github.com/labstack/echo/v4"
)

type FileHandler struct {
	Minio *services.MinIOService
}

func getUsername(c echo.Context) string {
	u, _ := c.Get("username").(string)
	return u
}

func ownsKey(c echo.Context, key string) bool {
	return strings.HasPrefix(key, getUsername(c)+"/")
}

func (h *FileHandler) GetUploadUrl(c echo.Context) error {
	filename := c.QueryParam("filename")
	if filename == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "filename parameter is required",
		})
	}

	key := fmt.Sprintf("%s/%d_%s", getUsername(c), time.Now().Unix(), filename)
	uploadURL, err := h.Minio.GenerateUploadURL(key)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"upload_url": uploadURL,
		"key":        key,
	})
}

func (h *FileHandler) GetDownloadUrl(c echo.Context) error {
	key := strings.TrimSpace(c.QueryParam("key"))
	bucket := strings.TrimSpace(c.QueryParam("bucket"))
	expiryStr := strings.TrimSpace(c.QueryParam("expiry"))

	if key == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "key parameter is required",
		})
	}

	if !ownsKey(c, key) {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "access denied",
		})
	}

	expiry := 60 * time.Minute
	if expiryStr != "" {
		if minutes, err := time.ParseDuration(expiryStr + "m"); err == nil {
			expiry = minutes
		}
	}

	downloadURL, err := h.Minio.GenerateDownloadURL(key, bucket, expiry)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"download_url": downloadURL,
		"expires_in":   expiry.String(),
	})
}

func (h *FileHandler) PostMoveFile(c echo.Context) error {
	key := c.FormValue("key")
	if key == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "key parameter is required",
		})
	}

	if !ownsKey(c, key) {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "access denied",
		})
	}

	if err := h.Minio.MoveFile(c.Request().Context(), key); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "file moved successfully",
	})
}

func (h *FileHandler) GetFiles(c echo.Context) error {
	bucket := c.QueryParam("bucket")
	if bucket == "" {
		bucket = "tempbucket"
	}

	prefix := getUsername(c) + "/"
	objects, err := h.Minio.ListFiles(bucket, prefix)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	var files []map[string]interface{}
	for _, obj := range objects {
		files = append(files, map[string]interface{}{
			"key":           obj.Key,
			"size":          obj.Size,
			"last_modified": obj.LastModified,
			"etag":          obj.ETag,
			"content_type":  obj.ContentType,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"files": files,
	})
}

func (h *FileHandler) GetFileInfo(c echo.Context) error {
	key := c.QueryParam("key")
	bucket := c.QueryParam("bucket")
	if bucket == "" {
		bucket = "tempbucket"
	}

	if key == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "key parameter is required",
		})
	}

	if !ownsKey(c, key) {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "access denied",
		})
	}

	objInfo, err := h.Minio.GetFileInfo(bucket, key)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"key":           objInfo.Key,
		"size":          objInfo.Size,
		"last_modified": objInfo.LastModified,
		"etag":          objInfo.ETag,
		"content_type":  objInfo.ContentType,
		"metadata":      objInfo.UserMetadata,
	})
}

func (h *FileHandler) DeleteFile(c echo.Context) error {
	key := c.QueryParam("key")
	bucket := c.QueryParam("bucket")

	if key == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "key parameter is required",
		})
	}

	if !ownsKey(c, key) {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "access denied",
		})
	}

	if err := h.Minio.DeleteFile(c.Request().Context(), bucket, key); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "file deleted successfully",
	})
}
