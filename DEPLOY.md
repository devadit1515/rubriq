# Deploying Rubriq

Two pieces: the engine (FastAPI + both models, Docker) on Hugging Face
Spaces, and the static frontend on Vercel. The engine also serves the
frontend itself, so the HF Space alone is a complete working app — the
Vercel deploy just gives it a nicer URL.

## 1. Engine → Hugging Face Spaces

One-time setup, in any terminal:

```bash
# needs a free HF account; create a WRITE token at
# huggingface.co/settings/tokens
.venv\Scripts\pip install -U huggingface_hub
.venv\Scripts\hf auth login          # paste the write token

# create the Space (Docker SDK) and push this repo to it
.venv\Scripts\python -c "from huggingface_hub import create_repo; create_repo('<HF_USERNAME>/rubriq', repo_type='space', space_sdk='docker')"
git remote add hf https://huggingface.co/spaces/<HF_USERNAME>/rubriq
git push hf main
```

The Space builds the Dockerfile (models bake into the image, ~10 min first
build) and serves at `https://<HF_USERNAME>-rubriq.hf.space`. Redeploys are
just `git push hf main`.

Free-tier note: Spaces sleep after ~48h idle; the first request after sleep
takes ~1 min. The UI's status pill shows "waking the engine…" and retries by
itself. Before the mentor demo, open the URL once in advance.

## 2. Frontend → Vercel

```bash
npx vercel login                     # once
cd web
npx vercel --prod --yes              # deploys the static frontend
```

Then point the frontend at the engine — edit `web/config.js`:

```js
window.RUBRIQ_API = "https://<HF_USERNAME>-rubriq.hf.space";
```

commit, and run `npx vercel --prod --yes` from `web/` again.

Any deployed copy can also be re-pointed without a redeploy by opening
`https://<frontend-url>/?api=https://<engine-url>` once — the override
persists in that browser.

## Local demo (no deployment at all)

```bash
.venv\Scripts\uvicorn rubriq.api.main:app --port 8000
# open http://127.0.0.1:8000 — UI and engine together, fully offline
```
