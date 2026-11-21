// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { useRequest } from "../src/useRequest";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ items: [], nextCursor: null })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows the theme grid page and an empty state", async () => {
  render(<App />);
  expect(
    screen.getByRole("heading", { level: 1, name: "THE MOODLE THEME ARCHIVE" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Skip to themes" }).getAttribute("href"),
  ).toBe("#main");
  expect(await screen.findByText("No themes available.")).toBeTruthy();
});

it("renders multiple themes safely as preview boxes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        items: [
          {
            id: "9007199254740993",
            name: "<img src=x onerror=alert(1)>",
            author: "Author",
            site: "moodle.example.com",
            description: "<script>bad()</script>",
            version: "1",
          },
          {
            id: "9007199254740994",
            name: "Second theme",
            author: "Another author",
            site: "moodle.example.com",
            description: "",
            version: "2",
          },
        ],
        nextCursor: null,
      }),
    ),
  );
  const { container } = render(<App />);
  expect(
    await screen.findByRole("heading", {
      name: "<img src=x onerror=alert(1)>",
    }),
  ).toBeTruthy();
  expect(screen.getAllByRole("article")).toHaveLength(2);
  expect(container.querySelector('img[src="x"], script')).toBeNull();
  expect(container.querySelector('[id="theme-9007199254740993"]')).toBeTruthy();
  expect(screen.getAllByText("No preview available")).toHaveLength(2);
});

it("retries a failed request", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: { code: "internal_error", message: "unable to list themes" },
          },
          { status: 500 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ items: [], nextCursor: null })),
  );
  render(<App />);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "unable to list themes",
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No themes available.")).toBeTruthy();
});

it("requests bounded pages using the server cursor and supports going back", async () => {
  const theme = {
    id: "9007199254740993",
    name: "First",
    author: "Author",
    site: "moodle.example.com",
    description: "",
    version: "1",
  };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ items: [theme], nextCursor: "opaque+/=" }),
      )
      .mockResolvedValueOnce(
        Response.json({
          items: [{ ...theme, id: "9007199254740994", name: "Second" }],
          nextCursor: null,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ items: [theme], nextCursor: "opaque+/=" }),
      ),
  );
  render(<App />);
  await screen.findByRole("heading", { name: "First" });
  expect(
    (screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("heading", { name: "Second" });
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/themes?limit=12&cursor=opaque%2B%2F%3D",
    expect.anything(),
  );
  expect(
    (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  await screen.findByRole("heading", { name: "First" });
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/themes?limit=12",
    expect.anything(),
  );
});
it("shows supplied design samples separately from the API and filters them", async () => {
  window.history.replaceState(null, "", "/?preview=design");
  render(<App />);
  expect(screen.getByText("DESIGN PREVIEW")).toBeTruthy();
  expect(screen.getAllByRole("article")).toHaveLength(12);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.change(
    screen.getByRole("searchbox", {
      name: "Search themes, authors, or universities",
    }),
    { target: { value: "emma" } },
  );
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Campus Modern" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "CLEAR FILTERS ×" }));
  expect(screen.getAllByRole("article")).toHaveLength(12);
  fireEvent.change(screen.getByLabelText("FILTER BY NAME"), {
    target: { value: "not a theme" },
  });
  expect(screen.getByText("No themes match your filters.")).toBeTruthy();
});

it("keeps university controls unambiguous and preserves filters when switching layouts", () => {
  window.history.replaceState(null, "", "/?preview=design");
  render(<App />);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "University of Melbourne" }),
  );
  expect(screen.getAllByRole("article")).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("FILTER BY UNIVERSITY"), {
    target: { value: "Stanford University" },
  });
  expect(
    (
      screen.getByRole("checkbox", {
        name: "University of Melbourne",
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "List view" }));
  expect(
    screen
      .getByRole("button", { name: "List view" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Aurora" })).toBeTruthy();
});

it("explains sample downloads without issuing file requests", () => {
  window.history.replaceState(null, "", "/?preview=design");
  render(<App />);
  fireEvent.click(
    screen.getByRole("button", { name: "Download Campus Modern" }),
  );
  expect(screen.getByRole("dialog", { name: "Campus Modern" })).toBeTruthy();
  expect(screen.getByText(/No theme file is included/)).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("cancels superseded requests, ignores late results, and cancels on unmount", async () => {
  let firstSignal: AbortSignal | undefined;
  let resolveFirst!: (value: string) => void;
  const first = (signal: AbortSignal) => {
    firstSignal = signal;
    return new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
  };
  let secondSignal: AbortSignal | undefined;
  const second = (signal: AbortSignal) => {
    secondSignal = signal;
    return Promise.resolve("new");
  };
  const { result, rerender, unmount } = renderHook(
    ({ load }) => useRequest(load),
    { initialProps: { load: first } },
  );
  rerender({ load: second });
  expect(firstSignal?.aborted).toBe(true);
  await waitFor(() =>
    expect(result.current).toEqual({ status: "success", data: "new" }),
  );
  await act(async () => {
    resolveFirst("stale");
  });
  expect(result.current).toEqual({ status: "success", data: "new" });
  unmount();
  expect(secondSignal?.aborted).toBe(true);
});
