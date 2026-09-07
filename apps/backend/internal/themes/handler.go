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
	"os"
	"github.com/cenkalti/backoff/v4"
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

	//need to add a limit
	myQuery := "SELECT id,name,site,author,description,version FROM themes"
	db, err := roachDb()
	if err != nil {
		log.Fatalf("failed to initialize the store: %s", err)
	}
	rows,err := db.Query(myQuery)
	if err != nil {
		log.Printf("error: %v", err)
	}

	defer rows.Close()

	for rows.Next() {
		var summary themeSummary
		if err := rows.Scan(&summary.Id,&summary.Name,&summary.Site,&summary.Author,&summary.Description,&summary.Version); err != nil {
			log.Printf("error: %v", err)
		}
		fmt.Println(summary)
		summaries = append(summaries,summary)
	}

	if err = rows.Err(); err != nil {
		log.Printf("error: %v", err)
	}
	fmt.Println(summaries)
	writeJSON(w, summaries)
}

func HandleThemeByID(w http.ResponseWriter, r *http.Request) {
	myId := strings.TrimPrefix(r.URL.Path, "/themes/")

	var t theme 
	db, err := roachDb()
	if err != nil {
		log.Fatalf("failed to initialize the store: %s", err)
	}

	sqlQuery:= "SELECT * FROM themes WHERE id = $1"

	row := db.QueryRow(sqlQuery,myId)
	if err = row.Scan(&t.themeSummary.Id,&t.themeSummary.Name,&t.themeSummary.Site,&t.themeSummary.Author,&t.themeSummary.Description,&t.themeSummary.Version,&t.Rules); err != nil {
		if err ==  sql.ErrNoRows {
			http.NotFound(w, r)
		}
		http.NotFound(w, r)
	}
	writeJSON(w,t)
}

func postTheme(w http.ResponseWriter, r *http.Request) {
	var t theme
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	db, err := roachDb()
	if err != nil {
		log.Fatalf("failed to initialize the store: %s", err)
	}

	defer db.Close()
	temporaryVersion := "1.0"
	sqlQuery := "INSERT INTO themes (name,site,author,description,version,rules) VALUES ($1,$2,$3,$4,$5,$6::jsonb)"
	
	_,err = db.Exec(sqlQuery,t.Name, t.Site, t.Author, t.Description,temporaryVersion,t.Rules)
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

	return db
}

func roachDb() (*sql.DB, error) {
	pgConnString := fmt.Sprintf("host=%s port=%s dbname=%s user=%s sslmode=disable",
		os.Getenv("PGHOST"), os.Getenv("PGPORT"), os.Getenv("PGDATABASE"), os.Getenv("PGUSER"))
	if password := os.Getenv("PGPASSWORD"); password != "" {
		pgConnString += fmt.Sprintf(" password=%s", password)
	}
	var db *sql.DB
	var err error
	openDB := func() error {
		db, err = sql.Open("postgres", pgConnString)
		return err
	}
	err = backoff.Retry(openDB, backoff.NewExponentialBackOff())
	return db, nil
}
