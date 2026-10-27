import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/lib/auth/roles";
import { registerCivilianUser } from "@/lib/auth/user-store";
import { isLocalAuthBridgeEnabled, isTestEnvironment } from "@/lib/auth/clerk-config";

/**
 * Local Registration Bridge
 * POST /api/auth/register
 *
 * PRD §2, §14B, & Civic Governance Rule:
 * During account creation, users can ONLY create a civilian account ("citizen").
 * Moderator and Admin roles cannot be requested or selected by default.
 *
 * The bridge is only available in tests or local development without Clerk keys.
 * Production registration is handled by Clerk.
 */
export async function POST(req: NextRequest) {
  if (!isLocalAuthBridgeEnabled()) {
    return NextResponse.json(
      {
        success: false,
        error: "Local registration is disabled. Accounts are created through Clerk.",
      },
      { status: 403 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const fullName = (body.fullName as string | undefined)?.trim();

    // Security invariant: public self-registration is strictly locked to civilian status
    const role: UserRole = "citizen";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email address is required." },
        { status: 400 },
      );
    }

    if (!fullName || fullName.length < 2) {
      return NextResponse.json(
        { success: false, error: "Full name must be at least 2 characters." },
        { status: 400 },
      );
    }

    // Client-supplied IDs are only honoured by the automated test harness.
    const customId =
      isTestEnvironment() && typeof body.userId === "string" ? body.userId.trim() : undefined;
    const registeredUser = await registerCivilianUser({
      id: customId,
      email,
      fullName,
    });

    const res = NextResponse.json({
      success: true,
      message: "Civic civilian account registered successfully",
      user: {
        userId: registeredUser.id,
        email: registeredUser.email,
        fullName: registeredUser.fullName,
        role: "citizen",
        isAuthenticated: true,
      },
    });

    const maxAge = 60 * 60 * 24 * 14;
    res.cookies.set("jansahayak_user_id", registeredUser.id, {
      path: "/",
      maxAge,
      sameSite: "lax",
      httpOnly: true,
    });
    res.cookies.set("jansahayak_role", role, {
      path: "/",
      maxAge,
      sameSite: "lax",
      httpOnly: true,
    });

    return res;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
