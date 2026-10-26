"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
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
import { ArrowRight, ArrowUpRight } from "@/components/icons";
import { Plus, Check, ThumbsUp } from "lucide-react";
import { GREATER_NOIDA_CENTER } from "@/lib/data";
import type { HazardReport, HazardCategoryKey } from "@/lib/types/hazard";
import { HazardPin } from "./hazard-pin";
import { MapCategoryFilter } from "./map-category-filter";

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
          m.setPaintProperty("landcover", "fill-color", "#f1efe8");
        }
        // Primary and secondary roads in crisp readable graphite
        if (m.getLayer("road_motorway")) {
          m.setPaintProperty("road_motorway", "line-color", "#c8c3b5");
        }
        if (m.getLayer("road_primary")) {
          m.setPaintProperty("road_primary", "line-color", "#d2cdc0");
        }
        if (m.getLayer("road_secondary")) {
          m.setPaintProperty("road_secondary", "line-color", "#ddd8cb");
        }
        // Buildings in light paper tint
        if (m.getLayer("building")) {
          m.setPaintProperty("building", "fill-color", "#ebe7dc");
          m.setPaintProperty("building", "fill-outline-color", "#dfdacd");
        }
      } catch {
        // Map layers might still be loading; fail gracefully
      }
    }

    if (currentMap.isStyleLoaded()) {
      applyTheme(currentMap);
    } else {
      currentMap.once("style.load", () => applyTheme(currentMap));
    }
  }, [map, isLoaded]);

  return null;
}

export interface LiveHazardMapProps {
  hazards?: HazardReport[];
  showHeroOverlay?: boolean;
}

export function LiveHazardMap({ hazards = [], showHeroOverlay = true }: LiveHazardMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<HazardCategoryKey | "all">("all");
  const [liveHazards, setLiveHazards] = useState<HazardReport[]>(hazards);
  const [votedIncidents, setVotedIncidents] = useState<Record<string, boolean>>({});
  const [votingLoading, setVotingLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsMounted(true);
    let active = true;

    try {
      const stored = localStorage.getItem("jansahayak_voted_incidents");
      if (stored) {
        setVotedIncidents(JSON.parse(stored));
      }
    } catch {
      // localStorage may fail in private mode or SSR
    }

    async function fetchLiveIncidents() {
      try {
        const res = await fetch("/api/map/incidents");
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.success && Array.isArray(data.incidents)) {
          setLiveHazards(data.incidents);
        }
      } catch (err) {
        console.warn("Public map fetch error:", err);
      }
    }

    fetchLiveIncidents();
    return () => {
      active = false;
    };
  }, []);

  const handleVote = async (incidentId: string) => {
    if (votedIncidents[incidentId] || votingLoading[incidentId]) return;
    setVotingLoading((prev) => ({ ...prev, [incidentId]: true }));
    try {
      const res = await fetch(`/api/incidents/${incidentId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voteType: "verify_hazard",
          isLocalResident: true,
          wantsUpdates: false,
        }),
      });
      if (res.ok) {
        setVotedIncidents((prev) => {
          const updated = { ...prev, [incidentId]: true };
          try {
            localStorage.setItem("jansahayak_voted_incidents", JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });
        setLiveHazards((prev) =>
          prev.map((h) =>
            h.id === incidentId
              ? {
                  ...h,
                  verificationsCount: (h.verificationsCount || h.votes || 1) + 1,
                  votes: (h.votes || 1) + 1,
                }
              : h,
          ),
        );
      }
    } catch (err) {
      console.warn("Vote recording error:", err);
    } finally {
      setVotingLoading((prev) => ({ ...prev, [incidentId]: false }));
    }
  };

  const filteredHazards = liveHazards.filter(
    (h) => selectedCategory === "all" || h.category === selectedCategory,
  );

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
        {filteredHazards.map((hazard) => (
          <MapMarker key={hazard.id} longitude={hazard.longitude} latitude={hazard.latitude}>
            <MarkerContent>
              <HazardPin severity={hazard.severity} />
            </MarkerContent>

            {/* Hover tooltip for quick glance */}
            <MarkerTooltip className="text-[11px] font-medium">
              {hazard.title} ({hazard.reportedAt || hazard.time || "Recently"})
            </MarkerTooltip>

            {/* Click popup anchored to the pin */}
            <MarkerPopup>
              <div className="w-72 rounded-xl bg-white p-3.5 text-[#17382f] shadow-2xl border border-[#e5e9e2]">
                <div className="flex items-center justify-between text-[10px] text-[#63736b]">
                  <span className="font-mono font-semibold text-[#0e2b24]">{hazard.id}</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${
                      hazard.publicOpinionStatus === "community_resolved"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : hazard.publicOpinionStatus === "public_disputed"
                          ? "bg-amber-50 text-amber-900 border-amber-200"
                          : hazard.publicOpinionStatus === "under_repair"
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : "bg-[#eaf1e9] text-[#1e4638] border-[#c5d8c3]"
                    }`}
                  >
                    {hazard.publicOpinionStatus === "community_resolved"
                      ? "Community Resolved"
                      : hazard.publicOpinionStatus === "public_disputed"
                        ? "Public Disputed"
                        : hazard.publicOpinionStatus === "under_repair"
                          ? "Under Repair"
                          : "Community Verified"}
                  </span>
                </div>
                <p className="mt-1.5 font-semibold text-xs leading-snug text-[#0e2b24]">
                  {hazard.title}
                </p>
                <p className="mt-0.5 text-[11px] text-[#486057]">
                  {hazard.landmark || hazard.location}
                </p>

                {/* Community Verification & Public Opinion Bar */}
                <div className="mt-2.5 rounded-lg bg-[#fafbf9] border border-[#ebeee8] p-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#17382f] flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      {hazard.verificationsCount || hazard.votes || 1} local verifications
                    </span>
                    {hazard.resolutionVotesCount !== undefined &&
                      hazard.resolutionVotesCount > 0 && (
                        <span className="text-[10px] text-[#486057] font-medium">
                          {hazard.resolutionVotesCount} fixed / {hazard.unresolvedVotesCount || 0}{" "}
                          open
                        </span>
                      )}
                  </div>

                  {/* 1-click citizen verification */}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={votedIncidents[hazard.id] || votingLoading[hazard.id]}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(hazard.id);
                      }}
                      className={`w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md text-[11px] font-semibold transition-all ${
                        votedIncidents[hazard.id]
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default"
                          : "bg-[#0e2b24] text-[#faf9f5] hover:bg-[#1c4b3e] active:scale-95 shadow-xs"
                      }`}
                    >
                      {votingLoading[hazard.id] ? (
                        <span>Recording...</span>
                      ) : votedIncidents[hazard.id] ? (
                        <>
                          <Check className="size-3.5 stroke-[2.5]" />
                          <span>You Verified This Hazard (+1)</span>
                        </>
                      ) : (
                        <>
                          <ThumbsUp className="size-3 stroke-[2.2]" />
                          <span>I See This Too (+1)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-[#eef1e9] pt-2 text-[10px]">
                  <span className="text-[#63736b]">
                    {hazard.reportedAt || hazard.time || "Recently"}
                  </span>
                  <Link
                    href={`/reports/${hazard.id}`}
                    className="font-semibold text-[#0e2b24] underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-0.5"
                  >
                    <span>Community Progress &rarr;</span>
                  </Link>
                </div>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </Map>

      {/* ── Floating Controls for Dedicated Map View ── */}
      {!showHeroOverlay && (
        <>
          <div className="pointer-events-auto absolute top-3 inset-x-3 z-20 flex flex-col gap-2 sm:top-4 sm:left-4 sm:right-auto sm:max-w-md">
            <div className="flex items-center justify-between gap-2 bg-[#faf9f5]/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#cbd5cb] shadow-xs">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0e2b24]">
                <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
                Greater Noida Live Safety Map
              </span>
              <span className="text-[10px] font-mono text-[#5c6f66]">
                {filteredHazards.length} Incidents
              </span>
            </div>
            <div className="bg-[#faf9f5]/95 backdrop-blur-md rounded-2xl p-1 border border-[#cbd5cb] shadow-sm">
              <MapCategoryFilter
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>
          </div>

          <div className="pointer-events-auto absolute bottom-4 left-4 z-20 hidden sm:block">
            <Link
              href="/reports/new"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#0e2b24] text-[#faf9f5] font-semibold text-xs shadow-lg hover:bg-[#1c4b3e] active:scale-95 transition-all"
            >
              <Plus className="size-4 stroke-[2.5]" />
              <span>Report at Current Location</span>
            </Link>
          </div>
        </>
      )}

      {/* ── Empty Map State Notice when no hazards are mapped ── */}
      {filteredHazards.length === 0 && (
        <div className="pointer-events-auto absolute bottom-8 left-8 z-20 rounded-lg border border-border/80 bg-background/95 p-4 shadow-lg backdrop-blur-xs max-w-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-2 rounded-full bg-emerald-500 mt-1.5" />
            <div>
              <p className="text-xs font-semibold text-foreground">Greater Noida Pilot Ready</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                No active hazards currently match this category filter.
              </p>
              <Link
                href="/reports/new"
                className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <span>Report a hazard in this category</span>
                <span className="size-3.5 inline-flex items-center">
                  <ArrowUpRight />
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── HERO TEXT OVERLAY (Non-blocking: pointer-events-none) ── */}
      {showHeroOverlay && (
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

            {/* Report + explore actions — the two ways in, equally findable */}
            <div className="pointer-events-auto mt-5 flex flex-wrap items-center gap-3">
              <Link className="nav-cta" href="/reports/new">
                <span className="nav-cta-label">Report a hazard</span>
                <span className="nav-cta-icon-track" aria-hidden="true">
                  <span className="nav-cta-icon">
                    <span className="nav-cta-arrow nav-cta-arrow-launch">
                      <ArrowUpRight />
                    </span>
                    <span className="nav-cta-arrow nav-cta-arrow-continue">
                      <ArrowRight />
                    </span>
                  </span>
                </span>
              </Link>
              <Link className="hero-pill-secondary" href="/#how-it-works">
                How it works
              </Link>
            </div>
          </div>

          {/* Bottom-Left subtle tip (also pointer-events-none) */}
          <div className="hero-overlay-shadow-subtle text-[11px] font-medium text-[#2d5246]">
            Interactive map · Click any pin to inspect verified community reports
          </div>
        </div>
      )}
    </div>
  );
}
