import React from "react";
import { motion } from "framer-motion";

export function Section({ eyebrow, title, description, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: "easeOut" }}
      className="section-shell"
    >
      <header className="section-header">
        <div>
          <p className="section-eyebrow">{eyebrow}</p>
          <h2 className="section-title">{title}</h2>
        </div>
        <p className="section-description">{description}</p>
      </header>
      {children}
    </motion.section>
  );
}

export function AtlasPanel({ children, className = "" }) {
  return <div className={`atlas-panel ${className}`}>{children}</div>;
}
