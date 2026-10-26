"use client";

import * as React from "react";
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Lock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface CivicUser {
  id: string;
  email: string;
  fullName: string;
  role: "citizen" | "moderator" | "admin" | "field_official";
  createdAt: string;
  updatedAt: string;
}

export function StaffRoleDelegation() {
  const [currentUserRole, setCurrentUserRole] = React.useState<string>("moderator");
  const [currentUserId, setCurrentUserId] = React.useState<string>("");
  const [users, setUsers] = React.useState<CivicUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [statusMessage, setStatusMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Delegation confirmation dialog
  const [targetUser, setTargetUser] = React.useState<CivicUser | null>(null);
  const [pendingRole, setPendingRole] = React.useState<"citizen" | "moderator" | "admin" | null>(
    null,
  );
  const [isUpdating, setIsUpdating] = React.useState(false);

  // 1. Fetch current session and user directory
  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const sessionRes = await fetch("/api/auth/session");
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        if (sessionData.session) {
          setCurrentUserRole(sessionData.session.role || "moderator");
          setCurrentUserId(sessionData.session.userId || "");
        }
      }

      const usersRes = await fetch("/api/admin/users");
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData.users) {
          setUsers(usersData.users);
        }
      } else {
        const errData = await usersRes.json().catch(() => ({}));
        setStatusMessage({
          type: "error",
          text: errData.error || "Failed to load user directory. Administrative access required.",
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Network or server connection failed while loading staff directory.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Execute Role Mutation
  const handleRoleChangeConfirm = async () => {
    if (!targetUser || !pendingRole) return;

    setIsUpdating(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(targetUser.id)}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: pendingRole }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update role.");
      }

      // Optimistic update in state
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: pendingRole } : u)),
      );

      setStatusMessage({
        type: "success",
        text: `Successfully designated ${targetUser.fullName || targetUser.email} as ${
          pendingRole === "citizen"
            ? "Civilian Reporter"
            : pendingRole === "moderator"
              ? "Municipal Moderator"
              : "Civic Administrator"
        }.`,
      });

      setTargetUser(null);
      setPendingRole(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delegate role.";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsUpdating(false);
    }
  };

  const isAdmin = currentUserRole === "admin";

  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, roleFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── Authority Notice & Hierarchy Matrix ─── */}
      <Card className="border border-[#cbd5cb] bg-[#faf9f5] shadow-xs">
        <CardHeader className="pb-3 border-b border-[#eef1e9]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-[#0e2b24]" />
              <CardTitle className="text-sm sm:text-base font-semibold text-[#17382f]">
                Civic Staff Directory &amp; Role Delegation
              </CardTitle>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono uppercase tracking-wider border-[#cbd5cb] text-[#486057]"
            >
              Session Role: {currentUserRole}
            </Badge>
          </div>
          <CardDescription className="text-xs text-[#5c6f66] mt-1">
            Democratic delegation matrix adhering to municipal policy: Civilian accounts cannot
            self-designate authority. Administrators can appoint both Moderators and Admins.
            Moderators can appoint or demote Moderators, but cannot designate Administrators.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Rules Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-[#cbd5cb] bg-[#f0eee6] p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[#0e2b24]">
                <ShieldAlert className="size-3.5 text-indigo-700" />
                <span>Administrator Privileges</span>
              </div>
              <p className="text-[11px] text-[#5c6f66] leading-relaxed">
                Full authority to appoint Citizens to Moderators, Moderators to Administrators, and
                execute municipal oversight.
              </p>
            </div>

            <div className="rounded-lg border border-[#cbd5cb] bg-[#f0eee6] p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[#0e2b24]">
                <ShieldCheck className="size-3.5 text-emerald-800" />
                <span>Moderator Privileges</span>
              </div>
              <p className="text-[11px] text-[#5c6f66] leading-relaxed">
                Authority to promote Citizens to Moderators or demote Moderators to Citizens.
                Blocked from designating new Administrators.
              </p>
            </div>
          </div>

          {/* Feedback Alerts */}
          {statusMessage && (
            <div
              role="alert"
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
                statusMessage.type === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-rose-300 bg-rose-50 text-rose-900"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-700 mt-0.5" />
              ) : (
                <AlertCircle className="size-4 shrink-0 text-rose-700 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-[#5c6f66]" />
              <Input
                id="search-civic-users"
                type="text"
                placeholder="Search by name, email, or user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-white border-[#cbd5cb] text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border border-[#cbd5cb] bg-white p-0.5 text-xs">
                {(["all", "citizen", "moderator", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoleFilter(r)}
                    className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                      roleFilter === r
                        ? "bg-[#0e2b24] text-white shadow-xs"
                        : "text-[#5c6f66] hover:text-[#0e2b24]"
                    }`}
                  >
                    {r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1) + "s"}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData()}
                disabled={isLoading}
                className="border-[#cbd5cb] text-xs h-9 gap-1"
              >
                <RotateCcw className={`size-3 ${isLoading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {/* Users Table / Directory */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#5c6f66] space-y-2">
              <Spinner className="size-5" />
              <p className="text-xs">Loading civic user records...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-lg border border-[#cbd5cb] bg-white p-8 text-center space-y-2">
              <Users className="size-6 text-[#5c6f66] mx-auto opacity-50" />
              <p className="text-xs font-medium text-[#17382f]">
                No user records match your query.
              </p>
              <p className="text-[11px] text-[#5c6f66]">
                Try adjusting the search query or role filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#cbd5cb] bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#eef1e9] bg-[#faf9f5] text-[#5c6f66]">
                    <th className="py-2.5 px-3 font-semibold">User</th>
                    <th className="py-2.5 px-3 font-semibold">Contact &amp; ID</th>
                    <th className="py-2.5 px-3 font-semibold">Current Role</th>
                    <th className="py-2.5 px-3 font-semibold">Enrolled</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Role Delegation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1e9]">
                  {filteredUsers.map((u) => {
                    const isSelf = u.id === currentUserId;
                    return (
                      <tr key={u.id} className="hover:bg-[#fbfbf9] transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex size-7 items-center justify-center rounded-full bg-[#eef1e9] text-[#0e2b24] font-semibold text-xs border border-[#cbd5cb]">
                              {u.fullName?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                            <div>
                              <p className="font-medium text-[#17382f] flex items-center gap-1.5">
                                {u.fullName}
                                {isSelf && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] border-[#cbd5cb] px-1 py-0 text-[#0e2b24]"
                                  >
                                    You
                                  </Badge>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <p className="text-[#17382f] font-mono text-[11px]">{u.email}</p>
                          <p className="text-[#5c6f66] font-mono text-[10px]">{u.id}</p>
                        </td>

                        <td className="py-3 px-3">
                          {u.role === "admin" ? (
                            <Badge className="bg-indigo-900 text-indigo-50 text-[10px] gap-1 font-medium">
                              <ShieldAlert className="size-2.5" />
                              Administrator
                            </Badge>
                          ) : u.role === "moderator" ? (
                            <Badge className="bg-[#0e2b24] text-[#f5f3ed] text-[10px] gap-1 font-medium">
                              <ShieldCheck className="size-2.5" />
                              Moderator
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-[#cbd5cb] text-[#486057] text-[10px] gap-1"
                            >
                              <User className="size-2.5" />
                              Civilian
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-3 text-[#5c6f66] text-[11px]">
                          {u.createdAt
                            ? new Date(u.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  aria-label={`Designate role for ${u.fullName}`}
                                  className="h-7 text-xs border-[#cbd5cb] gap-1"
                                />
                              }
                            >
                              <span>Designate</span>
                              <Sparkles className="size-3 text-[#0e2b24]" />
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-56 text-xs">
                              <DropdownMenuLabel className="text-[11px] text-[#5c6f66]">
                                Change Role for {u.fullName}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              {/* Demote to Citizen */}
                              <DropdownMenuItem
                                disabled={u.role === "citizen"}
                                onClick={() => {
                                  setTargetUser(u);
                                  setPendingRole("citizen");
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <User className="size-3.5 text-[#5c6f66]" />
                                <div>
                                  <p className="font-medium">Demote to Civilian</p>
                                  <p className="text-[10px] text-[#5c6f66]">
                                    Standard citizen access
                                  </p>
                                </div>
                              </DropdownMenuItem>

                              {/* Appoint as Moderator */}
                              <DropdownMenuItem
                                disabled={u.role === "moderator"}
                                onClick={() => {
                                  setTargetUser(u);
                                  setPendingRole("moderator");
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <ShieldCheck className="size-3.5 text-emerald-700" />
                                <div>
                                  <p className="font-medium">Appoint Moderator</p>
                                  <p className="text-[10px] text-[#5c6f66]">
                                    Review queue &amp; escalations
                                  </p>
                                </div>
                              </DropdownMenuItem>

                              {/* Appoint as Admin (Gated to Administrators) */}
                              {isAdmin ? (
                                <DropdownMenuItem
                                  disabled={u.role === "admin"}
                                  onClick={() => {
                                    setTargetUser(u);
                                    setPendingRole("admin");
                                  }}
                                  className="gap-2 cursor-pointer"
                                >
                                  <ShieldAlert className="size-3.5 text-indigo-700" />
                                  <div>
                                    <p className="font-medium text-indigo-900">
                                      Appoint Administrator
                                    </p>
                                    <p className="text-[10px] text-[#5c6f66]">
                                      Full municipal governance
                                    </p>
                                  </div>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  disabled
                                  className="gap-2 opacity-50 cursor-not-allowed"
                                >
                                  <Lock className="size-3.5 text-neutral-400" />
                                  <div>
                                    <p className="font-medium text-neutral-500">
                                      Appoint Administrator
                                    </p>
                                    <p className="text-[10px] text-neutral-400">
                                      Requires Admin Role
                                    </p>
                                  </div>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Confirmation Modal ─── */}
      <Dialog
        open={!!targetUser && !!pendingRole}
        onOpenChange={(open) => {
          if (!open) {
            setTargetUser(null);
            setPendingRole(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-[#faf9f5] border border-[#cbd5cb]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#0e2b24]">
              Confirm Role Delegation
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5c6f66]">
              You are modifying the civic authority level for this account under municipal PRD §2.
            </DialogDescription>
          </DialogHeader>

          {targetUser && pendingRole && (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-md border border-[#cbd5cb] bg-white p-3 space-y-1">
                <p className="font-semibold text-[#17382f]">{targetUser.fullName}</p>
                <p className="text-[#5c6f66] font-mono text-[11px]">{targetUser.email}</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-[#5c6f66]">Current:</span>
                  <Badge variant="outline" className="text-[10px]">
                    {targetUser.role}
                  </Badge>
                  <span className="text-[11px] text-[#5c6f66]">➔ Target:</span>
                  <Badge className="bg-[#0e2b24] text-white text-[10px]">{pendingRole}</Badge>
                </div>
              </div>

              {pendingRole === "admin" && (
                <div className="rounded-md border border-indigo-200 bg-indigo-50 p-2.5 text-indigo-900 text-[11px] flex items-start gap-2">
                  <ShieldAlert className="size-3.5 shrink-0 text-indigo-700 mt-0.5" />
                  <span>
                    Granting Administrator privileges delegates full system authority, including
                    user role management and automated municipal dispatch settings.
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTargetUser(null);
                setPendingRole(null);
              }}
              disabled={isUpdating}
              className="border-[#cbd5cb] text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRoleChangeConfirm}
              disabled={isUpdating}
              className="bg-[#0e2b24] hover:bg-[#1c4b3e] text-white text-xs h-9 gap-1.5"
            >
              {isUpdating ? (
                <>
                  <Spinner className="size-3.5" />
                  <span>Delegating Role...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>Confirm Delegation</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
