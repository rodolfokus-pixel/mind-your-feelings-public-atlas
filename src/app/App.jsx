import React, { useEffect, useMemo, useState } from "react";
import { AtlasShell } from "../components/layout/AtlasShell.jsx";
import { FilterPanel } from "../components/layout/FilterPanel.jsx";
import { ModuleFrame } from "../components/atlas/ModuleFrame.jsx";
import { EmotionRiver, EmotionRiverControls } from "../components/atlas/EmotionRiver.jsx";
import { ResponseRepositoryMap } from "../components/atlas/ResponseRepositoryMap.jsx";
import { NeuralEmotionMap } from "../components/atlas/NeuralEmotionMap.jsx";
import { BodyAtlas, BodyAtlasControls } from "../components/atlas/BodyAtlas.jsx";
import { AtlasPanel } from "../components/ui/Section.jsx";
import { EMPTY_FILTERS, applyFilters } from "../data/filters.js";
import { atlasMetrics } from "../data/metrics.js";
import { loadAtlasData } from "../data/loadAtlasData.js";

export function App() {
  const [records, setRecords] = useState([]);
  const [riverFilters, setRiverFilters] = useState(() => ({ ...EMPTY_FILTERS }));
  const [networkFilters, setNetworkFilters] = useState(() => ({ ...EMPTY_FILTERS }));
  const [bodyFilters, setBodyFilters] = useState(() => ({ ...EMPTY_FILTERS }));
  const [riverAccuracy, setRiverAccuracy] = useState(100);
  const [riverSmoothing, setRiverSmoothing] = useState(44);
  const [riverShowLines, setRiverShowLines] = useState(true);
  const [bodyOverlayMode, setBodyOverlayMode] = useState("glow");
  const [bodyStrength, setBodyStrength] = useState(82);
  const [bodyBackgroundMode, setBodyBackgroundMode] = useState("dark");
  useEffect(() => {
    loadAtlasData()
      .then((loaded) => {
        setRecords(loaded);
      })
      .catch(() => setRecords([]));
  }, []);

  const riverRecords = useMemo(() => applyFilters(records, riverFilters), [records, riverFilters]);
  const networkRecords = useMemo(() => applyFilters(records, networkFilters), [records, networkFilters]);
  const bodyRecords = useMemo(() => applyFilters(records, bodyFilters), [records, bodyFilters]);
  const allMetrics = useMemo(() => atlasMetrics(records), [records]);

  return (
    <AtlasShell metrics={allMetrics}>
      <div className="space-y-10">
        <ModuleFrame
          eyebrow="Individual response repository"
          title="Response Clusters"
          description="A clean overview of every participant response as a small color-bearing node. Begin in chronological order, then progressively regroup the same responses by language, time, emotion, valence, color, or number of colors selected."
        >
          <div className="p-4 md:p-6">
            <AtlasPanel>
              <ResponseRepositoryMap records={records} />
            </AtlasPanel>
          </div>
        </ModuleFrame>

        <ModuleFrame
          eyebrow="Relational emotional field"
          title="Neural Emotion Map"
          description="A glowing network where participant-selected colors, blended emotion bubbles, and individual submissions connect like a living emotional nervous system."
        >
          <div className="module-grid">
            <AtlasPanel className="atlas-panel-light">
              <NeuralEmotionMap records={networkRecords} />
            </AtlasPanel>
            <FilterPanel
              records={records}
              filters={networkFilters}
              setFilters={setNetworkFilters}
              title="Neural controls"
              description="Filter only the neural map. Use language here to compare English, Spanish, or both without adding language nodes to the graphic."
            />
          </div>
        </ModuleFrame>

        <ModuleFrame
          eyebrow="Embodied emotional topography"
          title="Body Atlas"
          description="A layered atlas made from the real body-map drawings, showing where participant colors overlap across the body."
        >
          <div className="module-grid">
            <AtlasPanel className="atlas-panel-light">
              <BodyAtlas
                records={bodyRecords}
                overlayMode={bodyOverlayMode}
                strength={bodyStrength}
                backgroundMode={bodyBackgroundMode}
              />
            </AtlasPanel>
            <FilterPanel
              records={records}
              filters={bodyFilters}
              setFilters={setBodyFilters}
              title="Body controls"
              description="Filter only the Body Atlas. Overlay effects and layer strength live beside the body visualization."
            >
              <BodyAtlasControls
                overlayMode={bodyOverlayMode}
                setOverlayMode={setBodyOverlayMode}
                strength={bodyStrength}
                setStrength={setBodyStrength}
                backgroundMode={bodyBackgroundMode}
                setBackgroundMode={setBodyBackgroundMode}
              />
            </FilterPanel>
          </div>
        </ModuleFrame>

        <ModuleFrame
          eyebrow="Whole archive timeline"
          title="Emotion Timeline"
          description="The opening view shows the complete timeline of participation. Each flowing band is a normalized emotion, shaped by participation density over time and colored from the participant-selected colors for that emotion."
        >
          <div className="module-grid">
            <AtlasPanel className="atlas-panel-light">
              <EmotionRiver
                records={riverRecords}
                accuracy={riverAccuracy}
                smoothing={riverSmoothing}
                showLines={riverShowLines}
              />
            </AtlasPanel>
            <FilterPanel
              records={records}
              filters={riverFilters}
              setFilters={setRiverFilters}
              title="Timeline controls"
              description="Filter only the Emotion Timeline, then tune its shape, smoothing, and line visibility here."
            >
              <EmotionRiverControls
                accuracy={riverAccuracy}
                setAccuracy={setRiverAccuracy}
                smoothing={riverSmoothing}
                setSmoothing={setRiverSmoothing}
                showLines={riverShowLines}
                setShowLines={setRiverShowLines}
              />
            </FilterPanel>
          </div>
        </ModuleFrame>

        <section className="public-context">
          <div>
            <p className="section-eyebrow">About the project</p>
            <h2>From private feeling to a shared civic portrait.</h2>
          </div>
          <div className="public-context-copy">
            <p>
              Mind Your Feelings is a participatory design intervention exploring how emotions manifest in the body. The atlas translates anonymous contributions into interactive fields of time, color, relation, and embodied experience.
            </p>
            <p>
              Commissioned by the Northern New Jersey Community Foundation (ArtsBergen) and developed at Johnson Public Library in Hackensack, New Jersey.
            </p>
            <a href="https://rodolfokusulas.com/project/" target="_blank" rel="noreferrer">
              View the complete project overview ↗
            </a>
          </div>
        </section>
      </div>
    </AtlasShell>
  );
}
