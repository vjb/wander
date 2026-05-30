"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TaglineItem {
  text: string;
  highlight?: string;
  suffix?: string;
}

const TAGLINES: TaglineItem[] = [
  { text: "the shortest path isn't the ", highlight: "point" },
  { text: "stop commuting, start ", highlight: "wandering" },
  { text: "don't just walk there... ", highlight: "wander" },
  { text: "discover the ", highlight: "spaces", suffix: " between destinations" },
  { text: "curated routes for the ", highlight: "curious", suffix: " walker" },
  { text: "experience the city at ", highlight: "walking", suffix: " speed" },
  { text: "your city, ", highlight: "perfectly", suffix: " paced" },
  { text: "wander with ", highlight: "intention" },
];

export function RotatingTagline() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % TAGLINES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const current = TAGLINES[index];

  return (
    <div className="h-[100px] md:h-[150px] overflow-hidden flex items-center justify-center max-w-2xl mx-auto mb-10 px-4">
      <AnimatePresence mode="wait">
        <motion.h1
          key={index}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -24, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="text-[2.2rem] md:text-[3.5rem] leading-[1.1] font-semibold text-[#f4f4f5] text-center"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          {current.text}
          {current.highlight && (
            <em className="text-[#8ba88e] not-italic font-semibold">
              {current.highlight}
            </em>
          )}
          {current.suffix && <span>{current.suffix}</span>}
        </motion.h1>
      </AnimatePresence>
    </div>
  );
}
