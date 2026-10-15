import { normalizeRecords } from "./normalizers.js";

export async function loadAtlasData() {
  let response = await fetch("/data/myf_cleaned_data.json");
  if (!response.ok) {
    response = await fetch("/public/data/myf_cleaned_data.json");
  }
  const payload = await response.json();
  return normalizeRecords(payload.cleaned_responses || []);
}
