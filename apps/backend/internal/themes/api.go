package themes

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"moodle-theme-shop-backend/internal/themecontract"
)

const DefaultPageSize = 20
const MaxPageSize = 100

// IDs remain strings, including validation against CockroachDB's INT8 range.
func validID(id string) bool {
	if id == "" || len(id) > 19 || (len(id) > 1 && id[0] == '0') {
		return false
	}
	for _, c := range id {
		if c < '0' || c > '9' {
			return false
		}
	}
	return len(id) < 19 || id <= "9223372036854775807"
}

func encodeCursor(id string) string {
	return base64.RawURLEncoding.EncodeToString([]byte("v1:" + id))
}

func decodeCursor(cursor string) (string, bool) {
	if len(cursor) > 32 {
		return "", false
	}
	data, err := base64.RawURLEncoding.Strict().DecodeString(cursor)
	id, ok := strings.CutPrefix(string(data), "v1:")
	return id, err == nil && ok && validID(id) && encodeCursor(id) == cursor
}

func apiError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}

func apiGet(w http.ResponseWriter, r *http.Request) bool {
	if r.Method == http.MethodGet {
		return true
	}
	w.Header().Set("Allow", "GET")
	apiError(w, http.StatusMethodNotAllowed, "method_not_allowed", "only GET is supported")
	return false
}

func (h *Handler) HandleAPIThemes(w http.ResponseWriter, r *http.Request) {
	if !apiGet(w, r) {
		return
	}
	query, err := parsePage(r)
	if err != nil {
		apiError(w, 400, "invalid_pagination", err.Error())
		return
	}
	items, err := h.store.ListPage(r.Context(), query.after, query.limit+1)
	if err != nil {
		log.Printf("list theme page: %v", err)
		apiError(w, 500, "internal_error", "unable to list themes")
		return
	}
	var next *string
	if len(items) > query.limit {
		cursor := encodeCursor(items[query.limit-1].Id)
		next = &cursor
		items = items[:query.limit]
	}
	if items == nil {
		items = []ThemeSummary{}
	}
	writeJSON(w, 200, struct {
		Items      []ThemeSummary `json:"items"`
		NextCursor *string        `json:"nextCursor"`
	}{items, next})
}

type pageQuery struct {
	after string
	limit int
}

func parsePage(r *http.Request) (pageQuery, error) {
	q := pageQuery{limit: DefaultPageSize}
	values, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		return q, err
	}
	if limits, ok := values["limit"]; ok {
		if len(limits) != 1 || limits[0] == "" {
			return q, errors.New("limit must be an integer from 1 to 100")
		}
		for _, c := range limits[0] {
			if c < '0' || c > '9' {
				return q, errors.New("limit must be an integer from 1 to 100")
			}
		}
		q.limit, err = strconv.Atoi(limits[0])
		if err != nil || q.limit < 1 || q.limit > MaxPageSize {
			return q, errors.New("limit must be an integer from 1 to 100")
		}
	}
	if cursors, ok := values["cursor"]; ok {
		if len(cursors) != 1 {
			return q, errors.New("cursor must be a valid continuation token")
		}
		var valid bool
		q.after, valid = decodeCursor(cursors[0])
		if !valid {
			return q, errors.New("cursor must be a valid continuation token")
		}
	}
	return q, nil
}

func (h *Handler) HandleAPITheme(w http.ResponseWriter, r *http.Request) {
	if !apiGet(w, r) {
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/themes/")
	id, download := strings.CutSuffix(path, "/download")
	if !validID(id) {
		apiError(w, 400, "invalid_id", "id must be a canonical nonnegative INT8 decimal string")
		return
	}
	theme, err := h.store.GetByID(r.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		apiError(w, 404, "theme_not_found", "theme not found")
		return
	}
	if err != nil {
		log.Printf("get API theme: %v", err)
		apiError(w, 500, "internal_error", "unable to load theme")
		return
	}
	if !download {
		writeJSON(w, 200, theme)
		return
	}
	// Explicit projection prevents database/API fields from entering portable files.
	portable := struct {
		Name        string          `json:"name"`
		Site        string          `json:"site"`
		Author      string          `json:"author"`
		Description string          `json:"description"`
		Version     string          `json:"version"`
		Rules       json.RawMessage `json:"rules"`
	}{theme.Name, theme.Site, theme.Author, theme.Description, theme.Version, theme.Rules}
	data, err := json.Marshal(portable)
	if err == nil {
		err = themecontract.ValidatePortable(data)
	}
	if err != nil {
		log.Printf("invalid portable theme %s: %v", id, err)
		apiError(w, 500, "invalid_theme", "stored theme cannot be downloaded as a portable theme")
		return
	}
	// The filename never incorporates untrusted theme metadata or path characters.
	w.Header().Set("Content-Disposition", `attachment; filename="theme-`+id+`.json"`)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(200)
	_, _ = w.Write(data)
}
