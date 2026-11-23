package themes

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"

	"moodle-theme-shop-backend/internal/themecontract"
)

type Handler struct {
	store ThemeStore
}

func NewHandler(store ThemeStore) *Handler {
	return &Handler{store: store}
}

func HandleRoot(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "Moodle Theme Shop API"})
}

func HandleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
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
	writeJSON(w, http.StatusOK, summaries)
}

func (h *Handler) HandleThemeByID(w http.ResponseWriter, r *http.Request) {
	myID := strings.TrimPrefix(r.URL.Path, "/themes/")
	if !validID(myID) {
		apiError(w, http.StatusBadRequest, "invalid_id", "id must be a canonical nonnegative INT8 decimal string")
		return
	}

	theme, err := h.store.GetByID(r.Context(), myID)
	if errors.Is(err, sql.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		log.Printf("get theme by ID: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, theme)
}

func (h *Handler) postTheme(w http.ResponseWriter, r *http.Request) {
	// Bound the entire stream, including trailing whitespace/JSON, before parsing.
	r.Body = http.MaxBytesReader(w, r.Body, themecontract.MaxBytes)
	data, err := io.ReadAll(r.Body)
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			http.Error(w, "theme exceeds 256 KiB", http.StatusRequestEntityTooLarge)
		} else {
			http.Error(w, "unable to read theme body", http.StatusBadRequest)
		}
		return
	}
	if err := themecontract.ValidatePortable(data); err != nil {
		http.Error(w, "invalid theme: "+err.Error(), http.StatusBadRequest)
		return
	}
	var theme Theme
	if err := json.Unmarshal(data, &theme); err != nil {
		http.Error(w, "invalid theme body", http.StatusBadRequest)
		return
	}

	created, err := h.store.Create(r.Context(), theme)

	if err != nil {
		log.Printf("inserting Theme: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("encode JSON response: %v", err)
	}
}
