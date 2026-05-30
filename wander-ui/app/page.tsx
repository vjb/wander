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
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen = "input" | "loading" | "route";
type VibeId = "Caffeinated & Cultured" | "Green & Scenic" | "Spontaneous & Social";

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
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
  waypoints: WaypointV3[];
  navigation_deep_link: string;
}

interface WanderV3Response {
  routes: WanderRouteOptionV3[];
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
];

const LOADING_MESSAGES = [
  "Reading the streets\u2026",
  "Curating three paths\u2026",
  "Consulting the locals\u2026",
  "Perfecting the timing\u2026",
  "Uncovering hidden gems\u2026",
  "Almost ready to wander\u2026",
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
}: {
  start: string; setStart: (v: string) => void;
  end: string; setEnd: (v: string) => void;
  timeBudget: number; setTimeBudget: (v: number) => void;
  vibe: VibeId | ""; setVibe: (v: VibeId) => void;
  onWander: () => void;
  error: string | null;
}) {
  const canWander = start.trim().length > 0 && end.trim().length > 0 && vibe !== "";

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
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <Navigation className="w-4 h-4 text-[#8ba88e]" strokeWidth={1.5} />
          <span className="text-[11px] font-medium tracking-[0.35em] uppercase text-[#8ba88e]/70" style={{ fontFamily: "var(--font-inter)" }}>
            Wander
          </span>
        </div>
        <h1 className="text-[2.8rem] md:text-[4.5rem] leading-[1.05] font-semibold text-[#f4f4f5] mb-5" style={{ fontFamily: "var(--font-playfair)" }}>
          Your city has<br />
          <em className="text-[#8ba88e]">secrets</em> to share.
        </h1>
        <p className="text-[#f4f4f5]/35 text-base font-light tracking-wide max-w-sm mx-auto" style={{ fontFamily: "var(--font-inter)" }}>
          Tell us where you&apos;re starting, where you need to end up, and how you feel today.
          We&apos;ll generate three distinct routes.
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
            <div className="flex items-center gap-3.5 py-3.5 px-1 border-b border-[#f4f4f5]/6">
              <MapPin className="w-4 h-4 text-[#8ba88e] shrink-0" strokeWidth={1.5} />
              <input
                id="start-location"
                type="text"
                placeholder="Starting from…"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="flex-1 bg-transparent text-[#f4f4f5] placeholder-[#f4f4f5]/20 text-[15px] font-light tracking-wide focus:outline-none"
                style={{ fontFamily: "var(--font-inter)" }}
              />
            </div>
            <div className="flex items-center pl-[7px] py-1 gap-3.5">
              <div className="w-2 h-2 rounded-full border border-[#f4f4f5]/15 shrink-0" />
              <div className="h-px flex-1 border-t border-dashed border-[#f4f4f5]/6" />
            </div>
            <div className="flex items-center gap-3.5 py-3.5 px-1">
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
                Time to wander
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
              Your vibe
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {VIBES.map((v) => {
                const isSelected = vibe === v.id;
                return (
                  <motion.button
                    key={v.id}
                    id={`vibe-${v.id.toLowerCase().replace(/[\s&]+/g, "-")}`}
                    onClick={() => setVibe(v.id)}
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
              <><span>Generate three routes</span><ArrowRight className="w-4 h-4" strokeWidth={2} /></>
            ) : (
              "Fill in the details above"
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
        Wander
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
                background: "linear-gradient(to bottom, transparent 40%, #1E1E24 100%)",
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
              {tipOpen ? "Hide tip" : "Insider tip"}
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

function RouteScreen({
  data,
  vibe,
  onReset,
}: {
  data: WanderV3Response;
  vibe: VibeId | "";
  onReset: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeRoute = data.routes[selectedIndex];

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
  };

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
              Three routes found
            </span>
          </div>
          <h1
            className="text-[2.2rem] md:text-[2.8rem] font-semibold leading-[1.1] text-[#f4f4f5] mb-3"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            <em>{activeRoute.route_name}</em>
          </h1>
          <p
            className="text-[#f4f4f5]/40 text-[14px] font-light leading-relaxed italic max-w-sm mx-auto"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            {activeRoute.theme_summary}
          </p>
        </motion.header>

        {/* ── Route Carousel Tabs ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="relative flex gap-2 mb-3 p-1 rounded-2xl bg-[#f4f4f5]/3 border border-[#f4f4f5]/6"
        >
          {data.routes.map((route, i) => (
            <button
              key={i}
              id={`route-tab-${i}`}
              onClick={() => setSelectedIndex(i)}
              className="relative flex-1 px-2 py-2.5 rounded-xl text-center transition-colors duration-200 z-10"
            >
              {selectedIndex === i && (
                <motion.div
                  layoutId="active-route-tab"
                  className="absolute inset-0 bg-[#8ba88e]/15 border border-[#8ba88e]/30 rounded-xl"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span
                className={`relative z-10 text-[11px] font-semibold leading-tight block tracking-wide ${
                  selectedIndex === i ? "text-[#8ba88e]" : "text-[#f4f4f5]/35"
                }`}
                style={{ fontFamily: "var(--font-inter)" }}
              >
                {route.route_name}
              </span>
            </button>
          ))}
        </motion.div>

        {/* Metadata pills */}
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
        </motion.div>

        {/* ── Timeline (re-animates on tab change) ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedIndex}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="mb-10"
          >
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

            {/* End marker */}
            <motion.div variants={cardVariants} className="flex items-center gap-3 mt-6">
              <div className="w-7 h-7 flex items-center justify-center shrink-0">
                <div className="w-3 h-3 rounded-full border-2 border-[#e5d3b3]/30 bg-[#e5d3b3]/8" />
              </div>
              <p className="text-[#e5d3b3]/35 text-[13px] font-light italic" style={{ fontFamily: "var(--font-playfair)" }}>
                Your destination awaits.
              </p>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Reset */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="flex justify-center"
        >
          <button
            id="wander-again-button"
            onClick={onReset}
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl border border-[#f4f4f5]/10 text-[#f4f4f5]/35 text-[13px] font-medium hover:text-[#f4f4f5]/60 hover:border-[#f4f4f5]/18 hover:bg-[#f4f4f5]/3 transition-all duration-300"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
            Plan another wander
          </button>
        </motion.div>
      </div>

      {/* ── Sticky Start Wandering Button ── */}
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
            Start Wandering
            <ExternalLink className="w-3.5 h-3.5 opacity-60" strokeWidth={2} />
          </motion.button>
          <p className="text-center text-[#f4f4f5]/20 text-[11px] mt-2 font-light" style={{ fontFamily: "var(--font-inter)" }}>
            Opens walking directions in Google Maps
          </p>
        </div>
      </motion.div>
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
  const [routeData, setRouteData] = useState<WanderV3Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);

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
    if (!start.trim() || !end.trim() || !vibe) return;
    setScreen("loading");
    setError(null);

    try {
      const res = await fetch("/api/generate-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_location: start,
          end_location: end,
          time_budget_minutes: timeBudget,
          vibe,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Something went wrong" }));
        throw new Error(err.detail ?? "Route generation failed");
      }

      const data: WanderV3Response = await res.json();
      setRouteData(data);
      setScreen("route");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setScreen("input");
    }
  }, [start, end, timeBudget, vibe]);

  const handleReset = useCallback(() => {
    setRouteData(null);
    setError(null);
    setScreen("input");
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
          />
        )}
        {screen === "loading" && (
          <LoadingScreen key="loading" message={loadingMsg} />
        )}
        {screen === "route" && routeData && (
          <RouteScreen key="route" data={routeData} vibe={vibe} onReset={handleReset} />
        )}
      </AnimatePresence>
    </main>
  );
}
