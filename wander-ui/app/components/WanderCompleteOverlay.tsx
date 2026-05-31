"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RotateCcw, BookOpen } from "lucide-react";
import { LEVEL_BADGE, getNeighborhoodLevel } from "../hooks/usePassport";

interface WanderCompleteOverlayProps {
  isVisible: boolean;
  neighborhood: string;
  neighborhoodVisitCount: number;
  streakDays: number;
  totalWanders: number;
  onClose: () => void;
  onPlanAnother: () => void;
}

export default function WanderCompleteOverlay({
  isVisible,
  neighborhood,
  neighborhoodVisitCount,
  streakDays,
  totalWanders,
  onClose,
  onPlanAnother,
}: WanderCompleteOverlayProps) {
  const level = getNeighborhoodLevel(neighborhoodVisitCount);
  const badge = LEVEL_BADGE[level];
  const levelLabel =
    level === "local" ? "Local" : level === "regular" ? "Regular" : "Newcomer";

  // Close on Escape
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="wander-complete"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[200] bg-[#131316]/90 backdrop-blur-xl flex items-center justify-center p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24, delay: 0.05 }}
            className="relative w-full max-w-[380px] glass border border-[#e5d3b3]/20 rounded-3xl overflow-hidden shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow background pulse */}
            <motion.div
              className="absolute inset-0 rounded-3xl pointer-events-none"
              animate={{
                boxShadow: [
                  "0 0 0px rgba(139,168,142,0)",
                  "0 0 60px rgba(139,168,142,0.2)",
                  "0 0 0px rgba(139,168,142,0)",
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative z-10 p-8">
              {/* Badge */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 18 }}
                className="text-6xl mb-4 select-none"
                aria-hidden
              >
                {badge}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8ba88e]/15 border border-[#8ba88e]/30 mb-4">
                  <Sparkles className="w-3 h-3 text-[#8ba88e]" />
                  <span
                    className="text-[#8ba88e] text-[10px] font-semibold tracking-[0.2em] uppercase"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    wander complete
                  </span>
                </div>

                <h2
                  className="text-[26px] font-semibold text-[#f4f4f5] leading-tight mb-1"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  {neighborhood}
                </h2>
                <p
                  className="text-[#f4f4f5]/40 text-[12px] font-light mb-6"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  {badge} {levelLabel} · {neighborhoodVisitCount}{" "}
                  {neighborhoodVisitCount === 1 ? "visit" : "visits"}
                </p>

                {/* Stats row */}
                <div className="flex items-center justify-center gap-6 mb-8">
                  {streakDays > 0 && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[22px]">🔥</span>
                      <span
                        className="text-[#e5d3b3] text-[15px] font-semibold"
                        style={{ fontFamily: "var(--font-inter)" }}
                      >
                        {streakDays}
                      </span>
                      <span
                        className="text-[#f4f4f5]/30 text-[10px] font-light"
                        style={{ fontFamily: "var(--font-inter)" }}
                      >
                        {streakDays === 1 ? "day" : "day streak"}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <BookOpen className="w-5 h-5 text-[#e5d3b3]/60" strokeWidth={1.5} />
                    <span
                      className="text-[#e5d3b3] text-[15px] font-semibold"
                      style={{ fontFamily: "var(--font-inter)" }}
                    >
                      {totalWanders}
                    </span>
                    <span
                      className="text-[#f4f4f5]/30 text-[10px] font-light"
                      style={{ fontFamily: "var(--font-inter)" }}
                    >
                      {totalWanders === 1 ? "wander" : "wanders"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2.5">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onPlanAnother}
                    className="w-full py-3.5 rounded-2xl bg-[#8ba88e] text-[#131316] text-[13px] font-semibold uppercase tracking-wider shadow-[0_0_24px_rgba(139,168,142,0.3)] hover:bg-[#97b59a] transition-colors flex items-center justify-center gap-2"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
                    plan another wander
                  </motion.button>
                  <button
                    onClick={onClose}
                    className="w-full py-2.5 rounded-2xl text-[#f4f4f5]/30 hover:text-[#f4f4f5]/60 text-[12px] font-medium transition-colors"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    keep exploring this route
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
