import * as React from "react";
import { redirect } from "next/navigation";
import { getCurrentUserSession } from "@/lib/auth/session";
import { DashboardShell } from "./dashboard-shell";

/**
 * The dashboard reads the Clerk session on the server, so it can never render as
 * part of the static shell. Opting out of instant-navigation validation keeps the
 * segment blocking until the session check resolves.
 */
export const instant = false;

function DashboardSessionFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f3ed] p-6 text-center">
      <div className="size-8 rounded-full border-2 border-[#0e2b24] border-t-transparent animate-spin mb-3" />
      <p className="text-xs font-semibold text-[#0e2b24]">Verifying Civic Session...</p>
      <p className="text-[11px] text-[#5c6f66]">Validating Role-Based Dashboard Authorization</p>
    </div>
  );
}

async function DashboardSessionGate({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUserSession();

  if (!session.isAuthenticated) {
    redirect("/sign-in?redirect_url=%2Fdashboard");
  }

  return <DashboardShell session={session}>{children}</DashboardShell>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={<DashboardSessionFallback />}>
      <DashboardSessionGate>{children}</DashboardSessionGate>
    </React.Suspense>
  );
}
