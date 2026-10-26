import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { canAppointRole, UserRole } from "@/lib/auth/roles";
import { updateUserRoleInStore } from "@/lib/auth/user-store";

/**
 * Role Appointment & Delegation API
 * PATCH /api/admin/users/:userId/role
 *
 * Enforces the municipal role delegation hierarchy:
 * 1. Administrators can appoint Citizens, Moderators, and Administrators.
 * 2. Moderators can appoint and demote Moderators (and demote back to Citizen).
 * 3. Moderators CANNOT appoint Administrators (returns HTTP 403).
 * 4. Civilian accounts cannot manage or mutate any user roles (returns HTTP 403).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await getCurrentUserSession(req);

    if (session.role !== "moderator" && session.role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Only designated moderators or administrators can manage user roles.",
        },
        { status: 403 },
      );
    }

    const { userId } = await params;
    const body = await req.json().catch(() => ({}));
    const targetRole = body.role as UserRole;

    if (!targetRole) {
      return NextResponse.json(
        {
          success: false,
          error: "A target role ('citizen', 'moderator', 'admin') is required.",
        },
        { status: 400 },
      );
    }

    // Role Delegation Matrix Verification
    const appointmentCheck = canAppointRole(session.role, targetRole);
    if (!appointmentCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: appointmentCheck.reason,
        },
        { status: 403 },
      );
    }

    const updatedUser = await updateUserRoleInStore(userId, targetRole);
    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          error: `User with ID '${userId}' could not be located.`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `User role successfully updated to ${targetRole}`,
      user: updatedUser,
      appointedBy: {
        userId: session.userId,
        role: session.role,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
