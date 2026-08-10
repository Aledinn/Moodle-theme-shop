package themes
import "encoding/json"

type theme struct {
	themeSummary
	Rules json.RawMessage `json:"rules"`
}

type themeSummary struct {
	Id          int    `json:"id"`
	Name        string `json:"name"`
	Site        string `json:"site"`
	Author      string `json:"author"`
	Description string `json:"description"`
	Version     string `json:"version"`
}