import React from "react";

export function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <article className="stat-card">
      {Icon ? (
        <div className="stat-icon" aria-hidden="true">
          <Icon size={22} strokeWidth={1.8} />
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--warm)]">{label}</p>
        <p className="mt-0.5 text-2xl font-black tracking-normal text-[var(--text)]">{value}</p>
        {helper ? <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{helper}</p> : null}
      </div>
    </article>
  );
}
