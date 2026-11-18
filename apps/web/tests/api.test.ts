import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getTheme, listThemes } from "../src/api";

const sample = {
  id: "9007199254740993",
  name: "Quiet",
  site: "moodle.example.com",
  author: "A",
  description: "Calm",
  version: "1",
};
afterEach(() => vi.unstubAllGlobals());
function respond(body: unknown, status = 200) {
  return vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json(body, { status })),
  );
}

describe("same-origin theme client", () => {
  it("preserves string IDs and opaque cursors in a typed page", async () => {
    respond({ items: [sample], nextCursor: "v1:opaque" });
    const result = await listThemes({ limit: 1, cursor: "abc+/=" });
    expect(result.items[0].id).toBe("9007199254740993");
    expect(fetch).toHaveBeenCalledWith(
      "/api/themes?limit=1&cursor=abc%2B%2F%3D",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
  it("accepts an empty final page", async () => {
    respond({ items: [], nextCursor: null });
    expect(await listThemes()).toEqual({ items: [], nextCursor: null });
  });
  it("loads a detail without converting its ID to a number", async () => {
    respond({
      ...sample,
      rules: [{ selector: "body", properties: { color: "#123456" } }],
    });
    expect((await getTheme(sample.id)).id).toBe(sample.id);
    expect(fetch).toHaveBeenCalledWith(
      `/api/themes/${sample.id}`,
      expect.anything(),
    );
  });
  it("encodes IDs instead of allowing path injection", async () => {
    respond({ ...sample, rules: [] });
    await getTheme("../other?x=1");
    expect(fetch).toHaveBeenCalledWith(
      "/api/themes/..%2Fother%3Fx%3D1",
      expect.anything(),
    );
  });
  it.each([400, 404, 500])(
    "retains structured errors for HTTP %i",
    async (status) => {
      respond(
        { error: { code: "theme_not_found", message: "theme not found" } },
        status,
      );
      await expect(getTheme("123")).rejects.toMatchObject({
        status,
        code: "theme_not_found",
        message: "theme not found",
      });
    },
  );
  it("handles an unstructured HTTP error", async () => {
    respond({}, 503);
    await expect(listThemes()).rejects.toMatchObject({
      status: 503,
      code: "http_error",
    });
  });
  it("handles non-JSON proxy errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Bad gateway", { status: 502 })),
    );
    await expect(listThemes()).rejects.toMatchObject({
      status: 502,
      code: "invalid_response",
    });
  });
  it.each([
    { items: [{ ...sample, id: 9007199254740992 }], nextCursor: null },
    { items: [], nextCursor: 5 },
    {},
  ])("rejects malformed success data: %j", async (body) => {
    respond(body);
    await expect(listThemes()).rejects.toBeInstanceOf(ApiError);
  });
  it("rejects malformed rule data", async () => {
    respond({ ...sample, rules: [{ selector: "body", properties: null }] });
    await expect(getTheme(sample.id)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
  it("turns network failures into actionable errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(listThemes()).rejects.toMatchObject({
      status: 0,
      code: "network_error",
    });
  });
  it("passes cancellation through without turning it into a network error", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(controller.signal.reason));
    await expect(
      listThemes({ signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/themes?limit=20",
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
