export const ATLAS_FIELDS = {
  responseId: "Response_ID",
  date: "Date",
  event: "Event",
  location: "Location",
  ageGroup: "Age_Group",
  emotion: "Emotion_Normalized",
  emotionGroup: "Emotion_Group",
  valence: "Emotion_Valence",
  intensity: "Emotion_Intensity",
  intensityScore: "Emotion_Intensity_Score",
  colors: "Colors_List",
  primaryColor: "Primary_Color",
  bodyArea: "Body_Area",
};

export const EMOTION_ORDER = [
  "Happiness",
  "Contentment",
  "Sadness",
  "Surprise",
  "Fear",
  "Anger",
];

export const EMOTION_DESCRIPTORS = {
  Happiness: "spark, social warmth, rising motion",
  Contentment: "quiet ground, softness, steady breath",
  Sadness: "low tide, interior weight, blue gravity",
  Surprise: "threshold, interruption, sudden light",
  Fear: "alert field, contraction, fast pulse",
  Anger: "heat, force, pressure, outward charge",
};

export const FALLBACK_BODY_AREAS = [
  "Head",
  "Chest",
  "Stomach",
  "Throat",
  "Hands",
  "Legs",
  "Whole body",
  "Not yet mapped",
];
