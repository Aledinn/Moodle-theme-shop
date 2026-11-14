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

	router := themes.NewRouter(store)

	fmt.Println("listening on :8080")

	err := http.ListenAndServe(":8080", router)
	if err != nil {
		log.Fatal(err)
	}
}
