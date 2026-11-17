package services

import (
	"io"
	"net/http"
	"os"
)

func TextExtractor(location string) (string, error) {
	file, err := os.Open("/tmp/" + location)
	if err != nil {
		return "", err
	}
	defer file.Close()

	req, err := http.NewRequest("PUT", "http://localhost:9998/tika", file)
	if err != nil {
		return "", err
	}
	req.Header.Add("Accept", "text/plain")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}
