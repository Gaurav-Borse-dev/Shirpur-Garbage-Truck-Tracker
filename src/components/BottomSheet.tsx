import { motion, useMotionValue, animate, type PanInfo } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Draggable bottom sheet with two snap points:
 *  - expanded (y = 0, full content visible)
 *  - collapsed (only the header row + handle peek above the bottom edge)
 * Drag the handle or anywhere on the sheet vertically to switch states.
 */
export function BottomSheet({
  children,
  springKey,
  peekHeight = 132,
}: {
  children: ReactNode;
  springKey?: string | number;
  peekHeight?: number;
}) {
  const y = useMotionValue(80);
  const ref = useRef<HTMLDivElement>(null);
  const [collapsedY, setCollapsedY] = useState(0);
  const [expanded, setExpanded] = useState(true);

  // Measure sheet height so collapsed state leaves `peekHeight` visible.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const h = el.getBoundingClientRect().height;
      setCollapsedY(Math.max(0, h - peekHeight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [peekHeight]);

  // Animate to current snap whenever it changes.
  useEffect(() => {
    const target = expanded ? 0 : collapsedY;
    const controls = animate(y, target, { type: "spring", stiffness: 320, damping: 32 });
    return controls.stop;
  }, [expanded, collapsedY, y]);

  // Re-play mount animation when springKey changes.
  useEffect(() => {
    y.set(80);
    const controls = animate(y, expanded ? 0 : collapsedY, {
      type: "spring",
      stiffness: 320,
      damping: 30,
    });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [springKey]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const current = y.get();
    const mid = collapsedY / 2;
    const fast = Math.abs(info.velocity.y) > 500;
    const shouldCollapse = fast ? info.velocity.y > 0 : current > mid;
    setExpanded(!shouldCollapse);
  };

  return (
    <motion.div
      ref={ref}
      style={{ y }}
      drag="y"
      dragConstraints={{ top: 0, bottom: collapsedY }}
      dragElastic={0.08}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      className="absolute left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.08)] z-[600] touch-none"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
        aria-label={expanded ? "Collapse details" : "Expand details"}
      >
        <div className="w-10 h-1.5 rounded-full bg-neutral-300" />
      </button>
      {children}
    </motion.div>
  );
}