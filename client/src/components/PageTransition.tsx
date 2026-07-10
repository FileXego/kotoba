import { motion } from "motion/react";
import { pageVariants } from "../design/motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="editorial-page"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
