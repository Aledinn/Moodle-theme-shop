import sampleRecords from "./design-samples.json";
import type { ThemeSummary } from "./api";

export interface CatalogTheme {
  id: string;
  name: string;
  author: string;
  institution: string;
  description: string;
  previewImage?: string;
  downloads?: number;
  featured?: boolean;
  version?: string;
}

export const designSamples: CatalogTheme[] = sampleRecords.map((theme) => ({
  id: theme.id,
  name: theme.name,
  author: theme.author,
  institution: theme.university,
  description: theme.description,
  previewImage: theme.preview_image.replace("../assets/", "/design/"),
  downloads: theme.downloads,
  featured: theme.badge === "featured",
}));

export function fromApi(theme: ThemeSummary): CatalogTheme {
  return {
    id: theme.id,
    name: theme.name,
    author: theme.author,
    institution: theme.site,
    description: theme.description,
    version: theme.version,
  };
}

export interface Filters {
  query: string;
  name: string;
  institution: string;
  institutions: string[];
  popularity: string[];
  sort: string;
  featured: boolean;
}

export function defaultFilters(sample: boolean): Filters {
  return {
    query: "",
    name: "",
    institution: "",
    institutions: [],
    popularity: [],
    sort: sample ? "popular-desc" : "server",
    featured: false,
  };
}

export const popularityBands = [
  { value: "10000+", label: "10,000+ downloads", min: 10000, max: Infinity },
  { value: "5000-9999", label: "5,000 - 9,999", min: 5000, max: 9999 },
  { value: "1000-4999", label: "1,000 - 4,999", min: 1000, max: 4999 },
  { value: "under1000", label: "Under 1,000", min: 0, max: 999 },
];

export function filterThemes(
  themes: CatalogTheme[],
  filters: Filters,
): CatalogTheme[] {
  const query = filters.query.trim().toLowerCase();
  const name = filters.name.trim().toLowerCase();
  const items = themes.filter((theme) => {
    return (
      (!query ||
        [theme.name, theme.author, theme.institution].some((text) =>
          text.toLowerCase().includes(query),
        )) &&
      (!name || theme.name.toLowerCase().includes(name)) &&
      (!filters.institution || theme.institution === filters.institution) &&
      (!filters.institutions.length ||
        filters.institutions.includes(theme.institution)) &&
      (!filters.featured || theme.featured) &&
      (!filters.popularity.length ||
        popularityBands.some(
          (band) =>
            filters.popularity.includes(band.value) &&
            theme.downloads !== undefined &&
            theme.downloads >= band.min &&
            theme.downloads <= band.max,
        ))
    );
  });
  switch (filters.sort) {
    case "popular-desc":
      return items.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
    case "popular-asc":
      return items.sort((a, b) => (a.downloads ?? 0) - (b.downloads ?? 0));
    case "name-asc":
      return items.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return items.sort((a, b) => b.name.localeCompare(a.name));
    default:
      return items;
  }
}
