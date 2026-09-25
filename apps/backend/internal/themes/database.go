package themes

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"github.com/cenkalti/backoff/v4"
	_ "github.com/lib/pq"
)

// legacy code for Postgresql
/*
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
*/
func RoachDb(ctx context.Context) (*sql.DB, error) {
	pgConnString := fmt.Sprintf("host=%s port=%s dbname=%s user=%s sslmode=disable",
		os.Getenv("PGHOST"), os.Getenv("PGPORT"), os.Getenv("PGDATABASE"), os.Getenv("PGUSER"))
	if password := os.Getenv("PGPASSWORD"); password != "" {
		pgConnString += fmt.Sprintf(" password=%s", password)
	}

	db, err := sql.Open("postgres", pgConnString)
	if err != nil {
		return nil, fmt.Errorf("open database :%w", err)
	}

	retryPolicy := backoff.NewExponentialBackOff()

	operation := func() error {
		return db.PingContext(ctx)
	}

	err = backoff.Retry(operation, backoff.WithContext(retryPolicy, ctx))
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("connect to database: %w", err)
	}
	return db, nil
}
