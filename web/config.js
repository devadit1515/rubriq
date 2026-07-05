// API base URL resolution, in priority order:
//   1. ?api=https://... query param (ad-hoc override, persisted to localStorage)
//   2. localStorage "rubriq_api"
//   3. window.RUBRIQ_API set below (deployment default)
//   4. same origin (local dev: uvicorn serves both UI and API)
window.RUBRIQ_API = window.RUBRIQ_API
  || (location.hostname.endsWith("hf.space") || location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? ""                                        // served by the engine itself: same origin
      : "https://devadit15-rubriq.hf.space");     // static hosting (Vercel): the HF Space engine
