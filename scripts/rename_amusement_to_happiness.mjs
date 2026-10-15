import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const JSON_FILES = [
  "outputs/myf_emotion_database/myf_cleaned_data.json",
  "public/data/myf_cleaned_data.json",
  "public/data/body_atlas_layers.json",
  "public/data/body_atlas_points.json",
];

function replaceEmotion(value) {
  if (Array.isArray(value)) return value.map(replaceEmotion);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceEmotion(entry)]));
  }
  if (value === "Amusement") return "Happiness";
  if (typeof value === "string") {
    return value
      .replaceAll("Amusement", "Happiness")
      .replaceAll("_amusement.png", "_happiness.png")
      .replaceAll("/amusement.png", "/happiness.png");
  }
  return value;
}

for (const relative of JSON_FILES) {
  const filePath = path.join(ROOT, relative);
  try {
    const payload = JSON.parse(await fs.readFile(filePath, "utf8"));
    await fs.writeFile(filePath, `${JSON.stringify(replaceEmotion(payload), null, 2)}\n`);
    console.log(`updated ${relative}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const bodyLayerDir = path.join(ROOT, "public", "data", "body_layers");
try {
  const entries = await fs.readdir(bodyLayerDir);
  for (const entry of entries) {
    if (!entry.endsWith("_amusement.png")) continue;
    const renamed = entry.replace("_amusement.png", "_happiness.png");
    await fs.rename(path.join(bodyLayerDir, entry), path.join(bodyLayerDir, renamed));
  }
  console.log("renamed generated body layer files");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
