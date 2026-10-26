"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldAlert, FileText, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AccessDeniedBarrierProps {
  pageTitle: string;
  requiredTier?: string;
  description?: string;
}

/**
 * AccessDeniedBarrier
 *
 * Rendered when a civilian reporter navigates to a municipal staff docket
 * (e.g. Moderation, Escalations, PRD Pipeline). Respects PRD §2 & §14B
 * role boundaries without throwing uncaught exceptions.
 */
export function AccessDeniedBarrier({
  pageTitle,
  requiredTier = "Staff Moderator or Civic Admin",
  description = "This internal civic docket is reserved for municipal authority officers, field engineers, and verified administrators.",
}: AccessDeniedBarrierProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <Card className="max-w-md border border-[#cbd5cb] bg-[#faf9f5] shadow-xs text-center p-6 space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-900 border border-amber-300">
          <ShieldAlert className="size-6 stroke-[2]" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <Badge
              variant="outline"
              className="border-amber-400 bg-amber-50 text-[10px] uppercase font-mono text-amber-900"
            >
              Clearance: {requiredTier}
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-[#0e2b24] tracking-tight">
            {pageTitle} Restricted
          </h2>
          <p className="text-xs text-[#486057] leading-relaxed">{description}</p>
        </div>

        <CardContent className="p-0 pt-2 space-y-2">
          <div className="rounded-lg bg-[#f5f3ed] border border-[#eef1e9] p-3 text-left text-xs text-[#5c6f66] space-y-1">
            <p className="font-semibold text-[#17382f]">
              Civilian Transparency Rights (PRD §2 &amp; §14B):
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              <li>Submit roadway hazard reports with geotagged evidence</li>
              <li>Inspect and manage your submitted reports</li>
              <li>Cast 500m community quorum verification votes</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              className="flex-1 bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed] text-xs h-9"
              render={<Link href="/dashboard/reports" />}
            >
              <FileText className="size-3.5 mr-1" />
              <span>Go to My Reports</span>
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-[#cbd5cb] text-[#17382f] text-xs h-9 hover:bg-[#eef1e9]"
              render={<Link href="/dashboard/map" />}
            >
              <MapPin className="size-3.5 mr-1 text-emerald-800" />
              <span>Explore Safety Map</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
