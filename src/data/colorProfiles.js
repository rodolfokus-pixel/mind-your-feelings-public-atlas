import { EMOTION_ORDER } from "../types/dataModel.js";
import { colorForSelection } from "./palette.js";

function colorsFromRecord(record) {
  return String(record.Colors_List || "")
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean);
}

export function colorProfileByEmotion(records) {
  return EMOTION_ORDER.reduce((profiles, emotion) => {
    const counts = new Map();
    records
      .filter((record) => record.Emotion_Normalized === emotion)
      .flatMap(colorsFromRecord)
      .forEach((color) => counts.set(color, (counts.get(color) || 0) + 1));

    const colors = Array.from(counts, ([color, count]) => ({
      color,
      count,
      hex: colorForSelection(color),
    })).sort((a, b) => b.count - a.count);

    profiles[emotion] = {
      emotion,
      colors,
      dominant: colors[0] || { color: "No color data", count: 0, hex: "#CBD5E1" },
      totalSelections: colors.reduce((sum, item) => sum + item.count, 0),
    };
    return profiles;
  }, {});
}

export function gradientStops(profile) {
  const colors = profile.colors.length ? profile.colors.slice(0, 4) : [profile.dominant];
  if (colors.length === 1) {
    return [
      { offset: "0%", hex: colors[0].hex },
      { offset: "100%", hex: colors[0].hex },
    ];
  }
  return colors.map((item, index) => ({
    offset: `${Math.round((index / (colors.length - 1)) * 100)}%`,
    hex: item.hex,
  }));
}
