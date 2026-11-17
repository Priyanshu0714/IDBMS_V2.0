package services

import (
	"context"
	"encoding/json"

	"github.com/segmentio/kafka-go"
)

type FileProcessingEvent struct {
	Username string `json:"username"`
	Filename string `json:"filename"`
	Bucket   string `json:"bucket"`
}

type KafkaService struct {
	Writer *kafka.Writer
}

func NewKafkaService(broker, topic string) *KafkaService {
	return &KafkaService{
		Writer: &kafka.Writer{
			Addr:     kafka.TCP(broker),
			Topic:    topic,
			Balancer: &kafka.LeastBytes{},
		},
	}
}

func (k *KafkaService) PublishFileUploaded(ctx context.Context, event FileProcessingEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return k.Writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.Username),
		Value: payload,
	})
}

func (k *KafkaService) Close() error {
	if k.Writer != nil {
		return k.Writer.Close()
	}
	return nil
}
