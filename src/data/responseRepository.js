import { COLOR_HEX, colorForSelection } from "./palette.js";
import { NO_COLOR_SELECTED } from "./normalizers.js";

function parseDateParts(record) {
  const date = record.Date || record.date_local || "";
  const time = record.Time || record.time_local || "00:00:00";
  const parsed = new Date(`${date}T${String(time).slice(0, 8) || "00:00:00"}`);
  const fallback = new Date(`${date}T00:00:00`);
  const safe = Number.isNaN(parsed.getTime()) ? fallback : parsed;
  return Number.isNaN(safe.getTime()) ? null : safe;
}

function weekOfYear(date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
}

function weekdayLabel(record, createdAt) {
  const explicit = String(record.Weekday || record.weekday || "").trim();
  if (explicit) return explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
  return createdAt ? createdAt.toLocaleDateString("en-US", { weekday: "long" }) : "Undated";
}

export function selectedColors(record) {
  const colors = String(record.Colors_List || "")
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean);
  return colors.length ? colors : [NO_COLOR_SELECTED];
}

export function toResponseNodes(records) {
  return records
    .map((record, index) => {
      const createdAt = parseDateParts(record);
      const colors = selectedColors(record);
      return {
        id: record.Response_ID || `response_${index}`,
        index,
        createdAt,
        date: record.Date || "",
        weekday: weekdayLabel(record, createdAt),
        language: record.Language || "Unspecified",
        emotion: record.Emotion_Normalized || "Unmapped",
        valence: record.Emotion_Valence || "Unknown",
        intensity: record.Emotion_Intensity || "Unknown",
        intensityScore: Number(record.Emotion_Intensity_Score || 0),
        colors,
        colorHexes: colors.map((color) => colorForSelection(color)),
        colorCount: colors[0] === NO_COLOR_SELECTED ? 0 : colors.length,
        source: record.Data_Source || record.Event || "MYF archive",
      };
    })
    .sort((a, b) => {
      const aTime = a.createdAt?.getTime() ?? 0;
      const bTime = b.createdAt?.getTime() ?? 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.id.localeCompare(b.id);
    })
    .map((node, index) => ({ ...node, chronologicalIndex: index }));
}

export const GROUP_OPTIONS = [
  { id: "language", label: "Language", helper: "English, Spanish, or other captured language values." },
  { id: "time:month", label: "Time: Month", helper: "Calendar month of participation." },
  { id: "time:week", label: "Time: Week", helper: "ISO-style week grouping inside the year." },
  { id: "time:day", label: "Time: Day of Week", helper: "Seven weekday clusters: Monday through Sunday." },
  { id: "emotion:individual", label: "Emotion", helper: "Each normalized emotion becomes a group." },
  { id: "emotion:valence", label: "Valence", helper: "Positive, negative, neutral, and unknown categories." },
  { id: "color:selected", label: "Selected Color", helper: "Uses the first selected color as the anchor; multi-color nodes remain visible." },
  { id: "color:count", label: "Color Count", helper: "Groups by how many colors a participant selected." },
];

export function groupLabelFor(node, layerId) {
  if (layerId === "language") return node.language || "Unspecified";
  if (layerId === "time:month") return node.createdAt ? node.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Undated";
  if (layerId === "time:week") {
    if (!node.createdAt) return "Undated";
    return `${node.createdAt.getFullYear()} / Week ${String(weekOfYear(node.createdAt)).padStart(2, "0")}`;
  }
  if (layerId === "time:day") return node.weekday || "Undated";
  if (layerId === "emotion:individual") return node.emotion || "Unmapped";
  if (layerId === "emotion:valence") return node.valence || "Unknown";
  if (layerId === "color:selected") return node.colors[0] || NO_COLOR_SELECTED;
  if (layerId === "color:count") {
    if (!node.colorCount) return "No color selected";
    return `${node.colorCount} color${node.colorCount === 1 ? "" : "s"}`;
  }
  return "All responses";
}

export function groupColorFor(label, layerId) {
  if (layerId === "color:selected") return COLOR_HEX[label] || "#94A3B8";
  if (label === "Positive") return "#FACC15";
  if (label === "Negative") return "#8B5CF6";
  if (label === "Neutral") return "#7DD3FC";
  return "#77D9E8";
}

export function buildGroupHierarchy(nodes, layers) {
  const root = {
    id: "root",
    label: "All responses",
    depth: 0,
    layerId: "root",
    nodes,
    children: [],
    parentId: null,
  };

  function split(group, depth) {
    if (depth >= layers.length) return;
    const layer = layers[depth];
    const buckets = new Map();
    group.nodes.forEach((node) => {
      const label = groupLabelFor(node, layer.id);
      if (!buckets.has(label)) buckets.set(label, []);
      buckets.get(label).push(node);
    });
    const weekdayOrder = new Map(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Undated"].map((day, index) => [day, index]));
    group.children = Array.from(buckets, ([label, childNodes]) => ({
      id: `${group.id}/${layer.id}:${label}`,
      label,
      displayLabel: [...(group.pathLabels || []), label].join(" - "),
      pathLabels: [...(group.pathLabels || []), label],
      depth: depth + 1,
      layerId: layer.id,
      nodes: childNodes,
      children: [],
      parentId: group.id,
    })).sort((a, b) => {
      if (layer.id === "time:day") return (weekdayOrder.get(a.label) ?? 99) - (weekdayOrder.get(b.label) ?? 99);
      return b.nodes.length - a.nodes.length || a.label.localeCompare(b.label);
    });
    group.children.forEach((child) => split(child, depth + 1));
  }

  split(root, 0);
  const parents = [];
  const leaves = [];

  function walk(group) {
    if (group.children.length) {
      if (group.id !== "root") parents.push(group);
      group.children.forEach(walk);
    } else {
      leaves.push(group);
    }
  }

  walk(root);
  return { root, parents, leaves: leaves.length ? leaves : [root] };
}
