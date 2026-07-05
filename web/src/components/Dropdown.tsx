// A glass dropdown cut from the same material as everything else. Used twice for
// the dependent provider→model picker: pick Anthropic and the model list holds
// only Claude models, pick OpenAI and it holds only GPT, and so on. Filters as you
// type when a list is long. The popover lives in a non-clipping wrapper so a glass
// panel's overflow never cuts it.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SNAP } from "../lib/motion";

interface Props {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
  disabledHint?: string;
}

export default function Dropdown({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled,
  disabledHint,
}: Props) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const searchable = options.length > 6;
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.toLowerCase().includes(t)) : options;
  }, [q, options]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    if (searchable) requestAnimationFrame(() => searchRef.current?.focus());
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, searchable]);

  const commit = (o: string) => {
    onChange(o);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (filtered[active]) {
        e.preventDefault();
        commit(filtered[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={id} className="etch mb-2 block" style={{ color: "var(--text-mut)" }}>
        {label} <span style={{ textTransform: "none", letterSpacing: 0 }}>· optional</span>
      </label>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="glass flex w-full items-center gap-2 px-3.5 text-left"
        style={{ borderRadius: "var(--r-md)", height: 46, opacity: disabled ? 0.55 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <span
          className="flex-1 truncate text-[0.92rem]"
          style={{ color: value ? "var(--text)" : "var(--text-mut)" }}
        >
          {disabled ? disabledHint ?? placeholder : value || placeholder}
        </span>
        {value && !disabled ? (
          <span
            role="button"
            aria-label={`Clear ${label}`}
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="grid h-5 w-5 place-items-center rounded-full"
            style={{ color: "var(--text-mut)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
        ) : (
          <motion.svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden animate={{ rotate: open ? 180 : 0 }} transition={SNAP}>
            <path d="m6 9 6 6 6-6" stroke="var(--text-mut)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        )}
      </button>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={SNAP}
            className="glass absolute left-0 right-0 z-pop mt-2 p-1.5"
            style={{ borderRadius: "var(--r-md)", boxShadow: "var(--shadow-lift)" }}
          >
            {searchable && (
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKey}
                placeholder="Filter…"
                spellCheck={false}
                className="mb-1.5 w-full bg-transparent px-3 py-2 text-[0.9rem] outline-none placeholder:text-[var(--text-mut)]"
                style={{ color: "var(--text)", borderBottom: "1px solid var(--line)" }}
              />
            )}
            <ul role="listbox" aria-label={label} className="max-h-[200px] overflow-y-auto" onKeyDown={onKey}>
              {filtered.length === 0 && (
                <li className="px-3 py-2.5 text-[0.85rem]" style={{ color: "var(--text-mut)" }}>
                  No match.
                </li>
              )}
              {filtered.map((o, i) => (
                <li key={o} role="option" aria-selected={o === value}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => commit(o)}
                    className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left"
                    style={{ background: i === active ? "oklch(0.85 0.14 160 / 0.1)" : "transparent" }}
                  >
                    <span className="text-[0.9rem]" style={{ color: "var(--text)" }}>
                      {o}
                    </span>
                    {o === value && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="m5 13 4 4 10-10" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
