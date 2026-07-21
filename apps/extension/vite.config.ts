import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "service-worker": "src/background/service-worker.ts",
        "foreground": "src/content/foreground.ts",
        "popup": "src/popup/popup.ts",
        "shop": "src/shop/shop.ts"
      },
      output: {
        entryFileNames: "[name].js"
      }
    }
  }
});
