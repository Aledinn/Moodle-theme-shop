import { useCallback, useEffect, useRef, useState } from "react";
import { listThemes } from "./api";
import { useRequest } from "./useRequest";
import { ThemeDetails } from "./ThemeDetails";
import {
  defaultFilters,
  designSamples,
  filterThemes,
  fromApi,
  popularityBands,
} from "./catalog";
import type { Filters } from "./catalog";

export function App() {
  const match = /^\/themes\/([^/]+)\/?$/.exec(window.location.pathname);
  if (!match) return <CatalogApp />;
  try {
    const id = decodeURIComponent(match[1]);
    return <ThemeDetails key={id} id={id} />;
  } catch {
    return <main className="theme-details"><h1>Invalid theme URL</h1><a href="/">Back to theme catalog</a></main>;
  }
}

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <img
      className={className}
      src={`/design/icons/${name}.svg`}
      alt=""
      aria-hidden="true"
    />
  );
}

function InfoDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="info-dialog"
      aria-labelledby="dialog-title"
      onClose={onClose}
    >
      <h2 id="dialog-title">{title}</h2>
      {children}
      <button className="download-button" onClick={() => ref.current?.close()}>
        Close
      </button>
    </dialog>
  );
}

export function CatalogApp() {
  const sample =
    new URLSearchParams(window.location.search).get("preview") === "design";
  const [filters, setFilters] = useState(() => defaultFilters(sample));
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState("grid");
  const [perPage, setPerPage] = useState(12);
  const [traversal, setTraversal] = useState(0);
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [attempt, setAttempt] = useState(0);
  const navigating = useRef(false);
  const [dialog, setDialog] = useState<{
    title: string;
    body: React.ReactNode;
  } | null>(null);
  const cursor = cursors[page];
  const load = useCallback(
    (signal: AbortSignal) =>
      sample
        ? Promise.resolve({ items: [], nextCursor: null, page: 0, traversal })
        : listThemes({ limit: perPage, cursor, signal })
            .then((data) => ({ ...data, page, traversal }))
            .finally(() => {
              if (!signal.aborted) navigating.current = false;
            }),
    [sample, perPage, cursor, page, attempt, traversal],
  );
  const state = useRequest(load, true);
  // A new page size starts a new traversal; old cursors/data belong to the old size.
  const data = state.data?.traversal === traversal ? state.data : undefined;
  const displayedPage = sample ? page : (data?.page ?? 0);
  const themes = sample
    ? designSamples
    : data
      ? data.items.map(fromApi)
      : [];
  const filtered = filterThemes(themes, filters);
  const visible = sample
    ? filtered.slice(page * perPage, (page + 1) * perPage)
    : filtered;
  const institutions = [
    ...new Set(themes.map((theme) => theme.institution)),
  ].sort((a, b) => a.localeCompare(b));
  const topInstitutions = [...institutions].sort((a, b) => {
    const count = (name: string) =>
      themes
        .filter((theme) => theme.institution === name)
        .reduce((sum, theme) => sum + (theme.downloads ?? 1), 0);
    return count(b) - count(a);
  });
  const totalPages = sample
    ? Math.max(1, Math.ceil(filtered.length / perPage))
    : cursors.length;
  // Keep the current page and its neighbours within a compact mobile control.
  const firstPageButton = Math.min(
    Math.max(displayedPage - 1, 0),
    Math.max(totalPages - 3, 0),
  );
  const pageButtons = Array.from(
    { length: Math.min(totalPages, 3) },
    (_, offset) => firstPageButton + offset,
  );
  const hasNext = sample
    ? page + 1 < totalPages
    : !!data && data.nextCursor !== null;
  const busy = !sample && state.status === "loading";
  const updateFilters = (patch: Partial<Filters>) => {
    setFilters((previous) => ({ ...previous, ...patch }));
    if (sample) setPage(0);
  };
  const toggle = (values: string[], value: string) =>
    values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  const goToPage = (index: number) => {
    if (busy || navigating.current || index === displayedPage) return;
    navigating.current = !sample;
    setPage(index);
    setAttempt((value) => value + 1);
  };
  const next = () => {
    if (!hasNext || busy || navigating.current) return;
    if (!sample && data?.nextCursor) {
      setCursors((previous) => [
        ...previous.slice(0, displayedPage + 1),
        data.nextCursor!,
      ]);
    }
    goToPage(displayedPage + 1);
  };
  const guide = () =>
    setDialog({
      title: "How themes work",
      body: (
        <>
          <p>
            Browse themes for your Moodle site. The browser extension applies
            them locally in your browser.
          </p>
          <p>
            For the local extension, build <code>apps/extension</code>, then
            load its <code>dist</code> folder using Developer mode at{" "}
            <code>chrome://extensions</code>.
          </p>
          <p>
            Open a theme’s details page to download its JSON file and read setup
            instructions. JSON file import in the extension is still in development.
            Always check the supported hostname before applying a theme.
          </p>
        </>
      ),
    });

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to themes
      </a>
      <header className="masthead" id="top">
        <a
          className="brand"
          href={sample ? "/?preview=design" : "/"}
          aria-label="Moodle Theme Marketplace home"
        >
          <img
            className="brand__mark"
            src="/design/brand/logo-mark.svg"
            alt=""
          />
          <span className="brand__title">
            MOODLE THEME
            <br />
            MARKETPLACE
          </span>
        </a>
        <div className="masthead__descriptor">
          BROWSER
          <br />
          EXTENSION
        </div>
        <nav className="masthead__nav" aria-label="Main navigation">
          <a
            className={!filters.featured ? "nav-active" : ""}
            href="#catalog"
            onClick={() => updateFilters({ featured: false })}
          >
            THEMES
          </a>
          {sample && (
            <button
              className={filters.featured ? "nav-active" : ""}
              onClick={() => updateFilters({ featured: !filters.featured })}
              aria-pressed={filters.featured}
            >
              CURATED
            </button>
          )}
          <button onClick={guide}>HOW IT WORKS</button>
          <button onClick={guide}>GUIDES</button>
        </nav>
        <a className="saved-link" href={sample ? "/" : "/?preview=design"}>
          <Icon name="star" />
          {sample ? "LIVE CATALOG" : "DESIGN SAMPLES"}
        </a>
        <button
          className="masthead__external"
          onClick={guide}
          aria-label="About the browser extension"
        >
          <Icon name="external-link" />
        </button>
      </header>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__copy">
          <h1 id="hero-title">
            THE MOODLE <br />
            THEME ARCHIVE
          </h1>
          <p>
            A COLLECTION OF THEMES FOR MOODLE.
            <br />
            BROWSE THEMES FOR YOUR BROWSER EXTENSION.
          </p>
        </div>
        <div className="hero__visual" aria-hidden="true">
          <img
            className="hero__building"
            src="/design/hero/university-collage-reference-crop.png"
            alt=""
          />
          <div className="hero__slash" />
          <div className="hero__keywords">
            UNIVERSITY
            <br />
            THEMES
            <br />
            COURSE DESIGNS
            <br />
            COMMUNITY
            <br />
            CREATIONS
            <div className="hero__underline" />
          </div>
        </div>
      </section>
      <div className="source-note">
        {sample ? (
          <>
            <strong>DESIGN PREVIEW</strong>
            <span>
              12 illustrative themes from the supplied design kit. Images,
              authors, institutions and download counts are sample content.
            </span>
          </>
        ) : (
          <>
            <strong>LIVE CATALOG</strong>
            <span>
              Filters apply to this page. Theme screenshots and download counts
              are not yet supplied by the API.
            </span>
          </>
        )}
      </div>
      <div className="catalog-shell" id="catalog">
        <aside className="sidebar" aria-labelledby="filter-heading">
          <h2 id="filter-heading" className="sidebar__mast">
            <Icon name="filter" />
            SORT &amp; FILTER
          </h2>
          <div className="filter-block">
            <label className="filter-label" htmlFor="sort">
              SORT BY
            </label>
            <select
              id="sort"
              className="field"
              value={filters.sort}
              onChange={(event) => updateFilters({ sort: event.target.value })}
            >
              {sample ? (
                <>
                  <option value="popular-desc">Popularity (High → Low)</option>
                  <option value="popular-asc">Popularity (Low → High)</option>
                </>
              ) : (
                <option value="server">Catalog order</option>
              )}
              <option value="name-asc">Name (A → Z)</option>
              <option value="name-desc">Name (Z → A)</option>
            </select>
          </div>
          <div className="filter-block">
            <label className="filter-label" htmlFor="name-search">
              FILTER BY NAME
            </label>
            <input
              id="name-search"
              type="search"
              className="field"
              placeholder="Search theme name..."
              value={filters.name}
              onChange={(event) => updateFilters({ name: event.target.value })}
            />
          </div>
          <div className="filter-block">
            <label className="filter-label" htmlFor="institution">
              {sample ? "FILTER BY UNIVERSITY" : "SUPPORTED SITE"}
            </label>
            <select
              id="institution"
              className="field"
              value={filters.institution}
              onChange={(event) =>
                updateFilters({
                  institution: event.target.value,
                  institutions: [],
                })
              }
            >
              <option value="">
                {sample ? "All universities" : "All sites on this page"}
              </option>
              {institutions.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
          {sample && (
            <fieldset className="filter-block filter-block--fieldset">
              <legend className="filter-label">POPULARITY</legend>
              {popularityBands.map((band) => (
                <label className="choice" key={band.value}>
                  <input
                    type="checkbox"
                    checked={filters.popularity.includes(band.value)}
                    onChange={() =>
                      updateFilters({
                        popularity: toggle(filters.popularity, band.value),
                      })
                    }
                  />
                  {band.label}
                </label>
              ))}
            </fieldset>
          )}
          <fieldset className="filter-block filter-block--fieldset university-choices">
            <legend className="filter-label">
              {sample ? "UNIVERSITY (TOP)" : "SITES ON THIS PAGE"}
            </legend>
            {(expanded ? topInstitutions : topInstitutions.slice(0, 5)).map(
              (name) => (
                <label className="choice" key={name}>
                  <input
                    type="checkbox"
                    checked={filters.institutions.includes(name)}
                    onChange={() =>
                      updateFilters({
                        institution: "",
                        institutions: toggle(filters.institutions, name),
                      })
                    }
                  />
                  {name}
                </label>
              ),
            )}
            {institutions.length > 5 && (
              <button
                className="show-more"
                aria-expanded={expanded}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "SHOW LESS ↑" : "SHOW MORE ↓"}
              </button>
            )}
          </fieldset>
          <button
            className="clear-filters"
            onClick={() => {
              setFilters(defaultFilters(sample));
              if (sample) setPage(0);
            }}
          >
            CLEAR FILTERS ×
          </button>
          <div className="sidebar__graphic" aria-hidden="true" />
        </aside>
        <main className="catalog" id="main" tabIndex={-1}>
          <div className="catalog__tools">
            <h2>
              {filtered.length} THEMES <span className="catalog__slash">/</span>
            </h2>
            <label className="global-search">
              <Icon name="search" />
              <span className="sr-only">
                {sample
                  ? "Search themes, authors, or universities"
                  : "Search themes, authors, or sites on this page"}
              </span>
              <input
                type="search"
                placeholder={
                  sample
                    ? "Search themes (e.g., Modern, Dark, University of Melbourne)"
                    : "Search this page by theme, author or site"
                }
                value={filters.query}
                onChange={(event) =>
                  updateFilters({ query: event.target.value })
                }
              />
            </label>
            <div
              className="view-toggle"
              role="group"
              aria-label="Catalog layout"
            >
              {["grid", "list"].map((mode) => (
                <button
                  key={mode}
                  className={view === mode ? "is-active" : ""}
                  aria-label={`${mode === "grid" ? "Grid" : "List"} view`}
                  aria-pressed={view === mode}
                  onClick={() => setView(mode)}
                >
                  <Icon name={mode} />
                </button>
              ))}
            </div>
          </div>
          {busy && (
            <p className="empty-state" role="status">
              Loading themes...
            </p>
          )}
          {!sample && state.status === "error" && (
            <div className="empty-state">
              <p role="alert">{state.message}</p>
              <button
                className="clear-filters"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {(sample || data) && (
            <>
              <div className={`theme-grid ${view === "list" ? "is-list" : ""}`}>
                {visible.map((theme) => (
                  <article
                    className="theme-card"
                    key={theme.id}
                    aria-labelledby={`theme-${theme.id}`}
                  >
                    <div className="theme-card__image-wrap">
                      {theme.previewImage ? (
                        <img
                          className="theme-card__preview"
                          src={theme.previewImage}
                          loading="lazy"
                          alt={`Sample preview of ${theme.name}`}
                        />
                      ) : (
                        <div className="theme-card__preview preview-placeholder">
                          No preview available
                        </div>
                      )}
                      {theme.featured && (
                        <span className="sr-only">Featured theme</span>
                      )}
                    </div>
                    <h3 id={`theme-${theme.id}`} title={theme.name}>
                      {sample ? theme.name : (
                        <a href={`/themes/${encodeURIComponent(theme.id)}`}>
                          {theme.name}
                        </a>
                      )}
                    </h3>
                    {!sample && (
                      <p className="theme-card__description">
                        {theme.description || "No description available."}
                      </p>
                    )}
                    <div className="theme-card__meta" title={theme.author}>
                      by {theme.author}
                    </div>
                    <div
                      className="theme-card__meta theme-card__meta--university"
                      title={theme.institution}
                    >
                      <Icon name="university" />
                      {theme.institution}
                    </div>
                    <div className="theme-card__footer">
                      <div className="theme-card__downloads">
                        {theme.downloads !== undefined ? (
                          <>
                            <Icon name="flame" />
                            <b>
                              {theme.downloads.toLocaleString("en-US")}
                            </b>{" "}
                            downloads
                          </>
                        ) : (
                          <span className="theme-card__version">
                            Version {theme.version}
                          </span>
                        )}
                      </div>
                      <button
                        className="download-button"
                        aria-label={
                          sample
                            ? `Download ${theme.name}`
                            : `Information about ${theme.name}`
                        }
                        onClick={() =>
                          setDialog({
                            title: theme.name,
                            body: sample ? (
                              <p>
                                This is an illustrative design sample. No theme
                                file is included, and no download has started.
                              </p>
                            ) : (
                              <>
                                <p>
                                  {theme.description ||
                                    "No description available."}
                                </p>
                                <p>
                                  By {theme.author}. Version {theme.version}.
                                  Supported site: {theme.institution}.
                                </p>
                                <p>
                                  <a href={`/themes/${encodeURIComponent(theme.id)}`}>Download JSON and read installation guidance</a>
                                </p>
                              </>
                            ),
                          })
                        }
                      >
                        {sample ? "DOWNLOAD" : "INFO"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {visible.length === 0 && (
                <p className="empty-state">
                  {themes.length === 0
                    ? "No themes available."
                    : "No themes match your filters."}
                </p>
              )}
            </>
          )}
          {!sample && data && !busy && !hasNext && (
            <p role="status" className="catalog-end">End of results.</p>
          )}
          <footer className="catalog__footer">
            <p aria-live="polite">
              {sample
                ? visible.length
                  ? `SHOWING ${page * perPage + 1} – ${page * perPage + visible.length} OF ${filtered.length} THEMES`
                  : "NO THEMES FOUND"
                : `${visible.length} THEMES ON PAGE ${displayedPage + 1}`}
            </p>
            <nav aria-label="Theme pages" className="pagination">
              <button
                disabled={displayedPage === 0 || busy}
                onClick={() => goToPage(displayedPage - 1)}
                aria-label="Previous"
              >
                <Icon name="arrow-left" />
              </button>
              {pageButtons.map((index) => (
                <button
                  key={index}
                  className={displayedPage === index ? "is-current" : ""}
                  aria-current={displayedPage === index ? "page" : undefined}
                  disabled={busy}
                  onClick={() => goToPage(index)}
                >
                  {index + 1}
                </button>
              ))}
              <button
                disabled={!hasNext || busy}
                onClick={next}
                aria-label="Next"
              >
                <Icon name="arrow-right" />
              </button>
            </nav>
            <label>
              ITEMS PER PAGE:{" "}
              <select
                aria-label="Items per page"
                disabled={busy}
                value={perPage}
                onChange={(event) => {
                  setPerPage(Number(event.target.value));
                  setTraversal((value) => value + 1);
                  setPage(0);
                  setCursors([undefined]);
                }}
              >
                {[12, 24, 48].map((size) => (
                  <option key={size}>{size}</option>
                ))}
              </select>
            </label>
          </footer>
        </main>
      </div>
      {dialog && (
        <InfoDialog title={dialog.title} onClose={() => setDialog(null)}>
          {dialog.body}
        </InfoDialog>
      )}
    </>
  );
}
