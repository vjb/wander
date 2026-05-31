"use client";

import { useState, useEffect, useCallback } from "react";

export interface PassportEntry {
  neighborhood: string;
  stopName: string;
  vibe: string;
  visitedAt: string; // ISO string
  lat?: number;
  lng?: number;
}

export interface PassportNeighborhood {
  neighborhood: string;
  stops: string[];
  vibes: string[];
  lastVisited: string; // ISO string
  count: number;
  level: "newcomer" | "regular" | "local"; // based on visit count
}

export type NeighborhoodLevel = "newcomer" | "regular" | "local";

export function getNeighborhoodLevel(count: number): NeighborhoodLevel {
  if (count >= 7) return "local";
  if (count >= 3) return "regular";
  return "newcomer";
}

export const LEVEL_BADGE: Record<NeighborhoodLevel, string> = {
  newcomer: "📍",
  regular: "🗺️",
  local: "🌟",
};

const STORAGE_KEY = "wander_passport";

function normalizeNeighborhood(raw: string): string {
  if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(raw.trim())) {
    return "unknown neighborhood";
  }
  const parts = raw.split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    const candidate = parts[1].toLowerCase();
    if (!/^\d/.test(candidate) && !/^[A-Z]{2}\s\d/.test(candidate)) {
      return candidate;
    }
  }
  const stripped = parts[0].toLowerCase().replace(/\d+/g, "").trim();
  return stripped || raw.toLowerCase();
}

function loadRaw(): PassportEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PassportEntry[]) : [];
  } catch {
    return [];
  }
}

function saveRaw(entries: PassportEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full or unavailable — fail silently
  }
}

function groupEntries(entries: PassportEntry[]): PassportNeighborhood[] {
  const map = new Map<string, PassportNeighborhood>();

  for (const entry of entries) {
    const key = normalizeNeighborhood(entry.neighborhood);
    if (!map.has(key)) {
      map.set(key, {
        neighborhood: key,
        stops: [],
        vibes: [],
        lastVisited: entry.visitedAt,
        count: 0,
        level: "newcomer",
      });
    }
    const group = map.get(key)!;
    if (!group.stops.includes(entry.stopName)) {
      group.stops.push(entry.stopName);
    }
    if (entry.vibe && !group.vibes.includes(entry.vibe)) {
      group.vibes.push(entry.vibe);
    }
    group.count += 1;
    if (entry.visitedAt > group.lastVisited) {
      group.lastVisited = entry.visitedAt;
    }
    group.level = getNeighborhoodLevel(group.count);
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime()
  );
}

/** Computes consecutive day streak ending today (or yesterday as base). */
function computeStreak(entries: PassportEntry[]): number {
  if (entries.length === 0) return 0;
  const days = new Set(
    entries.map((e) => new Date(e.visitedAt).toLocaleDateString("en-CA"))
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-CA");
    if (days.has(key)) {
      streak++;
    } else if (i === 0) {
      // No entry today yet — allow yesterday to be the streak base
      continue;
    } else {
      break;
    }
  }
  return streak;
}

/** Count unique calendar days with at least one stamp. */
function computeTotalWanders(entries: PassportEntry[]): number {
  const days = new Set(
    entries.map((e) => new Date(e.visitedAt).toLocaleDateString("en-CA"))
  );
  return days.size;
}

export interface UsePassportReturn {
  passport: PassportNeighborhood[];
  passportCount: number;
  totalStops: number;
  streakDays: number;
  totalWanders: number;
  addStamp: (entry: PassportEntry) => void;
  clearPassport: () => void;
}

export function usePassport(): UsePassportReturn {
  const [entries, setEntries] = useState<PassportEntry[]>([]);

  useEffect(() => {
    setEntries(loadRaw());
  }, []);

  const addStamp = useCallback((entry: PassportEntry) => {
    setEntries((prev) => {
      const today = new Date().toDateString();
      const isDuplicate = prev.some(
        (e) =>
          e.stopName === entry.stopName &&
          normalizeNeighborhood(e.neighborhood) === normalizeNeighborhood(entry.neighborhood) &&
          new Date(e.visitedAt).toDateString() === today
      );
      if (isDuplicate) return prev;
      const next = [...prev, entry];
      saveRaw(next);
      return next;
    });
  }, []);

  const clearPassport = useCallback(() => {
    setEntries([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const passport = groupEntries(entries);
  const passportCount = passport.length;
  const totalStops = new Set(entries.map((e) => e.stopName)).size;
  const streakDays = computeStreak(entries);
  const totalWanders = computeTotalWanders(entries);

  return { passport, passportCount, totalStops, streakDays, totalWanders, addStamp, clearPassport };
}
