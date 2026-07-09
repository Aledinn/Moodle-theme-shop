package themes

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthHandler(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/health", nil)
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

func TestHandleThemes(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/themes", nil)
	w := httptest.NewRecorder()

	HandleThemes(w, r)

	result := w.Result()
	if result.StatusCode != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, result.StatusCode)
	}

	body := w.Body.String()
	if strings.Contains(body, "rules") {
		t.Errorf("HandleThemes should not contain rules")
	}
}

func TestHandleThemeByIDReturnsFullTheme(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/themes/1", nil)
	w := httptest.NewRecorder()
	HandleThemeByID(w, r)

	result := w.Result()
	if result.StatusCode != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, result.StatusCode)
	}

	body := w.Body.String()
	if !strings.Contains(body, "rules") {
		t.Errorf("HandleThemeById should return theme with rules")
	}
}

// temporary extreme value for testing, logic will be changed later
func TestHandleThemeByIDReturnsNotFound(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/themes/9999999999999999999999999999999", nil)
	w := httptest.NewRecorder()
	HandleThemeByID(w, r)

	result := w.Result()
	if result.StatusCode != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, result.StatusCode)
	}
}
