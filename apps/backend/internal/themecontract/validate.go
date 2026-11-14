// Package themecontract checks the shared portable/API schemas. It is deliberately
// independent of HTTP and storage; integrating consumers is separate work.
package themecontract

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"unicode/utf8"

	"github.com/xeipuuv/gojsonschema"
)

const MaxBytes = 256 * 1024

type Validator struct{ schema *gojsonschema.Schema }

func New(schema []byte) (*Validator, error) {
	s, err := gojsonschema.NewSchema(gojsonschema.NewBytesLoader(schema))
	if err != nil {
		return nil, err
	}
	return &Validator{schema: s}, nil
}

// Validate rejects unsupported input without defaulting, stripping, or rewriting.
// Browser consumers must additionally parse selectors in the browser before use.
func (v *Validator) Validate(data []byte) error {
	if len(data) > MaxBytes {
		return fmt.Errorf("theme exceeds 256 KiB")
	}
	if !utf8.Valid(data) || bytes.HasPrefix(data, []byte{0xef, 0xbb, 0xbf}) {
		return fmt.Errorf("expected UTF-8 JSON without BOM")
	}
	if err := validUnicodeEscapes(data); err != nil {
		return err
	}
	d := json.NewDecoder(bytes.NewReader(data))
	d.UseNumber()
	if err := uniqueValue(d, 0); err != nil {
		return err
	}
	if _, err := d.Token(); err != io.EOF {
		return fmt.Errorf("expected exactly one JSON value")
	}
	result, err := v.schema.Validate(gojsonschema.NewBytesLoader(data))
	if err != nil {
		return err
	}
	if !result.Valid() {
		return fmt.Errorf("contract violation: %v", result.Errors())
	}
	return nil
}

// encoding/json otherwise replaces isolated surrogate escapes with U+FFFD.
func validUnicodeEscapes(data []byte) error {
	for i := 0; i < len(data); i++ {
		if data[i] != '\\' {
			continue
		}
		i++
		if i >= len(data) || data[i] != 'u' {
			continue
		}
		if i+4 >= len(data) {
			return fmt.Errorf("invalid Unicode escape")
		}
		code, err := strconv.ParseUint(string(data[i+1:i+5]), 16, 16)
		if err != nil {
			return err
		}
		i += 4
		if code >= 0xdc00 && code <= 0xdfff {
			return fmt.Errorf("isolated low surrogate")
		}
		if code < 0xd800 || code > 0xdbff {
			continue
		}
		if i+6 >= len(data) || data[i+1] != '\\' || data[i+2] != 'u' {
			return fmt.Errorf("isolated high surrogate")
		}
		low, err := strconv.ParseUint(string(data[i+3:i+7]), 16, 16)
		if err != nil || low < 0xdc00 || low > 0xdfff {
			return fmt.Errorf("invalid surrogate pair")
		}
		i += 6
	}
	return nil
}

func uniqueValue(d *json.Decoder, depth int) error {
	if depth > 32 {
		return fmt.Errorf("JSON nesting exceeds 32")
	}
	token, err := d.Token()
	if err != nil {
		return err
	}
	switch token {
	case json.Delim('{'):
		seen := map[string]bool{}
		for d.More() {
			key, err := d.Token()
			if err != nil {
				return err
			}
			name, ok := key.(string)
			if !ok || seen[name] {
				return fmt.Errorf("duplicate or invalid JSON field")
			}
			seen[name] = true
			if err := uniqueValue(d, depth+1); err != nil {
				return err
			}
		}
		end, err := d.Token()
		if err != nil || end != json.Delim('}') {
			return fmt.Errorf("invalid JSON object")
		}
	case json.Delim('['):
		for d.More() {
			if err := uniqueValue(d, depth+1); err != nil {
				return err
			}
		}
		end, err := d.Token()
		if err != nil || end != json.Delim(']') {
			return fmt.Errorf("invalid JSON array")
		}
	case json.Delim('}'), json.Delim(']'):
		return fmt.Errorf("unexpected JSON delimiter")
	}
	return nil
}
