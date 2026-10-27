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
} from "lucide-react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  minRole?: "citizen" | "moderator" | "admin";
};

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
    minRole: "citizen",
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string>("citizen");
  const [userEmail, setUserEmail] = React.useState<string>("");
  const [userFullName, setUserFullName] = React.useState<string>("");
  const [userAvatar, setUserAvatar] = React.useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    let active = true;
    async function verifyAuth() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          if (active) {
            if (data.success && data.session?.isAuthenticated) {
              setIsAuthenticated(true);
              setUserRole(data.session.role || "citizen");
              setUserEmail(data.session.email || "");
              setUserFullName(data.session.fullName || "");
              setUserAvatar(data.session.avatarUrl || "");
            } else {
              setIsAuthenticated(false);
              router.replace(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
            }
          }
        } else {
          if (active) {
            setIsAuthenticated(false);
            router.replace(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
          }
        }
      } catch {
        if (active) {
          setIsAuthenticated(false);
          router.replace(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
        }
      }
    }
    verifyAuth();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  const handleSignOut = async () => {
    try {
      if (
        typeof window !== "undefined" &&
        (window as unknown as { Clerk?: { signOut: () => Promise<void> } }).Clerk
      ) {
        await (window as unknown as { Clerk: { signOut: () => Promise<void> } }).Clerk.signOut();
      }
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/sign-in");
    } catch {
      router.push("/sign-in");
    }
  };

  // Filter navigation items based on user role (Civilians only see authorized pages)
  const isStaff = userRole === "moderator" || userRole === "admin";
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) => {
    if (!item.minRole || item.minRole === "citizen") return true;
    if (item.minRole === "moderator") return isStaff;
    if (item.minRole === "admin") return userRole === "admin";
    return false;
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
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-2">
            <span>Access Tier:</span>
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                userRole === "admin"
                  ? "bg-rose-100 text-rose-900 border-rose-300"
                  : userRole === "moderator"
                    ? "bg-blue-100 text-blue-900 border-blue-300"
                    : "bg-emerald-100 text-emerald-900 border-emerald-300"
              }`}
            >
              {userRole}
            </Badge>
          </div>
        </div>

        <div className="px-2">
          <div className="px-3 pb-2 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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
                  className={`w-full justify-start gap-3 rounded-lg px-3 h-9 text-sm transition-all ${
                    isActive
                      ? "bg-secondary/80 font-medium text-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
              <p className="truncate font-semibold text-[11px] text-foreground">
                {userFullName || (isStaff ? "Civic Official" : "Civic Citizen")}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {userEmail || "Verified Civic Account"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleSignOut}
            className="w-full justify-start gap-1.5 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50 h-7"
          >
            <LogOut className="size-3" />
            <span>Sign Out</span>
          </Button>
        </div>

        <div className="flex flex-col gap-1 px-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 text-xs text-muted-foreground hover:text-foreground h-8"
            render={<Link href="/" />}
          >
            <ExternalLink className="size-3.5" />
            <span>Public Civic Portal</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            className="w-full justify-start gap-2 rounded-lg text-xs font-medium h-8 shadow-sm bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed]"
            render={<Link href="/reports/new" />}
          >
            <Plus className="size-3.5" />
            <span>Report a Hazard</span>
          </Button>
        </div>

        <div className="px-3 pt-1">
          <p className="text-[11px] text-muted-foreground/80">Greater Noida Pilot · v0.9</p>
        </div>
      </div>
    </div>
  );

  // Authenticating session check screen
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f3ed] p-6 text-center">
        <div className="size-8 rounded-full border-2 border-[#0e2b24] border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-semibold text-[#0e2b24]">Verifying Civic Session...</p>
        <p className="text-[11px] text-[#5c6f66]">Validating Role-Based Dashboard Authorization</p>
      </div>
    );
  }

  return (
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
                render={<Button variant="ghost" size="icon-sm" aria-label="Open navigation menu" />}
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
