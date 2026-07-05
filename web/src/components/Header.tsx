// Sticky masthead. Just the wordmark — quiet by design; one thing leads per view,
// and it is never the header.
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE_OUT_EXPO } from "../lib/motion";

export default function Header({ children }: { children?: ReactNode }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
      className="sticky top-0 z-sticky"
    >
      <div
        className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8"
        style={{
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          maskImage: "linear-gradient(180deg, #000 62%, transparent)",
        }}
      >
        <a href="/" className="group flex items-baseline gap-3" aria-label="Rubriq — home">
          <span
            className="font-display font-semibold leading-none"
            style={{ fontSize: "1.32rem", letterSpacing: "-0.03em", color: "var(--text)" }}
          >
            Rubriq
          </span>
          <span className="hidden h-3.5 w-px sm:block" style={{ background: "var(--line-2)" }} />
          <span className="etch hidden sm:inline" style={{ fontSize: "0.6rem" }}>
            the instrument
          </span>
        </a>
        {children && <div className="flex items-center gap-2.5">{children}</div>}
      </div>
    </motion.header>
  );
}
