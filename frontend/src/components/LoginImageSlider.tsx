import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

import bannerImg from "@/assets/banner.png";
import cleanShirpurImg from "@/assets/clean-shirpur.jpg";
import swachhShirpurImg from "@/assets/swachh-shirpur.jpg";
import cleanTrackImg from "@/assets/clean-track.jpg";
import smartImg from "@/assets/smart.jpg";
import greenShirpurImg from "@/assets/greenshirpur.jpg";

interface Slide {
  id: string;
  src: string;
  caption: string;
}

const SLIDES: Slide[] = [
  { id: "banner", src: bannerImg, caption: "स्वच्छ शिरपूर · सुंदर शिरपूर" },
  { id: "clean-shirpur", src: cleanShirpurImg, caption: "Clean Shirpur Campaign" },
  { id: "swachh-shirpur", src: swachhShirpurImg, caption: "Swachh Bharat Shirpur" },
  { id: "green-shirpur", src: greenShirpurImg, caption: "Green Shirpur" },
  { id: "clean-track", src: cleanTrackImg, caption: "CleanTrack Live Fleet" },
  { id: "smart-shirpur", src: smartImg, caption: "Smart Sanitation Fleet" },
];

const INTERVAL_MS = 10_000; // 10 seconds

/**
 * Compact auto-sliding image carousel designed for the login page.
 * Cycles through Shirpur campaign photos every 10 seconds.
 */
export function LoginImageSlider() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  const goNext = useCallback(() => {
    setDirection(1);
    setIndex((prev) => (prev + 1) % SLIDES.length);
  }, []);

  const goTo = useCallback(
    (target: number) => {
      setDirection(target > index ? 1 : -1);
      setIndex(target);
    },
    [index],
  );

  // Auto-advance every 10 seconds
  useEffect(() => {
    const timer = setInterval(goNext, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [goNext]);

  const slide = SLIDES[index];

  return (
    <div className="w-full select-none">
      {/* Slider container with increased size to fill vacant space */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900 aspect-[16/11] min-h-[220px] max-h-[290px] shadow-lg border border-neutral-200/80">
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.div
            key={slide.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -80 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 w-full h-full"
          >
            {/* Image with subtle zoom */}
            <motion.img
              src={slide.src}
              alt={slide.caption}
              className="absolute inset-0 w-full h-full object-cover object-center will-change-transform"
              initial={{ scale: 1 }}
              animate={{ scale: 1.06 }}
              transition={{ duration: 7, ease: "easeOut" }}
              draggable={false}
            />

            {/* Bottom gradient overlay for caption readability */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />

            {/* Caption */}
            <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 z-10">
              <p className="text-white text-[11px] sm:text-xs font-semibold drop-shadow-sm truncate">
                {slide.caption}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dot indicators (top-right) */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 cursor-pointer ${
                i === index
                  ? "w-4 h-1.5 bg-white"
                  : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Progress bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] z-20">
          <motion.div
            key={`progress-${index}`}
            className="h-full bg-emerald-400/80 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: INTERVAL_MS / 1000, ease: "linear" }}
          />
        </div>
      </div>
    </div>
  );
}

export default LoginImageSlider;
