import React from "react";
import { colorForSelection } from "../../data/palette.js";

export function ColorConstellationPreview({ metrics }) {
  const max = Math.max(...metrics.colors.map((item) => item.count), 1);
  return (
    <section className="glass-panel p-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.24em] text-[var(--text)]">Color constellation</h2>
      <div className="relative mt-5 min-h-[260px] overflow-hidden border border-black/10 bg-[#f1f0ec]">
        {metrics.colors.slice(0, 18).map((item, index) => {
          const size = 18 + (item.count / max) * 62;
          const left = 12 + ((index * 23) % 76);
          const top = 14 + ((index * 31) % 68);
          return (
            <div
              key={item.color}
              className="absolute rounded-full"
              style={{
                width: size,
                height: size,
                left: `${left}%`,
                top: `${top}%`,
                background: colorForSelection(item.color),
                opacity: 0.72,
                boxShadow: `0 0 ${size}px ${colorForSelection(item.color)}`,
              }}
              title={`${item.color}: ${item.count}`}
            />
          );
        })}
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
        Participant-selected colors gather into a shared field, scaled by how often each hue appears across the archive.
      </p>
    </section>
  );
}
