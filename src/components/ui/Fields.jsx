import React, { useId } from "react";

function FieldShell({ id, label, helper, children, className = "" }) {
  return (
    <div className={`field-wrap min-w-0 ${className}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {helper ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{helper}</p> : null}
    </div>
  );
}

export function SelectField({ label, value, onChange, options, helper, includeAll = true, className = "" }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} helper={helper} className={className}>
      <select id={id} className="field-shell w-full" value={value} onChange={(event) => onChange(event.target.value)}>
        {includeAll ? <option>All</option> : null}
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </FieldShell>
  );
}

export function DateField({ label, value, onChange, helper, className = "" }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} helper={helper} className={className}>
      <input id={id} className="field-shell w-full" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </FieldShell>
  );
}

export function SliderField({ label, value, onChange, min = 0, max = 100, leftLabel, rightLabel, helper, className = "" }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} helper={helper} className={className}>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>{leftLabel}</span>
          <span className="font-semibold text-[var(--text)]">{value}</span>
          <span>{rightLabel}</span>
        </div>
        <input
          id={id}
          className="w-full accent-[var(--accent)]"
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </FieldShell>
  );
}
