import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@sixsync/shared": path.resolve(__dirname, "../packages/shared/src/index.ts"),
    },
  },
  server: {
    host: true,
    port: 3000,
  },
});
