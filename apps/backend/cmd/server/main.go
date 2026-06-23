package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
)

type theme struct {
	Id     int    `json:"id"`
	Name   string `json:"name"`
	Author string `json:"author"`
	Site   string `json:"site"`
}

var themes = []theme{
	{
		Id:     1,
		Name:   "Example Theme",
		Author: "John Doe",
		Site:   "moodle.com",
	},
}

func main() {
	router := http.NewServeMux()
	router.HandleFunc("/health", handleHealth)
	router.HandleFunc("/themes", handleThemes)
	router.HandleFunc("/themes/", handleThemeById)
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
	json.NewEncoder(w).Encode(themes)
}

func handleThemeById(w http.ResponseWriter, r *http.Request) {
	myId := strings.TrimPrefix(r.URL.Path, "/themes/")
	for _, theme := range themes {
		if fmt.Sprint(theme.Id) == myId {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(theme)
			return
		}
	}
	http.NotFound(w, r)
}
