"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Compass,
  ArrowRight,
  ShieldAlert,
  FileCheck,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardSession } from "@/app/dashboard/dashboard-shell";

export default function OrganizationOverviewPage() {
  const session = useDashboardSession();
  const [loading, setLoading] = React.useState(true);
  const [orgData, setOrgData] = React.useState<any>(null);
  const [impactData, setImpactData] = React.useState<any>(null);
  const [regForm, setRegForm] = React.useState({
    legalName: "",
    displayName: "",
    organizationType: "corporate",
    registrationNumber: "",
    contactEmail: session.email || "",
    contactPhone: "",
    publicDescription: "",
    websiteUrl: "",
    focusAreas: "Road Safety, Infrastructure, Sanitation",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [regError, setRegError] = React.useState<string | null>(null);

  const fetchOrg = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/organizations/me");
      if (res.ok) {
        const data = await res.json();
        setOrgData(data);
        if (data?.organization?.id) {
          const impRes = await fetch(`/api/organizations/${data.organization.id}/impact`);
          if (impRes.ok) {
            setImpactData(await impRes.json());
          }
        }
      } else {
        setOrgData(null);
      }
    } catch (err) {
      console.error(err);
      setOrgData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setRegError(null);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: regForm.legalName,
          displayName: regForm.displayName,
          organizationType: regForm.organizationType,
          registrationNumber: regForm.registrationNumber || undefined,
          contactEmail: regForm.contactEmail,
          contactPhone: regForm.contactPhone || undefined,
          publicDescription: regForm.publicDescription || undefined,
          websiteUrl: regForm.websiteUrl || undefined,
          focusAreas: regForm.focusAreas.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to register organization.");
      }
      await fetchOrg();
    } catch (err: any) {
      setRegError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-[#cbd5cb] bg-[#faf9f5]">
        <div className="flex flex-col items-center gap-2">
          <div className="size-6 animate-spin rounded-full border-2 border-[#0e2b24] border-t-transparent" />
          <p className="text-xs text-[#5c6f66]">Loading organization profile...</p>
        </div>
      </div>
    );
  }

  // If user does not belong to an organization yet
  if (!orgData?.organization) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-3 border-b border-[#cbd5cb] pb-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[#0e2b24] text-[#f5f3ed]">
            <Building2 className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0e2b24]">Register as a Civic Partner</h2>
            <p className="text-xs text-[#5c6f66]">
              Enable your enterprise, NGO, or CSR foundation to adopt verified civic problems
            </p>
          </div>
        </div>

        {regError && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
            <AlertTriangle className="size-4 shrink-0 text-rose-600" />
            <span>{regError}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0e2b24]">
                Legal Entity Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Infra CSR Foundation"
                value={regForm.legalName}
                onChange={(e) => setRegForm({ ...regForm, legalName: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-2 text-xs text-[#0e2b24] focus:border-[#0e2b24] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0e2b24]">
                Public Display Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Acme CSR"
                value={regForm.displayName}
                onChange={(e) => setRegForm({ ...regForm, displayName: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-2 text-xs text-[#0e2b24] focus:border-[#0e2b24] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0e2b24]">
                Organization Type <span className="text-rose-600">*</span>
              </label>
              <select
                value={regForm.organizationType}
                onChange={(e) => setRegForm({ ...regForm, organizationType: e.target.value as any })}
                className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-2 text-xs text-[#0e2b24] focus:border-[#0e2b24] focus:outline-hidden"
              >
                <option value="corporate">Corporate / CSR Entity</option>
                <option value="ngo">Non-Governmental Organization (NGO)</option>
                <option value="foundation">Charitable Foundation</option>
                <option value="contractor">Licensed Engineering Contractor</option>
                <option value="institution">Academic / Institutional</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0e2b24]">
                Registration / CIN / NGO Darpan ID
              </label>
              <input
                type="text"
                placeholder="e.g. U74999DL2020NPL123456"
                value={regForm.registrationNumber}
                onChange={(e) => setRegForm({ ...regForm, registrationNumber: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-2 text-xs text-[#0e2b24] focus:border-[#0e2b24] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0e2b24]">
                Official Contact Email <span className="text-rose-600">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="csr@acme.org"
                value={regForm.contactEmail}
                onChange={(e) => setRegForm({ ...regForm, contactEmail: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-2 text-xs text-[#0e2b24] focus:border-[#0e2b24] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0e2b24]">Contact Phone</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={regForm.contactPhone}
                onChange={(e) => setRegForm({ ...regForm, contactPhone: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-2 text-xs text-[#0e2b24] focus:border-[#0e2b24] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0e2b24]">Focus Areas (comma separated)</label>
            <input
              type="text"
              placeholder="Road Safety, Drainage, Sanitation, Potholes"
              value={regForm.focusAreas}
              onChange={(e) => setRegForm({ ...regForm, focusAreas: e.target.value })}
              className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-2 text-xs text-[#0e2b24] focus:border-[#0e2b24] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0e2b24]">Public Mission / Description</label>
            <textarea
              rows={3}
              placeholder="Brief description of your civic mission and focus in Greater Noida..."
              value={regForm.publicDescription}
              onChange={(e) => setRegForm({ ...regForm, publicDescription: e.target.value })}
              className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-2 text-xs text-[#0e2b24] focus:border-[#0e2b24] focus:outline-hidden"
            />
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900">
            <span className="font-semibold">Notice:</span> Registration requires platform verification
            before problem adoptions can be approved. JanSahayak does not grant unilateral authority to alter
            public infrastructure without statutory municipal permissions.
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#0e2b24] hover:bg-[#1a4439] text-[#f5f3ed] font-semibold text-xs py-2.5"
          >
            {submitting ? "Submitting Registration..." : "Complete Organization Registration"}
          </Button>
        </form>
      </div>
    );
  }

  const { organization, membership } = orgData;
  const isVerified = organization.verificationStatus === "verified";

  return (
    <div className="space-y-6">
      {/* Verification Status Banner */}
      {!isVerified && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="size-5 shrink-0 text-amber-700" />
            <div>
              <h3 className="text-xs font-bold text-amber-900">
                Verification Status: {organization.verificationStatus.replace(/_/g, " ").toUpperCase()}
              </h3>
              <p className="text-[11px] text-amber-800">
                Only verified organizations can submit official adoption proposals and resolution claims.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-400 bg-amber-100 text-[10px] text-amber-900">
            Review in Progress
          </Badge>
        </div>
      )}

      {/* Organization Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-5 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#0e2b24]">{organization.displayName}</h2>
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold uppercase ${
                isVerified
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                  : "bg-amber-100 text-amber-900 border-amber-300"
              }`}
            >
              {organization.verificationStatus}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-[#5c6f66]">
            {organization.legalName} • {organization.organizationType.toUpperCase()} • My Role:{" "}
            <span className="font-semibold text-[#0e2b24]">{membership.role}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/organizations/${organization.publicProfileSlug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs font-medium text-[#0e2b24] hover:bg-[#eae8de] transition-colors"
          >
            <span>Public Profile</span>
            <ExternalLink className="size-3 text-[#5c6f66]" />
          </Link>
          <Link
            href="/dashboard/organization/discover"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0e2b24] px-3 py-1.5 text-xs font-semibold text-[#f5f3ed] hover:bg-[#1a4439] transition-colors"
          >
            <Compass className="size-3.5" />
            <span>Discover Problems</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#5c6f66]">
            <span>Active Adoptions</span>
            <Compass className="size-4 text-[#0e2b24]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#0e2b24]">
            {impactData?.activeAdoptionsCount ?? 0}
          </p>
          <span className="text-[11px] text-[#5c6f66]">Civic interventions in progress</span>
        </div>

        <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#5c6f66]">
            <span>Verified Resolutions</span>
            <CheckCircle2 className="size-4 text-emerald-700" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-800">
            {impactData?.verifiedResolutionsCount ?? 0}
          </p>
          <span className="text-[11px] text-emerald-700">Citizen & official verified</span>
        </div>

        <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#5c6f66]">
            <span>Capital Deployed</span>
            <TrendingUp className="size-4 text-[#0e2b24]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#0e2b24]">
            ₹{(impactData?.totalEstimatedInvestmentInr ?? 0).toLocaleString("en-IN")}
          </p>
          <span className="text-[11px] text-[#5c6f66]">CSR & private commitment</span>
        </div>

        <div className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#5c6f66]">
            <span>Verification Tier</span>
            <FileCheck className="size-4 text-[#0e2b24]" />
          </div>
          <p className="mt-2 text-sm font-bold text-[#0e2b24]">
            {isVerified ? "Approved Civic Partner" : "Verification Pending"}
          </p>
          <span className="text-[11px] text-[#5c6f66]">
            {isVerified ? "Eligible for adoption proposals" : "Review by platform verifier"}
          </span>
        </div>
      </div>

      {/* Quick Action Portals */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/dashboard/organization/discover"
          className="group flex flex-col justify-between rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-5 transition-all hover:border-[#0e2b24] hover:shadow-sm"
        >
          <div>
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#0e2b24] text-[#f5f3ed]">
              <Compass className="size-4" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-[#0e2b24]">Discover Civic Problems</h3>
            <p className="mt-1 text-xs text-[#5c6f66]">
              Browse verified road hazards, drainage blocks, and infrastructure needing intervention.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#0e2b24] group-hover:translate-x-1 transition-transform">
            <span>Explore catalog</span>
            <ArrowRight className="size-3.5" />
          </div>
        </Link>

        <Link
          href="/dashboard/organization/adoptions"
          className="group flex flex-col justify-between rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-5 transition-all hover:border-[#0e2b24] hover:shadow-sm"
        >
          <div>
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#0e2b24] text-[#f5f3ed]">
              <Clock className="size-4" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-[#0e2b24]">Manage Adopted Projects</h3>
            <p className="mt-1 text-xs text-[#5c6f66]">
              Track milestones, coordinate statutory permissions, and manage field execution deadlines.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#0e2b24] group-hover:translate-x-1 transition-transform">
            <span>View projects</span>
            <ArrowRight className="size-3.5" />
          </div>
        </Link>

        <Link
          href="/dashboard/organization/claims"
          className="group flex flex-col justify-between rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-5 transition-all hover:border-[#0e2b24] hover:shadow-sm"
        >
          <div>
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#0e2b24] text-[#f5f3ed]">
              <CheckCircle2 className="size-4" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-[#0e2b24]">Claims & Verification</h3>
            <p className="mt-1 text-xs text-[#5c6f66]">
              Submit before/after photographic evidence, track citizen voting, and municipal sign-offs.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#0e2b24] group-hover:translate-x-1 transition-transform">
            <span>Track claims</span>
            <ArrowRight className="size-3.5" />
          </div>
        </Link>
      </div>
    </div>
  );
}
