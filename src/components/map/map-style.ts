/**
 * Navigation-style map style for MapLibre GL JS.
 *
 * Uses OpenFreeMap (free, no API key, OSM-based vector tiles)
 * with a clean light navigation theme optimized for truck tracking.
 *
 * Road hierarchy: primary > secondary > tertiary > local
 * Route + truck markers remain the dominant visual elements.
 */
import type { StyleSpecification } from "maplibre-gl";

/** CleanTrack brand colours — kept in sync with CSS vars. */
export const MAP_COLORS = {
  brand: "#22C55E",
  brandDark: "#16a34a",
  brandSoft: "rgba(34, 197, 94, 0.15)",
  ink: "#0f172a",
  routeCasing: "#1e293b",
  routeFill: "#22C55E",
  routeProgress: "#16a34a",
  resident: "#3B82F6",
  residentGlow: "rgba(59, 130, 246, 0.15)",
  water: "#d4e6f1",
  park: "#e2f0d9",
  building: "#e8e8e5",
  background: "#f7f7f5",
  roadPrimary: "#ffffff",
  roadPrimaryCasing: "#d4d4d4",
  roadSecondary: "#ffffff",
  roadSecondaryCasing: "#e0e0de",
  roadLocal: "#ffffff",
  roadLocalCasing: "#ebebea",
  landuse: "#f0f0ed",
  label: "#555555",
  labelHalo: "#ffffff",
};

/**
 * Build the complete MapLibre style spec.
 * Uses OpenFreeMap tiles which are free, open source, and require no API key.
 */
export function buildNavStyle(): StyleSpecification {
  return {
    version: 8,
    name: "CleanTrack Navigation",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sprite: "https://tiles.openfreemap.org/sprites/liberty",
    sources: {
      openmaptiles: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
      },
    },
    layers: [
      // ── Background ──
      {
        id: "background",
        type: "background",
        paint: { "background-color": MAP_COLORS.background },
      },

      // ── Water ──
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        paint: { "fill-color": MAP_COLORS.water, "fill-opacity": 0.7 },
      },

      // ── Landuse (parks, forests) ──
      {
        id: "landuse-park",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landuse",
        filter: ["in", "class", "park", "grass", "cemetery"],
        paint: { "fill-color": MAP_COLORS.park, "fill-opacity": 0.5 },
      },
      {
        id: "landuse-other",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landuse",
        filter: ["!in", "class", "park", "grass", "cemetery"],
        paint: { "fill-color": MAP_COLORS.landuse, "fill-opacity": 0.3 },
      },

      // ── Buildings ──
      {
        id: "building",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-color": MAP_COLORS.building,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 0.5, 17, 0.7],
        },
      },

      // ── Roads: casing (outline) layers first, then fill layers ──

      // Local roads — casing
      {
        id: "road-local-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["all", ["in", "class", "minor", "service", "track", "path"]],
        minzoom: 14,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_COLORS.roadLocalCasing,
          "line-width": ["interpolate", ["linear"], ["zoom"], 14, 2, 18, 8],
        },
      },

      // Tertiary roads — casing
      {
        id: "road-tertiary-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["==", "class", "tertiary"],
        minzoom: 12,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_COLORS.roadSecondaryCasing,
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3, 18, 14],
        },
      },

      // Secondary roads — casing
      {
        id: "road-secondary-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["==", "class", "secondary"],
        minzoom: 10,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_COLORS.roadSecondaryCasing,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 18, 18],
        },
      },

      // Primary / trunk roads — casing
      {
        id: "road-primary-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "primary", "trunk"],
        minzoom: 8,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_COLORS.roadPrimaryCasing,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 18, 22],
        },
      },

      // Motorway — casing
      {
        id: "road-motorway-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["==", "class", "motorway"],
        minzoom: 6,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#c8c8c5",
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2, 18, 26],
        },
      },

      // ── Roads: fill layers (on top of casings) ──

      // Local roads — fill
      {
        id: "road-local",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["all", ["in", "class", "minor", "service", "track", "path"]],
        minzoom: 14,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_COLORS.roadLocal,
          "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1, 18, 6],
        },
      },

      // Tertiary roads — fill
      {
        id: "road-tertiary",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["==", "class", "tertiary"],
        minzoom: 12,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_COLORS.roadSecondary,
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2, 18, 12],
        },
      },

      // Secondary roads — fill
      {
        id: "road-secondary",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["==", "class", "secondary"],
        minzoom: 10,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_COLORS.roadSecondary,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 18, 16],
        },
      },

      // Primary / trunk roads — fill
      {
        id: "road-primary",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "primary", "trunk"],
        minzoom: 8,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_COLORS.roadPrimary,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 18, 20],
        },
      },

      // Motorway — fill
      {
        id: "road-motorway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["==", "class", "motorway"],
        minzoom: 6,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#f5f0e8",
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1, 18, 24],
        },
      },

      // ── Road labels ──
      {
        id: "road-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 13,
        layout: {
          "symbol-placement": "line",
          "text-field": "{name}",
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 18, 13],
          "text-max-angle": 30,
          "text-padding": 2,
        },
        paint: {
          "text-color": MAP_COLORS.label,
          "text-halo-color": MAP_COLORS.labelHalo,
          "text-halo-width": 1.5,
        },
      },

      // ── Place labels ──
      {
        id: "place-label-city",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: ["in", "class", "city", "town"],
        layout: {
          "text-field": "{name}",
          "text-font": ["Noto Sans Bold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 6, 12, 14, 20],
          "text-max-width": 10,
        },
        paint: {
          "text-color": MAP_COLORS.ink,
          "text-halo-color": MAP_COLORS.labelHalo,
          "text-halo-width": 2,
        },
      },
      {
        id: "place-label-village",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: ["in", "class", "village", "suburb", "neighbourhood"],
        minzoom: 12,
        layout: {
          "text-field": "{name}",
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10, 16, 14],
          "text-max-width": 8,
        },
        paint: {
          "text-color": "#777777",
          "text-halo-color": MAP_COLORS.labelHalo,
          "text-halo-width": 1.5,
        },
      },
    ],
  } as StyleSpecification;
}
