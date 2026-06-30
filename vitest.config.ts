import { defineConfig } from "vitest/config";
import path from "path";

// Kept separate from vite.config.ts on purpose: the production `vite build`
// must not need the vitest packages (they are devDependencies only).
// `include` is scoped to src/ so the backend's Jest suite is never picked up.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
