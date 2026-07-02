package themes

type theme struct {
	themeSummary
	Rules []themeRule `json:"rules"`
}

type themeSummary struct {
	Id          int    `json:"id"`
	Name        string `json:"name"`
	Site        string `json:"site"`
	Author      string `json:"author"`
	Description string `json:"description"`
	Version     string `json:"version"`
}

type themeRule struct {
	Selector   string            `json:"selector"`
	Properties map[string]string `json:"properties"`
}
