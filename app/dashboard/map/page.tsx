"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";

import { LiveHazardMap } from "@/components/map";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function DashboardMapPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#0e2b24]">
              Geospatial Operations Map
            </h1>
            <Badge
              variant="outline"
              className="bg-[#d6e5d2] text-[#234a29] border-[#cbd5cb] text-[11px] font-mono font-medium"
            >
              Live Published Incidents
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-[#5c6f66] leading-relaxed">
            Geotagged hazards, pedestrian accident risk hotspots, and repair cluster mapping.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 flex-1 sm:flex-none h-9 sm:h-8 text-xs justify-center border-[#cbd5cb] bg-white text-[#17382f] hover:bg-[#e9efe8]"
            render={<Link href="/map" />}
          >
            <span>Full-Screen Map</span>
            <ExternalLink className="size-3.5" />
          </Button>

          <Button
            size="sm"
            className="flex-1 sm:flex-none h-9 sm:h-8 text-xs font-medium justify-center bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed]"
            render={<Link href="/reports/new" />}
          >
            <Plus className="size-3.5 mr-1" />
            <span>Pin Hazard</span>
          </Button>
        </div>
      </div>

      {/* ── Map Container Card ─── */}
      <Card className="overflow-hidden shadow-xs border-[#cbd5cb] bg-[#faf9f5]">
        <CardHeader className="border-b border-[#cbd5cb] pb-3 p-4 sm:p-6 bg-[#faf9f5]">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-[#0e2b24]">
                Greater Noida Road Safety Radar
              </CardTitle>
              <CardDescription className="text-xs text-[#5c6f66]">
                Interactive tiles centered on Pari Chowk and Knowledge Park corridor.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="relative h-[55vh] sm:h-[62vh] md:h-[640px] min-h-[380px] w-full">
            <LiveHazardMap showHeroOverlay={false} />
          </div>
        </CardContent>

        <CardFooter className="border-t border-[#cbd5cb] px-4 py-3 sm:px-6 bg-[#f5f3ed]/60 text-xs text-[#486057]">
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <span className="text-[11px] sm:text-xs text-[#5c6f66]">
              Click any pin to inspect incident history and authority dispatch status.
            </span>
            <div className="flex items-center gap-3 text-[11px] sm:text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#8c2e1b]" />
                <span className="font-medium text-[#8c2e1b]">High Urgency</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#7a540b]" />
                <span className="font-medium text-[#7a540b]">Medium Urgency</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#234a29]" />
                <span className="font-medium text-[#234a29]">Resolved</span>
              </span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
