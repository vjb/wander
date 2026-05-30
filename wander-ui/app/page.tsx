"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  MapPin,
  Clock,
  Coffee,
  Leaf,
  Zap,
  ArrowRight,
  RotateCcw,
  Lightbulb,
  Navigation,
  Timer,
  ExternalLink,
  Footprints,
  LocateFixed,
  Loader2,
  Share,
  Calendar,
} from "lucide-react";

import { MapPreview } from "./components/MapPreview";

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen = "input" | "loading" | "route";
type VibeId = "Caffeinated & Cultured" | "Green & Scenic" | "Spontaneous & Social" | "Mental Break";

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
}

interface WanderV3Response {
  routes: WanderRouteOptionV3[];
  weather_context?: string | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const VIBES: {
  id: VibeId;
  emoji: string;
  label: string;
  sub: string;
  activeBorder: string;
  activeBg: string;
  activeGlow: string;
  activeText: string;
}[] = [
  {
    id: "Caffeinated & Cultured",
    emoji: "☕",
    label: "Caffeinated & Cultured",
    sub: "Coffee · Galleries · Jazz",
    activeBorder: "border-[#e5d3b3]/40",
    activeBg: "bg-[#e5d3b3]/8",
    activeGlow: "shadow-[0_0_24px_rgba(229,211,179,0.15)]",
    activeText: "text-[#e5d3b3]",
  },
  {
    id: "Green & Scenic",
    emoji: "🌿",
    label: "Green & Scenic",
    sub: "Parks · Water · Architecture",
    activeBorder: "border-[#8ba88e]/50",
    activeBg: "bg-[#8ba88e]/8",
    activeGlow: "shadow-[0_0_24px_rgba(139,168,142,0.2)]",
    activeText: "text-[#8ba88e]",
  },
  {
    id: "Spontaneous & Social",
    emoji: "⚡",
    label: "Spontaneous & Social",
    sub: "Street Food · Rooftops · Music",
    activeBorder: "border-purple-400/40",
    activeBg: "bg-purple-400/8",
    activeGlow: "shadow-[0_0_24px_rgba(180,160,210,0.18)]",
    activeText: "text-purple-300",
  },
  {
    id: "Mental Break",
    emoji: "⏱️",
    label: "Mental Break",
    sub: "Coffee · Short loops · Fresh air",
    activeBorder: "border-sky-400/40",
    activeBg: "bg-sky-400/8",
    activeGlow: "shadow-[0_0_24px_rgba(125,211,252,0.18)]",
    activeText: "text-sky-300",
  },
];

const LOADING_MESSAGES = [
  "reading the streets…",
  "curating three paths…",
  "consulting the locals…",
  "perfecting the timing…",
  "uncovering hidden gems…",
  "almost ready to wander…",
];

// ── Motion Variants ───────────────────────────────────────────────────────────

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] } },
};

// ── Background ────────────────────────────────────────────────────────────────

function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute -top-48 -left-48 w-[600px] h-[600px] rounded-full bg-[#8ba88e]/6 blur-[130px]" />
      <div className="absolute -bottom-64 -right-32 w-[700px] h-[700px] rounded-full bg-[#e5d3b3]/4 blur-[150px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#8ba88e]/3 blur-[100px]" />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #f4f4f5 1px, transparent 0)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

// ── Input Screen ──────────────────────────────────────────────────────────────

function InputScreen({
  start, setStart, end, setEnd,
  timeBudget, setTimeBudget,
  vibe, setVibe,
  onWander, error,
  handleLocate, isLocating,
  customVibe, setCustomVibe,
  deferredPrompt,
}: {
  start: string; setStart: (v: string) => void;
  end: string; setEnd: (v: string) => void;
  timeBudget: number; setTimeBudget: (v: number) => void;
  vibe: VibeId | ""; setVibe: (v: VibeId | "") => void;
  onWander: () => void;
  error: string | null;
  handleLocate: () => void;
  isLocating: boolean;
  customVibe: string; setCustomVibe: (v: string) => void;
  deferredPrompt: any;
}) {
  const canWander = start.trim().length > 0 && end.trim().length > 0 && (vibe !== "" || customVibe.trim().length > 0);

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  return (
    <motion.div
      key="input"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="min-h-screen flex flex-col items-center justify-center px-5 py-20"
    >
      {/* Hero */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.6 }}
        className="text-center mb-14"
      >
        <div className="flex items-center justify-center gap-2.5 mb-5 flex-wrap">
          <Navigation className="w-4 h-4 text-[#8ba88e]" strokeWidth={1.5} />
          <span className="text-[11px] font-medium tracking-[0.35em] uppercase text-[#8ba88e]/70" style={{ fontFamily: "var(--font-inter)" }}>
            wander
          </span>
          {deferredPrompt && (
            <button
              onClick={async () => {
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
              }}
              className="ml-2 px-2.5 py-0.5 rounded-full bg-[#8ba88e]/15 border border-[#8ba88e]/30 text-[#8ba88e] text-[10px] font-semibold tracking-wide uppercase hover:bg-[#8ba88e]/25 transition-all duration-200"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              install app
            </button>
          )}
        </div>
        <h1 className="text-[2.8rem] md:text-[4.5rem] leading-[1.05] font-semibold text-[#f4f4f5] mb-5" style={{ fontFamily: "var(--font-playfair)" }}>
          any city has<br />
          <em className="text-[#8ba88e]">secrets</em> to share.
        </h1>
        <p className="text-[#f4f4f5]/35 text-base font-light tracking-wide max-w-sm mx-auto" style={{ fontFamily: "var(--font-inter)" }}>
          tell us where you&apos;re starting, where you need to end up, and how you feel today.
          we&apos;ll generate three distinct routes to wander them.
        </p>
      </motion.header>

      {/* Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6 }}
        className="w-full max-w-[480px]"
      >
        <div className="glass rounded-3xl p-7 shadow-2xl">
          {/* Locations */}
          <div className="mb-7 space-y-1">
            <div className="flex items-center gap-3.5 py-3.5 px-1 border-b border-[#f4f4f5]/6 focus-within:border-[#8ba88e]/40 transition-colors duration-300">
              <MapPin className="w-4 h-4 text-[#8ba88e] shrink-0" strokeWidth={1.5} />
              <input
                id="start-location"
                type="text"
                placeholder="Starting from…"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="flex-1 bg-transparent text-[#f4f4f5] placeholder-[#f4f4f5]/20 text-[15px] font-light tracking-wide focus:outline-none min-w-0"
                style={{ fontFamily: "var(--font-inter)" }}
              />
              <button 
                onClick={handleLocate}
                className="p-1.5 shrink-0 rounded-md bg-[#8ba88e]/5 hover:bg-[#8ba88e]/15 text-[#8ba88e] transition-colors"
                title="Use my current location"
                disabled={isLocating}
              >
                {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
            <div className="flex items-center pl-[7px] py-1 gap-3.5 relative">
              <div className="w-2 h-2 rounded-full border border-[#f4f4f5]/15 shrink-0" />
              <div className="h-px flex-1 border-t border-dashed border-[#f4f4f5]/6" />
              <button
                type="button"
                onClick={() => setEnd(start)}
                className="absolute right-1 p-1.5 hover:bg-[#8ba88e]/10 text-xs rounded-full border border-[#f4f4f5]/10 bg-[#131316] text-[#8ba88e] transition-colors flex items-center justify-center"
                title="Round trip (loop back to start)"
              >
                🔁
              </button>
            </div>
            <div className="flex items-center gap-3.5 py-3.5 px-1 border-b border-transparent focus-within:border-[#e5d3b3]/40 transition-colors duration-300">
              <MapPin className="w-4 h-4 text-[#e5d3b3] shrink-0" strokeWidth={1.5} />
              <input
                id="end-location"
                type="text"
                placeholder="Ending up at…"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="flex-1 bg-transparent text-[#f4f4f5] placeholder-[#f4f4f5]/20 text-[15px] font-light tracking-wide focus:outline-none"
                style={{ fontFamily: "var(--font-inter)" }}
              />
            </div>
          </div>

          {/* Time Budget */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <label htmlFor="time-budget" className="flex items-center gap-2 text-[#f4f4f5]/40 text-[12px] font-medium tracking-widest uppercase" style={{ fontFamily: "var(--font-inter)" }}>
                <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                time to wander
              </label>
              <span className="text-[#e5d3b3] text-sm font-medium" style={{ fontFamily: "var(--font-inter)" }}>
                {formatTime(timeBudget)}
              </span>
            </div>
            <input
              id="time-budget"
              type="range"
              min={30}
              max={240}
              step={15}
              value={timeBudget}
              onChange={(e) => setTimeBudget(Number(e.target.value))}
            />
            <div className="flex justify-between text-[#f4f4f5]/20 text-[11px] mt-2.5 font-light" style={{ fontFamily: "var(--font-inter)" }}>
              <span>30 min</span><span>2 hours</span><span>4 hours</span>
            </div>
          </div>

          {/* Vibe Selector */}
          <div className="mb-8">
            <p className="text-[#f4f4f5]/40 text-[12px] font-medium tracking-widest uppercase mb-4" style={{ fontFamily: "var(--font-inter)" }}>
              your vibe
            </p>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {VIBES.map((v) => {
                const isSelected = vibe === v.id;
                return (
                  <motion.button
                    key={v.id}
                    id={`vibe-${v.id.toLowerCase().replace(/[\s&]+/g, "-")}`}
                    onClick={() => {
                      setVibe(v.id);
                      setCustomVibe("");
                    }}
                    whileHover={{ scale: 1.025 }}
                    whileTap={{ scale: 0.975 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={`relative p-3.5 rounded-2xl border text-left transition-all duration-300 ${
                      isSelected
                        ? `${v.activeBg} ${v.activeBorder} ${v.activeGlow}`
                        : "bg-[#f4f4f5]/3 border-[#f4f4f5]/6 hover:bg-[#f4f4f5]/5 hover:border-[#f4f4f5]/10"
                    }`}
                  >
                    <span className="text-lg block mb-2">{v.emoji}</span>
                    <p className={`text-[11px] font-semibold leading-tight mb-1 tracking-wide ${isSelected ? v.activeText : "text-[#f4f4f5]/60"}`} style={{ fontFamily: "var(--font-inter)" }}>
                      {v.label}
                    </p>
                    <p className="text-[#f4f4f5]/25 text-[10px] font-light leading-tight" style={{ fontFamily: "var(--font-inter)" }}>
                      {v.sub}
                    </p>
                  </motion.button>
                );
              })}
            </div>

            {/* Custom Vibe Text Box */}
            <div className="relative">
              <textarea
                id="custom-vibe"
                placeholder="or, describe your own vibe... e.g. 'spicy noodles, vintage clothes, and a quiet place to read'"
                value={customVibe}
                onChange={(e) => {
                  setCustomVibe(e.target.value);
                  setVibe("");
                }}
                className={`w-full p-4 rounded-2xl border bg-[#f4f4f5]/3 placeholder-[#f4f4f5]/20 text-[13px] font-light tracking-wide focus:outline-none min-h-[72px] resize-none transition-all duration-300 ${
                  customVibe.trim()
                    ? "border-[#8ba88e]/40 bg-[#8ba88e]/5 shadow-[0_0_24px_rgba(139,168,142,0.1)]"
                    : "border-[#f4f4f5]/6 hover:border-[#f4f4f5]/10 focus:border-[#8ba88e]/40 focus:bg-[#8ba88e]/2"
                }`}
                style={{ fontFamily: "var(--font-inter)" }}
              />
            </div>
          </div>

          {/* CTA */}
          <motion.button
            id="wander-button"
            onClick={onWander}
            disabled={!canWander}
            whileHover={canWander ? { scale: 1.015 } : {}}
            whileTap={canWander ? { scale: 0.985 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`w-full py-4 rounded-2xl font-medium text-[15px] tracking-wide flex items-center justify-center gap-3 transition-all duration-300 ${
              canWander
                ? "bg-[#8ba88e] text-[#131316] hover:bg-[#97b59a] shadow-[0_0_32px_rgba(139,168,142,0.25)]"
                : "bg-[#f4f4f5]/5 text-[#f4f4f5]/20 cursor-not-allowed"
            }`}
            style={{ fontFamily: "var(--font-inter)" }}
          >
            {canWander ? (
              <>
                <span>
                  {start.trim() === end.trim() && start.trim() !== ""
                    ? "generate three round-trip loops"
                    : "generate three routes"}
                </span>
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </>
            ) : (
              "fill in the details above"
            )}
          </motion.button>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 text-red-400/70 text-[13px] text-center font-light"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Loading Screen ────────────────────────────────────────────────────────────

function LoadingScreen({ message }: { message: string }) {
  return (
    <motion.div
      key="loading"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="min-h-screen flex flex-col items-center justify-center px-5"
    >
      <motion.div className="text-6xl mb-10 animate-drift" aria-hidden>🗺️</motion.div>
      <div className="text-[11px] tracking-[0.35em] uppercase text-[#8ba88e]/50 mb-6 font-medium" style={{ fontFamily: "var(--font-inter)" }}>
        wander
      </div>
      <div className="h-10 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={message}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="text-[22px] text-[#f4f4f5]/70 font-light text-center"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            <em>{message}</em>
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2 mt-10">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#8ba88e]/40"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
          />
        ))}
      </div>
      <p className="mt-8 text-[12px] text-[#f4f4f5]/20 font-light tracking-wide" style={{ fontFamily: "var(--font-inter)" }}>
        GPT-4o is building three distinct paths…
      </p>
    </motion.div>
  );
}

// ── Waypoint Card ─────────────────────────────────────────────────────────────

function WaypointCard({ waypoint }: { waypoint: WaypointV3 }) {
  const [tipOpen, setTipOpen] = useState(false);

  return (
    <motion.div variants={cardVariants}>
      <div className="glass-lighter rounded-2xl overflow-hidden relative">

        {/* ── Photo Banner ── */}
        {waypoint.photo_url && (
          <div className="relative w-full h-40 overflow-hidden">
            <img
              src={waypoint.photo_url}
              alt={waypoint.location_name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* gradient fade into card background */}
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(to bottom, transparent 40%, #131316 100%)",
              }}
            />
            {/* vibe tag floated over the photo */}
            <span
              className="absolute top-3 left-3 inline-block px-2.5 py-0.5 rounded-full bg-[#131316]/70 backdrop-blur-sm text-[#8ba88e] text-[10px] font-medium tracking-wider uppercase"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              {waypoint.vibe_tag}
            </span>
            {/* rating floated over the photo */}
            {waypoint.google_rating != null && (
              <span
                className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#131316]/70 backdrop-blur-sm text-[#e5d3b3] text-[11px] font-medium"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                ★ {waypoint.google_rating.toFixed(1)}
              </span>
            )}
          </div>
        )}

        <div className="p-5">
          {/* vibe tag — only shown when no photo (photo shows it above) */}
          {!waypoint.photo_url && (
            <span
              className="inline-block px-2.5 py-0.5 rounded-full bg-[#8ba88e]/10 text-[#8ba88e] text-[10px] font-medium tracking-wider uppercase mb-3"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              {waypoint.vibe_tag}
            </span>
          )}

          <div className="flex items-start justify-between gap-2 mb-1">
            {waypoint.place_id ? (
              <a
                href={`https://www.google.com/maps/place/?q=place_id:${waypoint.place_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#f4f4f5] hover:text-[#8ba88e] transition-colors text-xl font-semibold leading-tight flex items-center gap-2 group"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                {waypoint.location_name}
                <ExternalLink className="w-4 h-4 shrink-0 text-[#f4f4f5]/30 group-hover:text-[#8ba88e] transition-colors" strokeWidth={1.5} />
              </a>
            ) : (
              <h3
                className="text-[#f4f4f5] text-xl font-semibold leading-tight"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                {waypoint.location_name}
              </h3>
            )}
            {/* rating badge — only shown when no photo (photo shows it above) */}
            {!waypoint.photo_url && waypoint.google_rating != null && (
              <span
                className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e5d3b3]/8 border border-[#e5d3b3]/15 text-[#e5d3b3]/70 text-[11px] font-medium mt-1"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                ★ {waypoint.google_rating.toFixed(1)}
              </span>
            )}
          </div>
          <p
            className="text-[#f4f4f5]/30 text-[12px] font-light mb-4 flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.5} />
            {waypoint.address_hint}
          </p>
          <p
            className="text-[#f4f4f5]/65 text-[14px] font-light leading-relaxed mb-4"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            {waypoint.action_description}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-[#e5d3b3]/60 text-[12px] font-light" style={{ fontFamily: "var(--font-inter)" }}>
                <Timer className="w-3.5 h-3.5" strokeWidth={1.5} />
                {waypoint.duration_mins} min
              </div>
              {waypoint.lat && waypoint.lng && (
                 <a
                    href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${waypoint.lat},${waypoint.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[#e5d3b3]/50 hover:text-[#e5d3b3]/80 text-[12px] font-medium transition-colors"
                    style={{ fontFamily: "var(--font-inter)" }}
                 >
                   <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                   Street View
                 </a>
              )}
            </div>
            <button
              id={`tip-toggle-${waypoint.order}`}
              onClick={() => setTipOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[#e5d3b3]/50 hover:text-[#e5d3b3]/80 text-[12px] font-medium transition-colors"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              <Lightbulb className="w-3.5 h-3.5" strokeWidth={1.5} />
              {tipOpen ? "hide tip" : "insider tip"}
            </button>
          </div>
          <AnimatePresence>
            {tipOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="pt-3 border-t border-[#e5d3b3]/8">
                  <p
                    className="text-[#e5d3b3]/60 text-[13px] font-light leading-relaxed italic"
                    style={{ fontFamily: "var(--font-playfair)" }}
                  >
                    &ldquo;{waypoint.insider_tip}&rdquo;
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ── Walk Label (between stops) ────────────────────────────────────────────────

function WalkLabel({ mins, origin, destination }: { mins: number, origin?: {lat: number, lng: number}, destination?: {lat: number, lng: number} }) {
  const directionsUrl = origin && destination
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=walking`
    : null;

  return (
    <motion.div
      variants={cardVariants}
      className="flex items-center gap-2.5 py-2 pl-1"
    >
      <div className="w-px h-4 bg-[#8ba88e]/15 ml-[3px]" />
      <Footprints className="w-3 h-3 text-[#8ba88e]/30" strokeWidth={1.5} />
      {directionsUrl ? (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[#f4f4f5]/40 hover:text-[#8ba88e] text-[11px] font-medium tracking-wide transition-colors"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          ~{mins} min walk
          <ExternalLink className="w-3 h-3 shrink-0" strokeWidth={1.5} />
        </a>
      ) : (
        <span
          className="text-[#f4f4f5]/25 text-[11px] font-light tracking-wide"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          ~{mins} min walk
        </span>
      )}
    </motion.div>
  );
}

// ── Route Screen ──────────────────────────────────────────────────────────────

// ── Route Screen ──────────────────────────────────────────────────────────────

export function RouteScreen({
  data,
  vibe,
  onReset,
  isSharedView = false,
  weatherContext,
}: {
  data: WanderV3Response;
  vibe: VibeId | "";
  onReset: () => void;
  isSharedView?: boolean;
  weatherContext?: string | null;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeRoute = data.routes[selectedIndex];
  
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleShare = async () => {
    if (!activeRoute) return;
    setIsSharing(true);
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route: activeRoute,
          vibe: vibe || "custom"
        })
      });
      if (res.ok) {
        const data = await res.json();
        const url = `${window.location.origin}/r/${data.id}`;
        setShareUrl(url);
        await navigator.clipboard.writeText(url);
        setTimeout(() => setShareUrl(null), 3000);
      }
    } catch (e) {
      console.error("Error sharing route", e);
    } finally {
      setIsSharing(false);
    }
  };

  const handleAddToCalendar = (route: WanderRouteOptionV3) => {
    if (!route) return;

    const eventStart = new Date();
    const eventEnd = new Date(eventStart.getTime() + route.total_walking_time_mins * 60 * 1000);

    const formatIcsDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const dtStart = formatIcsDate(eventStart);
    const dtEnd = formatIcsDate(eventEnd);
    const dtStamp = formatIcsDate(new Date());

    const descriptionLines = [
      route.theme_summary,
      "",
      "Waypoints:",
      ...route.waypoints.map(
        (wp, idx) => `${idx + 1}. ${wp.location_name} - ${wp.address_hint} (${wp.duration_mins} mins)`
      )
    ];

    const cleanIcsValue = (str: string) => {
      return str
        .replace(/\\/g, "\\\\")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;")
        .replace(/\n/g, "\\n");
    };

    const cleanedLines = descriptionLines.map(line => cleanIcsValue(line));
    const descriptionField = cleanedLines.join("\\n");

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Wander App//Wander Route//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${Date.now()}@wander.app`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${cleanIcsValue(route.route_name)}`,
      `DESCRIPTION:${descriptionField}`,
      `LOCATION:${cleanIcsValue(route.start_location || "")}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${route.route_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
  };

  const isGenerating = !activeRoute;
  const routeName = activeRoute ? activeRoute.route_name : `curating route ${selectedIndex + 1}...`;
  const themeSummary = activeRoute ? activeRoute.theme_summary : "gpt-4o is writing the perfect path for you.";

  // Use dynamic weather context if passed, otherwise fall back to response
  const activeWeather = weatherContext || data.weather_context;

  return (
    <motion.div
      key="route"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="min-h-screen px-5 pt-14 pb-36 flex flex-col items-center"
    >
      <div className="w-full max-w-[520px]">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-6">
            <Navigation className="w-3.5 h-3.5 text-[#8ba88e]/50" strokeWidth={1.5} />
            <span className="text-[11px] tracking-[0.35em] uppercase text-[#8ba88e]/50 font-medium" style={{ fontFamily: "var(--font-inter)" }}>
              {isSharedView ? "shared wander route" : "three routes found"}
            </span>
          </div>
          <h1
            className="text-[2.2rem] md:text-[2.8rem] font-semibold leading-[1.1] text-[#f4f4f5] mb-3"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            <em>{routeName}</em>
          </h1>
          <p
            className="text-[#f4f4f5]/40 text-[14px] font-light leading-relaxed italic max-w-sm mx-auto"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            {themeSummary}
          </p>
        </motion.header>

        {/* ── Route Carousel Tabs ── */}
        {!isSharedView && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="relative flex gap-2 mb-3 p-1 rounded-2xl bg-[#f4f4f5]/3 border border-[#f4f4f5]/6"
          >
            {[0, 1, 2].map((i) => {
              const route = data.routes[i];
              const tabTitle = route ? route.route_name : `route ${i + 1} (generating...)`;
              const isSelected = selectedIndex === i;
              return (
                <button
                  key={i}
                  id={`route-tab-${i}`}
                  onClick={() => setSelectedIndex(i)}
                  className="relative flex-1 px-2 py-2.5 rounded-xl text-center transition-colors duration-200 z-10"
                >
                  {isSelected && (
                    <motion.div
                      layoutId="active-route-tab"
                      className="absolute inset-0 bg-[#8ba88e]/15 border border-[#8ba88e]/30 rounded-xl"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span
                    className={`relative z-10 text-[11px] font-semibold leading-tight block tracking-wide transition-colors truncate max-w-full ${
                      selectedIndex === i ? "text-[#8ba88e]" : "text-[#f4f4f5]/35 hover:text-[#f4f4f5]/65"
                    }`}
                    style={{ fontFamily: "var(--font-inter)" }}
                    title={tabTitle}
                  >
                    {tabTitle}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}

        {/* Metadata pills */}
        {!isGenerating && activeRoute && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex items-center justify-center gap-2.5 flex-wrap mb-10"
          >
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#8ba88e]/10 text-[#8ba88e] text-[11px] font-medium border border-[#8ba88e]/20"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              <Clock className="w-3 h-3" strokeWidth={1.5} />
              {formatTime(activeRoute.total_walking_time_mins)}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e5d3b3]/8 text-[#e5d3b3]/60 text-[11px] font-medium border border-[#e5d3b3]/12"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              {activeRoute.waypoints.length} stops
            </span>
            {vibe && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4f4f5]/5 text-[#f4f4f5]/30 text-[11px] font-medium border border-[#f4f4f5]/8"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                {vibe}
              </span>
            )}
            {activeWeather && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#8ba88e]/10 text-[#8ba88e] text-[11px] font-medium border border-[#8ba88e]/20 shadow-[0_0_12px_rgba(139,168,142,0.1)]"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                {activeWeather.includes("Rain") || activeWeather.includes("Drizzle") ? "🌧️" : 
                 activeWeather.includes("Cloud") ? "☁️" : 
                 activeWeather.includes("Clear") ? "☀️" : "🌦️"} {activeWeather.toLowerCase()}
              </span>
            )}
          </motion.div>
        )}

        {/* ── Timeline (re-animates on tab change) ── */}
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="generating-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 text-[#f4f4f5]/30 italic font-light"
            >
              <Loader2 className="w-8 h-8 animate-spin text-[#8ba88e] mb-4" strokeWidth={1.5} />
              <p style={{ fontFamily: "var(--font-playfair)" }}>reading the streets for route {selectedIndex + 1}...</p>
            </motion.div>
          ) : (
            <motion.div
              key={selectedIndex}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="mb-10"
            >
              {/* Start Location Indicator */}
              <motion.div variants={cardVariants} className="flex items-center gap-3.5 mb-5">
                <div className="w-7 h-7 rounded-full bg-[#131316] border border-[#8ba88e]/30 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#8ba88e]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#8ba88e]/50 text-[10px] font-semibold tracking-wider uppercase leading-none mb-1" style={{ fontFamily: "var(--font-inter)" }}>
                    start
                  </p>
                  <a
                    href={activeRoute.start_lat != null && activeRoute.start_lng != null
                      ? `https://www.google.com/maps/search/?api=1&query=${activeRoute.start_lat},${activeRoute.start_lng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeRoute.start_location || "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#f4f4f5]/60 hover:text-[#8ba88e] transition-colors text-[13px] font-light truncate group max-w-full"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    <span className="truncate">{activeRoute.start_location || "Starting Location"}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 text-[#f4f4f5]/20 group-hover:text-[#8ba88e] transition-colors" strokeWidth={1.5} />
                  </a>
                </div>
              </motion.div>

              {/* Initial Walk from Start Location */}
              {activeRoute.initial_walk_mins > 0 && (
                <div className="ml-10 mb-2">
                  <WalkLabel
                    mins={activeRoute.initial_walk_mins}
                    origin={(activeRoute.start_lat != null && activeRoute.start_lng != null) ? { lat: activeRoute.start_lat as number, lng: activeRoute.start_lng as number } : undefined}
                    destination={(activeRoute.waypoints[0]?.lat != null && activeRoute.waypoints[0]?.lng != null) ? { lat: activeRoute.waypoints[0].lat as number, lng: activeRoute.waypoints[0].lng as number } : undefined}
                  />
                </div>
              )}

              {activeRoute.waypoints.map((wp, i) => (
                <div key={`${selectedIndex}-${wp.order}`}>
                  {/* Stop number indicator */}
                  <motion.div variants={cardVariants} className="flex items-center gap-3 mb-3">
                    <div className="w-7 h-7 rounded-full bg-[#8ba88e]/12 border border-[#8ba88e]/25 flex items-center justify-center text-[#8ba88e] text-xs font-semibold shrink-0" style={{ fontFamily: "var(--font-inter)" }}>
                      {wp.order}
                    </div>
                    <div className="h-px flex-1 bg-[#8ba88e]/8" />
                  </motion.div>

                  {/* Waypoint card */}
                  <div className="ml-10 mb-2">
                    <WaypointCard waypoint={wp} />
                  </div>

                  {/* Walk label to next stop */}
                  {wp.walk_to_next_mins > 0 && (
                    <div className="ml-10">
                      <WalkLabel 
                        mins={wp.walk_to_next_mins}
                        origin={(wp.lat != null && wp.lng != null) ? { lat: wp.lat as number, lng: wp.lng as number } : undefined}
                        destination={
                          i < activeRoute.waypoints.length - 1
                            ? ((activeRoute.waypoints[i+1].lat != null && activeRoute.waypoints[i+1].lng != null) ? { lat: activeRoute.waypoints[i+1].lat as number, lng: activeRoute.waypoints[i+1].lng as number } : undefined)
                            : ((activeRoute.end_lat != null && activeRoute.end_lng != null) ? { lat: activeRoute.end_lat as number, lng: activeRoute.end_lng as number } : undefined)
                        }
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* End marker (Destination) */}
              <motion.div variants={cardVariants} className="flex items-center gap-3.5 mt-7">
                <div className="w-7 h-7 rounded-full bg-[#e5d3b3]/10 border border-[#e5d3b3]/30 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#e5d3b3]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#e5d3b3]/60 text-[10px] font-semibold tracking-wider uppercase leading-none mb-1" style={{ fontFamily: "var(--font-inter)" }}>
                    destination
                  </p>
                  <a
                    href={activeRoute.end_lat != null && activeRoute.end_lng != null
                      ? `https://www.google.com/maps/search/?api=1&query=${activeRoute.end_lat},${activeRoute.end_lng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeRoute.end_location || "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#e5d3b3] hover:text-[#8ba88e] transition-colors text-[13px] font-light truncate group max-w-full"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    <span className="truncate">{activeRoute.end_location || "Destination"}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 text-[#e5d3b3]/40 group-hover:text-[#8ba88e] transition-colors" strokeWidth={1.5} />
                  </a>
                  <p className="text-[#e5d3b3]/35 text-[11px] font-light italic mt-1.5" style={{ fontFamily: "var(--font-playfair)" }}>
                    your destination awaits.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Map Preview ── */}
        {!isGenerating && activeRoute && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mb-10 w-full h-[320px] rounded-2xl overflow-hidden border border-[#f4f4f5]/10 shadow-lg relative bg-[#131316]"
          >
            <MapPreview route={activeRoute} />
          </motion.div>
        )}

        {/* Reset / Share Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="flex justify-center gap-4 flex-wrap"
        >
          <button
            id="wander-again-button"
            onClick={onReset}
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl border border-[#f4f4f5]/10 text-[#f4f4f5]/35 text-[13px] font-medium hover:text-[#f4f4f5]/60 hover:border-[#f4f4f5]/18 hover:bg-[#f4f4f5]/3 transition-all duration-300"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
            {isSharedView ? "create your own wander" : "plan another wander"}
          </button>

          {!isSharedView && !isGenerating && activeRoute && (
            <>
              <button
                id="share-route-button"
                onClick={handleShare}
                disabled={isSharing}
                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-[#8ba88e]/10 border border-[#8ba88e]/20 text-[#8ba88e] text-[13px] font-medium hover:bg-[#8ba88e]/25 transition-all duration-300 disabled:opacity-50"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                {isSharing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Share className="w-3.5 h-3.5" />
                )}
                {shareUrl ? "link copied!" : "share this route"}
              </button>

              <button
                id="add-to-calendar-button"
                onClick={() => handleAddToCalendar(activeRoute)}
                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-[#e5d3b3]/10 border border-[#e5d3b3]/20 text-[#e5d3b3] text-[13px] font-medium hover:bg-[#e5d3b3]/25 transition-all duration-300"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                <Calendar className="w-3.5 h-3.5" />
                Add to Calendar
              </button>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Sticky Start Wandering Button ── */}
      {!isGenerating && activeRoute && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed bottom-0 left-0 right-0 z-50 px-5 pb-6 pt-4"
          style={{
            background: "linear-gradient(to top, #131316 60%, transparent)",
          }}
        >
          <div className="max-w-[520px] mx-auto">
            <motion.button
              id="start-wandering-button"
              onClick={() => window.open(activeRoute.navigation_deep_link, "_blank")}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="w-full py-4 rounded-2xl bg-[#8ba88e] text-[#131316] font-semibold text-[15px] tracking-wide flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(139,168,142,0.3)] hover:bg-[#97b59a] transition-colors duration-200"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              <Navigation className="w-4 h-4" strokeWidth={2} />
              start wandering
              <ExternalLink className="w-3.5 h-3.5 opacity-60" strokeWidth={2} />
            </motion.button>
            <p className="text-center text-[#f4f4f5]/20 text-[11px] mt-2 font-light" style={{ fontFamily: "var(--font-inter)" }}>
              opens walking directions in google maps
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [screen, setScreen] = useState<Screen>("input");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [timeBudget, setTimeBudget] = useState(90);
  const [vibe, setVibe] = useState<VibeId | "">("");
  const [customVibe, setCustomVibe] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [routeData, setRouteData] = useState<WanderV3Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [weatherContext, setWeatherContext] = useState<string | null>(null);

  useEffect(() => {
    // 1. Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then((reg) => console.log("SW registered:", reg.scope))
        .catch((err) => console.error("SW registration failed:", err));
    }
    
    // 2. Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (screen !== "loading") return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 2000);
    return () => clearInterval(interval);
  }, [screen]);

  const handleWander = useCallback(async () => {
    const selectedVibe = vibe || customVibe;
    if (!start.trim() || !end.trim() || !selectedVibe) return;
    setScreen("loading");
    setError(null);
    setWeatherContext(null);
    setRouteData({ routes: [] });

    try {
      // Formulate local time context (e.g. "Saturday, 09:30 PM")
      const localTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const localDay = new Date().toLocaleDateString([], { weekday: 'long' });
      const timeContext = `${localDay}, ${localTime}`;

      const res = await fetch("/api/generate-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_location: start,
          end_location: end,
          time_budget_minutes: timeBudget,
          vibe: selectedVibe,
          local_time: timeContext
        }),
      });

      if (!res.ok) {
        throw new Error("Route generation failed");
      }

      if (!res.body) {
        throw new Error("No response body to stream");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentRoutes: WanderRouteOptionV3[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          let data;
          try {
            data = JSON.parse(trimmed.slice(6));
          } catch (e) {
            console.error("Stream parse error parsing JSON:", e);
            continue;
          }

          if (data.type === "status") {
            setLoadingMsg(data.message);
          } else if (data.type === "weather") {
            setWeatherContext(data.weather_context);
          } else if (data.type === "route") {
            // Add/update routes in list
            currentRoutes = [...currentRoutes];
            currentRoutes[data.index] = data.route;
            setRouteData({ routes: currentRoutes });

            // Switch screen to route view immediately when Route 1 is ready!
            if (data.index === 0) {
              setScreen("route");
            }
          } else if (data.type === "error") {
            throw new Error(data.detail || "Server error curating routes");
          }
        }
      }

      if (currentRoutes.length === 0) {
        throw new Error("Could not curate any routes. Try a different query.");
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setScreen("input");
    }
  }, [start, end, timeBudget, vibe, customVibe]);

  const handleReset = useCallback(() => {
    setRouteData(null);
    setError(null);
    setScreen("input");
  }, []);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`http://127.0.0.1:8000/api/reverse-geocode?lat=${position.coords.latitude}&lng=${position.coords.longitude}`);
          const data = await res.json();
          if (data.address) {
            setStart(data.address);
          }
        } catch (e) {
          console.error("Geocoding failed", e);
        }
        setIsLocating(false);
      },
      (error) => {
        console.error(error);
        setIsLocating(false);
      }
    );
  }, []);

  return (
    <main className="min-h-screen bg-[#131316] text-[#f4f4f5] relative overflow-x-hidden">
      <BackgroundOrbs />
      <AnimatePresence mode="wait">
        {screen === "input" && (
          <InputScreen
            key="input"
            start={start} setStart={setStart}
            end={end} setEnd={setEnd}
            timeBudget={timeBudget} setTimeBudget={setTimeBudget}
            vibe={vibe} setVibe={setVibe}
            onWander={handleWander}
            error={error}
            handleLocate={handleLocate}
            isLocating={isLocating}
            customVibe={customVibe}
            setCustomVibe={setCustomVibe}
            deferredPrompt={deferredPrompt}
          />
        )}
        {screen === "loading" && (
          <LoadingScreen key="loading" message={loadingMsg} />
        )}
        {screen === "route" && routeData && (
          <RouteScreen
            key="route"
            data={routeData}
            vibe={vibe}
            onReset={handleReset}
            weatherContext={weatherContext}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
