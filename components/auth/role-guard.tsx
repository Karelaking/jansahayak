"use client";

import * as React from "react";
import Link from "next/link";
import { MapPin, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { UserRole, ROLE_PERMISSIONS } from "@/lib/auth/roles";

interface UserSessionState {
  userId: string;
  email: string;
  fullName?: string;
  role: UserRole;
  isAuthenticated: boolean;
  permissions: (typeof ROLE_PERMISSIONS)["citizen"];
}

interface RoleGuardProps {
  children: React.ReactNode;
  requiredPermission?: keyof (typeof ROLE_PERMISSIONS)["citizen"];
  allowedRoles?: UserRole[];
  title?: string;
  description?: string;
}

/**
 * Keeps staff consoles out of reach for citizen accounts and, when it does,
 * explains the boundary in plain language with routes back to useful work.
 */
export function RoleGuard({
  children,
  requiredPermission,
  allowedRoles,
  title = "This console is for staff",
  description = "Municipal engineers, field officers, and moderators use this area to review and act on reports. Your account keeps its own reports, the public map, and hazard reporting.",
}: RoleGuardProps) {
  const [session, setSession] = React.useState<UserSessionState | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    async function fetchSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.success && data.session) {
          setSession(data.session);
        }
      } catch (err) {
        console.warn("Unable to check the current session:", err);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    fetchSession();
    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-87.5 items-center justify-center p-6">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <Spinner className="size-5 text-[#17382f]" aria-hidden="true" />
          <p className="text-[13px] font-medium text-[#17382f]">Checking your access…</p>
        </div>
      </div>
    );
  }

  const role = session?.role || "citizen";
  const permissions = session?.permissions || ROLE_PERMISSIONS.citizen;

  let isAuthorized = true;
  if (allowedRoles && allowedRoles.length > 0) {
    isAuthorized = allowedRoles.includes(role);
  } else if (requiredPermission) {
    isAuthorized = Boolean(permissions[requiredPermission]);
  }

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card className="overflow-hidden border-[#cbd5cb] bg-[#faf9f5]">
        <div className="border-b border-[#eef1e9] p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#cbd5cb] bg-[#dce8d9] text-[#17382f]">
              <Lock className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.125em] text-[#486057]">
                  Staff area
                </span>
                <Badge
                  variant="outline"
                  className="border-[#cbd5cb] bg-[#f5f3ed] text-[11px] font-normal text-[#486057]"
                >
                  Signed in as {role.replaceAll("_", " ")}
                </Badge>
              </div>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-[#0e2b24]">{title}</h2>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5c6f66]">{description}</p>
        </div>

        <CardContent className="space-y-5 p-6">
          <div className="border-y border-[#eef1e9] py-4">
            <p className="text-[13px] font-semibold text-[#0e2b24]">What you can do as a citizen</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#5c6f66]">
              See every verified hazard on the live map, file a new report with its location
              attached, follow redressal timelines, and confirm repairs reported near you.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="min-h-11 border-[#cbd5cb] bg-white text-[13px] text-[#0e2b24] hover:bg-[#eef1e9] sm:flex-1"
              render={<Link href="/map" />}
            >
              <MapPin className="size-4 text-[#17382f]" aria-hidden="true" />
              <span>Explore the public map</span>
            </Button>

            <Button
              className="min-h-11 bg-[#0e2b24] text-[13px] text-[#f5f3ed] hover:bg-[#1c4b3e] sm:flex-1"
              render={<Link href="/reports/new" />}
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>Report a hazard</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
