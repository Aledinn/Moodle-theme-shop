package themes

var themes = []theme{
	{
		themeSummary: themeSummary{
			Id:          1,
			Name:        "Example Theme",
			Site:        "moodle.com",
			Author:      "John Doe",
			Description: "Example theme",
			Version:     "1.0.0",
		},
		Rules: []themeRule{
			{
				Selector: "body",
				Properties: map[string]string{
					"color": "blue",
				},
			},
		},
	},
	{
		themeSummary: themeSummary{
			Id:          2,
			Name:        "Dark Theme 2",
			Site:        "informatik.moodle.com",
			Author:      "Jesse",
			Description: "Dark example theme for moodle informatik",
			Version:     "1.2.3",
		},
		Rules: []themeRule{
			{
				Selector: "body",
				Properties: map[string]string{
					"background-color": "yellow",
					"color":            "purple",
				},
			},
		},
	},
}
