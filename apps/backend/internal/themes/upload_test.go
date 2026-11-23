package themes

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"

	"moodle-theme-shop-backend/internal/themecontract"
)

type uploadCase struct {
	name   string
	body   []byte
	status int
}

// Exercise the shared manifest through the real HTTP write boundary as well as
// the isolated validator. API summaries are not valid upload objects either.
func uploadCases(t *testing.T) []uploadCase {
	t.Helper()
	root := "../../../../contracts/theme"
	data, err := os.ReadFile(filepath.Join(root, "fixtures/manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	var manifest struct {
		Cases []struct {
			File, Kind string
			Valid      bool
		}
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		t.Fatal(err)
	}
	var cases []uploadCase
	for _, fixture := range manifest.Cases {
		body, err := os.ReadFile(filepath.Join(root, fixture.File))
		if err != nil {
			t.Fatal(err)
		}
		status := http.StatusBadRequest
		if fixture.Kind == "portable" && fixture.Valid {
			status = http.StatusCreated
		}
		if len(body) > themecontract.MaxBytes {
			status = http.StatusRequestEntityTooLarge
		}
		cases = append(cases, uploadCase{fixture.File, body, status})
	}
	valid, err := os.ReadFile(filepath.Join(root, "fixtures/valid/editor-export.json"))
	if err != nil {
		t.Fatal(err)
	}
	boundary := append(bytes.Clone(valid), bytes.Repeat([]byte(" "), themecontract.MaxBytes-len(valid))...)
	cases = append(cases,
		uploadCase{"exact byte limit", boundary, http.StatusCreated},
		uploadCase{"one byte over limit", append(bytes.Clone(boundary), ' '), http.StatusRequestEntityTooLarge},
		uploadCase{"trailing garbage", append(bytes.Clone(valid), 'x'), http.StatusBadRequest},
		uploadCase{"empty body", nil, http.StatusBadRequest},
		uploadCase{"null object", []byte("null"), http.StatusBadRequest},
	)
	return cases
}

type uploadStore struct {
	ThemeStore
	calls int
	input Theme
	err   error
}

func (s *uploadStore) Create(_ context.Context, theme Theme) (Theme, error) {
	s.calls++
	s.input = theme
	theme.Id = "9007199254740993"
	return theme, s.err
}

func TestUploadContract(t *testing.T) {
	for _, tc := range uploadCases(t) {
		for _, streaming := range []bool{false, true} {
			t.Run(tc.name+"/streaming="+strconv.FormatBool(streaming), func(t *testing.T) {
				store := &uploadStore{}
				r := httptest.NewRequest(http.MethodPost, "/themes", bytes.NewReader(tc.body))
				if streaming {
					r.ContentLength = -1
					r.TransferEncoding = []string{"chunked"}
				}
				w := httptest.NewRecorder()
				NewRouter(store).ServeHTTP(w, r)
				if w.Code != tc.status {
					t.Fatalf("status %d, want %d: %s", w.Code, tc.status, w.Body)
				}
				if tc.status != http.StatusCreated {
					if store.calls != 0 {
						t.Fatal("invalid input reached database write")
					}
					if strings.TrimSpace(w.Body.String()) == "" {
						t.Fatal("missing client error")
					}
					return
				}
				if store.calls != 1 {
					t.Fatalf("Create called %d times", store.calls)
				}
				expected := map[string]any{}
				if err := json.Unmarshal(tc.body, &expected); err != nil {
					t.Fatal(err)
				}
				stored, _ := json.Marshal(store.input)
				var actual map[string]any
				json.Unmarshal(stored, &actual)
				delete(actual, "id")
				if !reflect.DeepEqual(actual, expected) {
					t.Fatal("upload changed portable fields")
				}
				expected["id"] = "9007199254740993"
				json.Unmarshal(w.Body.Bytes(), &actual)
				if !reflect.DeepEqual(actual, expected) {
					t.Fatal("created response shape or values changed")
				}
			})
		}
	}
}

type failedUploadReader struct{}

func (failedUploadReader) Read([]byte) (int, error) { return 0, errors.New("private read failure") }

func TestUploadReadFailure(t *testing.T) {
	store := &uploadStore{}
	w := httptest.NewRecorder()
	NewRouter(store).ServeHTTP(w, httptest.NewRequest("POST", "/themes", failedUploadReader{}))
	if w.Code != 400 || store.calls != 0 || strings.Contains(w.Body.String(), "private") {
		t.Fatalf("unsafe read failure: %d %s", w.Code, w.Body)
	}
}

func TestUploadStoreFailure(t *testing.T) {
	store := &uploadStore{err: errors.New("private database failure")}
	w := httptest.NewRecorder()
	body, err := os.ReadFile("../../../../contracts/theme/fixtures/valid/editor-export.json")
	if err != nil {
		t.Fatal(err)
	}
	NewRouter(store).ServeHTTP(w, httptest.NewRequest("POST", "/themes", bytes.NewReader(body)))
	if w.Code != 500 || store.calls != 1 || strings.Contains(w.Body.String(), "private") {
		t.Fatalf("unsafe database failure: %d %s", w.Code, w.Body)
	}
}

func TestUploadBoundsStreamRead(t *testing.T) {
	// A reader with no EOF must be stopped after the limit plus one probe byte.
	reader := &countingUploadReader{}
	store := &uploadStore{}
	w := httptest.NewRecorder()
	NewRouter(store).ServeHTTP(w, httptest.NewRequest("POST", "/themes", reader))
	if w.Code != 413 || store.calls != 0 || reader.count != themecontract.MaxBytes+1 {
		t.Fatalf("unbounded read: status=%d bytes=%d", w.Code, reader.count)
	}
}

type countingUploadReader struct{ count int }

func (r *countingUploadReader) Read(p []byte) (int, error) {
	for i := range p {
		p[i] = ' '
	}
	r.count += len(p)
	return len(p), nil
}

func TestCockroachUploadContract(t *testing.T) {
	db := integrationDB(t)
	router := NewRouter(NewCockroachStore(db))
	for _, tc := range uploadCases(t) {
		t.Run(tc.name, func(t *testing.T) {
			var before, after int
			if err := db.QueryRow("SELECT count(*) FROM themes").Scan(&before); err != nil {
				t.Fatal(err)
			}
			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest("POST", "/themes", bytes.NewReader(tc.body)))
			if w.Code != tc.status {
				t.Fatalf("status %d, want %d: %s", w.Code, tc.status, w.Body)
			}
			if err := db.QueryRow("SELECT count(*) FROM themes").Scan(&after); err != nil {
				t.Fatal(err)
			}
			if tc.status != http.StatusCreated {
				if after != before {
					t.Fatal("rejected upload inserted a row")
				}
				return
			}
			if after != before+1 {
				t.Fatal("valid upload did not insert exactly one row")
			}
			var created Theme
			if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
				t.Fatal(err)
			}
			get := httptest.NewRecorder()
			router.ServeHTTP(get, httptest.NewRequest("GET", "/api/themes/"+created.Id+"/download", nil))
			if get.Code != 200 {
				t.Fatalf("download failed: %d %s", get.Code, get.Body)
			}
			var expected, actual any
			json.Unmarshal(tc.body, &expected)
			json.Unmarshal(get.Body.Bytes(), &actual)
			if !reflect.DeepEqual(actual, expected) {
				t.Fatal("database round-trip changed portable fields")
			}
		})
	}
}
