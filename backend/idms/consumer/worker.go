package consumer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"backend/idms/database"
	"backend/idms/services"
	"github.com/dutchcoders/go-clamd"
	"github.com/segmentio/kafka-go"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type ProcessingWorker struct {
	Reader *kafka.Reader
	Minio  *services.MinIOService
	Mongo  *mongo.Client
}

func NewProcessingWorker(broker, topic, groupID string, minio *services.MinIOService, mongo *mongo.Client) *ProcessingWorker {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{broker},
		Topic:   topic,
		GroupID: groupID,
	})
	return &ProcessingWorker{
		Reader: r,
		Minio:  minio,
		Mongo:  mongo,
	}
}

func (w *ProcessingWorker) Start(ctx context.Context) {
	fmt.Println("kafka consumer worker started")

	for {
		msg, err := w.Reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("kafka read error: %v", err)
			continue
		}

		var event services.FileProcessingEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("invalid kafka payload: %v", err)
			continue
		}

		w.processFile(ctx, event)
	}
}

func (w *ProcessingWorker) processFile(ctx context.Context, event services.FileProcessingEvent) {
	temppath := fmt.Sprintf("%s/%s", event.Username, event.Filename)
	fmt.Printf("processing file: %s\n", temppath)

	localPath, err := w.Minio.DownloadFile(temppath)
	if err != nil {
		log.Printf("failed to download %s: %v", temppath, err)
		return
	}
	defer os.Remove(localPath)

	// clamav scan
	file, err := os.Open(localPath)
	if err != nil {
		log.Printf("failed to open local file %s: %v", localPath, err)
		return
	}

	clamHost := os.Getenv("CLAMAV_URL")
	if clamHost == "" {
		clamHost = "tcp://127.0.0.1:3310"
	}
	clamav := clamd.NewClamd(clamHost)
	response, err := clamav.ScanStream(file, make(chan bool))
	file.Close()

	if err != nil {
		log.Printf("clamav scan error on %s: %v", temppath, err)
		return
	}

	virusFound := false
	for r := range response {
		if r.Status == clamd.RES_FOUND {
			virusFound = true
			break
		}
	}

	if virusFound {
		log.Printf("virus detected in %s, removing from temp store", temppath)
		_ = w.Minio.DeleteFile(ctx, event.Bucket, temppath)
		return
	}

	// file ok, inspect metadata
	fileData, err := w.Minio.GetFileInfo(event.Bucket, temppath)
	if err != nil {
		log.Printf("failed to stat %s: %v", temppath, err)
		return
	}

	// extract text and groq headers for pdfs
	if fileData.ContentType == "application/pdf" {
		txt, err := services.TextExtractor(temppath)
		if err != nil {
			log.Printf("text extraction failed for %s: %v", temppath, err)
		} else {
			metaHeader, err := services.AIHeader(txt)
			if err != nil {
				log.Printf("ai header extraction failed for %s: %v", temppath, err)
			} else {
				if err := database.MongoDB(metaHeader, fileData); err != nil {
					log.Printf("mongo insert failed for %s: %v", temppath, err)
				}
			}
		}
	}

	// move to main bucket
	if err := w.Minio.MoveFile(ctx, temppath); err != nil {
		log.Printf("failed to move %s to main bucket: %v", temppath, err)
		return
	}

	fmt.Printf("file processed and moved: %s\n", temppath)
}

func (w *ProcessingWorker) Close() error {
	if w.Reader != nil {
		return w.Reader.Close()
	}
	return nil
}
