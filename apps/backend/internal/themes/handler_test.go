package themes

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeStore struct {
	listResult   []ThemeSummary
	listErr      error
	getResult    Theme
	getErr       error
	createResult Theme
	createErr    error
}

func (f *fakeStore) List(context.Context) ([]ThemeSummary, error) {
	return f.listResult, f.listErr
}

func (f *fakeStore) GetByID(context.Context, string) (Theme, error) {
	return f.getResult, f.getErr
}

func (f *fakeStore) Create(context.Context, Theme) (Theme, error) {
	return f.createResult, f.createErr
}

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

func TestHandleThemesRejectsUnsupportedMethod(t *testing.T) {
	r := httptest.NewRequest(http.MethodDelete, "/themes", nil)
	w := httptest.NewRecorder()

	handler := NewHandler(&fakeStore{})
	handler.HandleThemes(w, r)

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status %d, got %d", http.StatusMethodNotAllowed, w.Code)
	}
}

func TestHandleThemesRejectsInvalidJSON(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/themes", strings.NewReader("{"))
	w := httptest.NewRecorder()

	handler := NewHandler(&fakeStore{})
	handler.HandleThemes(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}
