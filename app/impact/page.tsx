import * as React from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getPublicImpactSummary } from "@/lib/organizations";
import {
  TrendingUp,
  CheckCircle2,
  Building2,
  Users,
  ShieldCheck,
  Clock,
  ArrowLeft,
  Info,
  Scale,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const instant = false;

export default async function PublicImpactReportPage() {
  await connection();
  const summary = await getPublicImpactSummary();

  return (
    <div className="min-h-screen bg-[#f5f3ed] text-[#0e2b24] py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5c6f66] hover:text-[#0e2b24]"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Home</span>
          </Link>

          <Link
            href="/dashboard/organization"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0e2b24] px-3 py-1.5 text-xs font-semibold text-[#f5f3ed] hover:bg-[#1a4439]"
          >
            <Building2 className="size-3.5" />
            <span>Organization Portal</span>
          </Link>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-[#cbd5cb] bg-[#faf9f5] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5c6f66]">
              JanSahayak SafeStreets Platform Ledger
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24]">
              Public Civic Impact & Performance Report
            </h1>
            <p className="text-xs text-[#5c6f66] max-w-2xl mt-1 leading-relaxed">
              Transparent, deduplicated civic accountability tracking government action, corporate CSR partnerships,
              and verified citizen resolutions across Greater Noida.
            </p>
          </div>

          {/* Deduplication Invariant Banner */}
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50/70 p-3.5 text-xs text-emerald-900">
            <ShieldCheck className="size-4 shrink-0 text-emerald-700 mt-0.5" />
            <div>
              <strong>Deduplication Invariant Verified:</strong> Unique civic reports are counted once in platform
              totals, regardless of how many partners co-funded or executed the intervention.
            </div>
          </div>
        </div>

        {/* High-Level Overview Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-5 shadow-xs">
            <span className="text-[11px] font-semibold text-[#5c6f66]">Total Hazards Reported</span>
            <p className="mt-2 text-3xl font-bold text-[#0e2b24]">
              {summary.totalHazardsReported.toLocaleString("en-IN")}
            </p>
            <span className="text-[11px] text-[#5c6f66]">Citizen documented issues</span>
          </div>

          <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-5 shadow-xs">
            <span className="text-[11px] font-semibold text-emerald-700">Verified Unique Resolved</span>
            <p className="mt-2 text-3xl font-bold text-emerald-800">
              {summary.totalResolvedUnique.toLocaleString("en-IN")}
            </p>
            <span className="text-[11px] text-emerald-700">Multi-stage verified</span>
          </div>

          <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-5 shadow-xs">
            <span className="text-[11px] font-semibold text-[#5c6f66]">Private / CSR Deployed</span>
            <p className="mt-2 text-3xl font-bold text-[#0e2b24]">
              ₹{summary.totalPrivateEstimatedSpendInr.toLocaleString("en-IN")}
            </p>
            <span className="text-[11px] text-[#5c6f66]">Committed private capital</span>
          </div>

          <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-5 shadow-xs">
            <span className="text-[11px] font-semibold text-[#5c6f66]">Median Resolution Time</span>
            <p className="mt-2 text-3xl font-bold text-[#0e2b24]">
              {summary.medianResolutionDays} days
            </p>
            <span className="text-[11px] text-[#5c6f66]">Intake to verified consensus</span>
          </div>
        </div>

        {/* Resolution Breakdown: Government vs Private vs Joint */}
        <div className="rounded-2xl border border-[#cbd5cb] bg-[#faf9f5] p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-[#cbd5cb] pb-4">
            <h2 className="text-base font-bold text-[#0e2b24]">
              Attribution Breakdown (Fair & Deduplicated)
            </h2>
            <p className="mt-1 text-xs text-[#5c6f66]">
              Every resolved incident is categorized into a single mutually exclusive classification
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#cbd5cb] bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0e2b24]">Government-Led</span>
                <Badge variant="outline" className="border-blue-300 bg-blue-50 text-[10px] text-blue-900">
                  Municipal
                </Badge>
              </div>
              <p className="mt-3 text-2xl font-bold text-[#0e2b24]">
                {summary.governmentLedResolutions}
              </p>
              <p className="mt-1 text-[11px] text-[#5c6f66]">
                Resolved exclusively through statutory municipal works or GNIDA/PWD teams.
              </p>
            </div>

            <div className="rounded-xl border border-[#cbd5cb] bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0e2b24]">Private / CSR-Led</span>
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-900">
                  Corporate / NGO
                </Badge>
              </div>
              <p className="mt-3 text-2xl font-bold text-emerald-800">
                {summary.privateLedResolutions}
              </p>
              <p className="mt-1 text-[11px] text-[#5c6f66]">
                Funded or implemented by verified private organizations under municipal clearance.
              </p>
            </div>

            <div className="rounded-xl border border-[#cbd5cb] bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0e2b24]">Joint Co-Resolutions</span>
                <Badge variant="outline" className="border-purple-300 bg-purple-50 text-[10px] text-purple-900">
                  Public-Private
                </Badge>
              </div>
              <p className="mt-3 text-2xl font-bold text-purple-800">
                {summary.jointResolutions}
              </p>
              <p className="mt-1 text-[11px] text-[#5c6f66]">
                Co-funded or co-executed through structured public-private municipal cooperation.
              </p>
            </div>
          </div>

          {/* Contextual Transparency */}
          <div className="rounded-xl border border-[#e2dec9] bg-[#f2eee1] p-5 space-y-2 text-xs text-[#344c42]">
            <div className="flex items-center gap-2 font-bold text-[#0e2b24]">
              <Scale className="size-4" />
              <span>Contextual Transparency & Statutory Boundaries (PRD §31)</span>
            </div>
            <p className="leading-relaxed">
              Direct comparison between government and private resolution velocity must account for task complexity.
              Routine surface cleanups and minor repairs differ fundamentally from capital-intensive asphalt road rebuilding,
              drainage stormline civil reconstruction, and electrical grid substations which mandate statutory engineering inspections.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
