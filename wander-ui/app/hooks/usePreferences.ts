"use client";

import { useState, useEffect, useCallback } from "react";

export interface WanderPreferences {
  lastVibe: string;
  lastCustomVibe: string;
  lastStopCount: number;
  lastCompanion: string;
  lastTimeBudget: number;
  lastInputMode: "time" | "steps";
  lastStepGoal: number;
  lastFreeOnly: boolean;
  lastAvoidSlopes: boolean;
  lastMaxBudget: number;
  vibeHistory: string[]; // ordered by most recently used, deduplicated
  wanderCount: number;   // total number of wanders completed
}

const STORAGE_KEY = "wander_preferences";
const DEFAULT_PREFS: WanderPreferences = {
  lastVibe: "",
  lastCustomVibe: "",
  lastStopCount: 3,
  lastCompanion: "solo",
  lastTimeBudget: 90,
  lastInputMode: "time",
  lastStepGoal: 5000,
  lastFreeOnly: false,
  lastAvoidSlopes: false,
  lastMaxBudget: 50,
  vibeHistory: [],
  wanderCount: 0,
};

function loadPrefs(): WanderPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: WanderPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // storage full — fail silently
  }
}

export interface UsePreferencesReturn {
  preferences: WanderPreferences;
  isLoaded: boolean;
  saveWander: (prefs: Partial<WanderPreferences>) => void;
  signatureVibe: string | null; // most-used vibe (after 2+ wanders)
}

export function usePreferences(): UsePreferencesReturn {
  const [preferences, setPreferences] = useState<WanderPreferences>(DEFAULT_PREFS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loaded = loadPrefs();
    setPreferences(loaded);
    setIsLoaded(true);
  }, []);

  const saveWander = useCallback((incoming: Partial<WanderPreferences>) => {
    setPreferences((prev) => {
      // Build updated vibe history (most recent first, max 10)
      const newVibe = incoming.lastVibe || prev.lastVibe;
      let vibeHistory = [...prev.vibeHistory];
      if (newVibe && newVibe !== "custom") {
        vibeHistory = [newVibe, ...vibeHistory.filter((v) => v !== newVibe)].slice(0, 10);
      }
      const next: WanderPreferences = {
        ...prev,
        ...incoming,
        vibeHistory,
        wanderCount: prev.wanderCount + 1,
      };
      savePrefs(next);
      return next;
    });
  }, []);

  // signatureVibe: only surface after 2+ wanders, picks the most frequently used vibe
  const signatureVibe = (() => {
    if (preferences.wanderCount < 2 || preferences.vibeHistory.length === 0) return null;
    const counts = preferences.vibeHistory.reduce<Record<string, number>>((acc, v) => {
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    }, {});
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  })();

  return { preferences, isLoaded, saveWander, signatureVibe };
}
