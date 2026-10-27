import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublicOrganizationProfile } from "@/lib/organizations";
import {
  Building2,
  CheckCircle2,
  Award,
  ShieldCheck,
  ExternalLink,
  Calendar,
  ArrowLeft,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const instant = false;

export default async function PublicOrganizationProfilePage(props: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await props.params;
  const profile = await getPublicOrganizationProfile(slug);

  if (!profile) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#f5f3ed] text-[#0e2b24] py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5c6f66] hover:text-[#0e2b24]"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Home</span>
        </Link>

        {/* Profile Card */}
        <div className="rounded-2xl border border-[#cbd5cb] bg-[#faf9f5] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#0e2b24] text-[#f5f3ed]">
                <Building2 className="size-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-[#0e2b24]">
                    {profile.name}
                  </h1>
                  {profile.isVerified && (
                    <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] font-semibold">
                      Verified Civic Partner
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-[#5c6f66]">
                  {profile.organizationType.toUpperCase()}
                  {profile.websiteUrl && (
                    <>
                      {" • "}
                      <a
                        href={profile.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-[#0e2b24]"
                      >
                        {profile.websiteUrl.replace(/^https?:\/\//, "")}
                      </a>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[#cbd5cb] bg-[#f2eee1] px-4 py-2 text-center sm:text-right">
              <span className="text-[10px] uppercase font-bold text-[#5c6f66]">Verified Resolutions</span>
              <p className="text-xl font-bold text-emerald-800">{profile.verifiedResolutionsCount}</p>
            </div>
          </div>

          {profile.description && (
            <p className="mt-6 text-xs text-[#344c42] leading-relaxed border-t border-[#cbd5cb]/70 pt-4">
              {profile.description}
            </p>
          )}

          {profile.focusAreas.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {profile.focusAreas.map((area) => (
                <span
                  key={area}
                  className="rounded-md border border-[#cbd5cb] bg-white px-2 py-0.5 text-[10px] font-medium text-[#4b5952]"
                >
                  {area}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Earned Badges */}
        {profile.badges.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#5c6f66]">
              Earned Civic Credentials
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {profile.badges.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <Award className="size-4 text-emerald-700" />
                    <h3 className="text-xs font-bold text-[#0e2b24]">{b.name}</h3>
                  </div>
                  <p className="mt-1 text-[11px] text-[#5c6f66]">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolved Incidents Portfolio */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#5c6f66]">
            Verified Resolution Portfolio
          </h2>

          {profile.resolvedIncidents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#cbd5cb] bg-[#faf9f5] p-8 text-center text-xs text-[#5c6f66]">
              No verified resolutions completed yet. Projects currently under execution or citizen verification.
            </div>
          ) : (
            <div className="space-y-3">
              {profile.resolvedIncidents.map((inc) => (
                <div
                  key={inc.incidentId}
                  className="flex flex-col gap-2 rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-[#cbd5cb] text-[#0e2b24]">
                        {inc.category}
                      </Badge>
                      <span className="text-[11px] font-mono text-[#5c6f66]">{inc.incidentNumber}</span>
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-[#0e2b24]">{inc.title}</h3>
                    <p className="text-[11px] text-[#5c6f66]">
                      Attributed Role: <strong>{inc.role}</strong>
                    </p>
                  </div>

                  <Link
                    href={`/resolutions/${inc.incidentId}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#0e2b24] px-3 py-1.5 text-xs font-semibold text-[#f5f3ed] hover:bg-[#1a4439] self-start sm:self-center"
                  >
                    <span>View Public Dossier</span>
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
