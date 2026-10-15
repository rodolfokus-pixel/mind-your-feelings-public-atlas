export const EMPTY_FILTERS = {
  dateFrom: "",
  dateTo: "",
  event: "All",
  language: "All",
  emotion: "All",
  color: "All",
  bodyArea: "All",
};

export function uniqueOptions(records, field) {
  return Array.from(new Set(records.map((record) => record[field]).filter(Boolean))).sort();
}

export function applyFilters(records, filters) {
  return records.filter((record) => {
    const date = record.Date || "";
    const recordColors = String(record.Colors_List || "")
      .split(",")
      .map((color) => color.trim())
      .filter(Boolean);

    if (filters.dateFrom && date && date < filters.dateFrom) return false;
    if (filters.dateTo && date && date > filters.dateTo) return false;
    if (filters.event !== "All" && record.Event !== filters.event) return false;
    if (filters.language !== "All" && record.Language !== filters.language) return false;
    if (filters.emotion !== "All" && record.Emotion_Normalized !== filters.emotion) return false;
    if (filters.color !== "All" && !recordColors.includes(filters.color)) return false;
    if (filters.bodyArea !== "All" && record.Body_Area !== filters.bodyArea) return false;
    return true;
  });
}
