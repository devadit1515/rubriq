// A field cut from the one glass material. The output field is mono — the pasted
// text is a specimen, so it reads as raw material under examination, and evidence
// highlighting later lands on precise monospace glyphs.
import { type ReactNode, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { wordCount } from "../lib/text";
import { SOFT } from "../lib/motion";

interface Props {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  minHeight?: number;
  corner?: ReactNode; // optional control in the header row (e.g. clear)
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export default function GlassField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  mono,
  minHeight = 168,
  corner,
  onKeyDown,
}: Props) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const words = wordCount(value);

  return (
    <div className="glass relative overflow-hidden p-4 sm:p-5">
      {/* ink focus glow — a ring that resolves in on focus */}
      <AnimatePresence>
        {focused && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SOFT}
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ boxShadow: "0 0 0 1px var(--ink-soft) inset, 0 0 34px -6px var(--ink-glow) inset" }}
          />
        )}
      </AnimatePresence>

      <div className="mb-3 flex items-center justify-between gap-3">
        <label htmlFor={id} className="etch" style={{ color: focused ? "var(--ink)" : "var(--text-mut)" }}>
          {label}
        </label>
        <div className="flex items-center gap-3">
          {hint && (
            <span className="hidden text-[0.72rem] sm:inline" style={{ color: "var(--text-mut)" }}>
              {hint}
            </span>
          )}
          {corner}
        </div>
      </div>

      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        spellCheck={false}
        className="w-full resize-none bg-transparent leading-relaxed outline-none placeholder:text-[var(--text-mut)]"
        style={{
          minHeight,
          maxHeight: 360,
          color: "var(--text)",
          fontFamily: mono ? '"JetBrains Mono", monospace' : "inherit",
          fontSize: mono ? "0.9rem" : "1rem",
          overflowY: "auto",
        }}
      />

      <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--line)" }}>
        <span className="etch" style={{ fontSize: "0.58rem", color: "var(--text-mut)" }}>
          {mono ? "specimen" : "instruction"}
        </span>
        <span
          className="font-mono tabular-nums"
          style={{ fontSize: "0.72rem", color: words ? "var(--text-dim)" : "var(--text-mut)" }}
        >
          {words} {words === 1 ? "word" : "words"}
        </span>
      </div>
    </div>
  );
}
