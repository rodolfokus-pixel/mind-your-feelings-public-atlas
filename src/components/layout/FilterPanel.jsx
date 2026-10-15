import React, { useId } from "react";
import { CalendarDays, Filter, RotateCcw, X } from "lucide-react";
import { EMPTY_FILTERS, applyFilters, uniqueOptions } from "../../data/filters.js";
import { Button } from "../ui/Button.jsx";
import { ControlPanel } from "../ui/ControlPanel.jsx";
import { DateField, SelectField } from "../ui/Fields.jsx";

export function FilterPanel({
  records,
  filters,
  setFilters,
  title = "Explore the atlas",
  description = "The full archive appears first. Use these controls to narrow the view by time, response source, language, emotion, or color.",
  children,
}) {
  const panelId = useId();
  const options = {
    event: uniqueOptions(records, "Event"),
    language: uniqueOptions(records, "Language"),
    emotion: uniqueOptions(records, "Emotion_Normalized"),
    color: uniqueOptions(records.flatMap((record) => String(record.Colors_List).split(",").map((color) => ({ color: color.trim() })).filter((item) => item.color)), "color"),
  };

  const visibleCount = applyFilters(records, filters).length;
  const activeFilters = [
    filters.dateFrom ? { key: "dateFrom", label: `From ${filters.dateFrom}` } : null,
    filters.dateTo ? { key: "dateTo", label: `To ${filters.dateTo}` } : null,
    filters.event !== "All" ? { key: "event", label: filters.event } : null,
    filters.language !== "All" ? { key: "language", label: filters.language } : null,
    filters.emotion !== "All" ? { key: "emotion", label: filters.emotion } : null,
    filters.color !== "All" ? { key: "color", label: filters.color } : null,
  ].filter(Boolean);

  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const reset = () => setFilters({ ...EMPTY_FILTERS });
  const clearFilter = (key) => update(key, key === "dateFrom" || key === "dateTo" ? "" : "All");

  return (
    <ControlPanel
      title={title}
      description={description}
    >
      <div className="filter-overview control-span-2">
        <div>
          <p className="filter-overview-label">Visible responses</p>
          <div className="filter-overview-count">
            <strong>{visibleCount}</strong>
            <span>of {records.length}</span>
          </div>
        </div>
        <Button className="filter-reset" onClick={reset} variant={activeFilters.length ? "primary" : "ghost"} disabled={!activeFilters.length}>
            <RotateCcw size={14} />
            Reset all
        </Button>
      </div>

      {activeFilters.length ? (
        <div className="active-filter-list control-span-2" aria-label="Active filters">
          <span className="active-filter-label"><Filter size={13} /> Active</span>
          {activeFilters.map((item) => (
            <button key={item.key} className="active-filter-chip" type="button" onClick={() => clearFilter(item.key)} aria-label={`Remove ${item.label} filter`}>
              {item.label}
              <X size={12} />
            </button>
          ))}
        </div>
      ) : null}

      <section className="filter-group control-span-2" aria-labelledby={`${panelId}-time`}>
        <div className="filter-group-heading">
          <CalendarDays size={15} />
          <h4 id={`${panelId}-time`}>Time range</h4>
        </div>
        <div className="filter-group-grid">
          <DateField label="Start date" value={filters.dateFrom} onChange={(value) => update("dateFrom", value)} />
          <DateField label="End date" value={filters.dateTo} onChange={(value) => update("dateTo", value)} />
        </div>
      </section>

      <section className="filter-group control-span-2" aria-labelledby={`${panelId}-attributes`}>
        <div className="filter-group-heading">
          <Filter size={15} />
          <h4 id={`${panelId}-attributes`}>Response attributes</h4>
        </div>
        <div className="filter-group-grid">
          <SelectField label="Source" value={filters.event} onChange={(value) => update("event", value)} options={options.event} />
          <SelectField label="Language" value={filters.language} onChange={(value) => update("language", value)} options={options.language} />
          <SelectField label="Emotion" value={filters.emotion} onChange={(value) => update("emotion", value)} options={options.emotion} />
          <SelectField label="Color" value={filters.color} onChange={(value) => update("color", value)} options={options.color} />
        </div>
      </section>
      {children}
    </ControlPanel>
  );
}
