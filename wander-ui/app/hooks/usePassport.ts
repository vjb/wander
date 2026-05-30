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
}

const STORAGE_KEY = "wander_passport";

function normalizeNeighborhood(raw: string): string {
  // Guard: coordinate fallbacks like "40.7580, -73.9855" should not be normalized
  if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(raw.trim())) {
    return "unknown neighborhood";
  }
  // Try to extract the neighborhood portion from a full address
  // e.g. "123 W 52nd St, Hell's Kitchen, New York, NY 10019, USA" → "hell's kitchen"
  const parts = raw.split(",").map((p) => p.trim());
  // If it looks like a full address, the 2nd part is often the neighborhood
  if (parts.length >= 3) {
    const candidate = parts[1].toLowerCase();
    // Skip parts that look like "New York" or state codes like "NY 10019"
    if (!/^\d/.test(candidate) && !/^[A-Z]{2}\s\d/.test(candidate)) {
      return candidate;
    }
  }
  // Fallback: use the whole string lowercased, stripped of numbers
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
  }

  // Sort by most recently visited
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime()
  );
}

export interface UsePassportReturn {
  passport: PassportNeighborhood[];
  passportCount: number;        // unique neighborhoods
  totalStops: number;           // total unique stops checked in
  addStamp: (entry: PassportEntry) => void;
  clearPassport: () => void;
}

export function usePassport(): UsePassportReturn {
  const [entries, setEntries] = useState<PassportEntry[]>([]);

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    setEntries(loadRaw());
  }, []);

  const addStamp = useCallback((entry: PassportEntry) => {
    setEntries((prev) => {
      // Avoid duplicate entries for the same stop+neighborhood on same day
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

  return { passport, passportCount, totalStops, addStamp, clearPassport };
}
