"use client";
import { useState, useEffect, useCallback } from "react";

const HISTORY_KEY = "wander_history_v1";
const MAX_HISTORY = 10;

export interface WanderHistoryEntry {
  id: string;
  route_name: string;
  theme_summary: string;
  vibe: string;
  start_location: string;
  end_location: string;
  saved_at: string; // ISO string
  waypoints: Array<{
    order: number;
    location_name: string;
    vibe_tag: string;
    duration_mins: number;
  }>;
  ratings: Record<string, "up" | "down">; // stop_name -> rating
  total_walking_time_mins: number;
  estimated_total_cost_usd: number;
}

export function useWanderHistory() {
  const [history, setHistory] = useState<WanderHistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = useCallback((entries: WanderHistoryEntry[]) => {
    setHistory(entries);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    } catch {}
  }, []);

  const saveWander = useCallback(
    (route: any, vibe: string, startLocation: string, endLocation: string): string => {
      const entry: WanderHistoryEntry = {
        id: `w_${Date.now()}`,
        route_name: route.route_name || "unnamed wander",
        theme_summary: route.theme_summary || "",
        vibe,
        start_location: startLocation,
        end_location: endLocation,
        saved_at: new Date().toISOString(),
        waypoints: (route.waypoints || []).map((wp: any) => ({
          order: wp.order,
          location_name: wp.location_name,
          vibe_tag: wp.vibe_tag || "",
          duration_mins: wp.duration_mins || 0,
        })),
        ratings: {},
        total_walking_time_mins: route.total_walking_time_mins || 0,
        estimated_total_cost_usd: route.estimated_total_cost_usd || 0,
      };
      setHistory((prev) => {
        const updated = [entry, ...prev.filter((e) => e.id !== entry.id)].slice(
          0,
          MAX_HISTORY
        );
        persist(updated);
        return updated;
      });
      return entry.id;
    },
    [persist]
  );

  const updateRating = useCallback(
    (entryId: string, stopName: string, rating: "up" | "down") => {
      setHistory((prev) => {
        const updated = prev.map((e) =>
          e.id === entryId
            ? { ...e, ratings: { ...e.ratings, [stopName]: rating } }
            : e
        );
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const clearHistory = useCallback(() => {
    persist([]);
  }, [persist]);

  return { history, saveWander, updateRating, clearHistory };
}
