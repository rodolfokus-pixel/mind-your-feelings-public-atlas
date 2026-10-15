import React, { useEffect, useMemo, useState } from "react";
import { SelectField, SliderField } from "../ui/Fields.jsx";

const WIDTH = 900;
const HEIGHT = 820;
const MAP_X = 200;
const MAP_Y = 72;
const MAP_W = 500;
const MAP_H = 700;

const OVERLAY_MODES = {
  glow: {
    label: "Glow accumulation",
    blend: "screen",
    opacity: 0.17,
    filter: "url(#bodyGlow)",
    lightBlend: "normal",
    lightOpacity: 0.075,
    lightFilter: "url(#lightBodyGlow)",
    note: "Softly accumulates repeated color density across the body.",
  },
  topographic: {
    label: "Topographic overlap",
    blend: "lighten",
    opacity: 0.24,
    filter: "url(#softBlur)",
    lightBlend: "normal",
    lightOpacity: 0.1,
    lightFilter: "url(#lightBodyTopographic)",
    note: "Keeps edges readable while overlaps brighten into shared zones.",
  },
  archive: {
    label: "Drawing archive",
    blend: "normal",
    opacity: 0.12,
    filter: "none",
    lightBlend: "normal",
    lightOpacity: 0.03,
    lightFilter: "url(#lightBodyLayer)",
    note: "A softer stack of the original drawing layers.",
  },
  multiply: {
    label: "Deep multiply / darken",
    blend: "multiply",
    opacity: 0.26,
    filter: "none",
    lightBlend: "multiply",
    lightOpacity: 0.105,
    lightFilter: "url(#lightBodyMultiply)",
    note: "A true multiply treatment that darkens repeated strokes so drawing overlaps remain clearly visible on the light field.",
  },
};

function splitColors(value) {
  return String(value || "")
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean);
}

function dateSort(a, b) {
  return `${a.period}-${a.responseId}`.localeCompare(`${b.period}-${b.responseId}`);
}

export function BodyAtlas({ records, overlayMode = "glow", strength = 82, backgroundMode = "dark" }) {
  const [atlas, setAtlas] = useState(null);
  const [active, setActive] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/body_atlas_layers.json")
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setAtlas(payload);
      })
      .catch(() => {
        if (!cancelled) setAtlas({ layers: [], summary: {} });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recordIds = useMemo(() => new Set(records.map((record) => record.Response_ID)), [records]);
  const visibleLayers = useMemo(() => {
    const layers = atlas?.layers || [];
    return layers.filter((layer) => recordIds.has(layer.responseId)).sort(dateSort);
  }, [atlas, recordIds]);
  const drawnLayers = useMemo(() => visibleLayers.filter((layer) => layer.hasDrawing), [visibleLayers]);
  const mode = OVERLAY_MODES[overlayMode];
  const drawingPixels = drawnLayers.reduce((total, layer) => total + layer.pixelCount, 0);
  const emotionCounts = useMemo(() => {
    return drawnLayers.reduce((map, layer) => {
      map[layer.emotion] = (map[layer.emotion] || 0) + 1;
      return map;
    }, {});
  }, [drawnLayers]);

  return (
    <div className={`atlas-visual-light grid overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)] body-atlas-shell body-atlas-${backgroundMode}`}>
      <aside className="readout-panel atlas-scrollbar order-2 min-h-[300px] lg:order-1 lg:h-[820px] lg:overflow-y-auto">
        <p className="readout-eyebrow">Body atlas readout</p>
        {active ? (
          <div className="readout-card mt-4">
            <h3 className="text-2xl font-black text-white">{active.emotion}</h3>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              This layer is one participant&apos;s actual color drawing, isolated from the body-map background and
              placed in the collective overlay.
            </p>
            <div className="mt-4 border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300">
              <p className="text-slate-500">Period</p>
              <p className="mt-1 text-white">{active.period || "Undated"}</p>
              <p className="mt-3 text-slate-500">Response colors</p>
              <p className="mt-1 text-white">{splitColors(active.colors).join(", ") || "No color selected"}</p>
              <p className="mt-3 text-slate-500">Drawing pixels</p>
              <p className="mt-1 text-white">{active.pixelCount.toLocaleString()}</p>
            </div>
          </div>
        ) : (
          <div className="readout-card mt-4">
            <h3 className="text-2xl font-black text-white">Layered body drawings</h3>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              This view overlays the real participant drawings as transparent image layers. Stronger overlaps reveal
              repeated body zones and shared color patterns.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300">
              <span className="text-slate-500">Image responses</span>
              <span className="text-right text-white">{visibleLayers.length}</span>
              <span className="text-slate-500">With drawing</span>
              <span className="text-right text-white">{drawnLayers.length}</span>
              <span className="text-slate-500">Drawing pixels</span>
              <span className="text-right text-white">{drawingPixels.toLocaleString()}</span>
            </div>
          </div>
        )}

      </aside>

      <div className="body-atlas-stage order-1 overflow-hidden lg:order-2">
        <svg className="body-atlas-canvas block w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img">
          <title>Body Atlas emotional topography</title>
          <desc>Layered body heat map built from transparent participant body-map drawing images.</desc>
          <defs>
            <filter id="bodyGlow">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="softBlur">
              <feGaussianBlur stdDeviation="0.75" />
            </filter>
            <filter id="lightBodyLayer" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0.75 0.75 0.75 0 -0.45
                "
              />
            </filter>
            <filter id="lightBodyGlow" colorInterpolationFilters="sRGB">
              <feColorMatrix type="saturate" values="1.65" result="saturated" />
              <feComponentTransfer in="saturated" result="brightened">
                <feFuncR type="gamma" amplitude="1.08" exponent="0.72" offset="0" />
                <feFuncG type="gamma" amplitude="1.08" exponent="0.72" offset="0" />
                <feFuncB type="gamma" amplitude="1.08" exponent="0.72" offset="0" />
              </feComponentTransfer>
              <feColorMatrix
                in="brightened"
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0.7 0.7 0.7 0 -0.36
                "
                result="isolated"
              />
              <feGaussianBlur in="isolated" stdDeviation="1.2" result="halo" />
              <feMerge>
                <feMergeNode in="halo" />
                <feMergeNode in="isolated" />
              </feMerge>
            </filter>
            <filter id="lightBodyTopographic" colorInterpolationFilters="sRGB">
              <feColorMatrix type="saturate" values="1.35" result="saturated" />
              <feColorMatrix
                in="saturated"
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0.75 0.75 0.75 0 -0.38
                "
                result="isolated"
              />
              <feMorphology in="isolated" operator="dilate" radius="0.45" />
            </filter>
            <filter id="lightBodyMultiply" colorInterpolationFilters="sRGB">
              <feColorMatrix type="saturate" values="2.15" result="saturated" />
              <feComponentTransfer in="saturated" result="deepened">
                <feFuncR type="gamma" amplitude="0.92" exponent="1.22" offset="0" />
                <feFuncG type="gamma" amplitude="0.92" exponent="1.22" offset="0" />
                <feFuncB type="gamma" amplitude="0.92" exponent="1.22" offset="0" />
              </feComponentTransfer>
              <feColorMatrix
                in="deepened"
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0.9 0.9 0.9 0 -0.42
                "
              />
            </filter>
          </defs>

          <rect width={WIDTH} height={HEIGHT} className="body-atlas-field-bg" />
          <rect x={MAP_X} y={MAP_Y} width={MAP_W} height={MAP_H} className="body-atlas-drawing-bg" />

          <g>
            {drawnLayers.map((layer) => (
              <image
                key={layer.responseId}
                href={layer.src}
                x={MAP_X}
                y={MAP_Y}
                width={MAP_W}
                height={MAP_H}
                opacity={(backgroundMode === "light" ? (mode.lightOpacity || mode.opacity) : mode.opacity) * (strength / 100)}
                preserveAspectRatio="xMidYMid meet"
                filter={backgroundMode === "light" ? mode.lightFilter : mode.filter}
                style={{ mixBlendMode: backgroundMode === "light" ? (mode.lightBlend || mode.blend) : mode.blend }}
                onMouseEnter={() => setActive(layer)}
              />
            ))}
          </g>

          <rect className="body-atlas-frame" x={MAP_X} y={MAP_Y} width={MAP_W} height={MAP_H} fill="transparent" pointerEvents="none" />
          <text className="body-atlas-title" x="42" y="40" fontSize="20" fontWeight="700">
            Body Atlas: {drawnLayers.length} layered drawings
          </text>
          <text className="body-atlas-subtitle" x="42" y="62" fontSize="14">
            Transparent overlays made from the actual participant body-map drawings.
          </text>
          <g transform="translate(42 104)">
            {Object.entries(emotionCounts).map(([emotion, count], index) => (
              <text className="body-atlas-count" key={emotion} x="0" y={index * 19} fontSize="12">
                {emotion}: {count}
              </text>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

export function BodyAtlasControls({ overlayMode, setOverlayMode, strength, setStrength, backgroundMode, setBackgroundMode }) {
  const mode = OVERLAY_MODES[overlayMode];
  return (
    <div className="control-subsection control-span-2">
      <p className="control-subsection-title">Body Atlas display</p>
      <div className="control-panel-grid mt-4">
        <SelectField
          label="Overlay effect"
          value={overlayMode}
          onChange={setOverlayMode}
          options={Object.entries(OVERLAY_MODES).map(([value, option]) => ({ value, label: option.label }))}
          helper={mode.note}
          includeAll={false}
        />
        <SelectField
          label="Background"
          value={backgroundMode}
          onChange={setBackgroundMode}
          options={[
            { value: "light", label: "Light field" },
            { value: "dark", label: "Dark field" },
          ]}
          helper="Switch the body drawing field for exhibition previews or print-friendly inspection."
          includeAll={false}
        />
        <SliderField
          className="control-span-2"
          label="Layer strength"
          value={strength}
          min={35}
          max={100}
          onChange={setStrength}
          leftLabel="Soft"
          rightLabel="Dense"
          helper="Controls the opacity of each participant drawing layer."
        />
      </div>
    </div>
  );
}
