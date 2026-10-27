"use client";

import * as React from "react";
import Link from "next/link";
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  ExternalLink,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function OrganizationImpactPage() {
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<any>(null);

  React.useEffect(() => {
    async function fetchOrgProfile() {
      try {
        setLoading(true);
        const res = await fetch("/api/organizations/me");
        if (res.ok) {
          const json = await res.json();
          if (json.organization?.publicProfileSlug) {
            const profRes = await fetch(`/api/organizations/${json.organization.publicProfileSlug}`);
            if (profRes.ok) {
              setProfile(await profRes.json());
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrgProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-[#cbd5cb] bg-[#faf9f5]">
        <div className="size-6 animate-spin rounded-full border-2 border-[#0e2b24] border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-6 text-center text-xs text-[#5c6f66]">
        Register your organization on the Overview page to begin tracking verified impact.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-[#0e2b24]">Verified Impact & Recognition</h2>
          <p className="text-xs text-[#5c6f66]">
            Earned civic credentials derived exclusively from verified, citizen-audited resolutions
          </p>
        </div>

        <Link
          href={`/organizations/${profile.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#cbd5cb] bg-[#faf9f5] px-3 py-1.5 text-xs font-semibold text-[#0e2b24] hover:bg-[#eae8de]"
        >
          <span>View Public Profile Showcase</span>
          <ExternalLink className="size-3 text-[#5c6f66]" />
        </Link>
      </div>

      {/* Badges Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="size-4" />
            </span>
            <h3 className="text-xs font-bold text-[#0e2b24]">Civic Contributor</h3>
          </div>
          <p className="mt-2 text-[11px] text-[#5c6f66]">
            Awarded upon achieving at least 1 verified civic problem resolution.
          </p>
          <div className="mt-3">
            <Badge
              variant="outline"
              className={
                profile.verifiedResolutionsCount >= 1
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]"
                  : "bg-gray-100 text-gray-500 border-gray-300 text-[10px]"
              }
            >
              {profile.verifiedResolutionsCount >= 1 ? "Earned & Active" : "Requires 1 Resolution"}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-blue-800">
              <Award className="size-4" />
            </span>
            <h3 className="text-xs font-bold text-[#0e2b24]">Verified Impact Partner</h3>
          </div>
          <p className="mt-2 text-[11px] text-[#5c6f66]">
            Awarded upon achieving 5+ verified civic infrastructure resolutions.
          </p>
          <div className="mt-3">
            <Badge
              variant="outline"
              className={
                profile.verifiedResolutionsCount >= 5
                  ? "bg-blue-100 text-blue-900 border-blue-300 text-[10px]"
                  : "bg-gray-100 text-gray-500 border-gray-300 text-[10px]"
              }
            >
              {profile.verifiedResolutionsCount >= 5 ? "Earned & Active" : "Requires 5 Resolutions"}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-purple-100 text-purple-800">
              <ShieldCheck className="size-4" />
            </span>
            <h3 className="text-xs font-bold text-[#0e2b24]">Community Safety Champion</h3>
          </div>
          <p className="mt-2 text-[11px] text-[#5c6f66]">
            Awarded upon achieving 10+ high-impact verified resolutions with $\ge 75\%$ consensus.
          </p>
          <div className="mt-3">
            <Badge
              variant="outline"
              className={
                profile.verifiedResolutionsCount >= 10
                  ? "bg-purple-100 text-purple-900 border-purple-300 text-[10px]"
                  : "bg-gray-100 text-gray-500 border-gray-300 text-[10px]"
              }
            >
              {profile.verifiedResolutionsCount >= 10 ? "Earned & Active" : "Requires 10 Resolutions"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Fairness & Anti-Manipulation Guardrail Note */}
      <div className="flex items-start gap-3 rounded-lg border border-[#cbd5cb] bg-[#faf9f5] p-4">
        <Info className="size-5 shrink-0 text-[#0e2b24] mt-0.5" />
        <div className="text-xs text-[#5c6f66]">
          <strong className="text-[#0e2b24]">Fairness and Non-Commercial Verification Principle (PRD §34):</strong>
          <p className="mt-0.5">
            Platform badges and verified impact scores cannot be bought, sponsored, or altered through commercial
            arrangements. Every resolved report requires evidentiary verification and community consensus.
          </p>
        </div>
      </div>
    </div>
  );
}
