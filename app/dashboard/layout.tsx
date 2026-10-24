"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: FileText,
    badge: "24",
  },
  {
    href: "/dashboard/map",
    label: "Live Map",
    icon: MapPin,
  },
  {
    href: "/dashboard/moderation",
    label: "Moderation",
    icon: ShieldCheck,
    badge: "6",
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
  },
  {
    href: "/dashboard/escalations",
    label: "Escalations",
    icon: AlertTriangle,
    badge: "3",
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navContent = (
    <div className="flex h-full flex-col justify-between py-4">
      <div className="space-y-6">
        <div className="px-4">
          <Link
            href="/"
            className="flex items-center gap-3 text-inherit no-underline"
            aria-label="JanSahayak SafeStreets Home"
          >
            <Brand />
          </Link>
        </div>

        <div className="px-2">
          <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Platform Management
          </div>
          <nav className="flex flex-col gap-1" aria-label="Dashboard navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Button
                  key={item.href}
                  variant={isActive ? "secondary" : "ghost"}
                  size="default"
                  className={`w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  render={<Link href={item.href} />}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      className="ml-auto text-[10px] font-semibold"
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

      <div className="space-y-3 px-3">
        <Separator />
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 text-xs text-muted-foreground hover:text-foreground"
            render={<Link href="/" />}
          >
            <ExternalLink className="size-3.5" />
            <span>Public Civic Portal</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            className="w-full justify-start gap-2 rounded-lg text-xs font-semibold shadow-xs"
            render={<Link href="/reports/new" />}
          >
            <Plus className="size-3.5" />
            <span>Report a Hazard</span>
          </Button>
        </div>

        <div className="px-2 pt-1">
          <p className="text-[11px] text-muted-foreground">Greater Noida Pilot &middot; v0.9</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:block">
        <div className="sticky top-0 h-screen">{navContent}</div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile Header with shadcn Sheet */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur-md md:hidden">
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={<Button variant="ghost" size="icon-sm" aria-label="Open Navigation Menu" />}
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

            <Link href="/dashboard" className="flex items-center gap-2 text-inherit no-underline">
              <span className="font-heading text-sm font-bold">JanSahayak</span>
              <Badge variant="outline" className="text-[10px]">
                Dashboard
              </Badge>
            </Link>
          </div>

          <Button size="xs" className="gap-1.5" render={<Link href="/reports/new" />}>
            <Plus className="size-3.5" />
            <span>Report</span>
          </Button>
        </header>

        {/* Main Routed Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
