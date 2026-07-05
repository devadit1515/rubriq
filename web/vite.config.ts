import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app always calls the engine at RELATIVE paths (/evaluate, /health, /warmup).
// In dev, Vite proxies them to the engine; in prod, vercel.json rewrites do the same.
// Zero CORS, zero per-environment API-base juggling.
// Override the dev target with VITE_PROXY_TARGET=http://127.0.0.1:8000 to hit a local uvicorn.
const ENGINE = process.env.VITE_PROXY_TARGET || "https://devadit15-rubriq.hf.space";

const proxy = Object.fromEntries(
  ["/evaluate", "/health", "/warmup"].map((path) => [
    path,
    { target: ENGINE, changeOrigin: true, secure: true },
  ]),
);

export default defineConfig({
  plugins: [react()],
  server: { proxy, host: true },
  build: {
    target: "es2020",
    // The one refractive material is CSS/SVG, so the bundle stays small; no manual
    // chunking gymnastics needed. framer-motion tree-shakes to what we import.
    chunkSizeWarningLimit: 700,
  },
});
