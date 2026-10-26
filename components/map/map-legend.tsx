"use client";

import React from "react";

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-[#cbd5cb] bg-white/95 px-3 py-1.5 text-[10px] text-[#486057] shadow-xs backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[#e4876f]" />
        <span>Critical</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[#e7b64f]" />
        <span>Moderate</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[#059669]" />
        <span>Community Resolved</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[#e11d48] animate-pulse" />
        <span className="font-medium text-rose-800">Citizen Disputed</span>
      </div>
    </div>
  );
}
