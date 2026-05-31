"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Sliders,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Radio,
  X,
  Trash2,
  Lock,
  Wand2,
  ChevronDown,
} from "lucide-react";

import { WanderMap } from "./components/WanderMap";
import { RotatingTagline } from "./components/RotatingTagline";
import { useWalkMode } from "./hooks/useWalkMode";
import { usePassport, type PassportEntry } from "./hooks/usePassport";

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen = "input" | "loading" | "route";
type VibeId = "Caffeinated & Cultured" | "Green & Scenic" | "Spontaneous & Social" | "Mental Break" | "Off the Grid" | "Feeling Lucky";

export type { PassportEntry };

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

interface AdvisorResponse {
  detected_neighborhood: string;
  density_level: string;
  recommended_stops: number;
  pacing_message: string;
  feasibility_status: "optimal" | "tight" | "impossible";
  density_badge_message: string;
  weather_advice: string | null;
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
  {
    id: "Off the Grid",
    emoji: "🗺️",
    label: "Off the Grid",
    sub: "Secret garden · Indie bookshops · Hidden gems",
    activeBorder: "border-emerald-500/40",
    activeBg: "bg-emerald-500/8",
    activeGlow: "shadow-[0_0_24px_rgba(16,185,129,0.18)]",
    activeText: "text-emerald-300",
  },
  {
    id: "Feeling Lucky",
    emoji: "🎲",
    label: "Feeling Lucky",
    sub: "Surprise theme · Unexpected routes · Oddities",
    activeBorder: "border-rose-400/40",
    activeBg: "bg-rose-400/8",
    activeGlow: "shadow-[0_0_24px_rgba(251,113,133,0.18)]",
    activeText: "text-rose-300",
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

// ── Confetti Particle System ──────────────────────────────────────────────────

function ConfettiCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#8ba88e", "#e5d3b3", "#d6dfd0", "#c2b280", "#e5e7eb"];
    interface Particle {
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
    }

    const particles: Particle[] = [];
    const particleCount = 120;

    for (let i = 0; i < particleCount; i++) {
      const fromLeft = Math.random() > 0.5;
      particles.push({
        x: fromLeft ? 0 : canvas.width,
        y: canvas.height * 0.8,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: (fromLeft ? 1 : -1) * (Math.random() * 15 + 5),
        speedY: -(Math.random() * 20 + 10),
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 10 - 5
      });
    }

    let frames = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.speedY += 0.4;
        p.speedX *= 0.98;
        p.rotation += p.rotationSpeed;

        if (p.y < canvas.height && p.x > -50 && p.x < canvas.width + 50) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      frames++;
      if (alive && frames < 180) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    animate();

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-50"
    />
  );
}

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
  inputMode, setInputMode,
  stepGoal, setStepGoal,
  vibe, setVibe,
  onWander, error,
  handleLocate, isLocating,
  customVibe, setCustomVibe,
  deferredPrompt,
  numStops, setNumStops,
  freeOnly, setFreeOnly,
  advisorData, advisorLoading, clientFeasibility,
  companion, setCompanion,
  setHasManuallySetStops,
  passportCount,
  onOpenPassport,
  isRoundTrip, setIsRoundTrip,
  comfortMode, setComfortMode,
}: {
  start: string; setStart: (v: string) => void;
  end: string; setEnd: (v: string) => void;
  timeBudget: number; setTimeBudget: (v: number) => void;
  inputMode: "time" | "steps"; setInputMode: (v: "time" | "steps") => void;
  stepGoal: number; setStepGoal: (v: number) => void;
  vibe: VibeId | ""; setVibe: (v: VibeId | "") => void;
  onWander: () => void;
  error: string | null;
  handleLocate: () => void;
  isLocating: boolean;
  customVibe: string; setCustomVibe: (v: string) => void;
  deferredPrompt: any;
  numStops: number; setNumStops: (v: number) => void;
  freeOnly: boolean; setFreeOnly: (v: boolean) => void;
  advisorData: AdvisorResponse | null;
  advisorLoading: boolean;
  clientFeasibility: { status: "impossible" | "tight"; message: string } | null;
  companion: string;
  setCompanion: (v: string) => void;
  setHasManuallySetStops: (v: boolean) => void;
  passportCount: number;
  onOpenPassport: () => void;
  isRoundTrip: boolean;
  setIsRoundTrip: (v: boolean) => void;
  comfortMode: boolean;
  setComfortMode: (v: boolean) => void;
}) {
  const effectiveEnd = isRoundTrip ? start : end;
  const canWander = start.trim().length > 0 && effectiveEnd.trim().length > 0 && (vibe !== "" || customVibe.trim().length > 0);

  const vibePlaceholder = useMemo(() => {
    const base = "or, describe your own vibe... e.g. ";
    if (!advisorData?.weather_advice) {
      return base + "'spicy noodles, vintage clothes, and a quiet place to read'";
    }
    const advice = advisorData.weather_advice.toLowerCase();
    if (advice.includes("rain") || advice.includes("precipitation") || advice.includes("shower") || advice.includes("snow")) {
      return base + "'cozy record cafes, covered book markets, and indie cinema'";
    }
    if (advice.includes("cold") || advice.includes("chill")) {
      return base + "'warm ramen shops, steaming coffee, and museum galleries'";
    }
    if (advice.includes("hot") || advice.includes("warm") || advice.includes("clear") || advice.includes("sun")) {
      return base + "'rooftop bars, park bench reading, and waterfront ice cream'";
    }
    return base + "'local record stores, hidden gardens, and quiet coffee shops'";
  }, [advisorData?.weather_advice]);

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
        className="text-center mb-12"
      >
        <div className="flex items-center justify-center gap-2.5 mb-5 flex-wrap">
          <Navigation className="w-4 h-4 text-[#8ba88e]" strokeWidth={1.5} />
          <span className="text-[11px] font-medium tracking-[0.35em] uppercase text-[#8ba88e]/70" style={{ fontFamily: "var(--font-inter)" }}>
            wander
          </span>
          {passportCount > 0 && (
            <button
              onClick={onOpenPassport}
              className="ml-1 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e5d3b3]/10 border border-[#e5d3b3]/25 text-[#e5d3b3]/70 text-[11px] font-medium tracking-wide hover:bg-[#e5d3b3]/20 hover:text-[#e5d3b3] transition-all duration-200"
              style={{ fontFamily: "var(--font-inter)" }}
              title="Open your neighborhood passport"
            >
              <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
              {passportCount} {passportCount === 1 ? "neighborhood" : "neighborhoods"}
            </button>
          )}
          {/* ── Comfort mode toggle ── */}
          <button
            onClick={() => setComfortMode(!comfortMode)}
            className={`ml-1 flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold tracking-wide transition-all duration-200 ${
              comfortMode
                ? "bg-[#8ba88e]/20 border-[#8ba88e]/50 text-[#8ba88e]"
                : "bg-transparent border-[#f4f4f5]/15 text-[#f4f4f5]/35 hover:text-[#f4f4f5]/60 hover:border-[#f4f4f5]/25"
            }`}
            style={{ fontFamily: "var(--font-inter)" }}
            title={comfortMode ? "Comfort mode on — tap to reduce" : "Larger text & icons"}
          >
            Aa
          </button>
          {deferredPrompt && (
            <button
              onClick={async () => {
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
              }}
              className="ml-2 px-2.5 py-1 rounded-full bg-[#8ba88e]/15 border border-[#8ba88e]/30 text-[#8ba88e] text-[11px] font-semibold tracking-wide uppercase hover:bg-[#8ba88e]/25 transition-all duration-200"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              install app
            </button>
          )}
        </div>
        <RotatingTagline />
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
          <div className="mb-7">
            <div className="flex items-center gap-3.5 py-4 px-1 border-b border-[#f4f4f5]/6 focus-within:border-[#8ba88e]/40 transition-colors duration-300">
              <MapPin className={`${comfortMode ? 'w-5 h-5' : 'w-4 h-4'} text-[#8ba88e] shrink-0 transition-all`} strokeWidth={1.5} />
              <input
                id="start-location"
                type="text"
                placeholder="Starting from…"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={`flex-1 bg-transparent text-[#f4f4f5] placeholder-[#f4f4f5]/25 font-light tracking-wide focus:outline-none min-w-0 transition-all ${comfortMode ? 'text-[17px]' : 'text-[15px]'}`}
                style={{ fontFamily: "var(--font-inter)" }}
              />
              <button
                onClick={handleLocate}
                className="p-1.5 shrink-0 rounded-md bg-[#8ba88e]/5 hover:bg-[#8ba88e]/15 text-[#8ba88e] transition-colors"
                title="Use my current location"
                disabled={isLocating}
              >
                {isLocating ? <Loader2 className={`${comfortMode ? 'w-5 h-5' : 'w-4 h-4'} animate-spin`} /> : <LocateFixed className={`${comfortMode ? 'w-5 h-5' : 'w-4 h-4'}`} strokeWidth={1.5} />}
              </button>
            </div>

            {/* Round-trip connector row */}
            <div className="flex items-center gap-3 py-2 px-1">
              <div className="w-px h-8 bg-[#f4f4f5]/8 ml-[8px] shrink-0" />
              <button
                type="button"
                id="round-trip-toggle"
                onClick={() => setIsRoundTrip(!isRoundTrip)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-[12px] font-medium tracking-wide transition-all duration-200 ${
                  isRoundTrip
                    ? "bg-[#8ba88e]/18 border-[#8ba88e]/50 text-[#8ba88e] shadow-[0_0_14px_rgba(139,168,142,0.12)]"
                    : "bg-transparent border-[#f4f4f5]/12 text-[#f4f4f5]/35 hover:text-[#f4f4f5]/55 hover:border-[#f4f4f5]/25"
                }`}
                style={{ fontFamily: "var(--font-inter)" }}
              >
                <span>↩</span>
                {isRoundTrip ? "looping back to start" : "make it a loop"}
              </button>
            </div>

            {/* d) End field: collapse entirely when round-trip is on */}
            {isRoundTrip ? (
              <div className="flex items-center gap-3.5 py-3 px-1">
                <MapPin className={`${comfortMode ? 'w-5 h-5' : 'w-4 h-4'} text-[#8ba88e]/40 shrink-0`} strokeWidth={1.5} />
                <span className={`${comfortMode ? 'text-[15px]' : 'text-[13px]'} text-[#8ba88e]/50 font-light italic`} style={{ fontFamily: "var(--font-inter)" }}>
                  ends back at {start || "your starting point"}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3.5 py-4 px-1 border-b border-transparent focus-within:border-[#e5d3b3]/40 transition-colors duration-300">
                <MapPin className={`${comfortMode ? 'w-5 h-5' : 'w-4 h-4'} text-[#e5d3b3] shrink-0 transition-all`} strokeWidth={1.5} />
                <input
                  id="end-location"
                  type="text"
                  placeholder="Ending up at…"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={`flex-1 bg-transparent text-[#f4f4f5] placeholder-[#f4f4f5]/25 font-light tracking-wide focus:outline-none transition-all ${comfortMode ? 'text-[17px]' : 'text-[15px]'}`}
                  style={{ fontFamily: "var(--font-inter)" }}
                />
              </div>
            )}
          </div>



          {/* Slider Mode Toggle */}
          <div className="flex gap-2.5 mb-5 p-1 rounded-xl bg-[#f4f4f5]/3 border border-[#f4f4f5]/6">
            <button
              type="button"
              onClick={() => setInputMode("time")}
              className={`flex-1 py-1.5 rounded-lg text-center text-[11px] font-semibold tracking-wide transition-all ${
                inputMode === "time"
                  ? "bg-[#8ba88e]/18 text-[#8ba88e] border border-[#8ba88e]/30"
                  : "text-[#f4f4f5]/40 hover:text-[#f4f4f5]/70 cursor-pointer"
              }`}
              style={{ fontFamily: "var(--font-inter)" }}
            >
              time budget
            </button>
            <button
              type="button"
              onClick={() => setInputMode("steps")}
              className={`flex-1 py-1.5 rounded-lg text-center text-[11px] font-semibold tracking-wide transition-all ${
                inputMode === "steps"
                  ? "bg-[#8ba88e]/18 text-[#8ba88e] border border-[#8ba88e]/30"
                  : "text-[#f4f4f5]/40 hover:text-[#f4f4f5]/70 cursor-pointer"
              }`}
              style={{ fontFamily: "var(--font-inter)" }}
            >
              step goal
            </button>
          </div>

          {/* Time Budget or Step Goal Slider */}
          <div className="mb-8">
            {inputMode === "time" ? (
              <>
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
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <label htmlFor="step-goal" className="flex items-center gap-2 text-[#f4f4f5]/40 text-[12px] font-medium tracking-widest uppercase" style={{ fontFamily: "var(--font-inter)" }}>
                    <Footprints className="w-3.5 h-3.5 text-[#8ba88e]" strokeWidth={1.5} />
                    target step goal
                  </label>
                  <span className="text-[#e5d3b3] text-sm font-medium" style={{ fontFamily: "var(--font-inter)" }}>
                    {stepGoal.toLocaleString()} steps
                  </span>
                </div>
                <input
                  id="step-goal"
                  type="range"
                  min={3000}
                  max={15000}
                  step={1000}
                  value={stepGoal}
                  onChange={(e) => setStepGoal(Number(e.target.value))}
                />
                <div className="flex justify-between text-[#f4f4f5]/20 text-[11px] mt-2.5 font-light" style={{ fontFamily: "var(--font-inter)" }}>
                  <span>3k steps</span><span>9k steps</span><span>15k steps</span>
                </div>
              </>
            )}
          </div>

          {/* Vibe Selector */}
          <div className="mb-8">
            <p className="text-[#f4f4f5]/40 text-[12px] font-medium tracking-widest uppercase mb-4" style={{ fontFamily: "var(--font-inter)" }}>
              your vibe
            </p>
            {/* e) Show badge when custom vibe is active */}
            {customVibe.trim() && (
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#8ba88e]/12 border border-[#8ba88e]/30 text-[#8ba88e] text-[11px] font-medium" style={{ fontFamily: "var(--font-inter)" }}>
                  ✦ using your custom vibe
                </span>
                <button onClick={() => setCustomVibe("")} className="text-[#f4f4f5]/30 hover:text-[#f4f4f5]/60 text-[11px] transition-colors" style={{ fontFamily: "var(--font-inter)" }}>clear</button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {VIBES.map((v) => {
                const isSelected = vibe === v.id;
                const dimmed = customVibe.trim().length > 0;
                return (
                  <motion.button
                    key={v.id}
                    id={`vibe-${v.id.toLowerCase().replace(/[\s&]+/g, "-")}`}
                    onClick={() => {
                      setVibe(v.id);
                      setCustomVibe("");
                    }}
                    whileHover={{ scale: dimmed ? 1 : 1.025 }}
                    whileTap={{ scale: 0.975 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={`relative p-3.5 rounded-2xl border text-left transition-all duration-300 ${
                      isSelected
                        ? `${v.activeBg} ${v.activeBorder} ${v.activeGlow}`
                        : dimmed
                        ? "bg-[#f4f4f5]/1 border-[#f4f4f5]/4 opacity-35"
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
                placeholder={vibePlaceholder}
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

          {/* Customization Options */}
          <div className="mb-8 border-t border-[#f4f4f5]/6 pt-6">
            <p className="flex items-center gap-2 text-[#f4f4f5]/40 text-[12px] font-medium tracking-widest uppercase mb-4.5" style={{ fontFamily: "var(--font-inter)" }}>
              <Sliders className="w-3.5 h-3.5 text-[#8ba88e]" strokeWidth={1.5} />
              custom options
            </p>
            
            {/* Number of Stops */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#f4f4f5]/60 text-xs font-light" style={{ fontFamily: "var(--font-inter)" }}>
                  number of stops
                </span>
                <span className="text-[#e5d3b3] text-xs font-medium" style={{ fontFamily: "var(--font-inter)" }}>
                  {numStops} {numStops === 1 ? 'stop' : 'stops'}
                </span>
              </div>
              <input
                id="num-stops"
                type="range"
                min={2}
                max={5}
                step={1}
                value={numStops}
                onChange={(e) => {
                  setNumStops(Number(e.target.value));
                  setHasManuallySetStops(true);
                }}
              />
              <div className="flex justify-between text-[#f4f4f5]/25 text-[10px] mt-1 font-light" style={{ fontFamily: "var(--font-inter)" }}>
                <span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
            </div>

            {/* Price Filter & Free Stops */}
            <div className="flex items-center justify-between border-t border-[#f4f4f5]/6 pt-4 mt-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#e5d3b3]" strokeWidth={1.5} />
                <span className="text-[#f4f4f5]/60 text-xs font-light" style={{ fontFamily: "var(--font-inter)" }}>
                  prefer free stops only
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={freeOnly}
                onClick={() => setFreeOnly(!freeOnly)}
                className={`w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none flex items-center p-0.5 cursor-pointer ${
                  freeOnly ? 'bg-[#8ba88e]' : 'bg-[#f4f4f5]/10'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-[#131316] shadow-md transform transition-transform duration-200 ${
                    freeOnly ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Companion Row */}
            <div className="border-t border-[#f4f4f5]/6 pt-4 mt-4">
              <span className="text-[#f4f4f5]/60 text-xs font-light block mb-3" style={{ fontFamily: "var(--font-inter)" }}>
                who are you wandering with
              </span>
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: "solo", label: "solo", icon: "🧍" },
                  { id: "date", label: "date", icon: "🕯️" },
                  { id: "friends", label: "friends", icon: "🍻" },
                  { id: "pet", label: "pet", icon: "🐶" }
                ].map((item) => {
                  const active = companion === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCompanion(item.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                        active 
                          ? "bg-[#8ba88e]/10 border-[#8ba88e] text-[#8ba88e]" 
                          : "bg-transparent border-[#f4f4f5]/6 hover:border-[#f4f4f5]/15 text-[#f4f4f5]/55"
                      }`}
                      style={{ fontFamily: "var(--font-inter)" }}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Feasibility check — only surface impossible, nothing else */}
          {(() => {
            const effectiveStatus = clientFeasibility?.status ?? advisorData?.feasibility_status;
            const effectiveMessage = clientFeasibility?.message ?? advisorData?.pacing_message;
            if (effectiveStatus !== "impossible") return null;
            return (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 glass border-l-4 border-l-[#ef4444] border-y border-r border-[#f4f4f5]/6 rounded-2xl p-4 flex items-start gap-2.5"
              >
                <X className="w-4 h-4 text-[#ef4444] shrink-0 mt-0.5" strokeWidth={2} />
                <p className="text-[#f4f4f5]/80 text-[12px] font-light leading-relaxed lowercase" style={{ fontFamily: "var(--font-inter)" }}>
                  {effectiveMessage}
                </p>
              </motion.div>
            );
          })()}

          {/* f) Static hint above CTA when disabled */}
          {!canWander && (
            <p className="text-center text-[11px] text-[#f4f4f5]/30 mb-3" style={{ fontFamily: "var(--font-inter)" }}>
              {!start.trim() || !effectiveEnd.trim()
                ? "↑ add a start & end location"
                : "↑ pick a vibe to continue"}
            </p>
          )}

          {/* CTA — always reads 'plan my wander' */}
          <motion.button
            id="wander-button"
            onClick={onWander}
            disabled={!canWander || advisorLoading || advisorData?.feasibility_status === "impossible" || clientFeasibility?.status === "impossible"}
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
            <span>{isRoundTrip && canWander ? "plan my loop" : "plan my wander"}</span>
            {canWander && <ArrowRight className="w-4 h-4" strokeWidth={2} />}
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

function WaypointCard({
  waypoint,
  isNearby = false,
  isVisited = false,
  dwellSeconds = 0,
  onManualCheckIn,
  vibe,
  onSwapWaypoint,
  isSwapping = false,
}: {
  waypoint: WaypointV3;
  isNearby?: boolean;
  isVisited?: boolean;
  dwellSeconds?: number;
  onManualCheckIn?: () => void;
  vibe: VibeId | "";
  onSwapWaypoint?: (index: number, customRefinement?: string) => Promise<void>;
  isSwapping?: boolean;
}) {
  const [tipOpen, setTipOpen] = useState(false);
  const [swapMenuOpen, setSwapMenuOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!swapMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSwapMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [swapMenuOpen]);

  const targetSeconds = (waypoint.duration_mins || 30) * 60;
  const dwellPercent = Math.min(100, (dwellSeconds / targetSeconds) * 100);

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div
        className={`glass-lighter rounded-2xl overflow-hidden relative transition-all duration-500 ${
          isVisited ? "opacity-50" : ""
        } ${
          isNearby && !isVisited
            ? "ring-2 ring-[#8ba88e]/60 shadow-[0_0_28px_rgba(139,168,142,0.25)]"
            : ""
        }`}
      >
        {/* Nearby pulse ring */}
        {isNearby && !isVisited && (
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-[#8ba88e]/40 pointer-events-none"
            animate={{ opacity: [0.4, 0.9, 0.4], scale: [1, 1.01, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {/* Visited overlay */}
        {isVisited && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#8ba88e]/20 border border-[#8ba88e]/40 backdrop-blur-sm">
              <CheckCircle2 className="w-4 h-4 text-[#8ba88e]" strokeWidth={2} />
              <span className="text-[#8ba88e] text-[12px] font-medium" style={{ fontFamily: "var(--font-inter)" }}>visited</span>
            </div>
          </div>
        )}

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
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(waypoint.address_hint);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch (err) {
                console.error("failed to copy address", err);
              }
            }}
            className="text-[#f4f4f5]/30 hover:text-[#8ba88e] text-[12px] font-light mb-4 flex items-center gap-1.5 transition-colors cursor-pointer text-left focus:outline-none"
            style={{ fontFamily: "var(--font-inter)" }}
            title="Click to copy address"
          >
            <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.5} />
            <span className="truncate">{waypoint.address_hint}</span>
            {copied && (
              <span className="text-[10px] text-[#8ba88e] font-medium ml-1 shrink-0">
                (copied!)
              </span>
            )}
          </button>
          <p
            className="text-[#f4f4f5]/65 text-[14px] font-light leading-relaxed mb-4"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            {waypoint.action_description}
          </p>
          {/* Nearby call-to-action banner */}
          {isNearby && !isVisited && (
            <div className="mb-4 flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-[#8ba88e]/10 border border-[#8ba88e]/25">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-[#8ba88e] shrink-0" strokeWidth={1.5} />
                <span className="text-[#8ba88e] text-[12px] font-medium lowercase" style={{ fontFamily: "var(--font-inter)" }}>
                  {dwellSeconds > 0
                    ? `you've been here ${Math.floor(dwellSeconds / 60)}m ${dwellSeconds % 60}s — auto check-in in ${Math.max(0, 5 - Math.floor(dwellSeconds / 60))}m`
                    : "you're close — head inside!"}
                </span>
              </div>
              {onManualCheckIn && (
                <button
                  onClick={onManualCheckIn}
                  className="shrink-0 px-3 py-1 rounded-full bg-[#8ba88e] text-[#131316] text-[10px] font-semibold uppercase tracking-wide hover:bg-[#97b59a] transition-colors"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  i'm here
                </button>
              )}
            </div>
          )}

          {/* Dwell progress bar */}
          {isNearby && !isVisited && dwellSeconds > 0 && (
            <div className="mb-3 h-1 rounded-full bg-[#8ba88e]/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[#8ba88e]/60"
                initial={{ width: 0 }}
                animate={{ width: `${dwellPercent}%` }}
                transition={{ duration: 0.5, ease: "linear" }}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-[#e5d3b3]/60 text-[12px] font-light" style={{ fontFamily: "var(--font-inter)" }}>
                {isVisited ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#8ba88e]" strokeWidth={1.5} />
                ) : (
                  <Timer className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
                {isVisited ? "visited" : `${waypoint.duration_mins} min`}
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
              {onSwapWaypoint && !isVisited && (
                <button
                  onClick={() => setSwapMenuOpen((o) => !o)}
                  className={`flex items-center gap-1.5 text-[12px] font-medium transition-colors ${swapMenuOpen ? 'text-[#8ba88e]' : 'text-[#e5d3b3]/50 hover:text-[#e5d3b3]/80'}`}
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  <Wand2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  swap stop
                </button>
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

          <AnimatePresence>
            {swapMenuOpen && !isVisited && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden border-t border-[#e5d3b3]/8 pt-3 mt-3 flex flex-col gap-2.5"
              >
                <p className="text-[#e5d3b3]/45 text-[11px] font-medium tracking-wide lowercase" style={{ fontFamily: "var(--font-inter)" }}>
                  swap this stop for something else
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setSwapMenuOpen(false);
                      if (onSwapWaypoint) await onSwapWaypoint(waypoint.order - 1);
                    }}
                    className="flex-1 py-1.5 rounded-xl bg-[#e5d3b3]/10 border border-[#e5d3b3]/15 text-[#e5d3b3]/80 hover:bg-[#e5d3b3]/18 transition-all flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    surprise me
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="what are you in the mood for instead?..."
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    className="w-full bg-[#131316]/50 border border-[#e5d3b3]/15 rounded-xl py-2 pl-3 pr-10 text-[13px] text-[#f4f4f5] placeholder-[#f4f4f5]/30 focus:outline-none focus:border-[#8ba88e]/40 transition-colors font-light"
                    style={{ fontFamily: "var(--font-inter)" }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && customInput.trim()) {
                        setSwapMenuOpen(false);
                        const val = customInput;
                        setCustomInput("");
                        if (onSwapWaypoint) await onSwapWaypoint(waypoint.order - 1, val);
                      }
                    }}
                  />
                  <button
                    disabled={!customInput.trim()}
                    onClick={async () => {
                      setSwapMenuOpen(false);
                      const val = customInput;
                      setCustomInput("");
                      if (onSwapWaypoint) await onSwapWaypoint(waypoint.order - 1, val);
                    }}
                    className="absolute right-2 p-1.5 rounded-lg text-[#8ba88e]/80 hover:text-[#8ba88e] disabled:opacity-30 transition-opacity"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Swapping/loading overlay */}
        <AnimatePresence>
          {isSwapping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#131316]/75 backdrop-blur-md z-20 flex flex-col items-center justify-center gap-3"
            >
              <div className="w-5 h-5 rounded-full border-2 border-[#8ba88e]/30 border-t-[#8ba88e] animate-spin" />
              <span className="text-[12px] text-[#8ba88e] font-medium tracking-wide lowercase" style={{ fontFamily: "var(--font-inter)" }}>
                swapping stop...
              </span>
            </motion.div>
          )}
        </AnimatePresence>
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

// ── Passport Overlay ─────────────────────────────────────────────────────────

function PassportOverlay({
  passport,
  totalStops,
  onClose,
  onClear,
}: {
  passport: import("./hooks/usePassport").PassportNeighborhood[];
  totalStops: number;
  onClose: () => void;
  onClear: () => void;
}) {
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <motion.div
      key="passport-overlay"
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 35 }}
      className="fixed inset-0 z-[100] bg-[#131316] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-6 border-b border-[#f4f4f5]/6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-[#e5d3b3]/60" strokeWidth={1.5} />
            <span className="text-[11px] font-medium tracking-[0.35em] uppercase text-[#e5d3b3]/40" style={{ fontFamily: "var(--font-inter)" }}>
              your wander passport
            </span>
          </div>
          {passport.length > 0 && (
            <p className="text-[#f4f4f5]/30 text-[12px] font-light" style={{ fontFamily: "var(--font-inter)" }}>
              {passport.length} {passport.length === 1 ? "neighborhood" : "neighborhoods"} · {totalStops} unique {totalStops === 1 ? "stop" : "stops"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {passport.length > 0 && (
            <button
              onClick={() => {
                if (confirm("clear your entire passport? this cannot be undone.")) onClear();
              }}
              className="p-2 rounded-xl text-[#f4f4f5]/20 hover:text-red-400/60 hover:bg-red-400/5 transition-colors"
              title="Clear passport"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#f4f4f5]/30 hover:text-[#f4f4f5]/70 hover:bg-[#f4f4f5]/5 transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {passport.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-24">
            <div className="text-5xl mb-6">🗺️</div>
            <p className="text-[#f4f4f5]/30 text-[16px] font-light italic mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
              no stamps yet
            </p>
            <p className="text-[#f4f4f5]/20 text-[13px] font-light" style={{ fontFamily: "var(--font-inter)" }}>
              start your first wander and check in to earn your first neighborhood stamp
            </p>
          </div>
        ) : (
          passport.map((hood, i) => (
            <motion.div
              key={hood.neighborhood}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              className="relative glass border border-[#e5d3b3]/8 rounded-2xl p-5 overflow-hidden"
            >
              {/* Diagonal watermark */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-2xl"
                aria-hidden
              >
                <span
                  className="text-[#e5d3b3]/3 font-black text-[72px] tracking-widest uppercase select-none"
                  style={{
                    fontFamily: "var(--font-inter)",
                    transform: "rotate(-20deg)",
                    whiteSpace: "nowrap",
                  }}
                >
                  visited
                </span>
              </div>

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3
                      className="text-[#f4f4f5] text-[18px] font-semibold leading-tight capitalize mb-1"
                      style={{ fontFamily: "var(--font-playfair)" }}
                    >
                      {hood.neighborhood}
                    </h3>
                    <p className="text-[#f4f4f5]/30 text-[11px] font-light" style={{ fontFamily: "var(--font-inter)" }}>
                      last visited {formatDate(hood.lastVisited)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2.5 py-1 rounded-full bg-[#e5d3b3]/10 border border-[#e5d3b3]/20 text-[#e5d3b3] text-[11px] font-semibold" style={{ fontFamily: "var(--font-inter)" }}>
                      {hood.count} {hood.count === 1 ? "visit" : "visits"}
                    </span>
                  </div>
                </div>

                {/* Stop list */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {hood.stops.slice(0, 6).map((stop) => (
                    <span
                      key={stop}
                      className="px-2 py-0.5 rounded-full bg-[#f4f4f5]/5 text-[#f4f4f5]/50 text-[10px] font-light lowercase"
                      style={{ fontFamily: "var(--font-inter)" }}
                    >
                      📍 {stop}
                    </span>
                  ))}
                  {hood.stops.length > 6 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#f4f4f5]/5 text-[#f4f4f5]/30 text-[10px] font-light">
                      +{hood.stops.length - 6} more
                    </span>
                  )}
                </div>

                {/* Vibe tags */}
                {hood.vibes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {hood.vibes.map((v) => (
                      <span
                        key={v}
                        className="px-2 py-0.5 rounded-full bg-[#8ba88e]/8 text-[#8ba88e]/70 text-[9px] font-medium uppercase tracking-wide"
                        style={{ fontFamily: "var(--font-inter)" }}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}

// ── Route Screen ──────────────────────────────────────────────────────────────

export function RouteScreen({
  data,
  vibe,
  onReset,
  isSharedView = false,
  weatherContext,
  addPassportStamp,
  comfortMode = false,
}: {
  data: WanderV3Response;
  vibe: VibeId | "";
  onReset: () => void;
  isSharedView?: boolean;
  weatherContext?: string | null;
  addPassportStamp?: (entry: PassportEntry) => void;
  comfortMode?: boolean;
}) {
  const [routes, setRoutes] = useState<WanderRouteOptionV3[]>(data.routes || []);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (data?.routes) {
      setRoutes(data.routes);
    }
  }, [data?.routes]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeRoute = routes[selectedIndex];
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (e.key === "1") {
        if (routes[0]) setSelectedIndex(0);
      } else if (e.key === "2") {
        if (routes[1]) setSelectedIndex(1);
      } else if (e.key === "3") {
        if (routes[2]) setSelectedIndex(2);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [routes, setSelectedIndex]);

  useEffect(() => {
    if (!routes[selectedIndex]) {
      const firstAvailableIdx = routes.findIndex(r => !!r);
      if (firstAvailableIdx !== -1) {
        setSelectedIndex(firstAvailableIdx);
      }
    }
  }, [routes, selectedIndex]);

  const handleSwapWaypoint = async (idx: number, customRefinement?: string) => {
    if (!activeRoute) return;
    setSwappingIndex(idx);
    try {
      const res = await fetch("/api/swap-waypoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route: activeRoute,
          index: idx,
          vibe: vibe || "custom",
          custom_refinement: customRefinement || null
        })
      });
      if (res.ok) {
        const updatedRoute = await res.json();
        setRoutes((prevRoutes) => {
          const next = [...prevRoutes];
          next[selectedIndex] = updatedRoute;
          return next;
        });
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to swap waypoint");
      }
    } catch (err) {
      console.error("Error swapping waypoint:", err);
      alert("An error occurred while swapping the waypoint.");
    } finally {
      setSwappingIndex(null);
    }
  };

  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // ── Calendar Picker ──
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState("");
  const [calendarTime, setCalendarTime] = useState("");

  // ── Walk Mode ──
  const walkWaypoints = (activeRoute?.waypoints ?? []).map((wp) => ({
    lat: wp.lat,
    lng: wp.lng,
    order: wp.order,
    duration_mins: wp.duration_mins,
    walk_to_next_mins: wp.walk_to_next_mins,
  }));

  const handleCheckIn = useCallback(
    async (idx: number) => {
      if (!addPassportStamp || !activeRoute) return;
      const wp = activeRoute.waypoints[idx];
      if (!wp) return;

      // Try to get neighborhood from address via reverse geocode
      let neighborhood = wp.address_hint || activeRoute.start_location || "unknown";
      if (wp.lat && wp.lng) {
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${wp.lat}&lng=${wp.lng}`);
          if (res.ok) {
            const d = await res.json();
            if (d.address) neighborhood = d.address;
          }
        } catch {
          // fall back to address_hint
        }
      }

      addPassportStamp({
        neighborhood,
        stopName: wp.location_name,
        vibe: vibe || "custom",
        visitedAt: new Date().toISOString(),
        lat: wp.lat ?? undefined,
        lng: wp.lng ?? undefined,
      });
    },
    [activeRoute, vibe, addPassportStamp]
  );

  const {
    walkModeActive,
    proximityStopIdx,
    checkedInStops,
    dwellSeconds,
    currentStopIdx,
    remainingMinutes,
    startWalk,
    stopWalk,
    manualCheckIn,
    geoError,
    stopsWithoutCoords,
  } = useWalkMode(walkWaypoints, handleCheckIn);

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
        const waypointNames = activeRoute.waypoints.map((w, idx) => `${idx + 1}. ${w.location_name}`).join(" -> ");
        const shareText = `Wander Route: ${activeRoute.route_name}\nWaypoints: ${waypointNames}\nDuration: ${activeRoute.total_walking_time_mins} minutes total\nDetails: ${url}`;
        await navigator.clipboard.writeText(shareText);
        setTimeout(() => setShareUrl(null), 3000);
      }
    } catch (e) {
      console.error("Error sharing route", e);
    } finally {
      setIsSharing(false);
    }
  };

  const handleAddToCalendar = (route: WanderRouteOptionV3, startDate?: Date) => {
    if (!route) return;

    const eventStart = startDate ?? new Date();
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
      "PRODID:-//wander app//wander route//EN",
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
            {/* c) Tabs with stronger active/inactive affordance */}
            {[0, 1, 2].map((i) => {
              const route = routes[i];
              const isLoading = !route;
              const tabTitle = route ? route.route_name : `route ${i + 1}…`;
              const isSelected = selectedIndex === i;
              return (
                <button
                  key={i}
                  id={`route-tab-${i}`}
                  onClick={() => { if (route) setSelectedIndex(i); }}
                  disabled={isLoading}
                  className={`relative flex-1 px-2 py-3 rounded-xl text-center transition-all duration-200 z-10 ${
                    isLoading ? "opacity-40 cursor-wait" : "cursor-pointer"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="active-route-tab"
                      className="absolute inset-0 bg-[#8ba88e]/18 border border-[#8ba88e]/40 rounded-xl shadow-[0_0_12px_rgba(139,168,142,0.12)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span
                    className={`relative z-10 text-[11px] font-semibold leading-snug block tracking-wide transition-colors ${
                      isSelected
                        ? "text-[#8ba88e]"
                        : "text-[#f4f4f5]/45 hover:text-[#f4f4f5]/75"
                    }`}
                    style={{ fontFamily: "var(--font-inter)" }}
                    title={tabTitle}
                  >
                    {tabTitle}
                  </span>
                  {isSelected && (
                    <span className="relative z-10 block w-3 h-0.5 bg-[#8ba88e]/60 rounded-full mx-auto mt-1.5" />
                  )}
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
            {(() => {
              const walkingMins = activeRoute.initial_walk_mins + activeRoute.waypoints.reduce((sum, wp) => sum + (wp.walk_to_next_mins || 0), 0);
              const dwellMins = activeRoute.waypoints.reduce((sum, wp) => sum + (wp.duration_mins || 0), 0);
              const totalMins = walkingMins + dwellMins;
              const hrs = Math.floor(totalMins / 60);
              const mins = totalMins % 60;
              const totalLabel = hrs > 0 ? (mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`) : `${mins}m`;
              return (
                <>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#8ba88e]/10 text-[#8ba88e] text-[11px] font-medium border border-[#8ba88e]/20"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    🚶 {walkingMins} min walking
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e5d3b3]/8 text-[#e5d3b3] text-[11px] font-medium border border-[#e5d3b3]/20"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    ☕ {dwellMins} min at stops
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4f4f5]/8 text-[#f4f4f5]/70 text-[11px] font-medium border border-[#f4f4f5]/15"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    ⏱️ {totalLabel} total
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4f4f5]/5 text-[#f4f4f5]/55 text-[11px] font-medium border border-[#f4f4f5]/10"
                    style={{ fontFamily: "var(--font-inter)" }}
                    title="Estimated based on walking duration"
                  >
                    👣 {Math.round(walkingMins * 120).toLocaleString()} steps
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4f4f5]/5 text-[#f4f4f5]/55 text-[11px] font-medium border border-[#f4f4f5]/10"
                    style={{ fontFamily: "var(--font-inter)" }}
                    title="Estimated calories burned walking"
                  >
                    🔥 {Math.round(walkingMins * 4.5)} kcal
                  </span>
                </>
              );
            })()}
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
                    <WaypointCard
                      waypoint={wp}
                      isNearby={walkModeActive && proximityStopIdx === i}
                      isVisited={checkedInStops.has(i)}
                      dwellSeconds={dwellSeconds.get(i) ?? 0}
                      onManualCheckIn={walkModeActive && !checkedInStops.has(i) ? () => manualCheckIn(i, handleCheckIn) : undefined}
                      vibe={vibe}
                      onSwapWaypoint={handleSwapWaypoint}
                      isSwapping={swappingIndex === i}
                    />
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

        {/* b) Map FIRST — above the stop timeline so users see geography immediately */}
        {!isGenerating && activeRoute && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.45 }}
            className="mb-5 w-full h-[340px] rounded-2xl overflow-hidden border border-[#8ba88e]/15 shadow-[0_0_40px_rgba(139,168,142,0.08)] relative bg-[#131316]"
          >
            <WanderMap route={activeRoute} />
          </motion.div>
        )}

        {/* ── Stop Badges (clickable links for each waypoint) ── */}
        {!isGenerating && activeRoute && activeRoute.waypoints.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="mb-8 flex items-center gap-2 flex-wrap justify-center"
          >
            {activeRoute.waypoints.map((wp) => {
              const href = wp.place_id
                ? `https://www.google.com/maps/place/?q=place_id:${wp.place_id}`
                : (wp.lat != null && wp.lng != null)
                ? `https://www.google.com/maps/search/?api=1&query=${wp.lat},${wp.lng}`
                : null;
              const badge = (
                <span
                  className="w-7 h-7 rounded-full bg-[#8ba88e]/15 border border-[#8ba88e]/30 flex items-center justify-center text-[#8ba88e] text-[11px] font-semibold transition-all duration-200"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  {wp.order}
                </span>
              );
              return href ? (
                <a
                  key={wp.order}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={wp.location_name}
                  className="hover:scale-110 hover:shadow-[0_0_12px_rgba(139,168,142,0.3)] transition-transform"
                >
                  {badge}
                </a>
              ) : (
                <span key={wp.order} title={wp.location_name} className="opacity-40">
                  {badge}
                </span>
              );
            })}
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
                onClick={() => {
                  const now = new Date();
                  const yyyy = now.getFullYear();
                  const mm = String(now.getMonth() + 1).padStart(2, '0');
                  const dd = String(now.getDate()).padStart(2, '0');
                  const totalMins = now.getHours() * 60 + now.getMinutes();
                  const rounded = Math.round(totalMins / 30) * 30;
                  const hh = String(Math.floor(rounded / 60) % 24).padStart(2, '0');
                  const min = String(rounded % 60).padStart(2, '0');
                  setCalendarDate(`${yyyy}-${mm}-${dd}`);
                  setCalendarTime(`${hh}:${min}`);
                  setCalendarPickerOpen(true);
                }}
                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-[#e5d3b3]/10 border border-[#e5d3b3]/20 text-[#e5d3b3] text-[13px] font-medium hover:bg-[#e5d3b3]/25 transition-all duration-300"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                <Calendar className="w-3.5 h-3.5" />
                add to calendar
              </button>

              {/* Calendar picker modal */}
              <AnimatePresence>
                {calendarPickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-x-4 bottom-36 z-[60] max-w-[400px] mx-auto glass border border-[#e5d3b3]/20 rounded-2xl p-5 shadow-2xl"
                  >
                    <p className="text-[#f4f4f5]/50 text-[11px] font-medium tracking-widest uppercase mb-4" style={{ fontFamily: "var(--font-inter)" }}>when do you want to go?</p>
                    <div className="flex gap-3 mb-4">
                      <input
                        type="date"
                        value={calendarDate}
                        onChange={(e) => setCalendarDate(e.target.value)}
                        className="flex-1 bg-[#f4f4f5]/5 border border-[#f4f4f5]/10 rounded-xl px-3 py-2.5 text-[#f4f4f5] text-[13px] font-light focus:outline-none focus:border-[#e5d3b3]/40"
                        style={{ fontFamily: "var(--font-inter)" }}
                      />
                      <input
                        type="time"
                        value={calendarTime}
                        onChange={(e) => setCalendarTime(e.target.value)}
                        className="w-28 bg-[#f4f4f5]/5 border border-[#f4f4f5]/10 rounded-xl px-3 py-2.5 text-[#f4f4f5] text-[13px] font-light focus:outline-none focus:border-[#e5d3b3]/40"
                        style={{ fontFamily: "var(--font-inter)" }}
                      />
                    </div>
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => setCalendarPickerOpen(false)}
                        className="flex-1 py-2.5 rounded-xl border border-[#f4f4f5]/10 text-[#f4f4f5]/40 text-[13px] font-medium hover:border-[#f4f4f5]/20 hover:text-[#f4f4f5]/60 transition-all"
                        style={{ fontFamily: "var(--font-inter)" }}
                      >
                        cancel
                      </button>
                      <button
                        onClick={() => {
                          if (calendarDate && calendarTime) {
                            handleAddToCalendar(activeRoute, new Date(`${calendarDate}T${calendarTime}`));
                          }
                          setCalendarPickerOpen(false);
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-[#e5d3b3]/15 border border-[#e5d3b3]/30 text-[#e5d3b3] text-[13px] font-medium hover:bg-[#e5d3b3]/25 transition-all"
                        style={{ fontFamily: "var(--font-inter)" }}
                      >
                        save to calendar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Sticky Walk Mode + Start Button Bar ── */}
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

            {/* Walk mode progress bar */}
            <AnimatePresence>
              {walkModeActive && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className="glass border border-[#8ba88e]/20 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <motion.div
                        className="w-2 h-2 rounded-full bg-[#8ba88e]"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <span className="text-[#8ba88e] text-[12px] font-medium lowercase" style={{ fontFamily: "var(--font-inter)" }}>
                        {currentStopIdx >= activeRoute.waypoints.length
                          ? "all stops checked in! 🎉"
                          : `stop ${currentStopIdx + 1} of ${activeRoute.waypoints.length}`}
                      </span>
                    </div>
                    <span className="text-[#f4f4f5]/40 text-[11px] font-light" style={{ fontFamily: "var(--font-inter)" }}>
                      ~{remainingMinutes} min left
                    </span>
                  </div>
                  {geoError && (
                    <p className="text-red-400/60 text-[11px] text-center mt-1.5 font-light" style={{ fontFamily: "var(--font-inter)" }}>
                      {geoError}
                    </p>
                  )}
                  {stopsWithoutCoords.length > 0 && (
                    <p className="text-[#e5d3b3]/50 text-[11px] text-center mt-1.5 font-light" style={{ fontFamily: "var(--font-inter)" }}>
                      ⚠ stop {stopsWithoutCoords.join(', ')} has no GPS coordinates — tap the card to check in manually
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Button row */}
            <div className="flex gap-2.5">
              {/* Live Walk Mode toggle */}
              {!isSharedView && (
                <motion.button
                  id="live-walk-mode-button"
                  onClick={walkModeActive ? stopWalk : startWalk}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={`shrink-0 py-4 px-4 rounded-2xl font-medium text-[13px] tracking-wide flex items-center justify-center gap-2 transition-all duration-300 ${
                    walkModeActive
                      ? "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25"
                      : "bg-[#8ba88e]/10 border border-[#8ba88e]/25 text-[#8ba88e] hover:bg-[#8ba88e]/20"
                  }`}
                  style={{ fontFamily: "var(--font-inter)" }}
                  title={walkModeActive ? "end walk" : "live walk mode"}
                >
                  {walkModeActive ? (
                    <>
                      <motion.div
                        className="w-3 h-3 rounded-full bg-red-400"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                      end
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4" strokeWidth={1.5} />
                      live
                    </>
                  )}
                </motion.button>
              )}

              {/* Main CTA */}
              <motion.button
                id="start-wandering-button"
                onClick={() => window.open(activeRoute.navigation_deep_link, "_blank")}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex-1 py-4 rounded-2xl bg-[#8ba88e] text-[#131316] font-semibold text-[15px] tracking-wide flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(139,168,142,0.3)] hover:bg-[#97b59a] transition-colors duration-200"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                <Navigation className="w-4 h-4" strokeWidth={2} />
                start wandering
                <ExternalLink className="w-3.5 h-3.5 opacity-60" strokeWidth={2} />
              </motion.button>

              {isIOS && (
                <motion.button
                  onClick={() => {
                    const startLoc = encodeURIComponent(activeRoute.start_location || activeRoute.waypoints[0]?.location_name || "");
                    const endLoc = encodeURIComponent(activeRoute.end_location || activeRoute.waypoints[activeRoute.waypoints.length - 1]?.location_name || "");
                    const appleMapsLink = `https://maps.apple.com/?saddr=${startLoc}&daddr=${endLoc}&dirflg=w`;
                    window.open(appleMapsLink, "_blank");
                  }}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="px-4 py-4 rounded-2xl bg-[#f4f4f5]/5 border border-[#f4f4f5]/10 text-[#f4f4f5]/70 font-semibold text-[13px] tracking-wide hover:bg-[#f4f4f5]/10 transition-colors"
                  style={{ fontFamily: "var(--font-inter)" }}
                  title="Open Apple Maps walking directions"
                >
                  apple maps
                </motion.button>
              )}
            </div>

            <p className="text-center text-[#f4f4f5]/20 text-[11px] mt-2 font-light" style={{ fontFamily: "var(--font-inter)" }}>
              {walkModeActive ? "gps active — your stops will glow when you're close" : "opens walking directions in google maps"}
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
  const [inputMode, setInputMode] = useState<"time" | "steps">("time");
  const [stepGoal, setStepGoal] = useState<number>(5000);
  const [vibe, setVibe] = useState<VibeId | "">("");
  const [customVibe, setCustomVibe] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [routeData, setRouteData] = useState<WanderV3Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [weatherContext, setWeatherContext] = useState<string | null>(null);
  const [numStops, setNumStops] = useState<number>(3);
  const [freeOnly, setFreeOnly] = useState<boolean>(false);
  const [advisorData, setAdvisorData] = useState<AdvisorResponse | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState<boolean>(false);
  const [companion, setCompanion] = useState<string>("solo");
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [comfortMode, setComfortMode] = useState(false);

  const effectiveTimeBudget = inputMode === "steps" ? Math.round(stepGoal / 120) + (numStops * 25) : timeBudget;

  // Keep end in sync when round-trip is active and start changes
  useEffect(() => {
    if (isRoundTrip) setEnd(start);
  }, [isRoundTrip, start]);

  // ── Passport ──
  const { passport, passportCount, totalStops, addStamp, clearPassport } = usePassport();
  const [passportOpen, setPassportOpen] = useState(false);

  useEffect(() => {
    // 1. Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then((reg) => {
          console.log("SW registered:", reg.scope);
          // Check for service worker updates
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("New service worker installed; reloading page to apply update.");
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch((err) => console.error("SW registration failed:", err));

      // Reload page when service worker controller changes
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
    
    // 2. Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const [hasManuallySetStops, setHasManuallySetStops] = useState<boolean>(false);

  // Advisor fetch — only re-runs when locations or companion change.
  // Slider changes (timeBudget, numStops) are evaluated client-side below.
  useEffect(() => {
    if (!start.trim() || !end.trim()) {
      setAdvisorData(null);
      return;
    }

    const timer = setTimeout(async () => {
      setAdvisorLoading(true);
      try {
        const localTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const localDay = new Date().toLocaleDateString([], { weekday: 'long' });
        const timeContext = `${localDay}, ${localTime}`;

        const res = await fetch("/api/pacing-advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_location: start,
            end_location: end,
            time_budget_minutes: effectiveTimeBudget,
            num_stops: numStops,
            companion: companion,
            local_time: timeContext,
          }),
        });
        if (res.ok) {
          const data: AdvisorResponse = await res.json();
          setAdvisorData(data);

          if (!hasManuallySetStops && data.recommended_stops >= 2 && data.recommended_stops <= 5) {
            setNumStops(data.recommended_stops);
          }
        }
      } catch (err) {
        console.error("error calling pacing advisor:", err);
      } finally {
        setAdvisorLoading(false);
      }
    }, 900);

    return () => clearTimeout(timer);
  // Companion is intentionally excluded: changing companion should NOT re-run the
  // distance/feasibility check. Companion is still sent in the request body
  // via the closure — it just won't act as a trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  // Client-side feasibility overlay — instantly reflects slider changes
  // without hitting the API. Overrides the card's status text only.
  const clientFeasibility = (() => {
    if (!advisorData) return null;
    const minRequired = numStops * 12;
    if (effectiveTimeBudget < minRequired) {
      return {
        status: "impossible" as const,
        message: `impossible: ${inputMode === "steps" ? `${stepGoal.toLocaleString()} steps` : `${effectiveTimeBudget}m`} is too short for ${numStops} stops — try fewer stops or more time`,
      };
    }
    if (effectiveTimeBudget < numStops * 18) {
      return {
        status: "tight" as const,
        message: `tight: ${numStops} stops in ${inputMode === "steps" ? `${stepGoal.toLocaleString()} steps` : `${effectiveTimeBudget}m`} is doable but you'll need to keep moving`,
      };
    }
    return null; // use server message
  })();



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
          time_budget_minutes: effectiveTimeBudget,
          vibe: selectedVibe,
          local_time: timeContext,
          num_stops: numStops,
          free_only: freeOnly,
          companion: companion
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

            // Switch screen to route view immediately when any route is ready!
            setScreen("route");
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
  }, [start, end, timeBudget, vibe, customVibe, numStops, freeOnly, companion]);

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
          const res = await fetch(`/api/reverse-geocode?lat=${position.coords.latitude}&lng=${position.coords.longitude}`);
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
    <main className={`min-h-screen bg-[#131316] text-[#f4f4f5] relative overflow-x-hidden${comfortMode ? ' comfort-mode' : ''}`}>
      <BackgroundOrbs />
      <ConfettiCanvas active={screen === "route"} />
      <AnimatePresence mode="wait">
        {screen === "input" && (
          <InputScreen
            key="input"
            start={start} setStart={setStart}
            end={end} setEnd={setEnd}
            timeBudget={timeBudget} setTimeBudget={setTimeBudget}
            inputMode={inputMode} setInputMode={setInputMode}
            stepGoal={stepGoal} setStepGoal={setStepGoal}
            vibe={vibe} setVibe={setVibe}
            onWander={handleWander}
            error={error}
            handleLocate={handleLocate}
            isLocating={isLocating}
            customVibe={customVibe}
            setCustomVibe={setCustomVibe}
            deferredPrompt={deferredPrompt}
            numStops={numStops}
            setNumStops={setNumStops}
            freeOnly={freeOnly}
            setFreeOnly={setFreeOnly}
            advisorData={advisorData}
            advisorLoading={advisorLoading}
            clientFeasibility={clientFeasibility}
            companion={companion}
            setCompanion={setCompanion}
            setHasManuallySetStops={setHasManuallySetStops}
            passportCount={passportCount}
            onOpenPassport={() => setPassportOpen(true)}
            isRoundTrip={isRoundTrip}
            setIsRoundTrip={setIsRoundTrip}
            comfortMode={comfortMode}
            setComfortMode={setComfortMode}
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
            addPassportStamp={addStamp}
            comfortMode={comfortMode}
          />
        )}
      </AnimatePresence>

      {/* ── Passport Overlay (global, above all screens) ── */}
      <AnimatePresence>
        {passportOpen && (
          <PassportOverlay
            passport={passport}
            totalStops={totalStops}
            onClose={() => setPassportOpen(false)}
            onClear={() => { clearPassport(); setPassportOpen(false); }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
