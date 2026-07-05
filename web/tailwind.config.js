/** @type {import('tailwindcss').Config} */
// Tokens live as CSS custom properties in index.css (single source of truth);
// Tailwind references them so utilities and hand-written CSS never drift.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-2": "var(--bg-2)",
        glass: "var(--glass)",
        ink: "var(--ink)", // the luminous evaluation-green
        "ink-soft": "var(--ink-soft)",
        platinum: "var(--platinum)",
        text: "var(--text)",
        "text-dim": "var(--text-dim)",
        "text-mut": "var(--text-mut)",
        line: "var(--line)",
        strong: "var(--strong)",
        mixed: "var(--mixed)",
        weak: "var(--weak)",
      },
      fontFamily: {
        display: ["'Bricolage Grotesque'", "system-ui", "sans-serif"],
        sans: ["'Bricolage Grotesque'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        etch: "0.22em",
        tightest: "-0.045em",
      },
      zIndex: {
        base: "0",
        aurora: "1",
        scene: "10",
        sticky: "20",
        thread: "30",
        overlay: "40",
        pop: "50",
        toast: "60",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-quint": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
