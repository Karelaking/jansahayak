"use client";

import { useState, useEffect, useRef } from "react";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  MapControls,
  useMap,
  type MapRef,
} from "@/components/ui/map";
import { GREATER_NOIDA_CENTER, RECENT_HAZARDS } from "@/lib/data/mock-hazards";
import { HazardPin } from "./hazard-pin";

// Dynamically skin MapLibre vector layers to match the JanSahayak project theme:
// Webpage Paper: #f5f3ed
// Project Sage:  #dce8d9 / #d2dfd1 (water and nature)
function MapThemeCustomizer() {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    const currentMap = map;

    function applyTheme(m: NonNullable<typeof map>) {
      try {
        // Match map background to webpage background (#f5f3ed Paper)
        if (m.getLayer("background")) {
          m.setPaintProperty("background", "background-color", "#f5f3ed");
        }
        // Tint water bodies in the project's Sage color
        if (m.getLayer("water")) {
          m.setPaintProperty("water", "fill-color", "#d2dfd1");
        }
        if (m.getLayer("waterway")) {
          m.setPaintProperty("waterway", "line-color", "#c0d4bf");
        }
        // Tint parks and green spaces in soft sage
        if (m.getLayer("park_national_park")) {
          m.setPaintProperty("park_national_park", "fill-color", "#e2ede0");
        }
        if (m.getLayer("park_nature_reserve")) {
          m.setPaintProperty("park_nature_reserve", "fill-color", "#e2ede0");
        }
        // Landcover and residential in subtle warm tones
        if (m.getLayer("landcover")) {
          m.setPaintProperty("landcover", "fill-color", "#edeae1");
        }
        if (m.getLayer("landuse_residential")) {
          m.setPaintProperty("landuse_residential", "fill-color", "#f0ece3");
        }
        if (m.getLayer("landuse")) {
          m.setPaintProperty("landuse", "fill-color", "#ebe8df");
        }
        // Buildings in gentle paper-tint
        if (m.getLayer("building")) {
          m.setPaintProperty("building", "fill-color", "#eae6dc");
        }
        if (m.getLayer("building-top")) {
          m.setPaintProperty("building-top", "fill-color", "#efece4");
        }
      } catch (err) {
        console.warn("Theme tinting:", err);
      }
    }

    applyTheme(currentMap);
    const onStyleLoad = () => applyTheme(currentMap);
    currentMap.on("style.load", onStyleLoad);
    return () => {
      currentMap.off("style.load", onStyleLoad);
    };
  }, [map, isLoaded]);

  return null;
}

export function LiveHazardMap() {
  const mapRef = useRef<MapRef | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        className="relative flex h-[calc(100dvh-80px)] min-h-150 w-full items-center justify-center bg-[#f5f3ed]"
        aria-label="Loading map"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-8 animate-spin rounded-full border-2 border-[#17382f] border-t-transparent" />
          <p className="text-sm font-semibold text-[#0e2b24]">
            Loading Greater Noida Live Safety Map...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group/hero-map relative h-[calc(100dvh-80px)] min-h-150 w-full overflow-hidden bg-[#f5f3ed]"
      id="map"
      aria-label="Interactive Live Map of road-safety hazards in Greater Noida"
    >
      {/* ── FULL-BLEED MAP CANVAS (Spans entire hero section) ── */}
      <Map
        ref={mapRef}
        center={GREATER_NOIDA_CENTER}
        zoom={13.6}
        pitch={44}
        bearing={-16}
        maxPitch={75}
        theme="light"
        className="size-full"
      >
        {/* Dynamic theme matching to webpage #f5f3ed Paper background */}
        <MapThemeCustomizer />

        {/* Minimal clean zoom controls tucked in bottom-right */}
        <MapControls
          position="bottom-right"
          showZoom
          showCompass={false}
          showLocate
          showFullscreen={false}
          className="bottom-6 right-6"
        />

        {/* Live hazard markers on the map */}
        {RECENT_HAZARDS.map((hazard) => (
          <MapMarker key={hazard.id} longitude={hazard.longitude} latitude={hazard.latitude}>
            <MarkerContent>
              <HazardPin severity={hazard.severity} />
            </MarkerContent>

            {/* Hover tooltip for quick glance */}
            <MarkerTooltip className="text-[11px] font-medium">
              {hazard.title} ({hazard.reportedAt})
            </MarkerTooltip>

            {/* Click popup anchored to the pin */}
            <MarkerPopup>
              <div className="w-64 rounded-lg bg-white p-3 text-[#17382f] shadow-xl">
                <div className="flex items-center justify-between text-[10px] text-[#63736b]">
                  <span className="font-mono font-semibold text-[#0e2b24]">{hazard.id}</span>
                  <span>{hazard.reportedAt}</span>
                </div>
                <p className="mt-1 font-semibold text-xs text-[#0e2b24]">{hazard.title}</p>
                <p className="mt-0.5 text-[11px] text-[#486057]">{hazard.landmark}</p>
                <div className="mt-2.5 flex items-center justify-between border-t border-[#eef1e9] pt-1.5 text-[10px]">
                  <span className="font-medium text-[#78a37d]">
                    ✓ {hazard.verificationsCount} verified
                  </span>
                  <span className="text-[#63736b]">{hazard.statusLabel}</span>
                </div>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </Map>

      {/* ── HERO TEXT OVERLAY (Non-blocking: pointer-events-none) ── */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 select-none sm:p-10 lg:p-14">
        {/* Top-Left Hero Title & Narrative (Completely transparent background) */}
        <div className="max-w-xl bg-transparent p-0 shadow-none border-0">
          <h1 className="hero-overlay-shadow font-heading text-3xl font-bold tracking-tight text-[#0e2b24] sm:text-5xl lg:text-6xl leading-[0.95]">
            Safer streets
            <br />
            <span className="text-[#1c4737] font-medium">start with us.</span>
          </h1>

          <p className="hero-overlay-shadow-subtle mt-3.5 max-w-lg text-sm sm:text-base font-medium leading-relaxed text-[#14352b]">
            A live civic map documenting road-safety hazards across Greater Noida. Spot an unsafe
            area, explore verified community reports, and follow the recorded path towards a fix.
          </p>
        </div>

        {/* Bottom-Left subtle tip (also pointer-events-none) */}
        <div className="hero-overlay-shadow-subtle text-[11px] font-medium text-[#2d5246]">
          Interactive map · Click any pin to inspect verified community reports
        </div>
      </div>
    </div>
  );
}
