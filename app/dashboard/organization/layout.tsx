"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Compass,
  Briefcase,
  CheckCircle2,
  Award,
  ExternalLink,
} from "lucide-react";

const ORG_TABS = [
  { href: "/dashboard/organization", label: "Overview", icon: Building2 },
  { href: "/dashboard/organization/discover", label: "Discover Problems", icon: Compass },
  { href: "/dashboard/organization/adoptions", label: "Adopted Projects", icon: Briefcase },
  { href: "/dashboard/organization/claims", label: "Claims & Verification", icon: CheckCircle2 },
  { href: "/dashboard/organization/impact", label: "Impact & Badges", icon: Award },
];

export default function OrganizationDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-navigation bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#cbd5cb] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-[#0e2b24] text-[#f5f3ed]">
              <Building2 className="size-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[#0e2b24]">
              Civic Impact & Organization Portal
            </h1>
          </div>
          <p className="mt-1 text-xs text-[#5c6f66]">
            Adoption, milestone execution, citizen verification, and verified civic attribution
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/impact"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#cbd5cb] bg-[#faf9f5] px-3 py-1.5 text-xs font-medium text-[#0e2b24] hover:bg-[#eae8de] transition-colors"
          >
            <span>Public Impact Report</span>
            <ExternalLink className="size-3 text-[#5c6f66]" />
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#cbd5cb] pb-2 scrollbar-none">
        {ORG_TABS.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-[#0e2b24] text-[#f5f3ed] shadow-xs"
                  : "text-[#344c42] hover:bg-[#e7e5dc] hover:text-[#0e2b24]"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}
