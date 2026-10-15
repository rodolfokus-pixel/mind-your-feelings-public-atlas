const EMOTION_QUALITY = {
  Happiness: ["Positive", "Medium", 2, "Positive / expressive / medium intensity"],
  Contentment: ["Positive", "Low / calm", 1, "Positive / calm / low intensity"],
  Sadness: ["Negative", "Low / calm", 1, "Negative / inward / low intensity"],
  Surprise: ["Neutral", "Medium", 2, "Neutral / uncertain / medium intensity"],
  Fear: ["Negative", "High / excessive", 3, "Negative / alert / high intensity"],
  Anger: ["Negative", "High / excessive", 3, "Negative / forceful / high intensity"],
};

export const NO_COLOR_SELECTED = "No color selected";

function canonicalEmotion(emotion) {
  const clean = String(emotion || "").trim();
  if (clean === "Amusement" || clean.toLowerCase() === "amusement") return "Happiness";
  return clean;
}

function canonicalColor(color) {
  const clean = String(color || "").trim();
  if (!clean) return "";
  if (clean === "Blue") return "Deep Blue";
  return clean;
}

function canonicalColors(value) {
  const colors = String(value || "")
    .split(",")
    .map(canonicalColor)
    .filter(Boolean);
  return colors.length ? Array.from(new Set(colors)) : [NO_COLOR_SELECTED];
}

function stableBodyArea(record) {
  const explicit = record.Body_Area || record.body_area || record.BodyArea || record.bodyZone || record.Body_Zone;
  return explicit || "Not mapped";
}

export function normalizeRecord(record, index = 0) {
  const emotion = canonicalEmotion(record.Emotion_Normalized || record.emotion || record.Emotion || "Unmapped");
  const quality = EMOTION_QUALITY[emotion] ?? ["Unknown", "Unknown", 0, "Unmapped"];
  const colorValues = canonicalColors(record.Colors_List || record.colors || record.Color || record.Primary_Color || "");
  const colors = colorValues.join(", ");
  const primaryColor = canonicalColor(record.Primary_Color) || colorValues[0];

  return {
    ...record,
    Response_ID: record.Response_ID || `response_${String(index + 1).padStart(4, "0")}`,
    Date: record.Date || record.date || "",
    Event: record.Data_Source || "MYF archive",
    Location: "Johnson Public Library",
    Emotion_Normalized: emotion,
    Emotion_Group: record.Emotion_Group || "Unmapped",
    Emotion_Valence: record.Emotion_Valence || quality[0],
    Emotion_Intensity: record.Emotion_Intensity || quality[1],
    Emotion_Intensity_Score: Number(record.Emotion_Intensity_Score || quality[2]),
    Emotion_Quality_Descriptor: record.Emotion_Quality_Descriptor || quality[3],
    Colors_List: colors,
    Color_Count: colorValues[0] === NO_COLOR_SELECTED ? 0 : colorValues.length,
    Primary_Color: primaryColor,
    Body_Area: stableBodyArea(record),
  };
}

export function normalizeRecords(records) {
  return records.map((record, index) => normalizeRecord(record, index));
}
