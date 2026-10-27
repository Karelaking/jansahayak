import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublicResolutionDossier } from "@/lib/organizations";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  MapPin,
  ArrowLeft,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ResolutionVotingWidget } from "./voting-widget";

export const instant = false;

export default async function PublicResolutionDossierPage(props: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await props.params;
  const dossier = await getPublicResolutionDossier(id);

  if (!dossier) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#f5f3ed] text-[#0e2b24] py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link
          href="/impact"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5c6f66] hover:text-[#0e2b24]"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Public Impact Directory</span>
        </Link>

        {/* Top Header */}
        <div className="rounded-2xl border border-[#cbd5cb] bg-[#faf9f5] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold uppercase ${
                    dossier.status === "resolved"
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                      : "bg-blue-100 text-blue-900 border-blue-300"
                  }`}
                >
                  {dossier.status}
                </Badge>
                <span className="font-mono text-xs text-[#5c6f66]">{dossier.incidentNumber}</span>
                <span className="text-xs text-[#5c6f66]">• {dossier.category}</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0e2b24]">
                {dossier.title}
              </h1>
              <p className="mt-1 text-xs text-[#5c6f66]">
                Located in {dossier.sectorName}
                {dossier.latitude && dossier.longitude && (
                  <span>
                    {" "}
                    ({dossier.latitude.toFixed(4)}, {dossier.longitude.toFixed(4)})
                  </span>
                )}
              </p>
            </div>

            <div className="rounded-lg border border-[#cbd5cb] bg-[#f2eee1] p-3 text-center sm:text-right">
              <span className="text-[10px] uppercase font-bold text-[#5c6f66]">Community Consensus</span>
              <p className="text-xl font-bold text-emerald-800">
                {dossier.citizenConsensusPercentage}%
              </p>
              <span className="text-[10px] text-[#5c6f66]">
                Across {dossier.citizenDecisiveVotesCount} decisive vote(s)
              </span>
            </div>
          </div>

          <div className="mt-6 border-t border-[#cbd5cb]/70 pt-4 text-xs text-[#344c42]">
            <h3 className="font-semibold text-[#0e2b24]">Problem Summary:</h3>
            <p className="mt-1 leading-relaxed">{dossier.summary}</p>
          </div>
        </div>

        {/* Multi-Party Attribution Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#5c6f66]">
            Verified Contributor Attribution
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {dossier.attributions.length === 0 ? (
              <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 text-xs text-[#5c6f66]">
                Resolved by statutory municipal works department (Government-Led).
              </div>
            ) : (
              dossier.attributions.map((attr, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-[#5c6f66] tracking-wider">
                      Role: {attr.role}
                    </span>
                    <Badge variant="outline" className="text-[9px] border-[#cbd5cb]">
                      {attr.classification}
                    </Badge>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-[#0e2b24]">
                    {attr.organizationSlug ? (
                      <Link
                        href={`/organizations/${attr.organizationSlug}`}
                        className="hover:underline text-[#0e2b24]"
                      >
                        {attr.organizationName}
                      </Link>
                    ) : (
                      attr.organizationName
                    )}
                  </h3>
                  <p className="mt-1 text-xs text-[#5c6f66]">{attr.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Before and After Photographic Evidence Slider / Comparison */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#5c6f66]">
            Photographic Evidence Audit
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Before Photo */}
            <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 shadow-xs">
              <span className="inline-block rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-900 mb-3">
                BEFORE INTERVENTION
              </span>
              {dossier.beforePhotos[0] ? (
                <div className="space-y-2">
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-gray-200">
                    <img
                      src={dossier.beforePhotos[0].url}
                      alt="Before repair"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="text-[11px] text-[#5c6f66] italic">
                    {dossier.beforePhotos[0].description || "Original road hazard documentation"}
                  </p>
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-[#cbd5cb] bg-white text-xs text-[#5c6f66]">
                  Initial citizen report photograph on file
                </div>
              )}
            </div>

            {/* After Photo */}
            <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 shadow-xs">
              <span className="inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900 mb-3">
                AFTER REMEDIATION
              </span>
              {dossier.afterPhotos[0] ? (
                <div className="space-y-2">
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-gray-200">
                    <img
                      src={dossier.afterPhotos[0].url}
                      alt="After repair"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="text-[11px] text-[#5c6f66] italic">
                    {dossier.afterPhotos[0].description || "Completed remediation photographic evidence"}
                  </p>
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-[#cbd5cb] bg-white text-xs text-[#5c6f66]">
                  Remediation photographic evidence on file
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Municipal Verification & Citizen Voting Widget */}
        <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-6 shadow-xs space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#cbd5cb] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0e2b24]">Verification Status & Safeguards</h3>
              <p className="text-xs text-[#5c6f66]">
                Consensus threshold $\ge 75\%$ decisive votes • 1 vote per authenticated citizen
              </p>
            </div>
            {dossier.municipalInspectionVerified && (
              <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]">
                <ShieldCheck className="size-3 mr-1" />
                <span>Municipal Engineering Certified</span>
              </Badge>
            )}
          </div>

          <ResolutionVotingWidget incidentId={dossier.id} />
        </div>
      </div>
    </div>
  );
}
