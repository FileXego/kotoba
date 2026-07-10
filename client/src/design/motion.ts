import type { Variants } from "motion/react";

export const editorialEase = [0.22, 1, 0.36, 1] as const;

export const pageVariants: Variants = {
  hidden: { opacity: 0, x: 14, scaleX: 0.985, transformOrigin: "left center" },
  visible: {
    opacity: 1,
    x: 0,
    scaleX: 1,
    transition: { duration: 0.46, ease: editorialEase },
  },
  exit: {
    opacity: 0,
    x: -8,
    transition: { duration: 0.18, ease: "easeIn" },
  },
};
export const entryVariants: Variants = {
  hidden: { opacity: 0, x: 10 },
  visible: (index: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      delay: Math.min(index, 6) * 0.045,
      ease: editorialEase,
    },
  }),
};

export const sealVariants: Variants = {
  rest: { opacity: 0.82, scale: 1, rotate: -2 },
  hover: { opacity: 1, scale: 1.04, rotate: 0 },
  tap: { scale: 0.92, rotate: -4 },
};
