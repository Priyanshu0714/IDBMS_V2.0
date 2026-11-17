package handler

import (
	"backend/idms/services"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

type ProcessHandler struct {
	Kafka *services.KafkaService
}

func (h *ProcessHandler) PostProcessFile(c echo.Context) error {
	username := getUsername(c)
	filename := strings.TrimSpace(c.QueryParam("filename"))
	if filename == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "filename parameter is required",
		})
	}

	event := services.FileProcessingEvent{
		Username: username,
		Filename: filename,
		Bucket:   "tempbucket",
	}

	if err := h.Kafka.PublishFileUploaded(c.Request().Context(), event); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to queue file for processing",
		})
	}

	return c.JSON(http.StatusAccepted, map[string]string{
		"status":  "queued",
		"message": "file queued for processing",
	})
}
