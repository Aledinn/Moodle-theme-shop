package themes

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"
)

func TestIDErrors(t *testing.T) {
	for _, prefix := range []string{"/themes/", "/api/themes/"} {
		for _, tc := range []struct {
			id     string
			status int
		}{
			{"not-an-id", 400}, {"", 400}, {"-1", 400}, {"+1", 400}, {"01", 400}, {"1.0", 400},
			{"9223372036854775808", 400}, {"0", 404}, {"42", 404}, {"9007199254740993", 404},
		} {
			t.Run(prefix+tc.id, func(t *testing.T) {
				router := NewRouter(&fakeStore{getErr: sql.ErrNoRows})
				w := httptest.NewRecorder()
				router.ServeHTTP(w, httptest.NewRequest("GET", prefix+tc.id, nil))
				if w.Code != tc.status {
					t.Fatalf("status %d, want %d", w.Code, tc.status)
				}
			})
		}
	}
}

func TestAPIErrorsAreJSON(t *testing.T) {
	store := &fakeStore{listErr: errors.New("private database failure"), getErr: errors.New("private database failure")}
	router := NewRouter(store)
	for _, tc := range []struct {
		method, path, code string
		status             int
	}{
		{"GET", "/api/themes?limit=101", "invalid_pagination", 400},
		{"GET", "/api/themes?cursor=bogus", "invalid_pagination", 400},
		{"GET", "/api/themes/not-an-id", "invalid_id", 400},
		{"GET", "/api/themes", "internal_error", 500},
		{"GET", "/api/themes/42", "internal_error", 500},
		{"GET", "/api/themes/42/download", "internal_error", 500},
		{"POST", "/api/themes", "method_not_allowed", 405},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, nil))
			if w.Code != tc.status || w.Header().Get("Content-Type") != "application/json" || w.Header().Get("Access-Control-Allow-Origin") != "*" {
				t.Fatalf("invalid error response: %v %s", w.Result(), w.Body)
			}
			var body struct {
				Error struct{ Code, Message string }
			}
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body.Error.Code != tc.code || body.Error.Message == "" || body.Error.Message == "private database failure" {
				t.Fatalf("bad error: %+v", body)
			}
		})
	}
}

func TestCursorStringRoundTrip(t *testing.T) {
	for _, id := range []string{"0", "1", "9007199254740993", "9223372036854775807"} {
		got, ok := decodeCursor(encodeCursor(id))
		if !ok || got != id {
			t.Fatalf("cursor changed %s to %s", id, got)
		}
	}
	for _, cursor := range []string{"", "v1:1", "djE6MQ==", encodeCursor("01"), encodeCursor("-1"), encodeCursor("9223372036854775808"), "djI6MQ"} {
		if _, ok := decodeCursor(cursor); ok {
			t.Fatalf("accepted invalid cursor %q", cursor)
		}
	}
}
