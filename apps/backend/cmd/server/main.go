package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	fmt.Println("server listening on :8080")
	http.HandleFunc("/health", handleHealth)
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		fmt.Println("Error starting server:", err)
		log.Fatal(err)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status":"ok"}`)
}
