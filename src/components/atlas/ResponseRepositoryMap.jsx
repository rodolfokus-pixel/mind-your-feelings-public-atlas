import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { forceCollide, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";
import { Plus, RotateCcw, X } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { SelectField } from "../ui/Fields.jsx";
import {
  GROUP_OPTIONS,
  buildGroupHierarchy,
  groupColorFor,
  toResponseNodes,
} from "../../data/responseRepository.js";

const WIDTH = 1040;
const HEIGHT = 720;
const MARGIN = 36;
const NODE_RADIUS = 6.5;
const GROUP_RADIUS_MIN = 64;
const COLOR_ORDER = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Light Blue",
  "Deep Blue",
  "Purple",
  "Magenta",
  "No color selected",
];

function stableNoise(seed, scale = 1) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  }
  return ((hash / 9973) * 2 - 1) * scale;
}

function colorAffinityOffset(node, group, center) {
  const colors = node.colors?.length ? node.colors : ["No color selected"];
  const angles = colors.map((color) => {
    const index = Math.max(0, COLOR_ORDER.indexOf(color));
    return (Math.PI * 2 * index) / COLOR_ORDER.length - Math.PI / 2;
  });
  const x = angles.reduce((sum, angle) => sum + Math.cos(angle), 0) / angles.length;
  const y = angles.reduce((sum, angle) => sum + Math.sin(angle), 0) / angles.length;
  const length = Math.hypot(x, y) || 1;
  const colorPull = Math.min(center.radius * 0.44, Math.max(20, Math.sqrt(group.nodes.length) * 5.4));
  const countPull = Math.min(center.radius * 0.2, node.colorCount * 5.5);
  return {
    x: (x / length) * (colorPull + countPull) + stableNoise(`${node.id}:x`, 10),
    y: (y / length) * (colorPull + countPull) + stableNoise(`${node.id}:y`, 10),
  };
}

function compactGrid(nodes) {
  const columns = Math.ceil(Math.sqrt(nodes.length * (WIDTH / HEIGHT)));
  const gapX = (WIDTH - MARGIN * 2) / Math.max(1, columns - 1);
  const rows = Math.ceil(nodes.length / columns);
  const gapY = Math.min(20, (HEIGHT - MARGIN * 2) / Math.max(1, rows - 1));
  const startY = (HEIGHT - gapY * Math.max(0, rows - 1)) / 2;
  const startX = MARGIN;
  return Object.fromEntries(
    nodes.map((node, index) => [
      node.id,
      {
        x: startX + (index % columns) * gapX,
        y: startY + Math.floor(index / columns) * gapY,
      },
    ])
  );
}

function placeGroups(groups, groupOffsets) {
  if (groups.length <= 1) {
    const group = groups[0];
    return {
      [group.id]: {
        x: WIDTH / 2 + (groupOffsets[group.id]?.x || 0),
        y: HEIGHT / 2 + (groupOffsets[group.id]?.y || 0),
        radius: Math.max(GROUP_RADIUS_MIN, Math.sqrt(group.nodes.length) * 13),
      },
    };
  }

  const weighted = groups.map((group) => ({
    ...group,
    radius: Math.max(GROUP_RADIUS_MIN, Math.sqrt(group.nodes.length) * 13),
  }));
  const columns = Math.ceil(Math.sqrt(weighted.length * 1.45));
  const rows = Math.ceil(weighted.length / columns);
  const cellW = (WIDTH - 120) / columns;
  const cellH = (HEIGHT - 116) / rows;
  return Object.fromEntries(
    weighted.map((group, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const wave = Math.sin(index * 1.7) * 18;
      const offset = groupOffsets[group.id] || { x: 0, y: 0 };
      return [
        group.id,
        {
          x: 60 + cellW * (col + 0.5) + wave + offset.x,
          y: 58 + cellH * (row + 0.5) + Math.cos(index * 1.3) * 16 + offset.y,
          radius: Math.min(Math.max(group.radius, Math.min(cellW, cellH) * 0.34), Math.min(cellW, cellH) * 0.48),
        },
      ];
    })
  );
}

function mapNodeTargets(nodes, leaves, centers) {
  const targetById = {};
  leaves.forEach((group) => {
    const center = centers[group.id];
    if (!center) return;
    group.nodes.forEach((node) => {
      const offset = colorAffinityOffset(node, group, center);
      targetById[node.id] = {
        x: center.x + offset.x,
        y: center.y + offset.y,
      };
    });
  });
  return nodes.map((node) => ({
    ...node,
    x: targetById[node.id]?.x ?? WIDTH / 2,
    y: targetById[node.id]?.y ?? HEIGHT / 2,
    targetX: targetById[node.id]?.x ?? WIDTH / 2,
    targetY: targetById[node.id]?.y ?? HEIGHT / 2,
  }));
}

function runLayout(nodes, leaves, groupOffsets) {
  if (!nodes.length) return { positions: {}, centers: {}, parents: [] };
  if (!leaves.length || (leaves.length === 1 && leaves[0].id === "root")) {
    return { positions: compactGrid(nodes), centers: {}, parents: [] };
  }

  const centers = placeGroups(leaves, groupOffsets);
  const simulated = mapNodeTargets(nodes, leaves, centers);
  const simulation = forceSimulation(simulated)
    .force("x", forceX((node) => node.targetX).strength(0.17))
    .force("y", forceY((node) => node.targetY).strength(0.17))
    .force("charge", forceManyBody().strength(-1.8))
    .force("collide", forceCollide(NODE_RADIUS + 2.6).strength(0.96))
    .stop();

  for (let tick = 0; tick < 230; tick += 1) simulation.tick();

  return {
    positions: Object.fromEntries(
      simulated.map((node) => [
        node.id,
        {
          x: Math.max(MARGIN, Math.min(WIDTH - MARGIN, node.x)),
          y: Math.max(MARGIN, Math.min(HEIGHT - MARGIN, node.y)),
        },
      ])
    ),
    centers,
  };
}

function ResponseGlyph({ node, x, y, onHover, onLeave }) {
  const colors = node.colorHexes;
  const count = colors.length;
  const dotRadius = count <= 1 ? 4.3 : count <= 3 ? 2.8 : 2.35;
  return (
    <motion.g
      layout
      initial={false}
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 68, damping: 18, mass: 0.7 }}
      onMouseEnter={() => onHover(node)}
      onMouseLeave={onLeave}
      style={{ cursor: "default" }}
    >
      <circle r={NODE_RADIUS + 2.8} fill="rgba(255,255,255,0.68)" stroke="rgba(30,24,42,0.18)" strokeWidth="1" />
      {colors.map((color, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(1, count) - Math.PI / 2;
        const orbit = count <= 1 ? 0 : count <= 3 ? 3.5 : 4.7;
        return (
          <circle
            key={`${node.id}-${color}-${index}`}
            cx={Math.cos(angle) * orbit}
            cy={Math.sin(angle) * orbit}
            r={dotRadius}
            fill={color}
            stroke="rgba(15,12,24,0.42)"
            strokeWidth="0.65"
          />
        );
      })}
    </motion.g>
  );
}

function GroupContainer({ group, center, total, parentTotal, muted, onPointerDown, onHover, onLeave }) {
  if (!center) return null;
  const totalPct = total ? Math.round((group.nodes.length / total) * 100) : 0;
  const parentPct = parentTotal ? Math.round((group.nodes.length / parentTotal) * 100) : 100;
  const color = groupColorFor(group.label, group.layerId);
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: muted ? 0.18 : 1, scale: 1 }}
      transition={{ duration: 0.45 }}
      onPointerDown={(event) => onPointerDown(event, group.id)}
      onMouseEnter={() => onHover?.({ type: "group", group, parentTotal })}
      onMouseLeave={onLeave}
      style={{ cursor: "grab" }}
    >
      <circle
        cx={center.x}
        cy={center.y}
        r={center.radius}
        fill={color}
        opacity={muted ? 0.08 : 0.075}
        stroke={color}
        strokeWidth={muted ? 1 : 1.4}
        strokeOpacity={muted ? 0.22 : 0.5}
        strokeDasharray={muted ? "5 9" : "none"}
      />
      {!muted ? (
        <g transform={`translate(${center.x}, ${center.y + center.radius + 24})`}>
          <text textAnchor="middle" className="repository-label">
            {group.displayLabel || group.label}
          </text>
          <text y="18" textAnchor="middle" className="repository-sub-label">
            {group.nodes.length} participants · {parentPct}% of parent · {totalPct}% total
          </text>
        </g>
      ) : null}
    </motion.g>
  );
}

function RepositoryReadout({ active, total }) {
  if (!active) {
    return (
      <div className="repository-readout">
        <p className="readout-eyebrow">Hover</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Move over a response node to read its emotion, language, time, and selected colors.
        </p>
      </div>
    );
  }
  if (active.type === "group") {
    const { group, parentTotal } = active;
    const totalPct = total ? Math.round((group.nodes.length / total) * 100) : 0;
    const parentPct = parentTotal ? Math.round((group.nodes.length / parentTotal) * 100) : 100;
    const emotionCounts = group.nodes.reduce((map, node) => {
      map[node.emotion] = (map[node.emotion] || 0) + 1;
      return map;
    }, {});
    const topEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const colorCounts = group.nodes.flatMap((node) => node.colors).reduce((map, color) => {
      map[color] = (map[color] || 0) + 1;
      return map;
    }, {});
    const topColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return (
      <div className="repository-readout">
        <p className="readout-eyebrow">Selected group</p>
        <p className="mt-2 text-lg font-black text-[var(--text)]">{group.displayLabel || group.label}</p>
        <div className="repository-hover-facts">
          <div>
            <span>Participants</span>
            <strong>{group.nodes.length}</strong>
          </div>
          <div>
            <span>Share</span>
            <strong>{parentPct}% of parent · {totalPct}% total</strong>
          </div>
          <div>
            <span>Top emotions</span>
            <strong>{topEmotions.map(([emotion, count]) => `${emotion} ${count}`).join(", ") || "No emotion data"}</strong>
          </div>
          <div>
            <span>Prevalent colors</span>
            <strong>{topColors.map(([color, count]) => `${color} ${count}`).join(", ") || "No color data"}</strong>
          </div>
        </div>
      </div>
    );
  }
  const node = active;
  return (
    <div className="repository-readout">
      <p className="readout-eyebrow">Participant response</p>
      <div className="repository-hover-facts">
        <div>
          <span>Emotion selected</span>
          <strong>{node.emotion}</strong>
        </div>
        <div>
          <span>Valence</span>
          <strong>{node.valence}</strong>
        </div>
        <div>
          <span>Intensity</span>
          <strong>{node.intensity}</strong>
        </div>
        <div>
          <span>Language / date</span>
          <strong>{node.language} · {node.date || "Undated"}</strong>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {node.colors.map((color, index) => (
          <span key={`${node.id}-${color}-${index}`} className="repository-chip">
            <span style={{ background: node.colorHexes[index] }} />
            {color}
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
        One of {total} responses in the collective archive. Multi-color responses keep every selected color visible inside the same participant node.
      </p>
    </div>
  );
}

export function ResponseRepositoryMap({ records }) {
  const nodes = useMemo(() => toResponseNodes(records), [records]);
  const [layers, setLayers] = useState([]);
  const [nextLayer, setNextLayer] = useState("language");
  const [positions, setPositions] = useState({});
  const [hovered, setHovered] = useState(null);
  const [groupOffsets, setGroupOffsets] = useState({});
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  const hierarchy = useMemo(() => buildGroupHierarchy(nodes, layers), [nodes, layers]);
  const layout = useMemo(() => runLayout(nodes, hierarchy.leaves, groupOffsets), [nodes, hierarchy.leaves, groupOffsets]);

  useEffect(() => {
    setPositions(layout.positions);
  }, [layout.positions]);

  const parentCenters = useMemo(() => {
    if (!hierarchy.parents.length || !layout.centers) return {};
    const centers = {};
    hierarchy.parents.forEach((parent) => {
      const children = hierarchy.leaves.filter((leaf) => leaf.id.startsWith(`${parent.id}/`));
      const childCenters = children.map((child) => layout.centers[child.id]).filter(Boolean);
      if (!childCenters.length) return;
      const x = childCenters.reduce((sum, center) => sum + center.x, 0) / childCenters.length;
      const y = childCenters.reduce((sum, center) => sum + center.y, 0) / childCenters.length;
      const radius = Math.max(...childCenters.map((center) => Math.hypot(center.x - x, center.y - y) + center.radius)) + 20;
      centers[parent.id] = { x, y, radius };
    });
    return centers;
  }, [hierarchy.parents, hierarchy.leaves, layout.centers]);

  const usedLayerIds = new Set(layers.map((layer) => layer.id));
  const availableOptions = GROUP_OPTIONS.filter((option) => !usedLayerIds.has(option.id));
  const selectedOption = GROUP_OPTIONS.find((option) => option.id === nextLayer) || availableOptions[0];

  function addLayer() {
    const option = GROUP_OPTIONS.find((item) => item.id === nextLayer) || availableOptions[0];
    if (!option) return;
    setLayers((current) => [...current, option]);
    setNextLayer(availableOptions.find((item) => item.id !== option.id)?.id || "");
  }

  function removeLayer(index) {
    setLayers((current) => current.filter((_, layerIndex) => layerIndex !== index));
    setGroupOffsets({});
  }

  function reset() {
    setLayers([]);
    setGroupOffsets({});
    setHovered(null);
    setNextLayer("language");
  }

  function pointerPoint(event) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(svg.getScreenCTM().inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function startDrag(event, groupId) {
    event.preventDefault();
    event.stopPropagation();
    const center = layout.centers[groupId];
    if (!center) return;
    const point = pointerPoint(event);
    setDrag({ groupId, start: point, origin: groupOffsets[groupId] || { x: 0, y: 0 } });
  }

  function moveDrag(event) {
    if (!drag) return;
    const point = pointerPoint(event);
    setGroupOffsets((current) => ({
      ...current,
      [drag.groupId]: {
        x: drag.origin.x + point.x - drag.start.x,
        y: drag.origin.y + point.y - drag.start.y,
      },
    }));
  }

  function endDrag() {
    setDrag(null);
  }

  const visibleGroups = layers.length ? hierarchy.leaves : [];
  const deepestLayer = layers.at(-1);

  return (
    <div className="repository-module">
      <div className="repository-stage">
        <div className="repository-summary">
          <div>
            <p className="readout-eyebrow">Response repository</p>
            <h3>{nodes.length} participants</h3>
          </div>
          <p>100% of visible responses · chronological origin</p>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Individual response nodes grouped by selected repository dimensions"
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          <defs>
            <radialGradient id="repositoryGlow" cx="50%" cy="50%" r="62%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <rect width={WIDTH} height={HEIGHT} rx="28" fill="url(#repositoryGlow)" />
          {hierarchy.parents.map((group) => (
            <GroupContainer
              key={group.id}
              group={group}
              center={parentCenters[group.id]}
              total={nodes.length}
              parentTotal={nodes.length}
              muted
              onPointerDown={startDrag}
              onHover={setHovered}
              onLeave={() => setHovered(null)}
            />
          ))}
          {visibleGroups.map((group) => {
            const parent = hierarchy.parents.find((item) => item.id === group.parentId);
            return (
              <GroupContainer
                key={group.id}
                group={group}
                center={layout.centers[group.id]}
                total={nodes.length}
                parentTotal={parent?.nodes.length || nodes.length}
                muted={false}
                onPointerDown={startDrag}
                onHover={setHovered}
                onLeave={() => setHovered(null)}
              />
            );
          })}
          <AnimatePresence>
            {nodes.map((node) => {
              const position = positions[node.id] || { x: WIDTH / 2, y: HEIGHT / 2 };
              return (
                <ResponseGlyph
                  key={node.id}
                  node={node}
                  x={position.x}
                  y={position.y}
                  onHover={setHovered}
                  onLeave={() => setHovered(null)}
                />
              );
            })}
          </AnimatePresence>
        </svg>
      </div>

      <aside className="repository-controls">
        <div className="repository-control-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="readout-eyebrow">Grouping layers</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Add layers one by one. Each layer subdivides the previous one; the newest groups become the visible clusters.
              </p>
            </div>
            <Button variant="ghost" onClick={reset} aria-label="Reset response repository">
              <RotateCcw size={15} />
              Reset
            </Button>
          </div>

          <div className="mt-5 grid gap-3">
            {availableOptions.length ? (
              <>
                <SelectField
                  label="Add grouping"
                  value={nextLayer || availableOptions[0]?.id || ""}
                  onChange={setNextLayer}
                  options={availableOptions.map((option) => ({ value: option.id, label: option.label }))}
                  helper={selectedOption?.helper}
                  includeAll={false}
                />
                <Button variant="primary" onClick={addLayer} className="w-fit">
                  <Plus size={15} />
                  Add Layer
                </Button>
              </>
            ) : (
              <p className="text-sm leading-6 text-[var(--muted)]">All grouping layers are active.</p>
            )}
          </div>

          <div className="mt-5 space-y-2">
            {layers.length ? (
              layers.map((layer, index) => (
                <div key={`${layer.id}-${index}`} className="repository-layer-pill">
                  <span>{index + 1}</span>
                  <p>{layer.label}</p>
                  <button type="button" onClick={() => removeLayer(index)} aria-label={`Remove ${layer.label}`}>
                    <X size={14} />
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm leading-6 text-[var(--muted)]">
                The opening state is a compact chronological grid. Add a grouping layer to watch the same responses reorganize.
              </p>
            )}
          </div>
        </div>

        <RepositoryReadout active={hovered} total={nodes.length} />

        <div className="repository-control-card">
          <p className="readout-eyebrow">Current view</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {deepestLayer
              ? `${visibleGroups.length} final groups by ${deepestLayer.label}. Parent group containers remain visible as soft background fields.`
              : "Chronological order, one participant node per response."}
          </p>
        </div>
      </aside>
    </div>
  );
}
