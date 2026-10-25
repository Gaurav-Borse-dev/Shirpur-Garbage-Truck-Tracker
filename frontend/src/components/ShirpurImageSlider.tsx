import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import buildingImg from "@/assets/shirpur-nagarparishad-building.jpg";
import compactorFleetImg from "@/assets/shirpur-compactor-fleet.jpg";
import intraCollectionImg from "@/assets/shirpur-intra-collection.jpg";
import segregatedTruckImg from "@/assets/shirpur-segregated-truck.jpg";
import compactorLoadingImg from "@/assets/shirpur-compactor-loading.jpg";

interface Slide {
  id: string;
  src: string;
  alt: string;
}

const SLIDES: Slide[] = [
  {
    id: "building",
    src: buildingImg,
    alt: "Shirpur Warwade Nagarparishad Headquarters",
  },
  {
    id: "compactor-fleet",
    src: compactorFleetImg,
    alt: "Shirpur Sanitation Fleet and Workers",
  },
  {
    id: "intra-collection",
    src: intraCollectionImg,
    alt: "Shirpur Tata Intra Door-to-Door Waste Collection",
  },
  {
    id: "segregated-truck",
    src: segregatedTruckImg,
    alt: "Shirpur Segregated Dry and Wet Waste Vehicle",
  },
  {
    id: "compactor-loading",
    src: compactorLoadingImg,
    alt: "Shirpur Waste Compactor Truck in Action",
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
    <section className="w-full py-6 px-4 max-w-6xl mx-auto select-none">
      {/* Slider Container */}
      <div
        className="
    relative
    overflow-hidden
    rounded-3xl
    shadow-lg
    border-4
    border-emerald-400
    bg-neutral-900
    group
    aspect-[16/10]
    min-h-[220px]
    max-h-[420px]
    sm:max-h-[500px]
    md:max-h-[600px]
    h-[260px]
    sm:h-[300px]
    md:h-[360px]
"

        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={SLIDES[currentIndex].id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <img
              src={SLIDES[currentIndex].src}
              alt={SLIDES[currentIndex].alt}
              className="
 absolute
 inset-0
 w-full
 h-full
 object-cover
 object-center
 bg-neutral-900
 "
            />
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <button
          onClick={handlePrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/40 hover:bg-black/70 text-white grid place-items-center backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label="Previous Slide"
        >
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <button
          onClick={handleNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/40 hover:bg-black/70 text-white grid place-items-center backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label="Next Slide"
        >
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
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
