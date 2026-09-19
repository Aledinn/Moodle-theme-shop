package themes

import "encoding/json"

type Theme struct {
	ThemeSummary
	Rules json.RawMessage `json:"rules"`
}

type ThemeSummary struct {
	Id          string `json:"id"`
	Name        string `json:"name"`
	Site        string `json:"site"`
	Author      string `json:"author"`
	Description string `json:"description"`
	Version     string `json:"version"`
}
