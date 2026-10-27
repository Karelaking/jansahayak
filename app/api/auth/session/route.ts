import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { ANONYMOUS_USER_ID, ROLE_PERMISSIONS } from "@/lib/auth/roles";

/**
 * PRD §2 & §14B User Session & Role Introspection Endpoint
 * GET /api/auth/session
 *
 * Returns current authenticated user session, role classification,
 * and capability permissions for client-side RBAC gating.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);
    const permissions = ROLE_PERMISSIONS[session.role] || ROLE_PERMISSIONS.citizen;

    return NextResponse.json({
      success: true,
      session: {
        ...session,
        permissions,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: msg,
        session: {
          userId: ANONYMOUS_USER_ID,
          email: "",
          role: "citizen",
          isAuthenticated: false,
          permissions: ROLE_PERMISSIONS.citizen,
        },
      },
      { status: 200 },
    );
  }
}
