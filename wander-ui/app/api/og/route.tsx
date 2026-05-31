import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * GET /api/og?id=<shareId>
 * Fetches the shared route data and renders a beautiful OG image card.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  // Defaults if no id or fetch fails
  let routeName = "a curated wander";
  let theme = "explore this custom walking route";
  let stops: string[] = [];
  let vibe = "";

  if (id) {
    try {
      const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${backendUrl}/api/shares/${id}`, {
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const data = await res.json();
        const route = data.routes?.[0];
        if (route) {
          routeName = route.route_name || routeName;
          theme = route.theme_summary || theme;
          stops = (route.waypoints || []).slice(0, 5).map(
            (wp: any) => wp.location_name
          );
          vibe = data.vibe || "";
        }
      }
    } catch {
      // fall through to defaults
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "1200px",
          height: "630px",
          background: "#131316",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background gradient orbs */}
        <div
          style={{
            position: "absolute",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(139,168,142,0.12) 0%, transparent 70%)",
            top: "-200px",
            left: "-100px",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(229,211,179,0.07) 0%, transparent 70%)",
            bottom: "-100px",
            right: "100px",
          }}
        />

        {/* Card content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: "64px 72px",
            justifyContent: "space-between",
          }}
        >
          {/* Top: brand + vibe */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: "rgba(139,168,142,0.8)",
              }}
            >
              wander
            </span>
            {vibe && (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "rgba(244,244,245,0.25)",
                  marginLeft: "8px",
                }}
              >
                · {vibe}
              </span>
            )}
          </div>

          {/* Center: route name + theme */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                fontSize: "56px",
                fontWeight: 700,
                lineHeight: 1.1,
                color: "#f4f4f5",
                maxWidth: "820px",
                fontStyle: "italic",
              }}
            >
              {routeName}
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 300,
                lineHeight: 1.5,
                color: "rgba(244,244,245,0.45)",
                maxWidth: "700px",
                fontStyle: "italic",
              }}
            >
              {theme}
            </div>
          </div>

          {/* Bottom: stop list + cta */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            {/* Stop pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", maxWidth: "780px" }}>
              {stops.map((stop, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    borderRadius: "999px",
                    background: "rgba(139,168,142,0.1)",
                    border: "1px solid rgba(139,168,142,0.25)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "rgba(139,168,142,0.7)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 400,
                      color: "rgba(244,244,245,0.75)",
                    }}
                  >
                    {stop}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#8ba88e",
                }}
              >
                steal this wander →
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(244,244,245,0.2)",
                }}
              >
                wander.app
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
