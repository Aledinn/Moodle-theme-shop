// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../src/App";

const theme = {
  id: "9007199254740993", name: "<img src=x onerror=alert(1)>",
  author: "<script>bad()</script>", site: "moodle.example.com",
  description: "<b>Literal description</b>", version: "<svg onload=alert(1)>", rules: [],
};
const createURL = vi.fn(() => "blob:test-download");
const revokeURL = vi.fn();
let click: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  window.history.replaceState(null, "", `/themes/${theme.id}`);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(theme)));
  URL.createObjectURL = createURL;
  URL.revokeObjectURL = revokeURL;
  click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});
function attachment(body = '{"rules": []}') {
  return new Response(body, { headers: {
    "Content-Type": "application/json",
    "Content-Disposition": `attachment; filename="theme-${theme.id}.json"`,
  } });
}

it("shows loading, literal metadata, and honest installation guidance without probing the extension", async () => {
  let resolve!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
  const { container } = render(<App />);
  expect(screen.getByRole("status").textContent).toBe("Loading theme...");
  expect(screen.queryByRole("button", { name: "Download theme JSON" })).toBeNull();
  await act(async () => resolve(Response.json(theme)));
  expect(screen.getByRole("heading", { name: theme.name })).toBeTruthy();
  for (const text of [theme.author, theme.description, theme.version]) expect(screen.getByText(text)).toBeTruthy();
  expect(container.querySelector("img, script, svg, b")).toBeNull();
  expect(screen.getAllByText("Import downloaded JSON")[0]).toBeTruthy();
  expect(screen.getByText(/hostname must exactly match/).textContent).toContain(theme.site);
  expect(screen.getByRole("link", { name: "extension setup instructions" }).getAttribute("href")).toContain("#installation");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(`/api/themes/${theme.id}`, expect.anything());
});

it.each([404, 500])("handles a details HTTP %s and retries", async (status) => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: { message: "Service unavailable" } }, { status }))
    .mockResolvedValueOnce(Response.json(theme));
  render(<App />);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(status === 404 ? "Theme not found" : "Service unavailable");
  expect(screen.queryByRole("button", { name: "Download theme JSON" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("button", { name: "Download theme JSON" })).toBeTruthy();
});

it("waits for the whole download, prevents duplicates, then hands the attachment to the browser", async () => {
  render(<App />);
  const button = await screen.findByRole("button", { name: "Download theme JSON" });
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } });
  vi.mocked(fetch).mockResolvedValueOnce(new Response(body, { headers: attachment().headers }));
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole("button", { name: "Downloading…" }).hasAttribute("disabled")).toBe(true));
  expect(createURL).not.toHaveBeenCalled();
  expect(screen.queryByText(/Download handed/)).toBeNull();
  await act(async () => { stream.enqueue(new TextEncoder().encode('{"rules": []}')); stream.close(); });
  await screen.findByText(/Download handed to your browser/);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenLastCalledWith(`/api/themes/${theme.id}/download`, expect.objectContaining({ credentials: "same-origin" }));
  expect(createURL).toHaveBeenCalledTimes(1);
  expect(click.mock.instances[0].download).toBe(`theme-${theme.id}.json`);
  expect(document.querySelector('a[download]')).toBeNull();
});

it.each(["http", "network", "stream", "save"])("reports %s download failure without success and allows retry", async (failure) => {
  render(<App />);
  const button = await screen.findByRole("button", { name: "Download theme JSON" });
  if (failure === "http") vi.mocked(fetch).mockResolvedValueOnce(Response.json({}, { status: 500 }));
  if (failure === "network") vi.mocked(fetch).mockRejectedValueOnce(new TypeError("offline"));
  if (failure === "stream") vi.mocked(fetch).mockResolvedValueOnce(new Response(new ReadableStream({ start(c) { c.error(new Error("connection lost")); } }), { headers: attachment().headers }));
  if (failure === "save") {
    vi.mocked(fetch).mockResolvedValueOnce(attachment());
    click.mockImplementationOnce(() => { throw new Error("blocked"); });
  }
  fireEvent.click(button);
  expect((await screen.findByRole("alert")).textContent).toContain("Download failed");
  expect(screen.queryByText(/Download handed/)).toBeNull();
  vi.mocked(fetch).mockResolvedValueOnce(attachment());
  fireEvent.click(screen.getByRole("button", { name: "Download theme JSON" }));
  await screen.findByText(/Download handed to your browser/);
  expect(screen.queryByRole("alert")).toBeNull();
});

it("explains a theme removed between viewing and downloading", async () => {
  render(<App />);
  const button = await screen.findByRole("button", { name: "Download theme JSON" });
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({}, { status: 404 }));
  fireEvent.click(button);
  expect((await screen.findByRole("alert")).textContent).toContain("no longer available");
  expect(createURL).not.toHaveBeenCalled();
});

it("cancels a download when leaving details and ignores a late response", async () => {
  const { unmount } = render(<App />);
  const button = await screen.findByRole("button", { name: "Download theme JSON" });
  let signal!: AbortSignal;
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce((_url, options) => {
    signal = options!.signal!;
    return new Promise<Response>((done) => { resolve = done; });
  });
  fireEvent.click(button);
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(attachment()));
  expect(createURL).not.toHaveBeenCalled();
});

it("decodes route IDs once and handles malformed URL encoding without a request", async () => {
  window.history.replaceState(null, "", "/themes/opaque%3Aid");
  const { unmount } = render(<App />);
  await screen.findByRole("heading", { name: theme.name });
  expect(fetch).toHaveBeenCalledWith("/api/themes/opaque%3Aid", expect.anything());
  unmount();
  vi.mocked(fetch).mockClear();
  window.history.replaceState(null, "", "/themes/%E0%A4%A");
  render(<App />);
  expect(screen.getByRole("heading", { name: "Invalid theme URL" })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});
