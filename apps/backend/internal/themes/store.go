package themes

import "context"

type ThemeStore interface {
	List(ctx context.Context) ([]ThemeSummary, error)
	GetByID(ctx context.Context, id string) (Theme, error)
	Create(ctx context.Context, theme Theme) (Theme, error)
}
