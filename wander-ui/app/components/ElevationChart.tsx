"use client";

interface ElevationPoint {
  elevation: number;
  index: number;
}

interface WaypointMark {
  order: number;
  fraction: number; // 0–1 position along the route
}

function formatElevation(m: number): string {
  return `${Math.round(m)}m`;
}

export function ElevationChart({
  data,
  waypointFractions,
}: {
  data: ElevationPoint[];
  waypointFractions?: number[]; // 0–1 position for each stop
}) {
  if (!data || data.length < 4) return null;

  const elevations = data.map((d) => d.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const range = maxElev - minElev;

  // Don't bother showing for flat routes (< 5m total range)
  if (range < 5) return null;

  const gain = elevations.reduce((acc, e, i) => {
    if (i === 0) return 0;
    const diff = e - elevations[i - 1];
    return acc + (diff > 0 ? diff : 0);
  }, 0);

  const loss = elevations.reduce((acc, e, i) => {
    if (i === 0) return 0;
    const diff = e - elevations[i - 1];
    return acc + (diff < 0 ? Math.abs(diff) : 0);
  }, 0);

  const W = 400;
  const H = 48;
  const PAD = 2;

  // Build SVG path points
  const pts = elevations.map((e, i) => {
    const x = PAD + (i / (elevations.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((e - minElev) / range) * (H - PAD * 2) * 0.85;
    return { x, y };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)},${H} L ${pts[0].x.toFixed(1)},${H} Z`;

  return (
    <div className="px-4 pb-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8ba88e" strokeWidth="2.5">
          <path d="M3 17l5-8 4 5 3-4 5 7" />
        </svg>
        <span
          style={{ fontFamily: "var(--font-inter)" }}
          className="text-[#e5d3b3]/40 text-[10px] font-semibold uppercase tracking-widest"
        >
          elevation
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          {gain > 2 && (
            <span className="text-[#8ba88e]/60 text-[10px]" style={{ fontFamily: "var(--font-inter)" }}>
              ↑ {formatElevation(gain)}
            </span>
          )}
          {loss > 2 && (
            <span className="text-[#e5d3b3]/50 text-[10px]" style={{ fontFamily: "var(--font-inter)" }}>
              ↓ {formatElevation(loss)}
            </span>
          )}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="rounded-xl overflow-hidden bg-[#131316]/40 border border-[#f4f4f5]/5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: "48px", display: "block" }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8ba88e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8ba88e" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaPath} fill="url(#elevFill)" />

          {/* Stroke line */}
          <path
            d={linePath}
            fill="none"
            stroke="#8ba88e"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Waypoint tick marks */}
          {waypointFractions?.map((frac, i) => {
            const x = PAD + frac * (W - PAD * 2);
            return (
              <g key={i}>
                <line
                  x1={x} y1={H - 10}
                  x2={x} y2={H}
                  stroke="#e5d3b3"
                  strokeWidth="1"
                  strokeOpacity="0.5"
                />
                <text
                  x={x}
                  y={H - 12}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#e5d3b3"
                  fillOpacity="0.5"
                  fontFamily="-apple-system, sans-serif"
                  fontWeight="600"
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Min / Max labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[#f4f4f5]/20 text-[9px]" style={{ fontFamily: "var(--font-inter)" }}>
          {formatElevation(minElev)} min
        </span>
        <span className="text-[#f4f4f5]/20 text-[9px]" style={{ fontFamily: "var(--font-inter)" }}>
          {formatElevation(maxElev)} max
        </span>
      </div>
    </div>
  );
}
