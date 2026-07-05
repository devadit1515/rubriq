// Provider -> model catalog for the picker. Ordered by popularity within
// each provider (the top entries are what most users will want; the picker
// shows ~4 rows and scrolls). Landscape as of July 2026 — refresh
// deliberately, this list is user-facing truth.
window.RUBRIQ_PROVIDERS = [
  {
    name: "OpenAI",
    models: [
      "GPT-5.5",
      "GPT-5.6 Sol (preview)",
      "GPT-5",
      "GPT-4o",
      "GPT-5.6 Terra (preview)",
      "GPT-5.6 Luna (preview)",
      "o3",
      "GPT-4.1",
    ],
  },
  {
    name: "Anthropic",
    models: [
      "Claude Sonnet 5",
      "Claude Opus 4.8",
      "Claude Fable 5",
      "Claude Haiku 4.5",
      "Claude Opus 4.5",
      "Claude Sonnet 4.5",
    ],
  },
  {
    name: "Google",
    models: [
      "Gemini 3.5 Flash",
      "Gemini 3.5 Pro",
      "Gemini 3.1 Pro",
      "Gemini 2.5 Pro",
      "Gemini 2.5 Flash",
      "Gemini 3.1 Flash-Lite (preview)",
    ],
  },
  {
    name: "Meta",
    models: [
      "Llama 4 Maverick",
      "Llama 4 Scout",
      "Llama 3.3 70B",
      "Llama 3.1 405B",
    ],
  },
  {
    name: "DeepSeek",
    models: [
      "DeepSeek V4 Pro",
      "DeepSeek V4 Flash",
      "DeepSeek R1",
      "DeepSeek V3",
    ],
  },
  {
    name: "xAI",
    models: [
      "Grok 4.3",
      "Grok 4.20",
      "Grok 4.1 Fast",
      "Grok 4",
    ],
  },
  {
    name: "Alibaba (Qwen)",
    models: [
      "Qwen 3.7 Max",
      "Qwen 3.5 397B",
      "Qwen 3 235B",
      "Qwen 3 Coder",
    ],
  },
  {
    name: "Mistral",
    models: [
      "Mistral Large 3",
      "Mistral Small 4",
      "Devstral 2",
      "Codestral",
    ],
  },
  {
    name: "Z.ai",
    models: ["GLM-5.1", "GLM-5", "GLM-4.5"],
  },
  {
    name: "MiniMax",
    models: ["MiniMax M3", "MiniMax M2"],
  },
  {
    name: "Cohere",
    models: ["Command A", "Command R+"],
  },
  {
    name: "Other",
    models: [],
  },
];
