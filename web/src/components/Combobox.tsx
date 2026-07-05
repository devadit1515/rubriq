// Searchable model picker. Type to filter; a few rows show, the rest scroll.
// Keyboard-navigable. The list is absolutely positioned in a non-clipping wrapper
// so it never gets cut by a glass panel's overflow. Provider rides as a subtitle,
// so this one control names both provider and model (EvalRequest.model_name).
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ALL_MODELS } from "../lib/providers";
import { SNAP } from "../lib/motion";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

function rank(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_MODELS;
  return ALL_MODELS.filter(
    (m) => m.model.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q),
  ).sort((a, b) => {
    const as = a.model.toLowerCase().startsWith(q) ? 0 : 1;
    const bs = b.model.toLowerCase().startsWith(q) ? 0 : 1;
    return as - bs;
  });
}

export default function Combobox({ value, onChange }: Props) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => rank(query), [query]);
  const providerOf = useMemo(
    () => ALL_MODELS.find((m) => m.model === value)?.provider ?? "",
    [value],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const commit = (model: string) => {
    onChange(model);
    setQuery("");
    setOpen(false);
  };

  const shown = open ? query : value;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && results[active]) {
        e.preventDefault();
        commit(results[active].model);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={id} className="etch mb-2 block" style={{ color: "var(--text-mut)" }}>
        Model evaluated <span style={{ textTransform: "none", letterSpacing: 0 }}>· optional</span>
      </label>
      <div
        className="glass flex items-center gap-2 px-3.5"
        style={{ borderRadius: "var(--r-md)", height: 46 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flex: "0 0 auto" }}>
          <circle cx="11" cy="11" r="7" stroke="var(--text-mut)" strokeWidth="1.6" />
          <path d="m20 20-3.2-3.2" stroke="var(--text-mut)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          value={shown}
          placeholder="Search 40+ models…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          spellCheck={false}
          className="w-full bg-transparent text-[0.92rem] outline-none placeholder:text-[var(--text-mut)]"
          style={{ color: "var(--text)" }}
        />
        {value && !open && (
          <button
            type="button"
            aria-label="Clear model"
            onClick={() => onChange("")}
            className="grid h-5 w-5 place-items-center rounded-full"
            style={{ color: "var(--text-mut)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {providerOf && !open && (
        <span
          className="mt-1.5 block font-mono"
          style={{ fontSize: "0.66rem", color: "var(--ink-soft)" }}
        >
          {providerOf}
        </span>
      )}

      <AnimatePresence>
        {open && (
          <motion.ul
            id={`${id}-list`}
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={SNAP}
            className="glass absolute left-0 right-0 z-pop mt-2 overflow-y-auto p-1.5"
            style={{ borderRadius: "var(--r-md)", maxHeight: 208, boxShadow: "var(--shadow-lift)" }}
          >
            {results.length === 0 && (
              <li className="px-3 py-2.5 text-[0.85rem]" style={{ color: "var(--text-mut)" }}>
                No match — <span style={{ color: "var(--text-dim)" }}>“{query}”</span> will be sent as-is.
              </li>
            )}
            {results.map((m, i) => (
              <li key={m.model} role="option" aria-selected={m.model === value}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(m.model)}
                  className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left transition-colors"
                  style={{
                    background: i === active ? "oklch(0.85 0.14 160 / 0.1)" : "transparent",
                  }}
                >
                  <span className="text-[0.9rem]" style={{ color: "var(--text)" }}>
                    {m.model}
                  </span>
                  <span className="font-mono" style={{ fontSize: "0.66rem", color: "var(--text-mut)" }}>
                    {m.provider}
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
