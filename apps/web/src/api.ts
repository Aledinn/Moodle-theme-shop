export interface ThemeSummary {
  id: string;
  name: string;
  site: string;
  author: string;
  description: string;
  version: string;
}

export interface ThemeRule {
  selector: string;
  properties: Record<string, string>;
}

export interface Theme extends ThemeSummary {
  rules: ThemeRule[];
}

export interface ThemePage {
  items: ThemeSummary[];
  nextCursor: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function summary(value: unknown): value is ThemeSummary {
  return (
    object(value) &&
    ["id", "name", "site", "author", "description", "version"].every(
      (key) => typeof value[key] === "string",
    )
  );
}

function page(value: unknown): value is ThemePage {
  return (
    object(value) &&
    Array.isArray(value.items) &&
    value.items.every(summary) &&
    (value.nextCursor === null || typeof value.nextCursor === "string")
  );
}

function theme(value: unknown): value is Theme {
  return (
    summary(value) &&
    "rules" in value &&
    Array.isArray(value.rules) &&
    value.rules.every(
      (rule: unknown) =>
        object(rule) &&
        typeof rule.selector === "string" &&
        object(rule.properties) &&
        !Array.isArray(rule.properties) &&
        Object.values(rule.properties).every(
          (property) => typeof property === "string",
        ),
    )
  );
}

async function request<T>(
  path: string,
  valid: (value: unknown) => value is T,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      signal,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    throw new ApiError(
      "Unable to reach the theme service. Please try again.",
      0,
      "network_error",
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    throw new ApiError(
      "The theme service returned an unreadable response.",
      response.status,
      "invalid_response",
    );
  }
  if (!response.ok) {
    const detail = object(body) && object(body.error) ? body.error : undefined;
    throw new ApiError(
      typeof detail?.message === "string"
        ? detail.message
        : `The theme service returned HTTP ${response.status}.`,
      response.status,
      typeof detail?.code === "string" ? detail.code : "http_error",
    );
  }
  if (!valid(body))
    throw new ApiError(
      "The theme service returned unexpected data.",
      response.status,
      "invalid_response",
    );
  return body;
}

export function listThemes(
  options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
): Promise<ThemePage> {
  const query = new URLSearchParams({ limit: String(options.limit ?? 20) });
  if (options.cursor !== undefined) query.set("cursor", options.cursor);
  return request(`/api/themes?${query}`, page, options.signal);
}

export function getTheme(id: string, signal?: AbortSignal): Promise<Theme> {
  return request(`/api/themes/${encodeURIComponent(id)}`, theme, signal);
}
