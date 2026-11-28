package themes

import (
	"context"
	"testing"
	"time"
)

func TestCockroachReadinessSchemaLossAndRecovery(t *testing.T) {
	db := integrationDB(t)
	s := NewCockroachStore(db)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := s.CheckReady(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, "ALTER TABLE themes RENAME TO unavailable_themes"); err != nil {
		t.Fatal(err)
	}
	if err := s.CheckReady(ctx); err == nil {
		t.Fatal("ready without required schema")
	}
	if _, err := db.ExecContext(ctx, "ALTER TABLE unavailable_themes RENAME TO themes"); err != nil {
		t.Fatal(err)
	}
	if err := s.CheckReady(ctx); err != nil {
		t.Fatal(err)
	}
	expired, stop := context.WithCancel(context.Background())
	stop()
	if err := s.CheckReady(expired); err == nil {
		t.Fatal("ignored canceled context")
	}
	db.Close()
	if err := s.CheckReady(ctx); err == nil {
		t.Fatal("ready with disconnected database")
	}
}
