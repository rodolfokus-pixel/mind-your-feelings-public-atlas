import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.resolve(process.argv[2] || root);
const sourcePublic = path.join(sourceRoot, "public");
const targetPublic = path.join(root, "public");
const sourceData = path.join(sourcePublic, "data");
const targetData = path.join(targetPublic, "data");

const sourceAtlas = JSON.parse(fs.readFileSync(path.join(sourceData, "myf_cleaned_data.json"), "utf8"));
const sourceLayers = JSON.parse(fs.readFileSync(path.join(sourceData, "body_atlas_layers.json"), "utf8"));

const idMap = new Map();
const publicRecords = (sourceAtlas.cleaned_responses || []).map((record, index) => {
  const publicId = `response_${String(index + 1).padStart(4, "0")}`;
  idMap.set(record.Response_ID, publicId);
  return {
    Response_ID: publicId,
    Data_Source: record.Data_Source,
    Date: record.Date,
    Weekday: record.Weekday,
    Language: record.Language,
    Emotion_Normalized: record.Emotion_Normalized,
    Emotion_Group: record.Emotion_Group,
    Emotion_Valence: record.Emotion_Valence,
    Emotion_Intensity: record.Emotion_Intensity,
    Emotion_Intensity_Score: record.Emotion_Intensity_Score,
    Emotion_Quality_Descriptor: record.Emotion_Quality_Descriptor,
    Colors_List: record.Colors_List,
    Color_Count: record.Color_Count,
    Primary_Color: record.Primary_Color,
  };
});

fs.mkdirSync(targetData, { recursive: true });
fs.writeFileSync(
  path.join(targetData, "myf_cleaned_data.json"),
  `${JSON.stringify({ cleaned_responses: publicRecords }, null, 2)}\n`,
);

const stagedLayers = path.join(targetData, ".body_layers_public");
fs.rmSync(stagedLayers, { recursive: true, force: true });
fs.mkdirSync(stagedLayers, { recursive: true });

const publicLayers = [];
for (const layer of sourceLayers.layers || []) {
  const publicId = idMap.get(layer.responseId);
  if (!publicId) continue;
  const sourceRelative = String(layer.src || "").replace(/^\//, "");
  const sourceImage = path.join(sourcePublic, sourceRelative);
  const publicFilename = `${publicId}.png`;
  if (layer.hasDrawing && fs.existsSync(sourceImage)) {
    fs.copyFileSync(sourceImage, path.join(stagedLayers, publicFilename));
  }
  publicLayers.push({
    responseId: publicId,
    emotion: layer.emotion,
    period: String(layer.date || "").slice(0, 7),
    language: layer.language,
    colors: layer.colors,
    src: layer.hasDrawing ? `/data/body_layers/${publicFilename}` : "",
    pixelCount: layer.pixelCount,
    width: layer.width,
    height: layer.height,
    hasDrawing: Boolean(layer.hasDrawing),
  });
}

const targetLayers = path.join(targetData, "body_layers");
fs.rmSync(targetLayers, { recursive: true, force: true });
fs.renameSync(stagedLayers, targetLayers);
fs.writeFileSync(
  path.join(targetData, "body_atlas_layers.json"),
  `${JSON.stringify({
    release: "public",
    layers: publicLayers,
    summary: {
      responses: publicLayers.length,
      drawings: publicLayers.filter((layer) => layer.hasDrawing).length,
    },
  }, null, 2)}\n`,
);

fs.rmSync(path.join(targetData, "body_atlas_points.json"), { force: true });

console.log(`Sanitized ${publicRecords.length} responses and ${publicLayers.length} body-atlas layers.`);
