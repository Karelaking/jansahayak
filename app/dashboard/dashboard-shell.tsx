"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  MapPin,
  ShieldCheck,
  BarChart3,
  AlertTriangle,
  Plus,
  ExternalLink,
  Menu,
  Workflow,
  LogOut,
  User,
  Building2,
} from "lucide-react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { UserRole, UserSession } from "@/lib/auth/roles";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  minRole?: UserRole;
};

const DashboardSessionContext = React.createContext<UserSession | null>(null);

/**
 * The dashboard layout already resolved the session on the server. Pages read it
 * from here instead of re-fetching /api/auth/session or inferring a role.
 */
export function useDashboardSession(): UserSession {
  const session = React.useContext(DashboardSessionContext);
  if (!session) {
    throw new Error("useDashboardSession must be used inside DashboardShell");
  }
  return session;
}

const ALL_NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    minRole: "citizen",
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: FileText,
    minRole: "citizen",
  },
  {
    href: "/dashboard/map",
    label: "Live Map",
    icon: MapPin,
    minRole: "citizen",
  },
  {
    href: "/dashboard/organization",
    label: "Organization",
    icon: Building2,
    minRole: "citizen",
  },
  {
    href: "/dashboard/moderation",
    label: "Moderation",
    icon: ShieldCheck,
    badge: "Staff",
    minRole: "moderator",
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
    minRole: "moderator",
  },
  {
    href: "/dashboard/escalations",
    label: "Escalations",
    icon: AlertTriangle,
    badge: "Staff",
    minRole: "moderator",
  },
  {
    href: "/dashboard/pipeline",
    label: "PRD Pipeline",
    icon: Workflow,
    badge: "Staff",
    minRole: "moderator",
  },
];

export function DashboardShell({
  session,
  children,
}: {
  session: UserSession;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [prevPathname, setPrevPathname] = React.useState(pathname);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileOpen) {
      setMobileOpen(false);
    }
  }

  const userRole = session.role;
  const userEmail = session.email;
  const userFullName = session.fullName;
  const userAvatar = session.avatarUrl;

  const handleSignOut = async () => {
    try {
      if (
        typeof window !== "undefined" &&
        (window as unknown as { Clerk?: { signOut: () => Promise<void> } }).Clerk
      ) {
        await (window as unknown as { Clerk: { signOut: () => Promise<void> } }).Clerk.signOut();
      }
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // The redirect below is the source of truth even if sign-out signalling fails.
    }
    router.push("/sign-in");
    router.refresh();
  };

  // Filter navigation items based on user role (Civilians only see authorized pages)
  const isStaff = userRole !== "citizen";
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) => {
    if (!item.minRole || item.minRole === "citizen") return true;
    if (item.minRole === "admin") return userRole === "admin";
    return isStaff;
  }).map((item) => {
    if (item.href === "/dashboard/reports" && userRole === "citizen") {
      return { ...item, label: "My Reports" };
    }
    return item;
  });

  const navContent = (
    <div className="flex h-full flex-col justify-between py-5">
      <div className="space-y-6">
        <div className="px-4">
          <Link
            href="/"
            className="flex items-center gap-3 text-inherit no-underline transition-opacity hover:opacity-80"
            aria-label="JanSahayak SafeStreets Home"
          >
            <Brand />
          </Link>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#5c6f66] border-t border-[#cbd5cb]/60 pt-2">
            <span className="font-medium">Access Tier:</span>
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                userRole === "admin"
                  ? "bg-[#f3d9cf] text-[#8c2e1b] border-[#e4876f]/50"
                  : userRole === "moderator"
                    ? "bg-[#dce8d9] text-[#0e2b24] border-[#cbd5cb]"
                    : "bg-[#eef1e9] text-[#17382f] border-[#d2d9d0]"
              }`}
            >
              {userRole}
            </Badge>
          </div>
        </div>

        <div className="px-2">
          <div className="px-3 pb-2 text-[10px] font-bold tracking-[0.12em] text-[#5c6f66] uppercase">
            {isStaff ? "Municipal Workspace" : "Citizen Workspace"}
          </div>
          <nav className="flex flex-col gap-0.5" aria-label="Dashboard navigation">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Button
                  key={item.href}
                  variant={isActive ? "secondary" : "ghost"}
                  size="default"
                  className={`w-full justify-start gap-3 rounded-lg px-3 h-10 md:h-9 text-sm transition-all ${
                    isActive
                      ? "bg-[#eef1e9] font-semibold text-[#0e2b24] shadow-xs"
                      : "text-[#486057] hover:bg-[#eef1e9]/60 hover:text-[#17382f]"
                  }`}
                  render={<Link href={item.href} />}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className="ml-auto text-[10px] font-medium h-5"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="space-y-3 px-2">
        <Separator className="mx-2" />

        {/* User Identity & Sign Out Widget */}
        <div className="rounded-lg bg-muted/40 p-2.5 mx-1 border border-border/50 text-xs space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0e2b24] text-white overflow-hidden border border-[#cbd5cb]/50">
              {userAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userAvatar}
                  alt={userFullName || "User Avatar"}
                  className="size-full object-cover"
                />
              ) : (
                <User className="size-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-xs text-[#17382f]">
                {userFullName || userEmail || "Civic account"}
              </p>
              <p className="truncate text-[11px] text-[#5c6f66]">
                {userEmail || (isStaff ? "Municipal staff" : "Citizen account")}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleSignOut}
            className="w-full justify-start gap-1.5 text-xs text-[#8c2e1b] hover:text-[#8c2e1b] hover:bg-[#f3d9cf]/40 h-8 md:h-7"
          >
            <LogOut className="size-3" />
            <span>Sign Out</span>
          </Button>
        </div>

        <div className="flex flex-col gap-1 px-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 text-xs text-[#486057] hover:bg-[#eef1e9]/60 hover:text-[#17382f] h-9 md:h-8"
            render={<Link href="/" />}
          >
            <ExternalLink className="size-3.5" />
            <span>Public Civic Portal</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            className="w-full justify-start gap-2 rounded-lg text-xs font-medium h-9 md:h-8 shadow-sm bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed]"
            render={<Link href="/reports/new" />}
          >
            <Plus className="size-3.5" />
            <span>Report a Hazard</span>
          </Button>
        </div>

        <div className="px-3 pt-1">
          <p className="text-xs text-[#5c6f66]">Greater Noida Pilot · v0.9</p>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardSessionContext.Provider value={session}>
      <div className="flex min-h-screen bg-background text-foreground antialiased">
        {/* Desktop Persistent Sidebar */}
        <aside className="hidden md:flex w-64 shrink-0 border-r border-border bg-card">
          <div className="sticky top-0 h-screen w-full">{navContent}</div>
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Mobile Header Bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm md:hidden">
            <Link href="/" className="flex items-center gap-2">
              <Brand />
            </Link>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                {userRole}
              </Badge>
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Open navigation menu"
                      className="size-10 min-h-[44px] min-w-[44px]"
                    />
                  }
                >
                  <Menu className="size-5" />
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation Menu</SheetTitle>
                  </SheetHeader>
                  {navContent}
                </SheetContent>
              </Sheet>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </DashboardSessionContext.Provider>
  );
}
