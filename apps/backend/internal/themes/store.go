package themes

import "context"

type ThemeStore interface {
	List(ctx context.Context) ([]ThemeSummary, error)
	ListPage(ctx context.Context, afterID string, limit int) ([]ThemeSummary, error)
	GetByID(ctx context.Context, id string) (Theme, error)
	Create(ctx context.Context, theme Theme) (Theme, error)
}
