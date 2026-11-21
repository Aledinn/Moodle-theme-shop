// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../src/App";

const records = [0, 1, 2].map((index) => ({
  id: (9007199254740993n + BigInt(index)).toString(),
  name: `Curated theme ${index + 1}`,
  author: "Curated author",
  description: "A curated local sample.",
  site: "moodle.example.com",
  version: "1.0",
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

it("keeps a page usable during a failed next page, retries its cursor and traverses without skips", async () => {
  window.history.replaceState(null, "", "/");
  let failPage!: (value: Response) => void;
  const fetchPage = vi.fn()
    .mockResolvedValueOnce(Response.json({ items: [records[0]], nextCursor: "cursor-1" }))
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { failPage = resolve; }))
    .mockResolvedValueOnce(Response.json({ items: [records[1]], nextCursor: "cursor-2" }))
    .mockResolvedValueOnce(Response.json({ items: [records[2]], nextCursor: null }));
  vi.stubGlobal("fetch", fetchPage);
  render(<App />);
  expect(screen.getByRole("status").textContent).toBe("Loading themes...");
  await screen.findByRole("link", { name: records[0].name });
  const seen = [screen.getByRole("article").getAttribute("aria-labelledby")];
  const next = screen.getByRole("button", { name: "Next" });
  fireEvent.click(next);
  fireEvent.click(next);
  expect(fetchPage).toHaveBeenCalledTimes(2);
  expect((next as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("link", { name: records[0].name }).getAttribute("href"))
    .toBe(`/themes/${records[0].id}`);
  expect(screen.getByText("1 THEMES ON PAGE 1")).toBeTruthy();
  await act(async () => { failPage(Response.json({ error: { message: "Page unavailable" } }, { status: 503 })); });
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("link", { name: records[0].name })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("link", { name: records[1].name });
  expect(fetchPage.mock.calls[1][0]).toBe(fetchPage.mock.calls[2][0]);
  seen.push(screen.getByRole("article").getAttribute("aria-labelledby"));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("link", { name: records[2].name });
  seen.push(screen.getByRole("article").getAttribute("aria-labelledby"));
  expect(seen).toEqual(records.map((record) => `theme-${record.id}`));
  expect(screen.getByText("End of results.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetchPage.mock.calls.map(([url]) => url)).toEqual([
    "/api/themes?limit=12", "/api/themes?limit=12&cursor=cursor-1",
    "/api/themes?limit=12&cursor=cursor-1", "/api/themes?limit=12&cursor=cursor-2",
  ]);
});

it("renders hostile metadata literally in every catalog field and preserves a large string ID", async () => {
  const hostile = "<img src=x onerror=alert(1)>";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
    items: [{ ...records[0], name: hostile, author: hostile, site: hostile, version: hostile, description: hostile }], nextCursor: null,
  })));
  const { container } = render(<App />);
  const card = await screen.findByRole("article");
  expect(within(card).getByRole("link", { name: hostile }).getAttribute("href"))
    .toBe(`/themes/${records[0].id}`);
  expect(within(card).getAllByText(hostile)).toHaveLength(3);
  expect(within(card).getByText(`by ${hostile}`)).toBeTruthy();
  expect(within(card).getByText(`Version ${hostile}`)).toBeTruthy();
  expect(container.querySelector('img[src="x"],script')).toBeNull();
});

it("opens a stable details URL directly using the exact string ID", async () => {
  window.history.replaceState(null, "", `/themes/${records[0].id}`);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...records[0], rules: [] })));
  render(<App />);
  expect(await screen.findByRole("heading", { name: records[0].name })).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith(`/api/themes/${records[0].id}`, expect.anything());
  expect(screen.getByText("Supported hostname")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to theme catalog" }).getAttribute("href")).toBe("/");
});

it("starts a fresh traversal on page-size change even when its first request fails", async () => {
  const fetchPage = vi.fn()
    .mockResolvedValueOnce(Response.json({ items: [records[0]], nextCursor: "old-cursor" }))
    .mockResolvedValueOnce(Response.json({ items: [records[1]], nextCursor: "old-next" }))
    .mockResolvedValueOnce(Response.json({ error: { message: "Try later" } }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ items: records, nextCursor: null }));
  vi.stubGlobal("fetch", fetchPage);
  render(<App />);
  await screen.findByRole("link", { name: records[0].name });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("link", { name: records[1].name });
  fireEvent.change(screen.getByLabelText("Items per page"), { target: { value: "24" } });
  await screen.findByRole("alert");
  expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("link", { name: records[2].name });
  expect(fetchPage.mock.calls.slice(2).map(([url]) => url)).toEqual([
    "/api/themes?limit=24", "/api/themes?limit=24",
  ]);
});

it("never revives an old traversal after switching sizes away and back with failures", async () => {
  const failure = () => Response.json({ error: { message: "Offline" } }, { status: 503 });
  const fetchPage = vi.fn()
    .mockResolvedValueOnce(Response.json({ items: [records[0]], nextCursor: "cursor-1" }))
    .mockResolvedValueOnce(Response.json({ items: [records[1]], nextCursor: "cursor-2" }))
    .mockResolvedValueOnce(Response.json({ items: [records[2]], nextCursor: null }))
    .mockResolvedValueOnce(failure())
    .mockResolvedValueOnce(failure())
    .mockResolvedValueOnce(Response.json({ items: [records[0]], nextCursor: "cursor-1" }));
  vi.stubGlobal("fetch", fetchPage);
  render(<App />);
  await screen.findByRole("link", { name: records[0].name });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("link", { name: records[1].name });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("link", { name: records[2].name });
  fireEvent.change(screen.getByLabelText("Items per page"), { target: { value: "24" } });
  await screen.findByRole("alert");
  fireEvent.change(screen.getByLabelText("Items per page"), { target: { value: "12" } });
  await screen.findByRole("alert");
  expect(screen.queryByRole("link", { name: records[2].name })).toBeNull();
  expect(screen.getByText("0 THEMES ON PAGE 1")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("link", { name: records[0].name });
  expect(screen.getByText("1 THEMES ON PAGE 1")).toBeTruthy();
  expect(fetchPage.mock.calls.slice(3).map(([url]) => url)).toEqual([
    "/api/themes?limit=24", "/api/themes?limit=12", "/api/themes?limit=12",
  ]);
});
