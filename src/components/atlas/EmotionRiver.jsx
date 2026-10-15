import React, { useMemo, useState } from "react";
import { emotionTimeSeries } from "../../data/metrics.js";
import { colorForSelection } from "../../data/palette.js";
import { EMOTION_ORDER } from "../../types/dataModel.js";
import { Button } from "../ui/Button.jsx";
import { SliderField } from "../ui/Fields.jsx";

const WIDTH = 1200;
const HEIGHT = 600;
const MARGIN_X = 92;
const GRAPH_TOP = 78;
const GRAPH_BOTTOM = HEIGHT - 78;
const GRAPH_HEIGHT = GRAPH_BOTTOM - GRAPH_TOP;

function splitColors(record) {
  return String(record.Colors_List || "")
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean);
}

function hashUnit(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 9973;
  }
  return hash / 9973;
}

function makeLinePath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function makeSmoothPath(points, smoothing) {
  if (smoothing <= 0 || points.length < 3) return makeLinePath(points);
  const amount = smoothing / 100;
  const segments = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    const midX = point.x + (next.x - point.x) * 0.5;
    const midY = point.y + (next.y - point.y) * 0.5;
    const lineX = point.x * (1 - amount) + midX * amount;
    const lineY = point.y * (1 - amount) + midY * amount;
    segments.push(`Q ${point.x.toFixed(1)} ${point.y.toFixed(1)} ${lineX.toFixed(1)} ${lineY.toFixed(1)}`);
  }
  const last = points[points.length - 1];
  segments.push(`L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`);
  return segments.join(" ");
}

function makeAreaPath(points, baseline, smoothing = 0) {
  if (!points.length) return "";
  const forward = makeSmoothPath(points, smoothing);
  const last = points[points.length - 1];
  const first = points[0];
  return `${forward} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z`;
}

function groupedRecords(records) {
  const groups = new Map();
  records.forEach((record) => {
    const key = `${record.Date}::${record.Emotion_Normalized}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });
  return groups;
}

function interactionDots(records, series, yForEmotion, xForIndex, maxDailyEmotion) {
  const groups = groupedRecords(records);
  const allDots = [];
  const dateStep = (WIDTH - MARGIN_X * 2) / Math.max(series.length - 1, 1);
  const jitterXRange = Math.min(86, Math.max(18, dateStep * 0.8));
  const jitterYRange = Math.min(46, Math.max(18, (GRAPH_HEIGHT / Math.max(maxDailyEmotion, 1)) * 0.62));

  series.forEach((day, dayIndex) => {
    EMOTION_ORDER.forEach((emotion, emotionIndex) => {
      const dayRecords = groups.get(`${day.date}::${emotion}`) || [];
      const count = day[emotion] || 0;
      if (!count) return;
      const x = xForIndex(dayIndex);
      const y = yForEmotion(count, dayIndex, emotionIndex);
      dayRecords.forEach((record, recordIndex) => {
        splitColors(record).forEach((color, colorIndex) => {
          const seed = `${record.Response_ID}-${emotion}-${color}-${colorIndex}`;
          allDots.push({
            id: `${seed}-${recordIndex}`,
            x: x + (hashUnit(seed) - 0.5) * jitterXRange,
            y: y + (hashUnit(`${seed}-y`) - 0.5) * jitterYRange,
            radius: 4.2 + Math.min(2.5, count * 0.12),
            emotion,
            date: day.date,
            color,
            hex: colorForSelection(color),
            dayEmotionCount: count,
            responseId: record.Response_ID,
            colors: splitColors(record),
          });
        });
      });
    });
  });

  return allDots;
}

export function EmotionRiver({ records, accuracy = 100, smoothing = 44, showLines = true }) {
  const [active, setActive] = useState(null);
  const series = useMemo(() => emotionTimeSeries(records), [records]);
  const totalByEmotion = useMemo(() => {
    return records.reduce((totals, record) => {
      totals[record.Emotion_Normalized] = (totals[record.Emotion_Normalized] || 0) + 1;
      return totals;
    }, {});
  }, [records]);
  const maxDailyEmotion = useMemo(() => {
    return Math.max(...series.flatMap((day) => EMOTION_ORDER.map((emotion) => day[emotion] || 0)), 1);
  }, [series]);
  const maxDailyTotal = useMemo(() => Math.max(...series.map((day) => day.total), 1), [series]);
  const xForIndex = (index) => MARGIN_X + (index / Math.max(series.length - 1, 1)) * (WIDTH - MARGIN_X * 2);
  const scaleY = (value) => GRAPH_BOTTOM - (value / maxDailyEmotion) * GRAPH_HEIGHT;
  const accuracyRatio = accuracy / 100;
  const yForEmotion = (value, dayIndex, emotionIndex) => {
    const accurateY = scaleY(value);
    const laneStep = GRAPH_HEIGHT / Math.max(EMOTION_ORDER.length - 1, 1);
    const laneCenter = GRAPH_TOP + emotionIndex * laneStep;
    const participationLift = (value / maxDailyEmotion) * laneStep * 0.72;
    const wave = Math.sin(dayIndex * 0.72 + emotionIndex * 1.37) * 16;
    const poeticY = laneCenter - participationLift + wave;
    return poeticY * (1 - accuracyRatio) + accurateY * accuracyRatio;
  };
  const dots = useMemo(
    () => interactionDots(records, series, yForEmotion, xForIndex, maxDailyEmotion),
    [records, series, maxDailyEmotion, accuracyRatio]
  );

  const emotionPaths = useMemo(() => {
    return EMOTION_ORDER.map((emotion, emotionIndex) => {
      const points = series.map((day, index) => ({
        x: xForIndex(index),
        y: yForEmotion(day[emotion] || 0, index, emotionIndex),
        count: day[emotion] || 0,
      }));
      return { emotion, emotionIndex, points };
    });
  }, [series, maxDailyEmotion]);

  return (
    <div className="atlas-visual-light emotion-timeline-shell grid overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]" aria-label="Emotion timeline visualization">
      <aside className="readout-panel atlas-scrollbar order-2 min-h-[240px] lg:order-1 lg:h-[600px] lg:min-h-0 lg:overflow-y-auto">
        {active ? (
          <div className="readout-card">
            <p className="readout-eyebrow">
              {active.type === "dot" ? "Interaction color" : "Emotion current"}
            </p>
            <div className="mt-3 flex items-start justify-between gap-4">
              <h3 className="text-2xl font-black text-white">{active.emotion}</h3>
              {active.hex ? (
                <span className="mt-1 h-8 w-8 border border-white/20" style={{ background: active.hex, boxShadow: `0 0 18px ${active.hex}` }} />
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {active.type === "dot"
                ? `${active.date}: one ${active.color} interaction within ${active.dayEmotionCount} ${active.emotion} response${active.dayEmotionCount === 1 ? "" : "s"} that day.`
                : `${active.date}: ${active.count} ${active.emotion} response${active.count === 1 ? "" : "s"}. Zero values sit directly on the baseline.`}
            </p>
            {active.type === "dot" ? (
              <div className="mt-4 border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300">
                <p className="text-slate-500">Interaction colors</p>
                <p className="mt-1 text-white">{active.colors.join(", ")}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="readout-card">
            <p className="readout-eyebrow">Timeline guide</p>
            <h3 className="mt-3 text-2xl font-black text-white">Accurate daily emotion counts</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Each emotion line uses the same y-axis. If an emotion was not selected on a day, its line touches 0.
              Colored dots are individual participant color interactions.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300">
              <span className="text-slate-500">Max emotion/day</span>
              <span className="text-right text-white">{maxDailyEmotion}</span>
              <span className="text-slate-500">Max total/day</span>
              <span className="text-right text-white">{maxDailyTotal}</span>
            </div>
          </div>
        )}
      </aside>

      <div className="order-1 relative min-h-[460px] min-w-0 overflow-hidden md:min-h-[600px] lg:order-2">
        <svg className="relative z-10 block h-[460px] w-full md:h-[600px]" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img">
          <title>Accurate emotion timeline with participant color interactions</title>
          <desc>
            Each emotion line uses actual daily response counts on a shared y-axis; colored dots show individual selected colors.
          </desc>
          <defs>
            <filter id="riverGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = scaleY(maxDailyEmotion * ratio);
            return (
              <g key={ratio} opacity={0.42 + accuracyRatio * 0.58}>
                <path d={`M ${MARGIN_X} ${y} L ${WIDTH - 42} ${y}`} stroke="rgba(33,28,40,0.16)" strokeWidth="1" />
                <text x="42" y={y + 4} fill="rgba(33,28,40,0.72)" fontSize="13" textAnchor="start">
                  {Math.round(maxDailyEmotion * ratio)}
                </text>
              </g>
            );
          })}
          <text x="42" y="208" fill="rgba(33,28,40,0.7)" fontSize="13" transform="rotate(-90 42 208)">
            responses per emotion per day
          </text>

          {series.map((day, index) => {
            const step = Math.max(1, Math.floor(series.length / 9));
            if (index % step !== 0) return null;
            const x = xForIndex(index);
            return (
              <g key={day.date} opacity="0.74">
                <path d={`M ${x} ${GRAPH_TOP} L ${x} ${GRAPH_BOTTOM}`} stroke="rgba(33,28,40,0.12)" strokeWidth="1" />
                <text x={x} y={HEIGHT - 30} textAnchor="middle" fill="rgba(33,28,40,0.72)" fontSize="14">
                  {day.date.slice(5)}
                </text>
              </g>
            );
          })}

          {showLines
            ? emotionPaths.filter(({ points }) => points.length > 0).map(({ emotion, points }, emotionIndex) => {
                const hasSelection = Boolean(active?.emotion);
                const isSelected = active?.emotion === emotion;
                const lineStroke = hasSelection
                  ? isSelected
                    ? "rgba(126,124,119,0.82)"
                    : "rgba(196,193,186,0.88)"
                  : "rgba(158,155,148,0.68)";
                const pointStroke = hasSelection
                  ? isSelected
                    ? "rgba(126,124,119,0.48)"
                    : "rgba(196,193,186,0.42)"
                  : "rgba(158,155,148,0.36)";
                const labelFill = hasSelection
                  ? isSelected
                    ? "rgba(104,102,98,0.86)"
                    : "rgba(174,171,165,0.82)"
                  : "rgba(126,123,117,0.78)";
                const areaFill = hasSelection
                  ? isSelected
                    ? "rgba(126,124,119,0.075)"
                    : "rgba(196,193,186,0.025)"
                  : "rgba(158,155,148,0.045)";
                return (
                <g key={emotion} filter="url(#riverGlow)">
                  <path d={makeAreaPath(points, GRAPH_BOTTOM, smoothing)} fill={areaFill} />
                  <path
                    d={makeSmoothPath(points, smoothing)}
                    fill="none"
                    stroke={lineStroke}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {points.map((point, index) => (
                    <circle
                      key={`${emotion}-${series[index]?.date}`}
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="transparent"
                      stroke={pointStroke}
                      className="cursor-crosshair"
                      onMouseEnter={() => setActive({ type: "point", emotion, date: series[index].date, count: point.count })}
                    />
                  ))}
                  <text
                    x={WIDTH - 36}
                    y={points[points.length - 1]?.y + emotionIndex * 3}
                    fill={labelFill}
                    fontSize="12"
                    fontWeight="700"
                    textAnchor="end"
                  >
                    {emotion}
                  </text>
                </g>
                );
              })
            : null}

          <g>
            {dots.map((dot) => (
              <circle
                key={dot.id}
                cx={dot.x}
                cy={dot.y}
                r={dot.radius}
                fill={dot.hex}
                opacity="0.88"
                stroke="rgba(33,28,40,0.46)"
                strokeWidth="0.7"
                className="cursor-crosshair"
                onMouseEnter={() => setActive({ type: "dot", ...dot })}
              />
            ))}
          </g>

          <text x="42" y="42" fill="rgba(33,28,40,0.94)" fontSize="20" fontWeight="700">
            Visible timeline: {records.length} participant traces
          </text>
          <text x="42" y="66" fill="rgba(33,28,40,0.68)" fontSize="14">
            Slider blends the atmospheric timeline form with the shared-y-axis accurate count view.
          </text>
        </svg>
      </div>
    </div>
  );
}

export function EmotionRiverControls({ accuracy, setAccuracy, smoothing, setSmoothing, showLines, setShowLines }) {
  return (
    <div className="control-subsection control-span-2">
      <p className="control-subsection-title">Timeline display</p>
      <div className="control-panel-grid mt-4">
        <SliderField
          label="Timeline shape"
          value={accuracy}
          onChange={setAccuracy}
          leftLabel="Poetic"
          rightLabel="Accurate"
          helper="Blends the atmospheric flow with the exact shared-y-axis count view."
        />
        <SliderField
          label="Line smoothing"
          value={smoothing}
          onChange={setSmoothing}
          leftLabel="Angular"
          rightLabel="Soft"
          helper="A visual-only curve treatment; counts and positions stay unchanged."
        />
        <Button
          aria-pressed={!showLines}
          className="w-fit self-end justify-center"
          onClick={() => setShowLines((current) => !current)}
          variant={showLines ? "secondary" : "primary"}
        >
          {showLines ? "Hide lines" : "Show lines"}
        </Button>
      </div>
    </div>
  );
}
