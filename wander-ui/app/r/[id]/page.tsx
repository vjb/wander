"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { RouteScreen } from "../../page";
import { usePassport } from "../../hooks/usePassport";

interface WaypointV3 {
  order: number;
  location_name: string;
  address_hint: string;
  google_rating?: number | null;
  photo_url?: string | null;
  action_description: string;
  duration_mins: number;
  walk_to_next_mins: number;
  vibe_tag: string;
  insider_tip: string;
  place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  estimated_cost_usd?: number;
}

interface WanderRouteOptionV3 {
  route_name: string;
  theme_summary: string;
  total_walking_time_mins: number;
  initial_walk_mins: number;
  start_location?: string;
  end_location?: string;
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
  waypoints: WaypointV3[];
  navigation_deep_link: string;
  estimated_total_cost_usd?: number;
}

interface WanderV3Response {
  routes: WanderRouteOptionV3[];
  weather_context?: string | null;
}

export default function SharedRoutePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  
  const [routeData, setRouteData] = useState<WanderV3Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fix #20: shared route now stamps the passport on check-in ──
  const { addStamp } = usePassport();

  useEffect(() => {
    if (!id) return;
    
    async function fetchSharedRoute() {
      try {
        const res = await fetch(`/api/shares/${id}`);
        if (!res.ok) {
          throw new Error("Shared route not found");
        }
        const data = await res.json();
        setRouteData(data);
      } catch (err: any) {
        setError(err.message || "Failed to load shared route");
      } finally {
        setLoading(false);
      }
    }
    
    fetchSharedRoute();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131316] text-[#f4f4f5] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#8ba88e] animate-spin mb-4" />
        <p className="text-[#f4f4f5]/40 text-sm font-light italic" style={{ fontFamily: "var(--font-playfair)" }}>
          fetching your shared path...
        </p>
      </div>
    );
  }

  if (error || !routeData) {
    return (
      <div className="min-h-screen bg-[#131316] text-[#f4f4f5] flex flex-col items-center justify-center px-6">
        <p className="text-red-400/80 text-lg mb-6 font-light">{error || "Route not found"}</p>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#f4f4f5]/5 border border-[#f4f4f5]/10 text-[#f4f4f5]/70 hover:bg-[#f4f4f5]/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          go to wander
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#131316] text-[#f4f4f5] relative pb-20">
      <div className="fixed top-5 left-5 z-50">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#131316]/85 backdrop-blur-md border border-[#f4f4f5]/6 text-[#f4f4f5]/55 hover:text-[#f4f4f5]/85 hover:border-[#f4f4f5]/12 text-[12px] font-medium transition-colors"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          create your own wander
        </button>
      </div>
      
      <RouteScreen
        data={routeData}
        vibe={""}
        onReset={() => router.push("/")}
        isSharedView={true}
        addPassportStamp={addStamp}
      />
    </main>
  );
}
