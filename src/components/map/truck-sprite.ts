/**
 * Renders truck marker sprites as canvas images for MapLibre GL.
 *
 * Each variant (online, offline, active) is rendered once to an offscreen
 * canvas and registered as a named image on the map instance.
 * MapLibre's symbol layer then handles GPU-accelerated rotation via
 * `icon-rotate` bound to each feature's heading property.
 */
import type { Map as MaplibreMap } from "maplibre-gl";
import { MAP_COLORS } from "./map-style";

const SPRITE_SIZE = 64;     // px (high-DPI: rendered at 2x)
const SPRITE_SCALE = 2;     // device pixel ratio for crisp rendering

type Variant = "online" | "offline" | "active";

/** Draw the garbage truck silhouette on a canvas context. */
function drawTruck(ctx: CanvasRenderingContext2D, variant: Variant) {
  const s = SPRITE_SIZE * SPRITE_SCALE;
  const cx = s / 2;

  // Scale everything relative to sprite size
  const scale = s / 64;

  ctx.save();
  ctx.translate(cx, s / 2);
  ctx.scale(scale, scale);

  const isOffline = variant === "offline";
  const isActive = variant === "active";

  // ── Active glow ring ──
  if (isActive) {
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fillStyle = MAP_COLORS.brandSoft;
    ctx.fill();
    ctx.strokeStyle = MAP_COLORS.brand;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ── Shadow ──
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 22, 12, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fill();
  ctx.restore();

  // ── Heading arrow (pointing up = north) ──
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(-6, -18);
  ctx.lineTo(6, -18);
  ctx.closePath();
  ctx.fillStyle = isOffline ? "#94a3b8" : MAP_COLORS.brand;
  ctx.fill();

  // ── Truck body (tipper — rear section) ──
  const bodyColor = isOffline ? "#94a3b8" : MAP_COLORS.brand;
  ctx.beginPath();
  roundRect(ctx, -11, -8, 22, 24, 3);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = MAP_COLORS.ink;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Inner compartment lines
  ctx.strokeStyle = isOffline ? "#64748b" : MAP_COLORS.brandDark;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.lineTo(8, 2);
  ctx.moveTo(-8, 8);
  ctx.lineTo(8, 8);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── Cab (white, front section) ──
  ctx.beginPath();
  roundRect(ctx, -10, -20, 20, 14, 3);
  ctx.fillStyle = isOffline ? "#cbd5e1" : "#ffffff";
  ctx.fill();
  ctx.strokeStyle = MAP_COLORS.ink;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Windshield
  ctx.beginPath();
  roundRect(ctx, -7, -18, 14, 5, 1.5);
  ctx.fillStyle = isOffline ? "#94a3b8" : "#334155";
  ctx.globalAlpha = 0.6;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Headlights
  ctx.beginPath();
  ctx.arc(-6, -19, 1.2, 0, Math.PI * 2);
  ctx.arc(6, -19, 1.2, 0, Math.PI * 2);
  ctx.fillStyle = isOffline ? "#94a3b8" : "#fde68a";
  ctx.fill();

  // ── Wheels ──
  const wheelColor = MAP_COLORS.ink;
  // Front wheels
  roundRect(ctx, -13, -16, 4, 7, 1.5);
  ctx.fillStyle = wheelColor;
  ctx.fill();
  roundRect(ctx, 9, -16, 4, 7, 1.5);
  ctx.fillStyle = wheelColor;
  ctx.fill();
  // Rear wheels
  roundRect(ctx, -13, 4, 4, 9, 1.5);
  ctx.fillStyle = wheelColor;
  ctx.fill();
  roundRect(ctx, 9, 4, 4, 9, 1.5);
  ctx.fillStyle = wheelColor;
  ctx.fill();

  // ── Online indicator dot ──
  if (!isOffline) {
    ctx.beginPath();
    ctx.arc(10, -18, 3, 0, Math.PI * 2);
    ctx.fillStyle = MAP_COLORS.brand;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  ctx.restore();
}

/** Helper: draw a rounded rectangle path. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Image name used for MapLibre's addImage / symbol-layer icon-image. */
export function truckImageName(variant: Variant): string {
  return `ct-truck-${variant}`;
}

/** Register all truck sprite variants on the map. Call once after map loads. */
export function registerTruckSprites(map: MaplibreMap) {
  const variants: Variant[] = ["online", "offline", "active"];
  const size = SPRITE_SIZE * SPRITE_SCALE;

  for (const v of variants) {
    const name = truckImageName(v);
    if (map.hasImage(name)) continue;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    drawTruck(ctx, v);

    // createImageBitmap is async but addImage needs ImageData — use getImageData
    const imageData = ctx.getImageData(0, 0, size, size);

    map.addImage(name, imageData, { pixelRatio: SPRITE_SCALE });
  }
}
