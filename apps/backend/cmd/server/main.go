package main

import (
	"fmt"
	"log"
	"net/http"

	"moodle-theme-shop-backend/internal/themes"
)

func main() {
	router := http.NewServeMux()
	router.HandleFunc("/", onlyGet(themes.HandleRoot))
	router.HandleFunc("/health", onlyGet(themes.HandleHealth))
	router.HandleFunc("/themes", onlyGet(themes.HandleThemes))
	router.HandleFunc("/themes/", onlyGet(themes.HandleThemeByID))

	fmt.Println("listening on :8080")

	err := http.ListenAndServe(":8080", router)
	if err != nil {
		log.Fatal(err)
	}
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
