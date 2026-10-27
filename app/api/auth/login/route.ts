import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { parseUserRole, UserRole } from "@/lib/auth/roles";
import { isLocalAuthBridgeEnabled, isTestEnvironment } from "@/lib/auth/clerk-config";

/**
 * Local Authentication Bridge
 * POST /api/auth/login
 *
 * This endpoint is a development/test convenience only. It is disabled whenever
 * Clerk is configured and is never available in production. The UI uses Clerk's
 * custom sign-in flow whenever Clerk keys are present.
 */
export async function POST(req: NextRequest) {
  if (!isLocalAuthBridgeEnabled()) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Local sign-in is disabled. Authentication is handled by Clerk; use the sign-in page.",
      },
      { status: 403 },
    );
  }

  try {
    const isTest = isTestEnvironment();
    const body = await req.json().catch(() => ({}));
    const requestedRole = parseUserRole(body.role) ?? "citizen";
    const requestedEmail = (body.email as string | undefined)?.trim().toLowerCase();

    let existingUser: typeof users.$inferSelect | undefined;
    if (requestedEmail) {
      try {
        const rows = await db
          .select()
          .from(users)
          .where(eq(users.email, requestedEmail))
          .limit(1);
        existingUser = rows[0];
      } catch {
        // The local bridge still works with an upsert when the lookup fails.
      }
    }

    if (!isTest && !requestedEmail) {
      return NextResponse.json(
        { success: false, error: "A registered email address is required." },
        { status: 400 },
      );
    }

    // Outside tests the bridge never grants a role supplied by the client.
    const role: UserRole = isTest
      ? (parseUserRole(existingUser?.role) ?? requestedRole)
      : (parseUserRole(existingUser?.role) ?? "citizen");

    const email =
      requestedEmail || (isTest ? `${role}@test.invalid` : (existingUser?.email ?? ""));
    const fullName =
      (body.fullName as string | undefined)?.trim() ||
      existingUser?.fullName ||
      email.split("@")[0] ||
      (isTest ? "Test user" : "Citizen");
    const clientUserId = isTest ? (body.userId as string | undefined)?.trim() : undefined;
    const userId =
      clientUserId ||
      existingUser?.id ||
      `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

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

    // Server-issued session bridge for local development only.
    const maxAge = 60 * 60 * 24 * 14;
    res.cookies.set("jansahayak_user_id", userId, {
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
