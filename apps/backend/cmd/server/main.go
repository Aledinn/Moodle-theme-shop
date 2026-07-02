package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
)

type theme struct {
	themeSummary
	Rules []themeRule `json:"rules"`
}

type themeSummary struct {
	Id          int    `json:"id"`
	Name        string `json:"name"`
	Site        string `json:"site"`
	Author      string `json:"author"`
	Description string `json:"description"`
	Version     string `json:"version"`
}

type themeRule struct {
	Selector   string            `json:"selector"`
	Properties map[string]string `json:"properties"`
}

var themes = []theme{
	{
		themeSummary: themeSummary{
			Id:          1,
			Name:        "Example Theme",
			Site:        "moodle.com",
			Author:      "John Doe",
			Description: "Example theme",
			Version:     "1.0.0",
		},
		Rules: []themeRule{
			{
				Selector: "body",
				Properties: map[string]string{
					"background-color": "yellow",
					"color":            "blue",
				},
			},
		},
	},
	{
		themeSummary: themeSummary{
			Id:          2,
			Name:        "Dark Theme 2",
			Site:        "informatik.moodle.com",
			Author:      "Jesse",
			Description: "Dark example theme for moodle informatik",
			Version:     "1.2.3",
		},
		Rules: []themeRule{
			{
				Selector: "body",
				Properties: map[string]string{
					"background-color": "yellow",
					"color":            "purple",
				},
			},
		},
	},
}

func main() {
	router := http.NewServeMux()
	router.HandleFunc("/", onlyGet(handleRoot))
	router.HandleFunc("/health", onlyGet(handleHealth))
	router.HandleFunc("/themes", onlyGet(handleThemes))
	router.HandleFunc("/themes/", onlyGet(handleThemeById))
	fmt.Println("listening on :8080")
	err := http.ListenAndServe(":8080", router)
	if err != nil {
		log.Fatal(err)
	}
}

func handleRoot(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"message": "Moodle Theme Shop API"})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"status": "ok"})
}

func handleThemes(w http.ResponseWriter, r *http.Request) {
	summaries := []themeSummary{}
	for _, theme := range themes {
		summaries = append(summaries, theme.themeSummary)
	}
	writeJSON(w, summaries)
}

func handleThemeById(w http.ResponseWriter, r *http.Request) {
	myId := strings.TrimPrefix(r.URL.Path, "/themes/")
	for _, theme := range themes {
		if fmt.Sprint(theme.Id) == myId {
			writeJSON(w, theme)
			return
		}
	}
	http.NotFound(w, r)
}

func onlyGet(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(data)
}
