import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { UserRole } from "@/lib/auth/roles";

/**
 * Authentication Login Endpoint
 * POST /api/auth/login
 *
 * Supports credentials and rapid persona authentication for Citizen, Moderator, and Admin.
 * Sets standard HTTP cookies for local and multi-environment session persistence.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const role = (body.role as UserRole) || "citizen";
    const email = (body.email as string)?.trim() || `${role}@jansahayak.in`;
    const fullName =
      (body.fullName as string)?.trim() ||
      (role === "admin"
        ? "Civic Administrator"
        : role === "moderator"
          ? "Municipal Officer"
          : "Verified Citizen");

    let userId = (body.userId as string)?.trim();
    if (!userId) {
      if (role === "admin") userId = "admin_dev_01";
      else if (role === "moderator") userId = "mod_dev_01";
      else userId = `citizen_${Date.now().toString(36)}`;
    }

    // Upsert into PostgreSQL users table
    try {
      await db
        .insert(users)
        .values({
          id: userId,
          email,
          fullName,
          role,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email,
            fullName,
            role,
            updatedAt: new Date(),
          },
        });
    } catch (dbErr) {
      console.warn("DB user sync warning:", dbErr);
    }

    const res = NextResponse.json({
      success: true,
      message: `Signed in successfully as ${role}`,
      user: {
        userId,
        email,
        fullName,
        role,
        isAuthenticated: true,
      },
    });

    // Set standard cookies (14 days expiry)
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
