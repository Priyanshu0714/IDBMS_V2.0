package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"

	"backend/idms/consumer"
	"backend/idms/database"
	"backend/idms/handler"
	"backend/idms/middleware"
	"backend/idms/services"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, reading system env")
	}

	endpoint := os.Getenv("ENDPOINT")
	accessKey := os.Getenv("ACCESS_KEY")
	secretKey := os.Getenv("SECRET_KEY")
	tempStore := os.Getenv("TEMP_STORE")
	mainStore := os.Getenv("MAIN_STORE")
	useSSL := os.Getenv("USE_SSL") == "true"

	if endpoint == "" || accessKey == "" || secretKey == "" || tempStore == "" || mainStore == "" {
		log.Fatal("missing minio configuration in env")
	}

	// postgres setup
	if err := database.InitPostgres(); err != nil {
		log.Fatal("postgres init failed:", err)
	}

	// minio setup
	minioService, err := services.NewMinIOService(endpoint, accessKey, secretKey, tempStore, mainStore, useSSL)
	if err != nil {
		log.Fatal("minio init failed:", err)
	}

	// mongo setup
	mongoClient, err := mongo.Connect(options.Client().ApplyURI(os.Getenv("MONGO_URL")))
	if err != nil {
		log.Fatal("mongo init failed:", err)
	}

	// kafka setup
	kafkaBroker := os.Getenv("KAFKA_BROKER")
	if kafkaBroker == "" {
		kafkaBroker = "127.0.0.1:9092"
	}
	kafkaTopic := os.Getenv("KAFKA_TOPIC")
	if kafkaTopic == "" {
		kafkaTopic = "file-processing"
	}
	kafkaGroup := os.Getenv("KAFKA_GROUP")
	if kafkaGroup == "" {
		kafkaGroup = "idms-workers"
	}

	kafkaService := services.NewKafkaService(kafkaBroker, kafkaTopic)
	defer kafkaService.Close()

	// start background worker
	worker := consumer.NewProcessingWorker(kafkaBroker, kafkaTopic, kafkaGroup, minioService, mongoClient)
	defer worker.Close()
	go worker.Start(context.Background())

	e := echo.New()
	e.Use(echomw.Logger())
	e.Use(echomw.Recover())
	e.Use(echomw.CORS())

	api := e.Group("/api")

	// public routes
	api.POST("/signup", handler.Signup)
	api.POST("/login", handler.Login)
	e.GET("/test", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "OK"})
	})

	// auth protected routes
	protected := api.Group("", middleware.JWTAuth)

	filehandler := handler.FileHandler{Minio: minioService}
	protected.GET("/upload-url", filehandler.GetUploadUrl)
	protected.GET("/download-url", filehandler.GetDownloadUrl)
	protected.POST("/move-file", filehandler.PostMoveFile)
	protected.GET("/files", filehandler.GetFiles)
	protected.GET("/file-info", filehandler.GetFileInfo)
	protected.DELETE("/file", filehandler.DeleteFile)

	processhandler := handler.ProcessHandler{Kafka: kafkaService}
	protected.POST("/process-file", processhandler.PostProcessFile)

	queryhandler := handler.QueryHandler{Minio: minioService, Mongo: mongoClient}
	protected.POST("/query", queryhandler.QueryProcessing)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("server starting on port %s\n", port)
	if err := e.Start(":" + port); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("server stopped with error", "error", err)
	}
}
