package themes

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/lib/pq"
	"log"
	"net/http"
	"strings"
	"time"
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

	db := databasehandler()
	defer db.Close()
	temporaryVersion := "1.0"
	sqlQuery := "INSERT INTO themes (name,site,author,description,version,rules) VALUES ($1,$2,$3,$4,$5,$6::jsonb)"
	
	_,err := db.Exec(sqlQuery,t.Name, t.Site, t.Author, t.Description,temporaryVersion,t.Rules)
	if err != nil {
		log.Printf("inserting theme: %v", err)
	}

	writeJSON(w, t)
}

func writeJSON(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(data)
}

func databasehandler() *sql.DB {
	cfg := pq.Config{
		Host:           "localhost",
		Port:           5432,
		Database:       "themeshop",
		User:           "test",
		Password:       "test",
		ConnectTimeout: 5 * time.Second,
		SSLMode:        pq.SSLMode("disable"),
	}

	c, err := pq.NewConnectorConfig(cfg)
	if err != nil {
		log.Fatal(err)
	}

	db := sql.OpenDB(c)

	err = db.Ping()
	if err != nil {
		log.Fatal(err)
		db.Close()
	}
	print("success")

	return db
}
