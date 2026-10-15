import React from "react";
import { Section } from "../ui/Section.jsx";

export function ModuleFrame({ eyebrow, title, description, children }) {
  return <Section eyebrow={eyebrow} title={title} description={description}>{children}</Section>;
}
