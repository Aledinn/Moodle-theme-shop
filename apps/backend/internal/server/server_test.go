package server

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func testConfig(t *testing.T) Config {
	t.Helper()
	c, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestReadinessAndRequestDeadlines(t *testing.T) {
	c := testConfig(t)
	c.Ready = 20 * time.Millisecond
	c.Request = 50 * time.Millisecond
	var state atomic.Int32
	release := make(chan struct{})
	defer close(release)
	app := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			w.WriteHeader(200)
			return
		}
		<-r.Context().Done()
		<-release // A stalled datastore must not hold the HTTP response open.
	})
	s := New(c, app, func(ctx context.Context) error {
		switch state.Load() {
		case 1:
			return errors.New("private database diagnostic")
		case 2:
			<-ctx.Done()
			return ctx.Err()
		}
		return nil
	})
	for _, step := range []struct {
		state  int32
		path   string
		status int
	}{
		{0, "/ready", 200}, {1, "/ready", 503}, {1, "/health", 200},
		{2, "/ready", 503}, {0, "/ready", 200}, {0, "/themes", 503},
	} {
		state.Store(step.state)
		w := httptest.NewRecorder()
		start := time.Now()
		s.HTTP.Handler.ServeHTTP(w, httptest.NewRequest("GET", step.path, nil))
		if w.Code != step.status {
			t.Fatalf("%s: %d", step.path, w.Code)
		}
		if time.Since(start) > time.Second {
			t.Fatal("unbounded check")
		}
		if step.status == 503 && step.path == "/ready" && w.Body.String() != "not ready\n" {
			t.Fatalf("leaked error: %s", w.Body)
		}
	}
	s.stopping.Store(true)
	w := httptest.NewRecorder()
	s.HTTP.Handler.ServeHTTP(w, httptest.NewRequest("GET", "/ready", nil))
	if w.Code != 503 {
		t.Fatal("ready while shutting down")
	}
}

func TestShutdownDrainsBeforeClosingDatabase(t *testing.T) {
	c := testConfig(t)
	started, release, finished := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var closed atomic.Bool
	s := New(c, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		select {
		case <-r.Context().Done():
			t.Error("signal canceled in-flight request")
		case <-release:
		}
		if closed.Load() {
			t.Error("database closed before handler drained")
		}
		w.Write([]byte("complete"))
		close(finished)
	}), func(context.Context) error { return nil })
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, stop := context.WithCancel(context.Background())
	defer stop()
	done := make(chan error, 1)
	go func() { done <- s.Run(ctx, listener, func() error { closed.Store(true); return nil }) }()
	response := make(chan string, 1)
	go func() {
		client := &http.Client{Timeout: 3 * time.Second}
		r, err := client.Get("http://" + listener.Addr().String() + "/themes")
		if err != nil {
			response <- err.Error()
			return
		}
		defer r.Body.Close()
		body, _ := io.ReadAll(r.Body)
		response <- string(body)
	}()
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("request did not start")
	}
	stop()
	deadline := time.Now().Add(time.Second)
	for !s.stopping.Load() && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	w := httptest.NewRecorder()
	s.HTTP.Handler.ServeHTTP(w, httptest.NewRequest("GET", "/ready", nil))
	if w.Code != 503 || closed.Load() {
		t.Error("shutdown readiness/order")
	}
	close(release)
	if got := <-response; got != "complete" {
		t.Errorf("response: %s", got)
	}
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("shutdown hung")
	}
	<-finished
	if !closed.Load() {
		t.Fatal("database not closed")
	}
}

func TestShutdownDeadline(t *testing.T) {
	c := testConfig(t)
	c.Shutdown = 30 * time.Millisecond
	started, canceled := make(chan struct{}), make(chan struct{})
	s := New(c, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-r.Context().Done()
		close(canceled)
	}), func(context.Context) error { return nil })
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, stop := context.WithCancel(context.Background())
	defer stop()
	done := make(chan error, 1)
	go func() { done <- s.Run(ctx, listener, func() error { return nil }) }()
	go func() {
		r, err := http.Get("http://" + listener.Addr().String())
		if err == nil {
			r.Body.Close()
		}
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("request did not start")
	}
	stop()
	select {
	case err := <-done:
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("shutdown: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("shutdown not bounded")
	}
	select {
	case <-canceled:
	case <-time.After(time.Second):
		t.Fatal("connection not canceled")
	}
}

func TestConfiguration(t *testing.T) {
	for _, value := range []string{"", "0", "-1s", "oops", "30s"} {
		t.Run(value, func(t *testing.T) {
			t.Setenv("REQUEST_TIMEOUT", value)
			if _, err := LoadConfig(); err == nil {
				t.Fatal("accepted invalid/inconsistent timeout")
			}
		})
	}
	t.Setenv("READINESS_TIMEOUT", "250ms")
	c, err := LoadConfig()
	if err != nil || c.Ready != 250*time.Millisecond {
		t.Fatalf("override: %+v %v", c, err)
	}
}
