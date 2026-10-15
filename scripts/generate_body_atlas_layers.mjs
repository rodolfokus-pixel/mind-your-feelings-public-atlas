import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, "public", "data", "myf_cleaned_data.json");
const OUT_DIR = path.join(ROOT, "public", "data", "body_layers");
const MANIFEST_PATH = path.join(ROOT, "public", "data", "body_atlas_layers.json");

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const PALETTE = {
  Red: "#EF4444",
  Orange: "#F97316",
  Yellow: "#FACC15",
  Green: "#22C55E",
  "Light Blue": "#38BDF8",
  "Deep Blue": "#1D4ED8",
  Purple: "#8B5CF6",
  Magenta: "#DB2777",
  "No color selected": "#94A3B8",
};

function crc32(buffer) {
  let crc = ~0;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function parsePng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("Not a PNG");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);

  const channelsByType = { 0: 1, 2: 3, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  if (!channels) throw new Error(`Unsupported PNG color type: ${colorType}`);

  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * 4);
  let sourceOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const row = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + stride));
    sourceOffset += stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x] || 0;
      const upLeft = x >= channels ? previous[x - channels] || 0 : 0;
      let value = row[x];
      if (filter === 1) value = (value + left) & 255;
      if (filter === 2) value = (value + up) & 255;
      if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
      if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
      }
      row[x] = value;
    }

    for (let x = 0; x < width; x += 1) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      if (colorType === 0) {
        pixels[dst] = row[src];
        pixels[dst + 1] = row[src];
        pixels[dst + 2] = row[src];
        pixels[dst + 3] = 255;
      } else if (colorType === 2) {
        pixels[dst] = row[src];
        pixels[dst + 1] = row[src + 1];
        pixels[dst + 2] = row[src + 2];
        pixels[dst + 3] = 255;
      } else if (colorType === 4) {
        pixels[dst] = row[src];
        pixels[dst + 1] = row[src];
        pixels[dst + 2] = row[src];
        pixels[dst + 3] = row[src + 1];
      } else {
        pixels[dst] = row[src];
        pixels[dst + 1] = row[src + 1];
        pixels[dst + 2] = row[src + 2];
        pixels[dst + 3] = row[src + 3];
      }
    }

    previous = row;
  }

  return { width, height, pixels };
}

function writePng({ width, height, pixels }) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    rows.push(Buffer.from([0]));
    rows.push(pixels.subarray(y * width * 4, (y + 1) * width * 4));
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND"),
  ]);
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function colorDistance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function selectedPalette(colorsList) {
  return String(colorsList || "")
    .split(",")
    .map((color) => color.trim())
    .filter((color) => color && color !== "No color selected")
    .map((color) => PALETTE[color])
    .filter(Boolean)
    .map(hexToRgb);
}

function isLikelyDrawingPixel(rgb, targets) {
  if (!targets.length) return false;
  const [r, g, b] = rgb;
  if (r > 238 && g > 238 && b > 238) return false;
  const nearest = Math.min(...targets.map((target) => colorDistance(rgb, target)));
  return nearest < 112;
}

function safeFileName(record) {
  return `${record.Response_ID}_${record.Emotion_Normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
}

const data = JSON.parse(await fs.readFile(DATA_PATH, "utf8"));
const records = data.cleaned_responses.filter((record) => record.Image_Path && record.Response_ID);

await fs.mkdir(OUT_DIR, { recursive: true });

const layers = [];

for (const record of records) {
  const targets = selectedPalette(record.Colors_List);
  const fileName = safeFileName(record);
  const outputPath = path.join(OUT_DIR, fileName);

  if (!targets.length) {
    layers.push({
      responseId: record.Response_ID,
      emotion: record.Emotion_Normalized,
      date: record.Date,
      language: record.Language,
      colors: record.Colors_List,
      src: `/data/body_layers/${fileName}`,
      pixelCount: 0,
      width: 0,
      height: 0,
      hasDrawing: false,
    });
    continue;
  }

  try {
    const decoded = parsePng(await fs.readFile(record.Image_Path));
    const output = Buffer.alloc(decoded.pixels.length);
    let pixelCount = 0;

    for (let index = 0; index < decoded.pixels.length; index += 4) {
      const alpha = decoded.pixels[index + 3];
      const rgb = [decoded.pixels[index], decoded.pixels[index + 1], decoded.pixels[index + 2]];
      if (alpha > 16 && isLikelyDrawingPixel(rgb, targets)) {
        output[index] = decoded.pixels[index];
        output[index + 1] = decoded.pixels[index + 1];
        output[index + 2] = decoded.pixels[index + 2];
        output[index + 3] = Math.min(235, Math.max(80, alpha));
        pixelCount += 1;
      }
    }

    await fs.writeFile(outputPath, writePng({ width: decoded.width, height: decoded.height, pixels: output }));
    layers.push({
      responseId: record.Response_ID,
      emotion: record.Emotion_Normalized,
      date: record.Date,
      language: record.Language,
      colors: record.Colors_List,
      src: `/data/body_layers/${fileName}`,
      pixelCount,
      width: decoded.width,
      height: decoded.height,
      hasDrawing: pixelCount > 0,
    });
  } catch (error) {
    layers.push({
      responseId: record.Response_ID,
      emotion: record.Emotion_Normalized,
      date: record.Date,
      language: record.Language,
      colors: record.Colors_List,
      src: `/data/body_layers/${fileName}`,
      pixelCount: 0,
      width: 0,
      height: 0,
      hasDrawing: false,
      error: error.message,
    });
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  layers,
  summary: {
    responsesWithImages: layers.length,
    layersWithDrawing: layers.filter((layer) => layer.hasDrawing).length,
    drawingPixels: layers.reduce((total, layer) => total + layer.pixelCount, 0),
  },
};

await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log(manifest.summary);
