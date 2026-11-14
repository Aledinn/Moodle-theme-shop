package themecontract

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"moodle-theme-shop-backend/internal/themes"
)

func TestSharedFixtures(t *testing.T) {
	root := filepath.Join("..", "..", "..", "..", "contracts", "theme")
	read := func(path string) []byte {
		t.Helper()
		data, err := os.ReadFile(filepath.Join(root, path))
		if err != nil {
			t.Fatal(err)
		}
		return data
	}
	validators := map[string]*Validator{}
	for kind, file := range map[string]string{"portable": "portable.schema.json", "api": "api-summary.schema.json"} {
		v, err := New(read(file))
		if err != nil {
			t.Fatal(err)
		}
		validators[kind] = v
	}
	var manifest struct {
		Cases []struct {
			File, Kind string
			Valid      bool
		}
	}
	if err := json.Unmarshal(read("fixtures/manifest.json"), &manifest); err != nil {
		t.Fatal(err)
	}
	if len(manifest.Cases) == 0 {
		t.Fatal("empty shared manifest")
	}
	listed := map[string]bool{}
	for _, c := range manifest.Cases {
		listed[filepath.FromSlash(c.File)] = true
		t.Run(c.File, func(t *testing.T) {
			data := read(c.File)
			original := bytes.Clone(data)
			if err := validators[c.Kind].Validate(data); (err == nil) != c.Valid {
				t.Fatalf("valid=%v, error=%v", c.Valid, err)
			}
			if !bytes.Equal(data, original) {
				t.Fatal("input was rewritten")
			}
		})
	}
	// New files cannot silently escape the shared test suite.
	err := filepath.WalkDir(filepath.Join(root, "fixtures"), func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() && entry.Name() != "manifest.json" {
			rel, _ := filepath.Rel(root, path)
			if !listed[rel] {
				t.Errorf("fixture missing from manifest: %s", rel)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	// Exercise the real API metadata model, not only a generic JSON map.
	var summary themes.ThemeSummary
	if err := json.Unmarshal(read("fixtures/api/large-string-id.json"), &summary); err != nil {
		t.Fatal(err)
	}
	if summary.Id != "9007199254740993" {
		t.Fatal("ID changed")
	}
	encoded, err := json.Marshal(summary)
	if err != nil {
		t.Fatal(err)
	}
	if err := validators["api"].Validate(encoded); err != nil {
		t.Fatal(err)
	}
	data := read("fixtures/valid/editor-export.json")
	boundary := append(bytes.Clone(data), bytes.Repeat([]byte(" "), MaxBytes-len(data))...)
	if err := validators["portable"].Validate(boundary); err != nil {
		t.Fatal(err)
	}
	if err := validators["portable"].Validate(append(boundary, ' ')); err == nil {
		t.Fatal("accepted 256 KiB + 1 byte")
	}
}
