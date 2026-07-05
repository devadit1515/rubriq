# Deploying Rubriq

Two pieces, deployed independently:

- **Engine** — FastAPI plus both local models, packaged as a Docker image, on
  Hugging Face Spaces. This is the scoring API. It rarely changes.
- **Frontend** — a Vite + React + TypeScript app in `web/`, on Vercel. It calls
  the engine at relative paths (`/evaluate`, `/health`, `/warmup`); `web/vercel.json`
  rewrites those to the HF Space, so the browser makes same-origin calls and there
  is no CORS to manage.

The redesign changed only the frontend. The engine, its models, and its response
contract are untouched, so a frontend change needs a Vercel deploy alone — leave
the Space running.

## Frontend → Vercel

The Vercel project `rubriq` is already linked (`web/.vercel`). From `web/`:

```bash
cd web
npm install
npx vercel deploy --prod --yes      # builds via `npm run build`, publishes dist/
```

`vercel.json` sets the framework to Vite, the build command, the output directory,
and the three API rewrites, so a fresh deploy needs no dashboard changes. Drop
`--prod` for a preview URL first if you want to check the build before it goes live.

Point the rewrites at a different engine by editing the three `destination` URLs in
`web/vercel.json`, then redeploy. A single browser can also be re-pointed for one
session with `?api=` — no, that override was removed in the rebuild; the engine URL
now lives only in `vercel.json` and the Vite dev proxy.

## Engine → Hugging Face Spaces

Redeploy only when the Python engine changes. One-time setup:

```bash
.venv\Scripts\pip install -U huggingface_hub
.venv\Scripts\hf auth login          # paste a WRITE token from huggingface.co/settings/tokens
git remote add hf https://huggingface.co/spaces/<HF_USERNAME>/rubriq   # if missing
git push hf main
```

The Space builds the Dockerfile, bakes both models into the image (about ten
minutes on the first build), and serves at `https://<HF_USERNAME>-rubriq.hf.space`.
Free-tier Spaces sleep after roughly 48h idle; the first request after sleep takes
about a minute. The frontend's status pill shows `waking engine` and retries on its
own, and the built-in samples fall back to bundled fixtures so the demo looks
identical while the models load. Open the Space once before a live demo.

## Local development

Run the two pieces separately:

```bash
# terminal 1 — the engine
.venv\Scripts\uvicorn rubriq.api.main:app --port 8000

# terminal 2 — the frontend, with hot reload
cd web
npm run dev          # http://localhost:5173, proxies /evaluate to the HF Space
```

By default the Vite dev proxy forwards API calls to the deployed Space. To hit a
local engine instead, set `VITE_PROXY_TARGET=http://127.0.0.1:8000` before
`npm run dev`.

## Single-container option

`npm run build` in `web/` writes `web/dist`, and the engine serves that directory at
`/` when it exists. So one `uvicorn rubriq.api.main:app` can serve both the API and
the built UI from the same origin — useful for a fully offline local demo, and the
path a self-contained Docker image would use.
