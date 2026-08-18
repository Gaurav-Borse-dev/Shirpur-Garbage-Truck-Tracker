import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import cleanShirpurImg from "@/assets/clean-shirpur.jpg";
import swachhShirpurImg from "@/assets/swachh-shirpur.jpg";
import cleanTrackImg from "@/assets/clean-track.jpg";
import smartImg from "@/assets/smart.jpg";

interface Slide {
  id: string;
  src: string;
  title: string;
  subtitle: string;
  badge: string;
}

const SLIDES: Slide[] = [
  {
    id: "clean-shirpur",
    src: cleanShirpurImg || "/clean-shirpur.jpg",
    title: "Clean Shirpur Campaign",
    subtitle: "Keeping our city streets green & spotless",
    badge: "Shirpur Nagarparishad",
  },
  {
    id: "swachh-shirpur",
    src: swachhShirpurImg || "/swachh-shirpur.jpg",
    title: "Swachh Bharat Shirpur",
    subtitle: "Segregated waste collection across all wards",
    badge: "Swachh Abhiyan",
  },
  {
    id: "clean-track",
    src: cleanTrackImg || "/clean-track.jpg",
    title: "CleanTrack Live Fleet",
    subtitle: "Real-time municipal waste truck monitoring",
    badge: "Smart Tracking",
  },
  {
    id: "smart-shirpur",
    src: smartImg || "/smart.jpg",
    title: "Smart Sanitation Fleet",
    subtitle: "Automated waste management & clean city drive",
    badge: "Municipal Sanitation",
  },
];

export function ShirpurImageSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % SLIDES.length);
    }, 3500);

    return () => clearInterval(timer);
  }, [isPaused]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % SLIDES.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  return (
    <section className="w-full py-3 px-4 max-w-6xl mx-auto select-none">
      {/* Slider Container */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-lg border border-neutral-100 bg-neutral-900 group aspect-[16/9] sm:aspect-[21/9] max-h-[300px] sm:max-h-[360px] md:max-h-[400px]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={SLIDES[currentIndex].id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 w-full h-full"
          >
            {/* Background Image */}
            <img
              src={SLIDES[currentIndex].src}
              alt={SLIDES[currentIndex].title}
              className="w-full h-full object-cover object-center"
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            {/* Content Text Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white z-10 flex flex-col justify-end">
              <span className="inline-block self-start px-2.5 py-0.5 mb-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-emerald-600/90 text-white rounded-full backdrop-blur-md">
                {SLIDES[currentIndex].badge}
              </span>
              <h3 className="text-base sm:text-xl font-bold tracking-tight text-white drop-shadow-sm">
                {SLIDES[currentIndex].title}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-200 mt-0.5 line-clamp-1 opacity-90">
                {SLIDES[currentIndex].subtitle}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <button
          onClick={handlePrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/40 hover:bg-black/70 text-white grid place-items-center backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label="Previous Slide"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={handleNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/40 hover:bg-black/70 text-white grid place-items-center backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label="Next Slide"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Dots Pagination Indicator */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
          {SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setCurrentIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentIndex ? "w-5 bg-white" : "w-1.5 bg-white/40"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default ShirpurImageSlider;
