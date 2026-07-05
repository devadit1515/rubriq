// Shared motion vocabulary. Spring physics is the default feel everywhere; the
// only non-spring curve is a true ease-out-expo for a few opacity/blur fades.
import type { SpringOptions, Transition, Variants } from "framer-motion";

// Underdamped on purpose (ζ ≈ 0.63): the score needle overshoots a hair, then
// settles — a mechanical instrument coming to rest, not a value easing in.
export const NEEDLE: Transition = { type: "spring", stiffness: 90, damping: 12, mass: 1.1 };
// Same feel, as bare SpringOptions for useSpring (which rejects `type`).
export const NEEDLE_SPRING: SpringOptions = { stiffness: 90, damping: 12, mass: 1.1 };

// General-purpose springs.
export const SOFT: Transition = { type: "spring", stiffness: 140, damping: 22, mass: 1 };
export const SNAP: Transition = { type: "spring", stiffness: 460, damping: 34 };
export const GLASS: Transition = { type: "spring", stiffness: 300, damping: 30 };

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

// Parameter cards / evidence rows resolve one after another.
export const revealContainer: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
};

export const revealChild: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: SOFT },
};

// The repair prompt assembles from a soft blur — "the cure" resolving into focus.
export const cureReveal: Variants = {
  hidden: { opacity: 0, y: 26, filter: "blur(12px)", scale: 0.985 },
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    scale: 1,
    transition: { type: "spring", stiffness: 120, damping: 20, mass: 1.1 },
  },
};
