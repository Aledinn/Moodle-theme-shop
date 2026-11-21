import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createServer, resolveConfig } from "vite";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

it("defaults to port 8080 and keeps the /api prefix", async () => {
  vi.stubEnv("WEB_API_TARGET", "");
  const config = await resolveConfig({}, "serve");
  const rule = config.server.proxy?.["^/api(?:/|$)"];
  expect(rule).toMatchObject({ target: "http://127.0.0.1:8080" });
  expect(rule).not.toHaveProperty("rewrite");
});

it("forwards the exact API path and query through Vite to a configurable target", async () => {
  const paths: string[] = [];
  const upstream = createHttpServer((request, response) => {
    paths.push(request.url!);
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ items: [], nextCursor: null }));
  });
  await new Promise<void>((resolve) =>
    upstream.listen(0, "127.0.0.1", resolve),
  );
  vi.stubEnv(
    "WEB_API_TARGET",
    `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
  );
  const vite = await createServer({
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "silent",
  });
  try {
    await vite.listen();
    const origin = `http://127.0.0.1:${(vite.httpServer!.address() as AddressInfo).port}`;
    const path = "/api/themes?limit=1&cursor=abc%2B%2F%3D";
    expect(await (await fetch(origin + path)).json()).toEqual({
      items: [],
      nextCursor: null,
    });
    const detailPath = "/api/themes/9007199254740993";
    await fetch(origin + detailPath);
    expect(paths).toEqual([path, detailPath]);
  } finally {
    await vite.close();
    await new Promise<void>((resolve, reject) =>
      upstream.close((error) => (error ? reject(error) : resolve())),
    );
  }
}, 20000);
