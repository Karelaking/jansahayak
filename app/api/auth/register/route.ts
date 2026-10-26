import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { UserRole } from "@/lib/auth/roles";

/**
 * Authentication Register Endpoint
 * POST /api/auth/register
 *
 * Creates a new account in PostgreSQL and sets session cookies.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email as string)?.trim().toLowerCase();
    const fullName = (body.fullName as string)?.trim();
    const role = (body.role as UserRole) || "citizen";

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

    const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    await db.insert(users).values({
      id: userId,
      email,
      fullName,
      role,
      updatedAt: new Date(),
    });

    const res = NextResponse.json({
      success: true,
      message: "Account registered successfully",
      user: {
        userId,
        email,
        fullName,
        role,
        isAuthenticated: true,
      },
    });

    const maxAge = 60 * 60 * 24 * 14;
    res.cookies.set("jansahayak_user_id", userId, {
      path: "/",
      maxAge,
      sameSite: "lax",
      httpOnly: false,
    });
    res.cookies.set("jansahayak_role", role, {
      path: "/",
      maxAge,
      sameSite: "lax",
      httpOnly: false,
    });

    return res;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
