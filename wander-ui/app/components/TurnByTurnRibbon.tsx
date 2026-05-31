"use client";

interface Step {
  instruction: string;
  distance_m: number;
  duration_secs: number;
  maneuver: string;
}

const MANEUVER_ICONS: Record<string, string> = {
  "turn-left": "↰",
  "turn-right": "↱",
  "turn-slight-left": "↖",
  "turn-slight-right": "↗",
  "turn-sharp-left": "↩",
  "turn-sharp-right": "↪",
  "uturn-left": "↩",
  "uturn-right": "↪",
  "straight": "↑",
  "ramp-left": "↖",
  "ramp-right": "↗",
  "keep-left": "↖",
  "keep-right": "↗",
  "roundabout-left": "↺",
  "roundabout-right": "↻",
  "fork-left": "↖",
  "fork-right": "↗",
  "merge": "↑",
  "ferry": "⛴",
  "ferry-train": "🚂",
  "": "·",
};

function formatDist(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m} m`;
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  return `${Math.round(secs / 60)} min`;
}

export function TurnByTurnRibbon({ steps }: { steps: Step[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="px-4 pb-3 pt-1">
      <div className="flex items-center gap-1.5 mb-2">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8ba88e" strokeWidth="2.5" className="shrink-0">
          <path d="M3 12l5-5 4 4 6-7" />
        </svg>
        <span
          style={{ fontFamily: "var(--font-inter)" }}
          className="text-[#e5d3b3]/40 text-[10px] font-semibold uppercase tracking-widest"
        >
          walking directions
        </span>
        <span className="text-[#f4f4f5]/20 text-[10px] ml-auto shrink-0">
          {steps.length} steps
        </span>
      </div>

      {/* Horizontally scrollable step cards */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {steps.map((step, i) => {
          const icon = MANEUVER_ICONS[step.maneuver] ?? "·";
          const isWalk = step.maneuver === "" || step.maneuver === "straight";
          return (
            <div
              key={i}
              className="shrink-0 flex items-start gap-2 px-3 py-2 rounded-xl border border-[#f4f4f5]/6 bg-[#131316]/60"
              style={{
                minWidth: "140px",
                maxWidth: "180px",
                borderLeft: isWalk
                  ? "2px solid rgba(139,168,142,0.3)"
                  : "2px solid rgba(229,211,179,0.25)",
              }}
            >
              {/* Step number + icon */}
              <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0">
                <span
                  className="text-[15px] leading-none"
                  style={{ color: isWalk ? "#8ba88e" : "#e5d3b3" }}
                >
                  {icon}
                </span>
                <span className="text-[#f4f4f5]/20 text-[9px]">{i + 1}</span>
              </div>

              {/* Instruction + meta */}
              <div className="min-w-0">
                <p
                  className="text-[#f4f4f5]/75 text-[11px] font-light leading-snug line-clamp-2"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  {step.instruction}
                </p>
                <p className="text-[#f4f4f5]/30 text-[10px] mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>
                  {formatDist(step.distance_m)}
                  {step.duration_secs > 0 && ` · ${formatDuration(step.duration_secs)}`}
                </p>
              </div>
            </div>
          );
        })}

        {/* End cap */}
        <div className="shrink-0 flex items-center justify-center px-3 py-2 rounded-xl border border-[#e5d3b3]/15 bg-[#e5d3b3]/5 min-w-[56px]">
          <span className="text-[#e5d3b3]/60 text-[18px]">⚑</span>
        </div>
      </div>
    </div>
  );
}
