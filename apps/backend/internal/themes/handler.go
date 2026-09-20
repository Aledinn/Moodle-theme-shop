package themes

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/lib/pq"
)

type Handler struct {
	store ThemeStore
}

func NewHandler(store ThemeStore) *Handler {
	return &Handler{store: store}
}

func HandleRoot(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"message": "Moodle Theme Shop API"})
}

func HandleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"status": "ok"})
}

func (h *Handler) HandleThemes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.getThemes(w, r)
	case http.MethodPost:
		h.postTheme(w, r)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (h *Handler) getThemes(w http.ResponseWriter, r *http.Request) {
	summaries, err := h.store.List(r.Context())
	if err != nil {
		log.Printf("list themes :%v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, summaries)
}

func (h *Handler) HandleThemeByID(w http.ResponseWriter, r *http.Request) {
	myId := strings.TrimPrefix(r.URL.Path, "/Themes/")
	if myId == "" {
		http.NotFound(w, r)
		return
	}

	theme, err := h.store.GetByID(r.Context(), myId)
	if errors.Is(err, sql.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		log.Printf("get theme by ID: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, theme)
}

func (h *Handler) postTheme(w http.ResponseWriter, r *http.Request) {
	var theme Theme

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&theme); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	if theme.Name == "" || theme.Site == "" || theme.Author == "" {
		http.Error(w, "name, site and author are required", http.StatusBadRequest)
		return
	}

	if theme.Version == "" {
		theme.Version = "1.0"
	}

	created, err := h.store.Create(r.Context(), theme)

	if err != nil {
		log.Printf("inserting Theme: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, created)
}

func writeJSON(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(data)
}

// legacy code for Postgresql
func databasehandler() *sql.DB {
	cfg := pq.Config{
		Host:           "localhost",
		Port:           5432,
		Database:       "Themeshop",
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

func RoachDb(ctx context.Context) (*sql.DB, error) {
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
