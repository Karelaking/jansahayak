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
 * Rendered when a citizen navigates to a municipal staff area. It explains the
 * boundary without internal policy references and points back to useful work.
 */
export function AccessDeniedBarrier({
  pageTitle,
  description = "This area is kept for municipal engineers, field officers, and moderators. Citizen accounts keep their own reports and the public map.",
}: AccessDeniedBarrierProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <Card className="max-w-md border border-[#cbd5cb] bg-[#faf9f5] text-center p-6 space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#dce8d9] text-[#17382f] border border-[#cbd5cb]">
          <ShieldAlert className="size-6 stroke-2" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <Badge
              variant="outline"
              className="border-[#cbd5cb] bg-[#f5f3ed] text-[11px] uppercase font-mono text-[#486057]"
            >
              Staff area
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-[#0e2b24] tracking-tight">
            {pageTitle} is for staff
          </h2>
          <p className="text-[13px] leading-relaxed text-[#486057]">{description}</p>
        </div>

        <CardContent className="p-0 pt-4 space-y-2 border-t border-[#eef1e9]">
          <div className="text-left text-[13px] text-[#5c6f66] space-y-1">
            <p className="font-semibold text-[#17382f]">What you can do as a citizen:</p>
            <ul className="list-disc pl-4 space-y-1 text-[12px]">
              <li>File a hazard report with its location attached</li>
              <li>Open and track the reports you submitted</li>
              <li>Confirm hazards reported near you</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              className="min-h-11 bg-[#0e2b24] text-[13px] text-[#f5f3ed] hover:bg-[#1c4b3e] sm:flex-1"
              render={<Link href="/dashboard/reports" />}
            >
              <FileText className="size-4" aria-hidden="true" />
              <span>Your reports</span>
            </Button>
            <Button
              variant="outline"
              className="min-h-11 border-[#cbd5cb] bg-white text-[13px] text-[#17382f] hover:bg-[#eef1e9] sm:flex-1"
              render={<Link href="/dashboard/map" />}
            >
              <MapPin className="size-4" aria-hidden="true" />
              <span>Open the map</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
