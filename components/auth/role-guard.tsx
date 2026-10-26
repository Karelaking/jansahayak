"use client";

import * as React from "react";
import Link from "next/link";
import { MapPin, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export function RoleGuard({
  children,
  requiredPermission,
  allowedRoles,
  title = "Civic Staff & Moderator Authorization Required",
  description = "This operational console is reserved for verified municipal engineers, GNIDA/PWD officers, and authorized moderation personnel under PRD §2 and §14B Role-Based Access Control.",
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
        console.warn("Failed to introspect user session:", err);
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
      <div className="flex min-h-[350px] items-center justify-center p-6 text-xs text-[#5c6f66]">
        <div className="flex flex-col items-center gap-2">
          <div className="size-6 animate-spin rounded-full border-2 border-[#17382f] border-t-transparent" />
          <p className="font-medium text-[#17382f]">Verifying civic staff authorization...</p>
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

  // Respectful Unauthorized Fallback View
  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <Card className="border-[#cbd5cb] bg-[#faf9f5] shadow-xs overflow-hidden">
        <CardHeader className="p-6 border-b border-[#eef1e9] bg-[#f5f3ed]/70">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-900 shrink-0">
              <Lock className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#486057]">
                  PRD §14B Role-Based Access Control
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-white text-[#5c6f66] border-[#cbd5cb]"
                >
                  Current Role: {role.toUpperCase()}
                </Badge>
              </div>
              <CardTitle className="text-lg font-bold text-[#0e2b24] mt-1">{title}</CardTitle>
            </div>
          </div>
          <CardDescription className="text-xs text-[#5c6f66] mt-2 leading-relaxed">
            {description}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          <div className="rounded-xl border border-[#cbd5cb] bg-white p-4 space-y-2 text-xs text-[#17382f]">
            <p className="font-semibold text-[#0e2b24]">Citizen Public Capabilities</p>
            <p className="text-[#5c6f66] text-[11px] leading-relaxed">
              As a general citizen, you have full access to view all verified road safety hazards on
              the live interactive map, submit new GPS-tagged hazard reports, follow civic redressal
              timelines, and vote on community repair verification.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <Link href="/map" className="flex-1">
              <Button
                variant="outline"
                className="w-full text-xs h-9 justify-center bg-white border-[#cbd5cb] text-[#0e2b24] hover:bg-[#eef1e9]"
              >
                <MapPin className="size-3.5 mr-1.5 text-emerald-800" />
                <span>Explore Public Map</span>
              </Button>
            </Link>

            <Link href="/reports/new" className="flex-1">
              <Button className="w-full text-xs h-9 justify-center bg-[#0e2b24] hover:bg-[#1c4b3e] text-white">
                <Plus className="size-3.5 mr-1.5" />
                <span>Report New Hazard</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
