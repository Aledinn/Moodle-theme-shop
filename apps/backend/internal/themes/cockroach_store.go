package themes

import (
	"context"
	"database/sql"
	"fmt"
)

type CockroachStore struct {
	db *sql.DB
}

func NewCockroachStore(db *sql.DB) *CockroachStore {
	return &CockroachStore{db: db}
}

func (s *CockroachStore) List(ctx context.Context) ([]ThemeSummary, error) {
	const query = `SELECT id, name, site ,author, description, version FROM themes`
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list themes: %w", err)
	}
	defer rows.Close()

	summaries := make([]ThemeSummary, 0)

	for rows.Next() {
		var summary ThemeSummary
		if err := rows.Scan(&summary.Id, &summary.Name, &summary.Site, &summary.Author, &summary.Description, &summary.Version); err != nil {
			return nil, fmt.Errorf("scan theme summary: %w", err)
		}
		summaries = append(summaries, summary)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate theme summaries: %w", err)
	}

	return summaries, nil

}

func (s *CockroachStore) GetByID(ctx context.Context, id string) (Theme, error) {
	const query = `SELECT * FROM themes WHERE id = $1`
	var theme Theme
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&theme.Id,
		&theme.Name,
		&theme.Site,
		&theme.Author,
		&theme.Description,
		&theme.Version,
		&theme.Rules,
	)
	if err != nil {
		return Theme{}, fmt.Errorf("get theme by ID: %w", err)
	}
	return theme, nil
}

func (s *CockroachStore) Create(
	ctx context.Context,
	theme Theme,
) (Theme, error) {
	const query = `INSERT INTO Themes (name,site,author,description,version,rules) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`

	err := s.db.QueryRowContext(
		ctx,
		query,
		theme.Name,
		theme.Site,
		theme.Author,
		theme.Description,
		theme.Version,
		theme.Rules,
	).Scan(&theme.Id)
	if err != nil {
		return Theme{}, fmt.Errorf("create theme: %w", err)
	}

	return theme, nil
}
