import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { listAllUsers } from "@/lib/auth/user-store";

/**
 * Administrative User Directory API
 * GET /api/admin/users
 *
 * PRD §2 & §14B:
 * Allows authorized staff (Moderators and Administrators) to inspect
 * registered civic users, their roles, and metadata.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUserSession(req);

    if (session.role !== "moderator" && session.role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Forbidden: Only designated moderators or administrators can access the civic staff directory.",
        },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const role = searchParams.get("role") || undefined;

    const usersList = await listAllUsers({ search, role });

    return NextResponse.json({
      success: true,
      count: usersList.length,
      users: usersList,
      requester: {
        userId: session.userId,
        role: session.role,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
