import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKDIR = path.resolve(process.env.MYF_WORKDIR || PROJECT_ROOT);
const OUTDIR = path.join(WORKDIR, "outputs", "myf_emotion_database");
const DATA_PATH = path.join(OUTDIR, "myf_cleaned_data.json");
const XLSX_PATH = path.join(OUTDIR, "MYF_emotion_database_cleaned_insights.xlsx");
const PREVIEW_DIR = path.join(OUTDIR, "previews");

const COLOR = {
  ink: "#111827",
  muted: "#6B7280",
  border: "#D1D5DB",
  panel: "#F8FAFC",
  dark: "#0F172A",
  teal: "#0F766E",
  coral: "#F97316",
  blue: "#2563EB",
  rose: "#DB2777",
  yellow: "#FACC15",
  green: "#22C55E",
  purple: "#8B5CF6",
};

const data = JSON.parse(await fs.readFile(DATA_PATH, "utf8"));
await fs.mkdir(OUTDIR, { recursive: true });
await fs.mkdir(PREVIEW_DIR, { recursive: true });

function colName(n) {
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - rem) / 26);
  }
  return name;
}

function sheetRange(rowCount, colCount, startRow = 1, startCol = 1) {
  return `${colName(startCol)}${startRow}:${colName(startCol + colCount - 1)}${startRow + rowCount - 1}`;
}

function tableFromRows(rows) {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  return {
    cols,
    values: [cols, ...rows.map((row) => cols.map((col) => row[col] ?? ""))],
  };
}

function styleTable(sheet, rowCount, colCount, options = {}) {
  if (!rowCount || !colCount) return;
  const full = sheet.getRange(sheetRange(rowCount, colCount));
  full.format = {
    font: { name: "Aptos", size: 10, color: COLOR.ink },
    borders: { preset: "outside", style: "thin", color: COLOR.border },
    verticalAlignment: "top",
    wrapText: true,
  };
  const header = sheet.getRange(sheetRange(1, colCount));
  header.format = {
    fill: options.headerFill ?? COLOR.dark,
    font: { name: "Aptos", size: 10, color: "#FFFFFF", bold: true },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };
  full.format.autofitColumns();
  full.format.autofitRows();
}

function writeRows(workbook, name, rows, options = {}) {
  const sheet = workbook.worksheets.add(name);
  const table = tableFromRows(rows);
  if (table.values.length && table.cols.length) {
    sheet.getRange(sheetRange(table.values.length, table.cols.length)).values = table.values;
    styleTable(sheet, table.values.length, table.cols.length, options);
  }
  return sheet;
}

function setWidths(sheet, widths) {
  for (const [col, width] of Object.entries(widths)) {
    sheet.getRange(`${col}:${col}`).format.columnWidthPx = width;
  }
}

function addTitle(sheet, title, subtitle) {
  sheet.getRange("A1:H1").values = [[title, "", "", "", "", "", "", ""]];
  sheet.getRange("A1:H1").format = {
    fill: COLOR.dark,
    font: { name: "Aptos Display", size: 20, color: "#FFFFFF", bold: true },
    verticalAlignment: "center",
  };
  sheet.getRange("A1:H1").format.rowHeightPx = 36;
  sheet.getRange("A2:H2").values = [[subtitle, "", "", "", "", "", "", ""]];
  sheet.getRange("A2:H2").format = {
    fill: "#E2E8F0",
    font: { name: "Aptos", size: 11, color: COLOR.ink },
    wrapText: true,
  };
  sheet.getRange("A2:H2").format.rowHeightPx = 34;
}

const workbook = Workbook.create();

const dashboard = workbook.worksheets.add("Dashboard");
addTitle(
  dashboard,
  "MYF Emotion Body Map: Cleaned Insights",
  "A standardized, chart-ready view of newer body-map submissions and older emotion/color responses."
);

const q = Object.fromEntries(data.quality_checks.map((row) => [row.Check, row.Value]));
const kpis = [
  ["Clean responses", q["Total cleaned response records"]],
  ["Color selections", q["Response color selections"]],
  ["Body-map PNGs", q["Indexed body-map PNG files"]],
  ["Matched body maps", q["Image files matched to cleaned response IDs"]],
];
dashboard.getRange("A4:H6").values = [
  ["Metric", "Value", "Metric", "Value", "Metric", "Value", "Metric", "Value"],
  [kpis[0][0], kpis[0][1], kpis[1][0], kpis[1][1], kpis[2][0], kpis[2][1], kpis[3][0], kpis[3][1]],
  ["", "", "", "", "", "", "", ""],
];
dashboard.getRange("A4:H4").format = { fill: COLOR.teal, font: { color: "#FFFFFF", bold: true }, horizontalAlignment: "center" };
dashboard.getRange("A5:H5").format = {
  fill: "#ECFDF5",
  font: { size: 14, bold: true, color: COLOR.dark },
  horizontalAlignment: "center",
};
dashboard.getRange("A5:H5").format.numberFormat = [["@", "0", "@", "0", "@", "0", "@", "0"]];

const topEmotion = data.emotion_summary[0];
const topColor = data.color_summary[0];
const insights = [
  ["Insight", "Read"],
  ["Most common normalized emotion", `${topEmotion.Emotion_Normalized} (${topEmotion.Responses} responses)`],
  ["Most selected color", `${topColor.Color_Normalized} (${topColor.Selections} selections)`],
  ["Cross-era coverage", `${q["New detailed responses"]} newer detailed responses and ${q["Older basic responses"]} older basic responses`],
  ["Emotion quality fields", "Valence, intensity label, intensity score, and quality descriptor are now available for visual mapping."],
  ["Image use", `${q["Image files matched to cleaned response IDs"]} body-map files are matched to newer responses; archive extras remain indexed.`],
  ["Clean-up rule", "Original labels are preserved while normalized fields support combined analysis."],
];
dashboard.getRange("A8:B14").values = insights;
styleTable(dashboard, insights.length, 2, { headerFill: COLOR.rose });
setWidths(dashboard, { A: 220, B: 520, C: 120, D: 120, E: 120, F: 120, G: 120, H: 120 });

dashboard.charts.add("bar", {
  title: "Responses by Normalized Emotion",
  categories: data.emotion_summary.map((row) => row.Emotion_Normalized),
  series: [{ name: "Responses", values: data.emotion_summary.map((row) => row.Responses), fill: { type: "solid", color: COLOR.blue } }],
  hasLegend: false,
  dataLabels: { showValue: true, position: "outEnd", textStyle: { fontSize: 9 } },
  xAxis: { textStyle: { fontSize: 9 } },
  yAxis: { majorGridlines: { fill: "#E5E7EB", style: "solid", width: 1 } },
  from: { row: 7, col: 3 },
  extent: { widthPx: 500, heightPx: 280 },
});

dashboard.charts.add("bar", {
  title: "Color Selections",
  categories: data.color_summary.map((row) => row.Color_Normalized),
  series: [{ name: "Selections", values: data.color_summary.map((row) => row.Selections), fill: { type: "solid", color: COLOR.coral } }],
  hasLegend: false,
  dataLabels: { showValue: true, position: "outEnd", textStyle: { fontSize: 9 } },
  xAxis: { textStyle: { fontSize: 9 } },
  yAxis: { majorGridlines: { fill: "#E5E7EB", style: "solid", width: 1 } },
  from: { row: 22, col: 3 },
  extent: { widthPx: 500, heightPx: 280 },
});

dashboard.getRange("A16:B29").values = [
  ["How to use this workbook", ""],
  ["Cleaned_Responses", "One row per interaction, with original and normalized emotion/color fields."],
  ["Color_Selections", "One row per color choice. Use this for emotion-color matrices and future LED mappings."],
  ["Image_Index", "The body-map image archive with parsed metadata and local file paths."],
  ["Emotion_Quality_Summary", "Counts by positive/negative/neutral valence and low/medium/high intensity."],
  ["Emotion_Color_Matrix", "A chart-ready heatmap-style table showing color selections by emotion."],
  ["Quality_Checks", "Counts and assumptions used during clean-up."],
  ["", ""],
  ["Recommended next visual step", "Use Color_Selections plus Image_Index to create body-region heatmaps or animated LED palettes."],
  ["", ""],
  ["Normalization note", "The older tab has less body-map detail, so it is included for emotion/color volume while the newer tab powers image-backed visualization."],
  ["", ""],
  ["Source files", "MYFdatabase.xlsx, the appended Responses CSV, and the combined MYF_Responses_Images repository."],
  ["", ""],
];
styleTable(dashboard, 14, 2, { headerFill: COLOR.dark });

const responseSheet = writeRows(workbook, "Cleaned_Responses", data.cleaned_responses, { headerFill: COLOR.dark });
setWidths(responseSheet, { A: 150, B: 165, C: 90, D: 85, F: 90, G: 120, H: 130, I: 170, J: 120, K: 130, L: 90, M: 240, N: 190, S: 260, T: 420, U: 420 });

const colorSheet = writeRows(workbook, "Color_Selections", data.color_selections, { headerFill: COLOR.teal });
setWidths(colorSheet, { A: 150, B: 160, C: 90, E: 130, F: 170, G: 120, H: 130, I: 90, J: 240, L: 130, M: 90 });

const imageSheet = writeRows(workbook, "Image_Index", data.image_index, { headerFill: COLOR.rose });
setWidths(imageSheet, { A: 300, B: 360, C: 620, D: 180, E: 120, F: 140, G: 140, H: 180 });

const emotionSheet = writeRows(workbook, "Emotion_Summary", data.emotion_summary, { headerFill: COLOR.blue });
emotionSheet.charts.add("bar", {
  title: "Emotion Volume",
  categories: data.emotion_summary.map((row) => row.Emotion_Normalized),
  series: [{ name: "Responses", values: data.emotion_summary.map((row) => row.Responses), fill: { type: "solid", color: COLOR.blue } }],
  hasLegend: false,
  dataLabels: { showValue: true, position: "outEnd" },
  from: { row: 1, col: 5 },
  extent: { widthPx: 520, heightPx: 300 },
});

const qualitySheet = writeRows(workbook, "Emotion_Quality_Summary", data.quality_summary, { headerFill: COLOR.rose });
qualitySheet.charts.add("bar", {
  title: "Responses by Valence and Intensity",
  categories: data.quality_summary.map((row) => `${row.Emotion_Valence} | ${row.Emotion_Intensity}`),
  series: [{ name: "Responses", values: data.quality_summary.map((row) => row.Responses), fill: { type: "solid", color: COLOR.rose } }],
  hasLegend: false,
  dataLabels: { showValue: true, position: "outEnd" },
  xAxis: { textStyle: { fontSize: 9 } },
  from: { row: 1, col: 6 },
  extent: { widthPx: 560, heightPx: 300 },
});

const colorSummarySheet = writeRows(workbook, "Color_Summary", data.color_summary, { headerFill: COLOR.coral });
for (let i = 0; i < data.color_summary.length; i += 1) {
  colorSummarySheet.getRange(`B${i + 2}`).format.fill = data.color_summary[i].Color_Hex;
}
colorSummarySheet.charts.add("bar", {
  title: "Color Selection Volume",
  categories: data.color_summary.map((row) => row.Color_Normalized),
  series: [{ name: "Selections", values: data.color_summary.map((row) => row.Selections), fill: { type: "solid", color: COLOR.coral } }],
  hasLegend: false,
  dataLabels: { showValue: true, position: "outEnd" },
  from: { row: 1, col: 5 },
  extent: { widthPx: 520, heightPx: 300 },
});

const sourceSheet = writeRows(workbook, "Emotion_By_Source", data.emotion_by_source, { headerFill: COLOR.green });
sourceSheet.charts.add("bar", {
  title: "Emotion Comparison by Dataset",
  categories: data.emotion_by_source.map((row) => row.Emotion_Normalized),
  series: Object.keys(data.emotion_by_source[0] ?? {})
    .filter((key) => key !== "Emotion_Normalized")
    .map((key, idx) => ({
      name: key,
      values: data.emotion_by_source.map((row) => row[key] ?? 0),
      fill: { type: "solid", color: idx === 0 ? COLOR.green : COLOR.purple },
    })),
  hasLegend: true,
  legend: { position: "bottom" },
  barOptions: { direction: "column", grouping: "clustered", gapWidth: 120 },
  dataLabels: { showValue: false },
  from: { row: 1, col: 5 },
  extent: { widthPx: 560, heightPx: 320 },
});

const matrixSheet = writeRows(workbook, "Emotion_Color_Matrix", data.emotion_color_matrix, { headerFill: COLOR.purple });
if (data.emotion_color_matrix.length) {
  const matrixCols = Object.keys(data.emotion_color_matrix[0]).length;
  matrixSheet.getRange(`B2:${colName(matrixCols)}${data.emotion_color_matrix.length + 1}`).conditionalFormats.add("colorScale", {
    criteria: [
      { type: "lowestValue", color: "#F8FAFC" },
      { type: "percentile", value: 50, color: "#FDE68A" },
      { type: "highestValue", color: "#EF4444" },
    ],
  });
}

const dailySheet = writeRows(workbook, "Daily_Trends", data.daily_summary, { headerFill: COLOR.dark });
dailySheet.charts.add("line", {
  title: "Daily Response Volume",
  categories: data.daily_summary.map((row) => `${row.Date} ${row.Data_Source.replace(" responses", "")}`),
  series: [{ name: "Responses", values: data.daily_summary.map((row) => row.Responses), line: { fill: COLOR.teal, style: "solid", width: 2 } }],
  hasLegend: false,
  xAxis: { textStyle: { fontSize: 7 } },
  yAxis: { majorGridlines: { fill: "#E5E7EB", style: "solid", width: 1 } },
  from: { row: 1, col: 5 },
  extent: { widthPx: 720, heightPx: 320 },
});

writeRows(workbook, "Language_Summary", data.language_summary, { headerFill: COLOR.teal });
writeRows(workbook, "Source_Summary", data.source_summary, { headerFill: COLOR.dark });

const dictionaryRows = [
  { Field: "Response_ID", Meaning: "Stable identifier for each interaction. New records preserve submission IDs; old records use old_####." },
  { Field: "Data_Source", Meaning: "Identifies whether the row came from the newer detailed Responses tab or older 121125-3726 tab." },
  { Field: "Original_Emotion", Meaning: "The exact emotion label from the source workbook." },
  { Field: "Emotion_Normalized", Meaning: "Standardized emotion label used for combined analysis." },
  { Field: "Emotion_Group", Meaning: "Interpretive grouping for high-level visualization and comparison." },
  { Field: "Emotion_Valence", Meaning: "Processing-friendly quality: Positive, Negative, Neutral, or Unknown." },
  { Field: "Emotion_Intensity", Meaning: "Processing-friendly intensity label: Low / calm, Medium, High / excessive, or Unknown." },
  { Field: "Emotion_Intensity_Score", Meaning: "Numeric intensity pointer for sorting, scaling LEDs, animation speed, or chart sizing: 1 low, 2 medium, 3 high." },
  { Field: "Emotion_Quality_Descriptor", Meaning: "Readable combined descriptor joining valence, tone, and intensity." },
  { Field: "Colors_List", Meaning: "Comma-separated colors selected in the interaction." },
  { Field: "Color_Selections", Meaning: "Long-form table where each selected color becomes its own row." },
  { Field: "Image_Index", Meaning: "Archive inventory for body-map PNG files with parsed emotion/language/timestamp metadata." },
  { Field: "Matched_Response", Meaning: "True when the image filename or submission ID matches a cleaned newer response." },
];
writeRows(workbook, "Data_Dictionary", dictionaryRows, { headerFill: COLOR.dark });
writeRows(workbook, "Quality_Checks", data.quality_checks, { headerFill: COLOR.rose });

const inspection = await workbook.inspect({
  kind: "table",
  range: "Dashboard!A1:H29",
  include: "values,formulas",
  tableMaxRows: 29,
  tableMaxCols: 8,
});
console.log(inspection.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

for (const [sheetName, range] of [
  ["Dashboard", "A1:H32"],
  ["Cleaned_Responses", "A1:V24"],
  ["Color_Selections", "A1:M24"],
  ["Image_Index", "A1:H24"],
  ["Emotion_Quality_Summary", "A1:J12"],
  ["Emotion_Color_Matrix", "A1:J12"],
  ["Quality_Checks", "A1:C12"],
]) {
  await workbook.render({ sheetName, range, scale: 1 });
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(XLSX_PATH);

const checkInput = await FileBlob.load(XLSX_PATH);
const checkWorkbook = await SpreadsheetFile.importXlsx(checkInput);
const exportedCheck = await checkWorkbook.inspect({
  kind: "match",
  searchTerm: "MYF Emotion Body Map",
  options: { maxResults: 5 },
  summary: "export smoke test",
});
console.log(exportedCheck.ndjson);
console.log(XLSX_PATH);
