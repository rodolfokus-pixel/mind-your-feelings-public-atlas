import React from "react";
import { EMOTION_DESCRIPTORS, EMOTION_ORDER } from "../../types/dataModel.js";
import { colorProfileByEmotion } from "../../data/colorProfiles.js";

export function Legend({ metrics, records }) {
  const max = Math.max(...metrics.emotions.map((item) => item.count), 1);
  const profiles = colorProfileByEmotion(records);

  return (
    <section className="glass-panel h-full p-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.24em] text-[var(--text)]">Emotional legend</h2>
      <div className="mt-5 space-y-4">
        {EMOTION_ORDER.map((emotion) => {
          const count = metrics.emotions.find((item) => item.emotion === emotion)?.count ?? 0;
          const profile = profiles[emotion];
          return (
            <div key={emotion}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: profile.dominant.hex, boxShadow: `0 0 18px ${profile.dominant.hex}` }}
                  />
                  <p className="truncate text-sm font-semibold text-[var(--text)]">{emotion}</p>
                </div>
                <p className="text-sm tabular-nums text-[var(--muted)]">{count}</p>
              </div>
              <div className="h-1.5 bg-black/10">
                <div
                  className="h-full"
                  style={{
                    width: `${(count / max) * 100}%`,
                    background: `linear-gradient(90deg, ${profile.colors.slice(0, 4).map((item) => item.hex).join(", ") || profile.dominant.hex})`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                {EMOTION_DESCRIPTORS[emotion]} · dominant participant color: {profile.dominant.color}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
