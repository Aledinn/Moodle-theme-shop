// Package server owns HTTP deadlines, readiness and the shutdown lifecycle.
package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"sync/atomic"
	"time"
)

type Config struct {
	Header, Read, Write, Idle, Request, Ready, Shutdown time.Duration
}

func LoadConfig() (Config, error) {
	c := Config{5 * time.Second, 15 * time.Second, 20 * time.Second, 60 * time.Second, 10 * time.Second, 2 * time.Second, 15 * time.Second}
	for _, setting := range []struct {
		name  string
		value *time.Duration
	}{
		{"HTTP_HEADER_TIMEOUT", &c.Header}, {"HTTP_READ_TIMEOUT", &c.Read},
		{"HTTP_WRITE_TIMEOUT", &c.Write}, {"HTTP_IDLE_TIMEOUT", &c.Idle},
		{"REQUEST_TIMEOUT", &c.Request}, {"READINESS_TIMEOUT", &c.Ready},
		{"SHUTDOWN_TIMEOUT", &c.Shutdown},
	} {
		if raw, ok := os.LookupEnv(setting.name); ok {
			d, err := time.ParseDuration(raw)
			if err != nil || d <= 0 {
				return Config{}, fmt.Errorf("%s must be a positive duration", setting.name)
			}
			*setting.value = d
		}
	}
	if c.Header > c.Read || c.Read >= c.Write || c.Request >= c.Write || c.Ready > c.Request {
		return Config{}, fmt.Errorf("require header <= read < write, readiness <= request < write timeouts")
	}
	return c, nil
}

type Server struct {
	HTTP     *http.Server
	config   Config
	stopping atomic.Bool
}

func New(c Config, app http.Handler, check func(context.Context) error) *Server {
	s := &Server{config: c}
	mux := http.NewServeMux()
	mux.Handle("GET /ready", http.TimeoutHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), c.Ready)
		defer cancel()
		if s.stopping.Load() {
			http.Error(w, "not ready", http.StatusServiceUnavailable)
			return
		}
		err := check(ctx)
		if err != nil || ctx.Err() != nil || s.stopping.Load() {
			http.Error(w, "not ready", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("{\"status\":\"ready\"}\n"))
	}), c.Ready, "not ready\n"))
	mux.Handle("/", app)
	s.HTTP = &http.Server{Addr: ":8080", ReadHeaderTimeout: c.Header, ReadTimeout: c.Read,
		WriteTimeout: c.Write, IdleTimeout: c.Idle,
		Handler: http.TimeoutHandler(mux, c.Request, "request timed out\n")}
	return s
}

// Run takes ownership of the listener and closes the datastore only after HTTP
// draining. The signal context does not cancel in-flight request contexts.
func (s *Server) Run(ctx context.Context, listener net.Listener, closeDB func() error) error {
	defer closeDB()
	served := make(chan error, 1)
	go func() { served <- s.HTTP.Serve(listener) }()
	select {
	case err := <-served:
		s.stopping.Store(true)
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		s.stopping.Store(true)
		drain, cancel := context.WithTimeout(context.Background(), s.config.Shutdown)
		defer cancel()
		err := s.HTTP.Shutdown(drain)
		if err != nil {
			s.HTTP.Close()
		}
		<-served
		return err
	}
}
