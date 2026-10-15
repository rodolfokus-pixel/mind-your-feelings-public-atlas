import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { colorForSelection } from "../../data/palette.js";
import { EMOTION_ORDER } from "../../types/dataModel.js";

const WIDTH = 1200;
const HEIGHT = 760;
const MAX_SUBMISSIONS = 144;

const EMOTION_POINTS = {
  Happiness: { x: 420, y: 300 },
  Contentment: { x: 330, y: 520 },
  Sadness: { x: 600, y: 565 },
  Surprise: { x: 745, y: 300 },
  Fear: { x: 910, y: 455 },
  Anger: { x: 705, y: 440 },
};

const COLOR_POINTS = {
  Yellow: { x: 235, y: 105 },
  Orange: { x: 95, y: 310 },
  Red: { x: 150, y: 585 },
  Magenta: { x: 455, y: 635 },
  Purple: { x: 800, y: 635 },
  Blue: { x: 1088, y: 525 },
  "Deep Blue": { x: 1105, y: 335 },
  "Light Blue": { x: 940, y: 115 },
  Green: { x: 610, y: 86 },
  "No color selected": { x: 1028, y: 610 },
};

function splitColors(record) {
  return String(record.Colors_List || "")
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean);
}

function hashUnit(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 15485863;
  }
  return hash / 15485863;
}

function addLink(links, source, target, kind, color, increment = 1) {
  const key = `${source}->${target}`;
  const existing = links.get(key);
  if (existing) {
    existing.count += increment;
    return;
  }
  links.set(key, { id: key, source, target, kind, color, count: increment });
}

function addNode(nodes, node) {
  nodes.set(node.id, node);
}

function colorProfileForEmotion(records, emotion) {
  const counts = new Map();
  records
    .filter((record) => record.Emotion_Normalized === emotion)
    .forEach((record) => {
      splitColors(record).forEach((color) => counts.set(color, (counts.get(color) || 0) + 1));
    });
  return Array.from(counts, ([color, count]) => ({ color, count, hex: colorForSelection(color) })).sort((a, b) => b.count - a.count);
}

function describeColors(colors) {
  if (!colors.length) return "No color listed";
  if (colors.length === 1) return colors[0];
  return `${colors.slice(0, 3).join(", ")}${colors.length > 3 ? "..." : ""}`;
}

function buildGraph(records) {
  const nodes = new Map();
  const links = new Map();
  const colorCounts = new Map();

  records.forEach((record) => {
    splitColors(record).forEach((color) => colorCounts.set(color, (colorCounts.get(color) || 0) + 1));
  });

  const emotionCounts = new Map(EMOTION_ORDER.map((emotion) => [emotion, records.filter((record) => record.Emotion_Normalized === emotion).length]));
  const maxEmotion = Math.max(...emotionCounts.values(), 1);
  const colors = Array.from(colorCounts, ([color, count]) => ({ color, count })).sort((a, b) => b.count - a.count);
  const maxColor = Math.max(...colors.map((item) => item.count), 1);

  colors.forEach((item, index) => {
    const point = COLOR_POINTS[item.color] || {
      x: 200 + ((index * 137) % 800),
      y: 95 + ((index * 89) % 500),
    };
    addNode(nodes, {
      id: `color:${item.color}`,
      type: "color",
      label: item.color,
      count: item.count,
      x: point.x,
      y: point.y,
      radius: 28 + (item.count / maxColor) * 38,
      color: colorForSelection(item.color),
      description: `${item.count} visible selections used this participant-selected color.`,
    });
  });

  EMOTION_ORDER.forEach((emotion) => {
    const count = emotionCounts.get(emotion) || 0;
    const profile = colorProfileForEmotion(records, emotion);
    const point = EMOTION_POINTS[emotion];
    addNode(nodes, {
      id: `emotion:${emotion}`,
      type: "emotion",
      label: emotion,
      count,
      x: point.x,
      y: point.y,
      radius: 36 + (count / maxEmotion) * 48,
      color: profile[0]?.hex || "#CBD5E1",
      profile,
      description: `${count} visible participants selected ${emotion}. Its fill and outer ring are blended from the colors those participants chose.`,
    });
  });

  records.forEach((record) => {
    const emotionId = `emotion:${record.Emotion_Normalized}`;
    splitColors(record).forEach((color) => addLink(links, emotionId, `color:${color}`, "emotion-color", colorForSelection(color)));
  });

  records
    .slice()
    .sort((a, b) => String(b.Date || "").localeCompare(String(a.Date || "")))
    .slice(0, MAX_SUBMISSIONS)
    .forEach((record, index) => {
      const emotion = record.Emotion_Normalized;
      const colorsForRecord = splitColors(record);
      const point = EMOTION_POINTS[emotion] || { x: WIDTH / 2, y: HEIGHT / 2 };
      const colorPoint = COLOR_POINTS[colorsForRecord[0]] || { x: WIDTH / 2, y: HEIGHT / 2 };
      const seed = hashUnit(record.Response_ID || `${record.Date}-${index}`);
      const angle = seed * Math.PI * 2;
      const pull = 0.28 + (index % 7) * 0.06;
      const jitter = 34 + (index % 6) * 11;
      const x = point.x + (colorPoint.x - point.x) * pull + Math.cos(angle) * jitter;
      const y = point.y + (colorPoint.y - point.y) * pull + Math.sin(angle) * jitter * 0.82;
      const id = `submission:${record.Response_ID}`;
      addNode(nodes, {
        id,
        type: "submission",
        label: `Entry ${index + 1}`,
        count: 1,
        x,
        y,
        radius: 7,
        color: colorForSelection(colorsForRecord[0] || record.Primary_Color || "Unmapped"),
        colors: colorsForRecord,
        record,
        description: `${record.Date || "Undated"} · ${emotion} · ${describeColors(colorsForRecord)}`,
      });
      addLink(links, id, `emotion:${emotion}`, "submission-emotion", colorForSelection(colorsForRecord[0] || record.Primary_Color || "Unmapped"), 0.45);
      colorsForRecord.forEach((color) => addLink(links, id, `color:${color}`, "submission-color", colorForSelection(color), 0.2));
    });

  return {
    nodes: Array.from(nodes.values()),
    links: Array.from(links.values()).filter((link) => nodes.has(link.source) && nodes.has(link.target)),
  };
}

function nodeTypeLabel(type) {
  return {
    emotion: "Emotion bubble",
    color: "Color anchor",
    submission: "Individual entry",
  }[type] || type;
}

function activeLinkForNode(activeId, link) {
  return activeId && (link.source === activeId || link.target === activeId || link.id === activeId);
}

function colorSegments(profile, radius) {
  const total = profile.reduce((sum, item) => sum + item.count, 0);
  const circumference = Math.PI * 2 * radius;
  let offset = 0;
  return profile.map((item) => {
    const length = (item.count / Math.max(total, 1)) * circumference;
    const segment = { ...item, dash: `${Math.max(0.01, length)} ${circumference}`, offset: -offset };
    offset += length;
    return segment;
  });
}

function independentDrift(node) {
  const seed = node.id;
  const phase = hashUnit(`${seed}:phase`) * Math.PI * 2;
  const secondaryPhase = hashUnit(`${seed}:secondary`) * Math.PI * 2;
  const direction = hashUnit(`${seed}:direction`) > 0.5 ? 1 : -1;
  const baseAmplitude = node.type === "submission" ? 13 : node.type === "color" ? 17 : 12;
  const radiusX = baseAmplitude + hashUnit(`${seed}:radius-x`) * (node.type === "submission" ? 15 : 10);
  const radiusY = baseAmplitude * 0.72 + hashUnit(`${seed}:radius-y`) * 10;
  const points = Array.from({ length: 9 }, (_, index) => {
    const angle = phase + direction * (index / 8) * Math.PI * 2;
    return {
      x: Math.cos(angle) * radiusX + Math.sin(angle * 2 + secondaryPhase) * radiusX * 0.27,
      y: Math.sin(angle) * radiusY + Math.cos(angle * 2 - secondaryPhase) * radiusY * 0.24,
    };
  });
  const origin = points[0];

  return {
    x: points.map((point) => point.x - origin.x),
    y: points.map((point) => point.y - origin.y),
    duration: 7.5 + hashUnit(`${seed}:duration`) * 6.5,
    delay: -(hashUnit(`${seed}:delay`) * 8),
  };
}

function absoluteDrift(node, point, paused) {
  const drift = independentDrift(node);
  return {
    x: paused ? point.x : drift.x.map((offset) => point.x + offset),
    y: paused ? point.y : drift.y.map((offset) => point.y + offset),
    transition: paused
      ? { duration: 0.15 }
      : { duration: drift.duration, delay: drift.delay, repeat: Infinity, ease: "easeInOut" },
  };
}

function NodeGlyph({ node, point, active, graph, setActive, setDragging, isDragging, reduceMotion }) {
  const isActive = active?.id === node.id;
  const isConnected = graph.links.some((link) => activeLinkForNode(active?.id, link) && (link.source === node.id || link.target === node.id));
  const dimmed = active && !isActive && !isConnected;
  const isEmotion = node.type === "emotion";
  const isSubmission = node.type === "submission";
  const drift = independentDrift(node);
  const shouldDrift = isSubmission && !reduceMotion && !isDragging;
  return (
    <motion.g
      initial={false}
      animate={shouldDrift ? { x: drift.x, y: drift.y } : { x: 0, y: 0 }}
      transition={shouldDrift ? { duration: drift.duration, delay: drift.delay, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15 }}
      opacity={dimmed ? 0.28 : 1}
      role="button"
      tabIndex={0}
      aria-label={`${nodeTypeLabel(node.type)} ${node.label}: ${node.count}`}
      className="cursor-grab outline-none active:cursor-grabbing"
      onMouseEnter={() => setActive({ type: "node", id: node.id })}
      onMouseLeave={() => setActive(null)}
      onFocus={() => setActive({ type: "node", id: node.id })}
      onBlur={() => setActive(null)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(node.id);
        setActive({ type: "node", id: node.id });
      }}
    >
      {isEmotion
        ? colorSegments(node.profile || [], node.radius + 9).map((segment) => (
            <circle
              key={`${node.id}-${segment.color}`}
              role="button"
              tabIndex={0}
              aria-label={`${node.label} ${segment.color}: ${segment.count}`}
              cx={point.x}
              cy={point.y}
              r={node.radius + 9}
              fill="none"
              stroke={segment.hex}
              strokeWidth="8"
              strokeDasharray={segment.dash}
              strokeDashoffset={segment.offset}
              transform={`rotate(-90 ${point.x} ${point.y})`}
              opacity="0.96"
              className="cursor-crosshair outline-none"
              onMouseEnter={(event) => {
                event.stopPropagation();
                setActive({
                  type: "segment",
                  id: `${node.id}:${segment.color}`,
                  emotion: node.label,
                  color: segment.color,
                  count: segment.count,
                  hex: segment.hex,
                });
              }}
              onMouseLeave={(event) => {
                event.stopPropagation();
                setActive(null);
              }}
              onFocus={(event) => {
                event.stopPropagation();
                setActive({
                  type: "segment",
                  id: `${node.id}:${segment.color}`,
                  emotion: node.label,
                  color: segment.color,
                  count: segment.count,
                  hex: segment.hex,
                });
              }}
              onBlur={() => setActive(null)}
            />
          ))
        : null}
      <motion.circle
        cx={point.x}
        cy={point.y}
        r={node.radius}
        fill={isEmotion ? `url(#blend-${node.label})` : node.color}
        opacity={isSubmission ? 0.58 : 0.92}
        filter="url(#neuralGlow)"
        animate={{ scale: isActive ? 1.1 : [1, 1.025, 1] }}
        transition={{ duration: isActive ? 0.2 : 3.2 + hashUnit(`${node.id}:pulse`) * 2, repeat: isActive ? 0 : Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: `${point.x}px ${point.y}px` }}
      />
      {isSubmission && node.colors?.length > 1
        ? node.colors.slice(0, 5).map((color, index) => {
            const angle = (index / node.colors.length) * Math.PI * 2;
            const offsetX = Math.cos(angle) * 5.8;
            const offsetY = Math.sin(angle) * 5.8;
            return (
              <circle
                key={`${node.id}-${color}-${index}`}
                cx={point.x + offsetX}
                cy={point.y + offsetY}
                r="3.4"
                fill={colorForSelection(color)}
                opacity="0.86"
              />
            );
          })
        : null}
      <circle
        cx={point.x}
        cy={point.y}
        r={node.radius + (isEmotion ? 18 : 9)}
        fill="transparent"
        stroke={isActive ? "rgba(33,28,40,0.82)" : "rgba(33,28,40,0.18)"}
        strokeWidth={isActive ? 2 : 1}
      />
      {!isSubmission ? (
        <text
          x={point.x}
          y={point.y + node.radius + 21}
          textAnchor="middle"
          fill="rgba(33,28,40,0.9)"
          fontSize={isEmotion ? 15 : 12}
          fontWeight={isEmotion ? 800 : 650}
        >
          {node.label}
        </text>
      ) : null}
    </motion.g>
  );
}

export function NeuralEmotionMap({ records }) {
  const svgRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(null);
  const [dragging, setDragging] = useState(null);
  const graph = useMemo(() => buildGraph(records), [records]);
  const [positions, setPositions] = useState({});

  useEffect(() => {
    setPositions(Object.fromEntries(graph.nodes.map((node) => [node.id, { x: node.x, y: node.y }])));
    setActive(null);
    setDragging(null);
  }, [graph]);

  const nodesById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const maxLink = Math.max(...graph.links.map((link) => link.count), 1);
  const activeNode = active?.type === "node" ? nodesById.get(active.id) : null;
  const activeLink = active?.type === "link" ? graph.links.find((link) => link.id === active.id) : null;
  const activeSegment = active?.type === "segment" ? active : null;

  function pointFromEvent(event) {
    const svg = svgRef.current;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  function moveDraggedNode(event) {
    if (!dragging) return;
    const point = pointFromEvent(event);
    setPositions((current) => ({
      ...current,
      [dragging]: {
        x: Math.max(60, Math.min(WIDTH - 60, point.x)),
        y: Math.max(45, Math.min(HEIGHT - 45, point.y)),
      },
    }));
  }

  return (
    <div className="atlas-visual-light neural-map-shell grid overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="order-1 relative min-h-[640px] overflow-hidden lg:order-2">
        <svg
          ref={svgRef}
          className="block h-[640px] w-full touch-none md:h-[760px]"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          onPointerMove={moveDraggedNode}
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => {
            setDragging(null);
            setActive(null);
          }}
        >
          <title>Neural network emotion map</title>
          <desc>
            A draggable neural network connecting participant color anchors, blended emotion bubbles,
            and individual entries.
          </desc>
          <defs>
            <filter id="neuralGlow">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="networkCore" cx="50%" cy="50%" r="62%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.96)" />
              <stop offset="58%" stopColor="rgba(119,217,232,0.18)" />
              <stop offset="100%" stopColor="rgba(241,240,235,0)" />
            </radialGradient>
            {graph.nodes
              .filter((node) => node.type === "emotion")
              .map((node) => {
                const profile = node.profile?.length ? node.profile : [{ hex: "#CBD5E1", count: 1 }];
                const total = profile.reduce((sum, item) => sum + item.count, 0);
                let stop = 0;
                return (
                  <radialGradient key={node.id} id={`blend-${node.label}`} cx="50%" cy="50%" r="65%">
                    {profile.slice(0, 6).map((item, index) => {
                      stop += item.count / Math.max(total, 1);
                      return <stop key={`${node.id}-${item.color}`} offset={`${Math.min(100, Math.max(index * 8, stop * 100))}%`} stopColor={item.hex} />;
                    })}
                  </radialGradient>
                );
              })}
          </defs>

          <rect width={WIDTH} height={HEIGHT} fill="url(#networkCore)" />

          <g filter="url(#neuralGlow)">
            {graph.links.map((link) => {
              const source = positions[link.source];
              const target = positions[link.target];
              if (!source || !target) return null;
              const sourceNode = nodesById.get(link.source);
              const targetNode = nodesById.get(link.target);
              const sourceMotion = absoluteDrift(sourceNode, source, reduceMotion || sourceNode.type !== "submission" || dragging === link.source);
              const targetMotion = absoluteDrift(targetNode, target, reduceMotion || targetNode.type !== "submission" || dragging === link.target);
              const activeId = active?.id;
              const isActive = activeLinkForNode(activeId, link);
              const width = Math.max(0.55, Math.min(7, (link.count / maxLink) * 6));
              return (
                <motion.line
                  key={link.id}
                  initial={false}
                  animate={{ x1: sourceMotion.x, y1: sourceMotion.y, x2: targetMotion.x, y2: targetMotion.y }}
                  transition={{
                    x1: sourceMotion.transition,
                    y1: sourceMotion.transition,
                    x2: targetMotion.transition,
                    y2: targetMotion.transition,
                  }}
                  stroke={link.color}
                  strokeWidth={isActive ? width + 2 : width}
                  strokeLinecap="round"
                  opacity={active ? (isActive ? 0.92 : 0.12) : link.kind.startsWith("submission") ? 0.28 : 0.46}
                  onMouseEnter={() => setActive({ type: "link", id: link.id })}
                  onMouseLeave={() => setActive(null)}
                />
              );
            })}
          </g>

          {graph.nodes.filter((node) => node.type === "submission").map((node) => {
            const point = positions[node.id] || { x: node.x, y: node.y };
            return (
              <NodeGlyph key={node.id} node={node} point={point} active={active} graph={graph} setActive={setActive} setDragging={setDragging} isDragging={dragging === node.id} reduceMotion={reduceMotion} />
            );
          })}

          {graph.nodes.filter((node) => node.type !== "submission").map((node) => {
            const point = positions[node.id] || { x: node.x, y: node.y };
            return (
              <NodeGlyph key={node.id} node={node} point={point} active={active} graph={graph} setActive={setActive} setDragging={setDragging} isDragging={dragging === node.id} reduceMotion={reduceMotion} />
            );
          })}
        </svg>
      </div>

      <aside className="readout-panel atlas-scrollbar order-2 min-h-[300px] lg:order-1 lg:h-[760px] lg:overflow-y-auto">
        <p className="readout-eyebrow">Neural readout</p>
        {activeSegment ? (
          <div className="readout-card mt-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Emotion color ring</p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className="h-8 w-8 border border-white/20"
                style={{ background: activeSegment.hex, boxShadow: `0 0 22px ${activeSegment.hex}` }}
              />
              <h3 className="text-2xl font-black text-white">{activeSegment.color}</h3>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {activeSegment.count} participant selection{activeSegment.count === 1 ? "" : "s"} used {activeSegment.color} while mapping {activeSegment.emotion}.
              This segment belongs to the outer ring of the {activeSegment.emotion} emotion bubble.
            </p>
          </div>
        ) : activeNode ? (
          <div className="readout-card mt-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">{nodeTypeLabel(activeNode.type)}</p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className="h-8 w-8 border border-white/20"
                style={{ background: activeNode.color, boxShadow: `0 0 22px ${activeNode.color}` }}
              />
              <h3 className="text-2xl font-black text-white">{activeNode.label}</h3>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{activeNode.description}</p>
            {activeNode.type === "emotion" && activeNode.profile?.length ? (
              <div className="mt-4 space-y-2">
                {activeNode.profile.slice(0, 7).map((item) => (
                  <div key={item.color} className="flex items-center justify-between gap-3 border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="h-3 w-3 rounded-full" style={{ background: item.hex }} />
                      {item.color}
                    </span>
                    <span className="font-semibold text-white">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-5 border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Visible count</span>
                <span className="font-semibold text-white">{activeNode.count}</span>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <span className="text-slate-500">Meaning</span>
                <span className="text-right font-semibold text-white">{nodeTypeLabel(activeNode.type)}</span>
              </div>
            </div>
          </div>
        ) : activeLink ? (
          <div className="readout-card mt-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Connection</p>
            <h3 className="mt-3 text-2xl font-black text-white">
              {nodesById.get(activeLink.source)?.label} to {nodesById.get(activeLink.target)?.label}
            </h3>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              This glowing strand represents {Math.round(activeLink.count)} visible relation{Math.round(activeLink.count) === 1 ? "" : "s"} between those parts of the archive.
            </p>
          </div>
        ) : (
          <div className="readout-card mt-4">
            <h3 className="text-2xl font-black text-white">Neural relation field</h3>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Color anchors sit around the edge. Emotion bubbles are filled by the real colors participants
              chose. Tiny clustered bubbles are individual entries distributed through the network. Drag any
              bubble to rearrange the living map.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-slate-300">
              <div className="border border-white/10 bg-white/[0.04] p-3">
                <p className="text-slate-500">Nodes</p>
                <p className="mt-1 text-lg font-black text-white">{graph.nodes.length}</p>
              </div>
              <div className="border border-white/10 bg-white/[0.04] p-3">
                <p className="text-slate-500">Links</p>
                <p className="mt-1 text-lg font-black text-white">{graph.links.length}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
