package themes

import (
	"database/sql"
	"fmt"
)

type CockroachStore struct {
	db *sql.DB
}

func newCockroachStore(db *sql.DB) *CockroachStore {
	return &CockroachStore{db: db}
}

func (s *CockroachStore) List() ([]themeSummary, error) {
	const query = `SELECT id, name, site ,author, description, version FROM themes`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("list themes: %w", err)
	}
	defer rows.Close()

	summaries := make([]themeSummary, 0)

	for rows.Next() {
		var summary themeSummary
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
