import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Read this only in Node. It is deliberately not a VITE_* browser variable.
  const env = loadEnv(mode, process.cwd(), "WEB_API_TARGET");
  const target =
    process.env.WEB_API_TARGET || env.WEB_API_TARGET || "http://127.0.0.1:8080";
  const url = new URL(target);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "WEB_API_TARGET must be an HTTP(S) origin without a path or credentials",
    );
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        // No rewrite: Go expects /api/themes, including the /api prefix.
        "^/api(?:/|$)": { target: url.origin, changeOrigin: true },
      },
    },
  };
});
