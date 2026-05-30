"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface WaypointCoords {
  lat: number | null | undefined;
  lng: number | null | undefined;
  order: number;
  duration_mins: number;
  walk_to_next_mins: number;
}

export interface WalkModeState {
  walkModeActive: boolean;
  userPosition: { lat: number; lng: number } | null;
  proximityStopIdx: number | null; // within 150m — glow zone
  nearbyStopIdx: number | null;    // within 100m — dwell zone
  checkedInStops: Set<number>;
  dwellSeconds: Map<number, number>;
  currentStopIdx: number;          // next unchecked stop index
  remainingMinutes: number;
  startWalk: () => void;
  stopWalk: () => void;
  manualCheckIn: (idx: number, onCheckIn?: (idx: number) => void) => void;
  geoError: string | null;
  stopsWithoutCoords: number[];    // order values of stops missing lat/lng
}

/** Haversine distance in meters between two lat/lng points */
function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const dphi = ((b.lat - a.lat) * Math.PI) / 180;
  const dlng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dphi / 2) * Math.sin(dphi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlng / 2) * Math.sin(dlng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

const PROXIMITY_RADIUS_M = 150;
const DWELL_RADIUS_M = 100;
const AUTO_CHECKIN_SECONDS = 300; // 5 minutes

export function useWalkMode(
  waypoints: WaypointCoords[],
  onCheckIn?: (idx: number) => void
): WalkModeState {
  const [walkModeActive, setWalkModeActive] = useState(false);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [proximityStopIdx, setProximityStopIdx] = useState<number | null>(null);
  const [nearbyStopIdx, setNearbyStopIdx] = useState<number | null>(null);
  const [checkedInStops, setCheckedInStops] = useState<Set<number>>(new Set());
  const [dwellSeconds, setDwellSeconds] = useState<Map<number, number>>(new Map());
  const [geoError, setGeoError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const dwellIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nearbyIdxRef = useRef<number | null>(null);
  const checkedInRef = useRef<Set<number>>(new Set());

  // Keep ref in sync with state for use inside intervals
  useEffect(() => {
    nearbyIdxRef.current = nearbyStopIdx;
  }, [nearbyStopIdx]);

  useEffect(() => {
    checkedInRef.current = checkedInStops;
  }, [checkedInStops]);

  const doCheckIn = useCallback(
    (idx: number) => {
      setCheckedInStops((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
      setDwellSeconds((prev) => {
        const next = new Map(prev);
        next.delete(idx);
        return next;
      });
      onCheckIn?.(idx);
    },
    [onCheckIn]
  );

  const manualCheckIn = useCallback(
    (idx: number, cb?: (idx: number) => void) => {
      doCheckIn(idx);
      cb?.(idx);
    },
    [doCheckIn]
  );

  // Position update handler
  const handlePosition = useCallback(
    (pos: GeolocationPosition) => {
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      setUserPosition({ lat: userLat, lng: userLng });
      setGeoError(null);

      let closestProximityIdx: number | null = null;
      let closestNearbyIdx: number | null = null;

      waypoints.forEach((wp, idx) => {
        if (checkedInRef.current.has(idx)) return;
        if (wp.lat == null || wp.lng == null) return;
        const dist = haversineDistance(
          { lat: userLat, lng: userLng },
          { lat: wp.lat as number, lng: wp.lng as number }
        );
        if (dist <= PROXIMITY_RADIUS_M && closestProximityIdx === null) {
          closestProximityIdx = idx;
        }
        if (dist <= DWELL_RADIUS_M && closestNearbyIdx === null) {
          closestNearbyIdx = idx;
        }
      });

      setProximityStopIdx(closestProximityIdx);
      setNearbyStopIdx(closestNearbyIdx);
    },
    [waypoints]
  );

  // Dwell timer — increments every second when inside dwell zone
  useEffect(() => {
    if (!walkModeActive) return;

    dwellIntervalRef.current = setInterval(() => {
      const idx = nearbyIdxRef.current;
      if (idx === null || checkedInRef.current.has(idx)) return;

      setDwellSeconds((prev) => {
        const next = new Map(prev);
        const current = (next.get(idx) || 0) + 1;
        next.set(idx, current);
        if (current >= AUTO_CHECKIN_SECONDS) {
          // Trigger auto check-in
          setTimeout(() => doCheckIn(idx), 0);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (dwellIntervalRef.current) clearInterval(dwellIntervalRef.current);
    };
  }, [walkModeActive, doCheckIn]);

  const startWalk = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("location access is not available in your browser");
      return;
    }
    setWalkModeActive(true);
    setGeoError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("location access denied — enable in browser settings to use live walk mode");
        } else {
          setGeoError("could not get your location — please check your GPS signal");
        }
        setWalkModeActive(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );
  }, [handlePosition]);

  const stopWalk = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWalkModeActive(false);
    setUserPosition(null);
    setProximityStopIdx(null);
    setNearbyStopIdx(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (dwellIntervalRef.current) {
        clearInterval(dwellIntervalRef.current);
      }
    };
  }, []);

  // Compute current stop index (next unchecked)
  const currentStopIdx = (() => {
    for (let i = 0; i < waypoints.length; i++) {
      if (!checkedInStops.has(i)) return i;
    }
    return waypoints.length; // all done
  })();

  // Remaining time estimate: sum duration_mins for unchecked stops + walk between them
  const remainingMinutes = (() => {
    let mins = 0;
    waypoints.forEach((wp, idx) => {
      if (!checkedInStops.has(idx)) {
        // Include both dwell time AND walking time to the next stop
        mins += (wp.duration_mins || 15) + (wp.walk_to_next_mins || 0);
      }
    });
    return mins;
  })();

  // Stops that have no GPS coordinates — warn user they can't auto-glow
  const stopsWithoutCoords = waypoints
    .filter((wp) => !wp.lat || !wp.lng)
    .map((wp) => wp.order);

  return {
    walkModeActive,
    userPosition,
    proximityStopIdx,
    nearbyStopIdx,
    checkedInStops,
    dwellSeconds,
    currentStopIdx,
    remainingMinutes,
    startWalk,
    stopWalk,
    manualCheckIn,
    geoError,
    stopsWithoutCoords,
  };
}
