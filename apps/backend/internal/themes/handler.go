package themes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

func HandleRoot(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"message": "Moodle Theme Shop API"})
}

func HandleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"status": "ok"})
}

func HandleThemes(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		getThemes(w, r)
	} else if r.Method == http.MethodPost {
		postTheme(w, r)
	} else {
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func getThemes(w http.ResponseWriter, r *http.Request) {
	summaries := []themeSummary{}
	for _, theme := range themes {
		summaries = append(summaries, theme.themeSummary)
	}
	writeJSON(w, summaries)
}

func HandleThemeByID(w http.ResponseWriter, r *http.Request) {
	myId := strings.TrimPrefix(r.URL.Path, "/themes/")
	for _, theme := range themes {
		if fmt.Sprint(theme.Id) == myId {
			writeJSON(w, theme)
			return
		}
	}
	http.NotFound(w, r)
}

func postTheme(w http.ResponseWriter, r *http.Request) {
	var t theme
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	t.Id = len(themes) + 1
	themes = append(themes, t)
	writeJSON(w, t)
}

func writeJSON(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(data)
}
