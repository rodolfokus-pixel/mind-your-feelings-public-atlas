import React from "react";

const VARIANTS = {
  primary: "button-primary",
  secondary: "button-secondary",
  ghost: "button-ghost",
};

export function Button({ children, className = "", variant = "secondary", ...props }) {
  return (
    <button className={`atlas-button ${VARIANTS[variant] || VARIANTS.secondary} ${className}`} type="button" {...props}>
      {children}
    </button>
  );
}
