import { EMOTION_ORDER } from "../types/dataModel.js";

export function countBy(records, accessor) {
  return records.reduce((map, record) => {
    const key = accessor(record) || "Unmapped";
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
}

export function atlasMetrics(records) {
  const emotions = countBy(records, (record) => record.Emotion_Normalized);
  const colors = countBy(records.flatMap((record) => String(record.Colors_List).split(",").map((color) => color.trim()).filter(Boolean)), (color) => color);
  const bodyAreas = countBy(records, (record) => record.Body_Area);
  const valence = countBy(records, (record) => record.Emotion_Valence);

  return {
    total: records.length,
    emotions: EMOTION_ORDER.map((emotion) => ({ emotion, count: emotions.get(emotion) || 0 })),
    colors: Array.from(colors, ([color, count]) => ({ color, count })).sort((a, b) => b.count - a.count),
    bodyAreas: Array.from(bodyAreas, ([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count),
    valence: Array.from(valence, ([quality, count]) => ({ quality, count })).sort((a, b) => b.count - a.count),
  };
}

export function emotionTimeSeries(records) {
  const dates = Array.from(new Set(records.map((record) => record.Date).filter(Boolean))).sort();
  const byDate = new Map(dates.map((date) => [date, records.filter((record) => record.Date === date)]));
  return dates.map((date) => {
    const dayRecords = byDate.get(date) || [];
    const row = { date, total: dayRecords.length };
    EMOTION_ORDER.forEach((emotion) => {
      row[emotion] = dayRecords.filter((record) => record.Emotion_Normalized === emotion).length;
    });
    return row;
  });
}
