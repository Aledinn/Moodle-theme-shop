package themes

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthHandler(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "", nil)
	w := httptest.NewRecorder()

	HandleHealth(w, r)

	result := w.Result()

	if result.StatusCode != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, result.StatusCode)
	}

	contentType := result.Header.Get("Content-Type")
	if !strings.Contains(contentType, "application/json") {
		t.Errorf("expected content type application/json, got %s", contentType)
	}

	body := w.Body.String()
	expectedBody := "{\"status\":\"ok\"}\n"
	if body != expectedBody {
		t.Errorf("expected body %s, got %s", expectedBody, body)
	}
}
