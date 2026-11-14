package themes

import "net/http"

// NewRouter is shared by the server and database-backed HTTP integration tests.
func NewRouter(store ThemeStore) http.Handler {
	h := NewHandler(store)
	router := http.NewServeMux()
	router.HandleFunc("/", onlyGet(HandleRoot))
	router.HandleFunc("/health", onlyGet(HandleHealth))
	router.HandleFunc("/themes", h.HandleThemes)
	router.HandleFunc("/themes/", onlyGet(h.HandleThemeByID))
	router.HandleFunc("/api/themes", h.HandleAPIThemes)
	router.HandleFunc("/api/themes/", h.HandleAPITheme)
	return router
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
