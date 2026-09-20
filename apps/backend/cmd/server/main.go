package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"moodle-theme-shop-backend/internal/themes"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 35*time.Second)
	defer cancel()

	db, DBerr := themes.RoachDb(ctx)
	if DBerr != nil {
		log.Fatalf("initialize database: %v", DBerr)
	}
	defer db.Close()

	store := themes.NewCockroachStore(db)
	handler := themes.NewHandler(store)

	router := http.NewServeMux()
	router.HandleFunc("/", onlyGet(themes.HandleRoot))
	router.HandleFunc("/health", onlyGet(themes.HandleHealth))
	router.HandleFunc("/themes", handler.HandleThemes)
	router.HandleFunc("/themes/", onlyGet(handler.HandleThemeByID))

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
