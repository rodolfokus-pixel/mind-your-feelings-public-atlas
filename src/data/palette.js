export const COLOR_HEX = {
  Yellow: "#FACC15",
  Red: "#EF4444",
  Orange: "#F97316",
  "Light Blue": "#7DD3FC",
  Green: "#22C55E",
  Magenta: "#DB2777",
  Purple: "#8B5CF6",
  "Deep Blue": "#1D4ED8",
  "No color selected": "#94A3B8",
};

export const EMOTION_PALETTE = {
  Happiness: "#FACC15",
  Contentment: "#7DD3FC",
  Sadness: "#2563EB",
  Surprise: "#DB2777",
  Fear: "#8B5CF6",
  Anger: "#EF4444",
};

export function colorForEmotion(emotion) {
  return EMOTION_PALETTE[emotion] ?? "#CBD5E1";
}

export function colorForSelection(color) {
  return COLOR_HEX[color] ?? "#CBD5E1";
}
