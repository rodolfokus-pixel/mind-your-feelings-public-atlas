import json
import math
import os
import re
import zipfile
from collections import Counter
from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_XLSX = Path(os.environ.get("MYF_SOURCE_XLSX", PROJECT_ROOT / "MYFdatabase.xlsx")).expanduser().resolve()
SOURCE_ZIP = Path(os.environ.get("MYF_SOURCE_ZIP", PROJECT_ROOT / "MYF_Responses_Images.zip")).expanduser().resolve()
ADDITIONAL_RESPONSES_CSV = Path(
    os.environ.get("MYF_NEW_RESPONSES_CSV", PROJECT_ROOT / "Responses-Table 1.csv")
).expanduser().resolve()
ADDITIONAL_SOURCE_ZIP = Path(
    os.environ.get("MYF_ADDITIONAL_SOURCE_ZIP", PROJECT_ROOT / "NEW_MYF_Responses_Images.zip")
).expanduser().resolve()
WORKDIR = Path(os.environ.get("MYF_WORKDIR", PROJECT_ROOT)).expanduser().resolve()
OUT_JSON = WORKDIR / "outputs" / "myf_emotion_database" / "myf_cleaned_data.json"
LOCAL_IMAGE_DIR = WORKDIR / "MYF_Responses_Images"


EMOTION_MAP = {
    "amusement": ("Happiness", "Positive / expressive"),
    "content": ("Contentment", "Positive / calm"),
    "contentment": ("Contentment", "Positive / calm"),
    "satisfecho": ("Contentment", "Positive / calm"),
    "anger": ("Anger", "High arousal / difficult"),
    "rabia": ("Anger", "High arousal / difficult"),
    "sad": ("Sadness", "Low arousal / difficult"),
    "triste": ("Sadness", "Low arousal / difficult"),
    "sadness": ("Sadness", "Low arousal / difficult"),
    "fear": ("Fear", "High arousal / difficult"),
    "miedo": ("Fear", "High arousal / difficult"),
    "surprise": ("Surprise", "Arousal / uncertain"),
    "suprise": ("Surprise", "Arousal / uncertain"),
    "sorpresa": ("Surprise", "Arousal / uncertain"),
    "happy": ("Happiness", "Positive / expressive"),
    "happiness": ("Happiness", "Positive / expressive"),
    "felicidad": ("Happiness", "Positive / expressive"),
}

EMOTION_QUALITY_MAP = {
    "Happiness": {
        "Emotion_Valence": "Positive",
        "Emotion_Intensity": "Medium",
        "Emotion_Intensity_Score": 2,
        "Emotion_Quality_Descriptor": "Positive / expressive / medium intensity",
    },
    "Contentment": {
        "Emotion_Valence": "Positive",
        "Emotion_Intensity": "Low / calm",
        "Emotion_Intensity_Score": 1,
        "Emotion_Quality_Descriptor": "Positive / calm / low intensity",
    },
    "Sadness": {
        "Emotion_Valence": "Negative",
        "Emotion_Intensity": "Low / calm",
        "Emotion_Intensity_Score": 1,
        "Emotion_Quality_Descriptor": "Negative / inward / low intensity",
    },
    "Surprise": {
        "Emotion_Valence": "Neutral",
        "Emotion_Intensity": "Medium",
        "Emotion_Intensity_Score": 2,
        "Emotion_Quality_Descriptor": "Neutral / uncertain / medium intensity",
    },
    "Fear": {
        "Emotion_Valence": "Negative",
        "Emotion_Intensity": "High / excessive",
        "Emotion_Intensity_Score": 3,
        "Emotion_Quality_Descriptor": "Negative / alert / high intensity",
    },
    "Anger": {
        "Emotion_Valence": "Negative",
        "Emotion_Intensity": "High / excessive",
        "Emotion_Intensity_Score": 3,
        "Emotion_Quality_Descriptor": "Negative / forceful / high intensity",
    },
}

COLOR_MAP = {
    "deepblue": ("Deep Blue", "#1D4ED8"),
    "blue": ("Blue", "#2563EB"),
    "lightblue": ("Light Blue", "#7DD3FC"),
    "light blue": ("Light Blue", "#7DD3FC"),
    "magenta": ("Magenta", "#DB2777"),
    "yellow": ("Yellow", "#FACC15"),
    "green": ("Green", "#22C55E"),
    "orange": ("Orange", "#F97316"),
    "red": ("Red", "#EF4444"),
    "purple": ("Purple", "#8B5CF6"),
}


def clean_text(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    return str(value).strip()


def norm_key(value):
    return re.sub(r"[^a-z0-9]+", "", clean_text(value).lower())


def normalize_emotion(value):
    original = clean_text(value)
    key = norm_key(original)
    if key in EMOTION_MAP:
        return EMOTION_MAP[key]
    return (original.title() if original else "Unknown", "Unmapped")


def display_original_emotion(value):
    original = clean_text(value)
    key = norm_key(original)
    if key in {"amusement", "happy", "happiness", "felicidad"}:
        return "Happiness"
    return original


def emotion_quality(emotion_normalized):
    return EMOTION_QUALITY_MAP.get(emotion_normalized, {
        "Emotion_Valence": "Unknown",
        "Emotion_Intensity": "Unknown",
        "Emotion_Intensity_Score": 0,
        "Emotion_Quality_Descriptor": "Unmapped",
    })


def normalize_color(value):
    original = clean_text(value)
    key = norm_key(original)
    if key in COLOR_MAP:
        return COLOR_MAP[key]
    return (original.title() if original else "Unknown", "#9CA3AF")


def parse_color_list(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return []
    if isinstance(value, list):
        raw = value
    else:
        text = str(value).strip()
        try:
            raw = json.loads(text)
        except Exception:
            raw = [part.strip() for part in re.split(r"[,;/|]", text) if part.strip()]
    return [normalize_color(item)[0] for item in raw if clean_text(item)]


def parse_image_name(path):
    name = Path(path).name
    pattern = re.compile(
        r"^(?P<emotion>[^_]+)_(?P<language>[^_]+)_(?P<date>\d{4}-\d{2}-\d{2})_"
        r"(?P<time>\d{2}-\d{2}-\d{2})_sub_(?P<submission_id>\d+)_(?P<suffix>[^.]+)\.png$",
        re.I,
    )
    match = pattern.match(name)
    parsed = match.groupdict() if match else {}
    if parsed:
        parsed["full_submission_id"] = f"sub_{parsed['submission_id']}_{parsed['suffix']}"
        parsed["timestamp_from_filename"] = f"{parsed['date']} {parsed['time'].replace('-', ':')}"
        parsed["emotion_normalized"], _ = normalize_emotion(parsed["emotion"])
        parsed["language_normalized"] = {"en": "English", "es": "Spanish"}.get(parsed["language"], parsed["language"])
    return parsed


def safe_date(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    dt = pd.to_datetime(value, errors="coerce")
    return "" if pd.isna(dt) else dt.date().isoformat()


def safe_time(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%H:%M:%S")
    text = str(value)
    dt = pd.to_datetime(text, errors="coerce")
    return text if pd.isna(dt) else dt.strftime("%H:%M:%S")


def make_records():
    newer = pd.read_excel(SOURCE_XLSX, sheet_name="Responses", usecols=lambda c: c != "raw_submission_json")
    if ADDITIONAL_RESPONSES_CSV.exists():
        additional = pd.read_csv(ADDITIONAL_RESPONSES_CSV, dtype=str)
        additional = additional[[column for column in additional.columns if column and not str(column).startswith("Unnamed:")]]
        additional = additional.drop(columns=["raw_submission_json"], errors="ignore")
        newer = pd.concat([newer, additional], ignore_index=True)
        newer = newer.drop_duplicates(subset=["submission_id"], keep="last")
    older = pd.read_excel(SOURCE_XLSX, sheet_name="121125-3726")

    records = []
    color_long = []

    for i, row in newer.iterrows():
        response_id = clean_text(row.get("submission_id")) or f"new_{i + 1:04d}"
        emotion_norm, group = normalize_emotion(row.get("emotion"))
        quality = emotion_quality(emotion_norm)
        colors = parse_color_list(row.get("colors_used_json"))
        timestamp = pd.to_datetime(row.get("timestamp_iso"), errors="coerce")
        date_value = row.get("date_local") if clean_text(row.get("date_local")) else timestamp
        language = {"en": "English", "es": "Spanish"}.get(clean_text(row.get("language")).lower(), clean_text(row.get("language")))
        image_filename = clean_text(row.get("image_filename"))
        image_path = str((WORKDIR / "MYF_Responses_Images" / image_filename).resolve()) if image_filename else ""
        base = {
            "Response_ID": response_id,
            "Data_Source": "New detailed responses",
            "Date": safe_date(date_value),
            "Time": clean_text(row.get("time_local"))[:8],
            "Weekday": clean_text(row.get("weekday")).title(),
            "Language": language,
            "Original_Emotion": display_original_emotion(row.get("emotion")),
            "Emotion_Normalized": emotion_norm,
            "Emotion_Group": group,
            **quality,
            "Colors_List": ", ".join(colors),
            "Color_Count": len(colors),
            "Primary_Color": colors[0] if colors else "",
            "Emailed_Self": str(row.get("emailed_self")).upper() in ("TRUE", "YES", "1"),
            "Kiosk_ID": clean_text(row.get("kiosk_id")),
            "Image_Filename": image_filename,
            "Image_Path": image_path if image_filename else "",
            "Image_Drive_URL": clean_text(row.get("image_drive_url")),
            "Upload_Status": clean_text(row.get("upload_status")),
        }
        records.append(base)
        for idx, color in enumerate(colors, 1):
            color_long.append({
                "Response_ID": response_id,
                "Data_Source": base["Data_Source"],
                "Date": base["Date"],
                "Language": base["Language"],
                "Emotion_Normalized": emotion_norm,
                "Emotion_Group": group,
                **quality,
                "Color_Rank": idx,
                "Color_Normalized": color,
                "Color_Hex": normalize_color(color)[1],
            })

    for i, row in older.iterrows():
        response_id = f"old_{i + 1:04d}"
        emotion_norm, group = normalize_emotion(row.get("Emotion"))
        quality = emotion_quality(emotion_norm)
        color = normalize_color(row.get("Color"))[0]
        language = {"english": "English", "spanish": "Spanish"}.get(clean_text(row.get("Language")).lower(), clean_text(row.get("Language")))
        base = {
            "Response_ID": response_id,
            "Data_Source": "Older basic responses",
            "Date": safe_date(row.get("Date")),
            "Time": safe_time(row.get("Time")),
            "Weekday": "",
            "Language": language,
            "Original_Emotion": display_original_emotion(row.get("Emotion")),
            "Emotion_Normalized": emotion_norm,
            "Emotion_Group": group,
            **quality,
            "Colors_List": color,
            "Color_Count": 1 if color else 0,
            "Primary_Color": color,
            "Emailed_Self": clean_text(row.get("emailed (yes/no)")).lower() in ("yes", "true", "1"),
            "Kiosk_ID": "",
            "Image_Filename": clean_text(row.get("Image")),
            "Image_Path": "",
            "Image_Drive_URL": "",
            "Upload_Status": "",
        }
        records.append(base)
        if color:
            color_long.append({
                "Response_ID": response_id,
                "Data_Source": base["Data_Source"],
                "Date": base["Date"],
                "Language": language,
                "Emotion_Normalized": emotion_norm,
                "Emotion_Group": group,
                **quality,
                "Color_Rank": 1,
                "Color_Normalized": color,
                "Color_Hex": normalize_color(color)[1],
            })

    return records, color_long


def make_image_index(response_ids, response_filenames):
    image_rows = []
    files = []
    if LOCAL_IMAGE_DIR.exists():
        files.extend(sorted(LOCAL_IMAGE_DIR.rglob("*.png")))

    for archive_path in [SOURCE_ZIP, ADDITIONAL_SOURCE_ZIP]:
        if not archive_path.exists():
            continue
        with zipfile.ZipFile(archive_path) as archive:
            files.extend(
                Path(path)
                for path in archive.namelist()
                if path.lower().endswith(".png") and not path.startswith("__MACOSX/")
            )

    seen = set()
    for path in files:
        filename = Path(path).name
        if filename in seen:
            continue
        seen.add(filename)
        parsed = parse_image_name(path)
        sid = parsed.get("full_submission_id", "")
        local_path = LOCAL_IMAGE_DIR / filename
        image_rows.append({
            "Image_Filename": filename,
            "Archive_Path": str(path),
            "Local_Image_Path": str(local_path.resolve()) if local_path.exists() else "",
            "Submission_ID_From_Filename": sid,
            "Matched_Response": sid in response_ids or filename in response_filenames,
            "Emotion_From_Filename": parsed.get("emotion_normalized", ""),
            "Language_From_Filename": parsed.get("language_normalized", ""),
            "Timestamp_From_Filename": parsed.get("timestamp_from_filename", ""),
        })
    return image_rows


def count_by(rows, fields):
    counts = Counter(tuple(row.get(field, "") for field in fields) for row in rows)
    return [dict(zip(fields, key), Count=value) for key, value in sorted(counts.items())]


def pivot_counts(rows, index_field, column_field, value_name="Count"):
    df = pd.DataFrame(rows)
    if df.empty:
        return []
    pivot = pd.pivot_table(df, index=index_field, columns=column_field, values=value_name if value_name in df else None, aggfunc="size", fill_value=0)
    pivot = pivot.reset_index()
    return pivot.to_dict(orient="records")


def main():
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    records, color_long = make_records()
    response_ids = {r["Response_ID"] for r in records}
    response_filenames = {r["Image_Filename"] for r in records if r["Image_Filename"]}
    image_index = make_image_index(response_ids, response_filenames)

    records_df = pd.DataFrame(records)
    color_df = pd.DataFrame(color_long)
    image_df = pd.DataFrame(image_index)

    emotion_summary = (
        records_df.groupby([
            "Emotion_Normalized",
            "Emotion_Group",
            "Emotion_Valence",
            "Emotion_Intensity",
            "Emotion_Intensity_Score",
            "Emotion_Quality_Descriptor",
        ], dropna=False)
        .size().reset_index(name="Responses").sort_values("Responses", ascending=False)
    )
    quality_summary = (
        records_df.groupby(["Emotion_Valence", "Emotion_Intensity", "Emotion_Intensity_Score"], dropna=False)
        .size().reset_index(name="Responses").sort_values(["Emotion_Intensity_Score", "Responses"], ascending=[True, False])
    )
    source_summary = records_df.groupby("Data_Source").size().reset_index(name="Responses")
    language_summary = records_df.groupby("Language").size().reset_index(name="Responses")
    color_summary = (
        color_df.groupby(["Color_Normalized", "Color_Hex"], dropna=False)
        .size().reset_index(name="Selections").sort_values("Selections", ascending=False)
    )
    daily_summary = records_df.groupby(["Date", "Data_Source"]).size().reset_index(name="Responses")
    emotion_by_source = pd.pivot_table(records_df, index="Emotion_Normalized", columns="Data_Source", aggfunc="size", fill_value=0).reset_index()
    emotion_color_matrix = pd.pivot_table(color_df, index="Emotion_Normalized", columns="Color_Normalized", aggfunc="size", fill_value=0).reset_index()
    quality_checks = pd.DataFrame([
        {"Check": "Total cleaned response records", "Value": len(records), "Notes": "New and older sheets combined"},
        {"Check": "New detailed responses", "Value": int((records_df["Data_Source"] == "New detailed responses").sum()), "Notes": "Rows from Responses tab"},
        {"Check": "Older basic responses", "Value": int((records_df["Data_Source"] == "Older basic responses").sum()), "Notes": "Rows from 121125-3726 tab"},
        {"Check": "Response color selections", "Value": len(color_long), "Notes": "New responses can contain multiple colors"},
        {"Check": "Indexed body-map PNG files", "Value": len(image_index), "Notes": "PNG body map files from the local repository and provided archives"},
        {"Check": "Image files matched to cleaned response IDs", "Value": int(image_df["Matched_Response"].sum()), "Notes": "Matches use submission_id parsed from filename"},
        {"Check": "Rows with normalized unknown emotion", "Value": int((records_df["Emotion_Group"] == "Unmapped").sum()), "Notes": "Should be reviewed if non-zero"},
        {"Check": "Rows with unknown valence or intensity", "Value": int(((records_df["Emotion_Valence"] == "Unknown") | (records_df["Emotion_Intensity"] == "Unknown")).sum()), "Notes": "Should be reviewed if non-zero"},
        {"Check": "Rows without a date", "Value": int((records_df["Date"] == "").sum()), "Notes": "Useful for trend chart completeness"},
        {"Check": "New records with no image filename", "Value": int(((records_df["Data_Source"] == "New detailed responses") & (records_df["Image_Filename"] == "")).sum()), "Notes": "Older records did not consistently include images"},
    ])

    data = {
        "cleaned_responses": records,
        "color_selections": color_long,
        "image_index": image_index,
        "emotion_summary": emotion_summary.to_dict(orient="records"),
        "quality_summary": quality_summary.to_dict(orient="records"),
        "source_summary": source_summary.to_dict(orient="records"),
        "language_summary": language_summary.to_dict(orient="records"),
        "color_summary": color_summary.to_dict(orient="records"),
        "daily_summary": daily_summary.to_dict(orient="records"),
        "emotion_by_source": emotion_by_source.to_dict(orient="records"),
        "emotion_color_matrix": emotion_color_matrix.to_dict(orient="records"),
        "quality_checks": quality_checks.to_dict(orient="records"),
    }
    OUT_JSON.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(OUT_JSON)


if __name__ == "__main__":
    main()
