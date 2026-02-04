import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 80,
  },
  build: {
    // Generate sourcemaps for bundle analysis
    sourcemap: process.env.ANALYZE ? true : false,
    rollupOptions: {
      output: {
        // This helps with analysis by separating vendors
        manualChunks: process.env.ANALYZE ? undefined : undefined,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Bundle analyzer - generates stats.html after build
    // Run with: ANALYZE=true npm run build
    process.env.ANALYZE && visualizer({
      filename: "stats.html",
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: "treemap", // or "sunburst", "network"
    }),
    // Also generate JSON for programmatic analysis
    process.env.ANALYZE && visualizer({
      filename: "stats.json",
      template: "raw-data",
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
