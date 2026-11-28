package main

import (
	"context"
	"log"
	"net"
	"os/signal"
	"syscall"
	"time"

	"moodle-theme-shop-backend/internal/server"
	"moodle-theme-shop-backend/internal/themes"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	config, err := server.LoadConfig()
	if err != nil {
		return err
	}
	signals, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(signals, 35*time.Second)
	defer cancel()

	db, DBerr := themes.RoachDb(ctx)
	if DBerr != nil {
		return DBerr
	}

	store := themes.NewCockroachStore(db)

	router := themes.NewRouter(store)

	s := server.New(config, router, store.CheckReady)
	listener, err := net.Listen("tcp", s.HTTP.Addr)
	if err != nil {
		db.Close()
		return err
	}
	log.Printf("listening on %s", listener.Addr())
	return s.Run(signals, listener, db.Close)
}
