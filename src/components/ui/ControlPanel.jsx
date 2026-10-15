import React from "react";
import { SlidersHorizontal } from "lucide-react";

export function ControlPanel({ title, description, actions, children }) {
  return (
    <aside className="control-panel" aria-label={title}>
      <div className="control-panel-header">
        <div className="flex min-w-0 items-start gap-3">
          <span className="control-panel-icon" aria-hidden="true">
            <SlidersHorizontal size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="control-panel-grid">{children}</div>
    </aside>
  );
}
