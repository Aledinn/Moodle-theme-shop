package themes

var themes = []theme{}

type ThemeStore interface {
	List() ([]themeSummary, error)
}
