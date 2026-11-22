import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { fetchThemeDownload } from "../src/download";

const id = "9007199254740993";
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Content-Disposition": `attachment; filename="theme-${id}.json"`,
};
afterEach(() => vi.unstubAllGlobals());
const signal = () => new AbortController().signal;

it("preserves all valid shared portable fixtures byte-for-byte with a safe server filename", async () => {
  const root = new URL("../../../contracts/theme/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("fixtures/manifest.json", root), "utf8"));
  for (const fixture of manifest.cases.filter((item: { valid: boolean; kind: string }) => item.valid && item.kind === "portable")) {
    const source = readFileSync(new URL(fixture.file, root));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(source, { headers })));
    const file = await fetchThemeDownload(id, signal());
    expect(file.filename).toBe(`theme-${id}.json`);
    expect(Buffer.from(await file.blob.arrayBuffer())).toEqual(source);
  }
});

it.each([
  { ...headers, "Content-Type": "text/html" },
  { ...headers, "Content-Disposition": 'attachment; filename="../../bad.json"' },
  { ...headers, "Content-Disposition": 'attachment; filename="evil.html"' },
  { ...headers, "Content-Disposition": "" },
])("refuses an unexpected attachment: %j", async (badHeaders) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { headers: badHeaders })));
  await expect(fetchThemeDownload(id, signal())).rejects.toThrow("JSON attachment");
});

it("enforces the byte limit while streaming and cancels the oversized body", async () => {
  const cancel = vi.fn();
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(262_145)); }, cancel,
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers })));
  await expect(fetchThemeDownload(id, signal())).rejects.toThrow("256 KiB");
  expect(cancel).toHaveBeenCalledOnce();
});

it("rejects an empty attachment", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { headers })));
  await expect(fetchThemeDownload(id, signal())).rejects.toThrow("empty");
});
