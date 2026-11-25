import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "VITE_");
  const shop = process.env.VITE_SHOP_URL ?? env.VITE_SHOP_URL ?? "http://127.0.0.1:5173";
  const api = process.env.VITE_API_BASE_URL ?? env.VITE_API_BASE_URL ?? "http://localhost:8080";
  for (const [name, value] of [["VITE_SHOP_URL", shop], ["VITE_API_BASE_URL", api]]) {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (!(url.protocol === "https:" || (url.protocol === "http:" && local)) || url.username || url.password || url.search || url.hash) {
      throw new Error(`${name} must be HTTPS (HTTP is allowed on loopback only), without credentials, query or fragment`);
    }
  }
  return {
    define: {
      "import.meta.env.VITE_SHOP_URL": JSON.stringify(new URL(shop).href),
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(api.replace(/\/$/, "")),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          "service-worker": "src/background/service-worker.ts",
          "foreground": "src/content/foreground.ts",
          "popup": "src/popup/popup.ts",
          "import": "src/import/import.ts"
        },
        output: {
          entryFileNames: "[name].js"
        }
      }
    }
  };
});
