package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

type theme struct {
	Id     int    `json:"id"`
	Name   string `json:"name"`
	Author string `json:"author"`
	Site   string `json:"site"`
}

func main() {
	router := http.NewServeMux()
	router.HandleFunc("/health", handleHealth)
	router.HandleFunc("/themes", handleThemes)
	fmt.Println("listening on :8080")
	err := http.ListenAndServe(":8080", router)
	if err != nil {
		log.Fatal(err)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status":"ok"}`)
}

func handleThemes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	themes := []theme{
		{
			Id:     1,
			Name:   "Example Theme",
			Author: "John Doe",
			Site:   "moodle.com",
		},
	}

	json.NewEncoder(w).Encode(themes)
}
