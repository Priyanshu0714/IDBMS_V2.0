package services

import (
	"context"
	"fmt"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinIOService struct {
	client     *minio.Client
	tempBucket string
	mainBucket string
}

func NewMinIOService(endpoint, accessKey, secretKey, tempBucket, mainBucket string, useSSL bool) (*MinIOService, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio connection failed: %w", err)
	}

	service := &MinIOService{
		client:     client,
		tempBucket: tempBucket,
		mainBucket: mainBucket,
	}

	ctx := context.Background()
	if err := service.ensureBucketExists(ctx, tempBucket); err != nil {
		return nil, fmt.Errorf("create temp bucket: %w", err)
	}
	if err := service.ensureBucketExists(ctx, mainBucket); err != nil {
		return nil, fmt.Errorf("create main bucket: %w", err)
	}

	return service, nil
}

func (s *MinIOService) ensureBucketExists(ctx context.Context, bucketName string) error {
	exists, err := s.client.BucketExists(ctx, bucketName)
	if err != nil {
		return err
	}
	if !exists {
		err = s.client.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{})
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *MinIOService) GenerateUploadURL(key string) (string, error) {
	presignedURL, err := s.client.PresignedPutObject(
		context.Background(),
		s.tempBucket,
		key,
		15*time.Minute,
	)
	if err != nil {
		return "", err
	}
	return presignedURL.String(), nil
}

func (s *MinIOService) GenerateDownloadURL(key string, bucket string, expiry time.Duration) (string, error) {
	if bucket == "" {
		bucket = s.mainBucket
	}
	if expiry == 0 {
		expiry = time.Hour
	}

	presignedURL, err := s.client.PresignedGetObject(
		context.Background(),
		bucket,
		key,
		expiry,
		nil,
	)
	if err != nil {
		return "", err
	}
	return presignedURL.String(), nil
}

func (s *MinIOService) MoveFile(ctx context.Context, key string) error {
	src := minio.CopySrcOptions{
		Bucket: s.tempBucket,
		Object: key,
	}
	dst := minio.CopyDestOptions{
		Bucket: s.mainBucket,
		Object: key,
	}

	if _, err := s.client.CopyObject(ctx, dst, src); err != nil {
		return fmt.Errorf("copy object: %w", err)
	}

	return s.client.RemoveObject(ctx, s.tempBucket, key, minio.RemoveObjectOptions{})
}

func (s *MinIOService) ListFiles(bucket string, prefix string) ([]minio.ObjectInfo, error) {
	if bucket == "" {
		bucket = s.mainBucket
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	objectCh := s.client.ListObjects(ctx, bucket, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})

	var objects []minio.ObjectInfo
	for object := range objectCh {
		if object.Err != nil {
			return nil, object.Err
		}
		objects = append(objects, object)
	}
	return objects, nil
}

func (s *MinIOService) DeleteFile(ctx context.Context, bucket, key string) error {
	if bucket == "" {
		bucket = s.mainBucket
	}
	return s.client.RemoveObject(ctx, bucket, key, minio.RemoveObjectOptions{})
}

func (s *MinIOService) GetFileInfo(bucket, key string) (minio.ObjectInfo, error) {
	if bucket == "" {
		bucket = s.mainBucket
	}
	return s.client.StatObject(context.Background(), bucket, key, minio.StatObjectOptions{})
}

func (s *MinIOService) DownloadFile(key string) (string, error) {
	localpath := fmt.Sprintf("/tmp/%s", key)
	err := s.client.FGetObject(
		context.Background(),
		s.tempBucket,
		key,
		localpath,
		minio.GetObjectOptions{},
	)
	if err != nil {
		return "", err
	}
	return localpath, nil
}
