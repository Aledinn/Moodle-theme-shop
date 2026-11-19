package themes

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"net/url"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"moodle-theme-shop-backend/internal/themecontract"
)

// Each run creates and drops its own database, never reusing development tables.
// TEST_DATABASE_URL must name a CockroachDB user allowed to create databases.
func integrationDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to run CockroachDB integration checks")
	}
	u, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	admin, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close() })
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	var version string
	if err = admin.QueryRowContext(ctx, "SELECT version()").Scan(&version); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(version, "CockroachDB") {
		t.Fatalf("expected CockroachDB, got %s", version)
	}
	name := fmt.Sprintf("theme_api_test_%d", time.Now().UnixNano())
	if _, err = admin.ExecContext(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := admin.Exec("DROP DATABASE " + name + " CASCADE"); err != nil {
			t.Error(err)
		}
	})
	u.Path = "/" + name
	db, err := sql.Open("postgres", u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	migration, err := os.ReadFile("../../migrations/001.sql")
	if err != nil {
		t.Fatal(err)
	}
	// Use the real table migration in the isolated database, without its dev DB setup.
	_, table, ok := strings.Cut(string(migration), "CREATE TABLE")
	if !ok {
		t.Fatal("table migration missing")
	}
	if _, err = db.ExecContext(ctx, "CREATE TABLE"+table); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestCockroachWebsiteAPI(t *testing.T) {
	db := integrationDB(t)
	router := NewRouter(NewCockroachStore(db))
	request := func(method, path, body string, status int) *httptest.ResponseRecorder {
		t.Helper()
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(method, path, strings.NewReader(body)))
		if w.Code != status {
			t.Fatalf("%s %s: status %d, want %d: %s", method, path, w.Code, status, w.Body.String())
		}
		return w
	}
	type page struct {
		Items []ThemeSummary `json:"items"`
		Next  *string        `json:"nextCursor"`
	}
	getPage := func(path string) page {
		t.Helper()
		w := request("GET", path, "", 200)
		var p page
		if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
			t.Fatal(err)
		}
		if p.Items == nil {
			t.Fatal("items must be an array")
		}
		return p
	}
	empty := getPage("/api/themes")
	if len(empty.Items) != 0 || empty.Next != nil {
		t.Fatalf("bad empty page: %+v", empty)
	}
	fixture, err := os.ReadFile("../../../../contracts/theme/fixtures/valid/bundled-example.json")
	if err != nil {
		t.Fatal(err)
	}
	var theme Theme
	if err = json.Unmarshal(fixture, &theme); err != nil {
		t.Fatal(err)
	}
	ids := []string{"1", "2", "10", "9007199254740993", "9223372036854775807"}
	for _, id := range []string{ids[4], ids[2], ids[0], ids[3], ids[1]} {
		_, err := db.Exec(`INSERT INTO themes (id,name,site,author,description,version,rules) VALUES ($1,$2,$3,$4,$5,$6,$7::JSONB)`, id, theme.Name, theme.Site, theme.Author, theme.Description, theme.Version, theme.Rules)
		if err != nil {
			t.Fatal(err)
		}
	}
	for _, size := range []int{1, 2, 5, 100} {
		var got []string
		path := fmt.Sprintf("/api/themes?limit=%d", size)
		for steps := 0; ; steps++ {
			if steps > len(ids) {
				t.Fatal("pagination failed to terminate")
			}
			p := getPage(path)
			for _, item := range p.Items {
				got = append(got, item.Id)
			}
			if p.Next == nil {
				break
			}
			if len(p.Items) != size {
				t.Fatal("nonterminal page is not full")
			}
			path = fmt.Sprintf("/api/themes?limit=%d&cursor=%s", size, *p.Next)
		}
		if !reflect.DeepEqual(ids, got) {
			t.Fatalf("limit %d traversal: %v", size, got)
		}
	}
	last := getPage("/api/themes?cursor=" + encodeCursor(ids[4]))
	if len(last.Items) != 0 || last.Next != nil {
		t.Fatal("expected terminal empty page")
	}
	for _, path := range []string{
		"/api/themes?limit=0", "/api/themes?limit=-1", "/api/themes?limit=101", "/api/themes?limit=1.5", "/api/themes?limit=", "/api/themes?limit=abc", "/api/themes?limit=999999999999999999999", "/api/themes?limit=1&limit=2", "/api/themes?cursor=", "/api/themes?cursor=garbage", "/api/themes?cursor=MQ", "/api/themes?cursor=" + encodeCursor("9223372036854775808"), "/api/themes?cursor=" + encodeCursor("01"), "/api/themes?cursor=%zz", "/api/themes?cursor=" + encodeCursor("1") + "&cursor=" + encodeCursor("2"),
	} {
		request("GET", path, "", 400)
	}
	for _, prefix := range []string{"/themes/", "/api/themes/"} {
		for _, id := range []string{"not-an-id", "-1", "1.0", "01", "9223372036854775808", "1/extra"} {
			request("GET", prefix+id, "", 400)
		}
		request("GET", prefix+"3", "", 404)
	}
	request("GET", "/api/themes/not-an-id/download", "", 400)
	request("GET", "/api/themes/3/download", "", 404)
	for _, path := range []string{"/api/themes", "/api/themes/1", "/api/themes/1/download"} {
		w := request("POST", path, "", 405)
		if w.Header().Get("Allow") != "GET" {
			t.Fatal("missing Allow header")
		}
	}
	for _, id := range ids {
		for _, prefix := range []string{"/themes/", "/api/themes/"} {
			w := request("GET", prefix+id, "", 200)
			var actual Theme
			if err := json.Unmarshal(w.Body.Bytes(), &actual); err != nil {
				t.Fatal(err)
			}
			theme.Id = id
			var a, b any
			expected, _ := json.Marshal(theme)
			json.Unmarshal(expected, &a)
			json.Unmarshal(w.Body.Bytes(), &b)
			if actual.Id != id || !reflect.DeepEqual(a, b) {
				t.Fatal("detail payload changed")
			}
		}
		w := request("GET", "/api/themes/"+id+"/download", "", 200)
		if err := themecontract.ValidatePortable(w.Body.Bytes()); err != nil {
			t.Fatal(err)
		}
		var a, b any
		json.Unmarshal(fixture, &a)
		json.Unmarshal(w.Body.Bytes(), &b)
		if !reflect.DeepEqual(a, b) {
			t.Fatal("download did not preserve portable fields")
		}
		if w.Header().Get("Content-Disposition") != `attachment; filename="theme-`+id+`.json"` {
			t.Fatal("unsafe filename")
		}
	}
	legacy := request("GET", "/themes", "", 200)
	var summaries []ThemeSummary
	if err := json.Unmarshal(legacy.Body.Bytes(), &summaries); err != nil || len(summaries) != len(ids) {
		t.Fatal("legacy catalog shape changed")
	}
	// The retained development upload still accepts a portable fixture and returns an ID.
	created := request("POST", "/themes", string(fixture), 201)
	var uploaded Theme
	if err := json.Unmarshal(created.Body.Bytes(), &uploaded); err != nil || !validID(uploaded.Id) {
		t.Fatal("legacy upload changed")
	}
	request("GET", "/themes/"+uploaded.Id, "", 200)
	// Even path-like, quoted metadata never influences the attachment filename.
	if _, err := db.Exec(`UPDATE themes SET name=$1 WHERE id=1`, `../a"b.json`); err != nil {
		t.Fatal(err)
	}
	safe := request("GET", "/api/themes/1/download", "", 200)
	if safe.Header().Get("Content-Disposition") != `attachment; filename="theme-1.json"` {
		t.Fatal("metadata entered filename")
	}
	// Invalid permissive development records must not produce invalid portable files.
	if _, err := db.Exec(`UPDATE themes SET site='localhost', name=$1 WHERE id=1`, "../bad\r\nname"); err != nil {
		t.Fatal(err)
	}
	invalid := request("GET", "/api/themes/1/download", "", 500)
	if invalid.Header().Get("Content-Disposition") != "" {
		t.Fatal("invalid content sent as attachment")
	}
	// Default and maximum boundaries on a catalog larger than either limit.
	for i := 100; i < 225; i++ {
		if _, err := db.Exec(`INSERT INTO themes (id,name,site,author,description,version) VALUES ($1,'Sample','example.com','Curator','','1')`, i); err != nil {
			t.Fatal(err)
		}
	}
	for _, q := range []struct {
		path  string
		count int
	}{{"/api/themes", 20}, {"/api/themes?limit=100", 100}} {
		p := getPage(q.path)
		if len(p.Items) != q.count || p.Next == nil {
			t.Fatalf("wrong page boundary for %s", q.path)
		}
	}
}
