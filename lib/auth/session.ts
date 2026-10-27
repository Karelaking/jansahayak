import { ANONYMOUS_USER_ID, normalizeUserRole, parseUserRole, UserRole, UserSession } from "./roles";
import { db, isDatabaseReachable, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  isClerkBackendEnabled,
  isLocalAuthBridgeEnabled,
  isTestEnvironment,
} from "./clerk-config";

/**
 * Server-side helper to retrieve the current authenticated user session.
 *
 * Clerk is the source of truth whenever it is configured. Outside the automated
 * test harness the only trusted inputs are Clerk's own session and (when Clerk is
 * absent in local development) the server-issued local bridge cookie.
 *
 * Test-only `x-user-id` / `x-mock-role` headers remain supported so the integration
 * suite can exercise role-based routes without network calls to Clerk.
 */

const TEST_EMAIL_DOMAIN = "test.invalid";

function emptySession(): UserSession {
  return {
    userId: "",
    email: "",
    role: "citizen",
    isAuthenticated: false,
  };
}

function getTestHeaderIdentity(req?: Request): {
  userId?: string;
  role?: string;
} {
  if (!req) return {};
  return {
    userId: req.headers.get("x-user-id") || req.headers.get("x-mock-user-id") || undefined,
    role: req.headers.get("x-user-role") || req.headers.get("x-mock-role") || undefined,
  };
}

async function readClerkSession(userId: string): Promise<UserSession> {
  let clerkUser = null;
  try {
    clerkUser = await currentUser();
  } catch (error) {
    console.warn("Clerk currentUser() retrieval note:", error);
  }

  const primaryEmail =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    "";
  const fullName =
    [clerkUser?.firstName?.trim(), clerkUser?.lastName?.trim()].filter(Boolean).join(" ") ||
    clerkUser?.username ||
    undefined;
  const avatarUrl = clerkUser?.imageUrl || undefined;

  // Preserve a role that was previously granted in Postgres when Clerk metadata
  // has not been populated yet. Never reset staff accounts back to "citizen".
  let existingUser: typeof users.$inferSelect | undefined;
  if (await isDatabaseReachable()) {
    try {
      const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      existingUser = rows[0];
    } catch {
      // Non-blocking: database query error.
    }
  }

  const role =
    parseUserRole(clerkUser?.publicMetadata?.role) ??
    parseUserRole(existingUser?.role) ??
    ("citizen" satisfies UserRole);

  const email = primaryEmail || existingUser?.email || "";
  const resolvedFullName = fullName || existingUser?.fullName || undefined;

  if (email && (await isDatabaseReachable())) {
    try {
      await db
        .insert(users)
        .values({
          id: userId,
          email,
          fullName: resolvedFullName || null,
          role,
          avatarUrl: avatarUrl || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email,
            fullName: resolvedFullName || null,
            role,
            avatarUrl: avatarUrl || null,
            updatedAt: new Date(),
          },
        });
    } catch {
      // Non-blocking in case the database is unavailable.
    }
  }

  return {
    userId,
    email,
    fullName: resolvedFullName,
    role,
    avatarUrl,
    isAuthenticated: true,
  };
}

export async function getCurrentUserSession(req?: Request): Promise<UserSession> {
  // 1. Automated test harness: trust explicit mock headers, never Clerk.
  if (isTestEnvironment()) {
    const { userId: headerUserId, role: headerRole } = getTestHeaderIdentity(req);

    if (headerUserId) {
      return {
        userId: headerUserId,
        email: `${headerUserId}@${TEST_EMAIL_DOMAIN}`,
        fullName: undefined,
        role: normalizeUserRole(headerRole),
        isAuthenticated: true,
      };
    }

    // A bare role header without an identity is intentionally unauthenticated.
    return emptySession();
  }

  // 2. Clerk is configured: the session is the only identity source.
  if (isClerkBackendEnabled()) {
    try {
      const { userId } = await auth();
      if (userId) {
        return await readClerkSession(userId);
      }
    } catch (error: any) {
      if (error?.digest !== "HANGING_PROMISE_REJECTION") {
        console.warn("Clerk auth evaluation failed:", error?.message || error);
      }
    }

    return emptySession();
  }

  // 3. Local development bridge (Clerk not configured, non-production only).
  if (!isLocalAuthBridgeEnabled()) {
    return emptySession();
  }

  let cookieUserId: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieUserId = cookieStore.get("jansahayak_user_id")?.value;
  } catch {
    // Outside request scope.
  }

  if (!cookieUserId || cookieUserId === ANONYMOUS_USER_ID) {
    return emptySession();
  }

  if (await isDatabaseReachable()) {
    try {
      const [dbUser] = await db.select().from(users).where(eq(users.id, cookieUserId)).limit(1);

      if (dbUser) {
        return {
          userId: dbUser.id,
          email: dbUser.email,
          fullName: dbUser.fullName || undefined,
          role: normalizeUserRole(dbUser.role),
          avatarUrl: dbUser.avatarUrl || undefined,
          isAuthenticated: true,
        };
      }
    } catch {
      // Non-blocking: database unavailable.
    }
  }

  return emptySession();
}

/**
 * Asserts that the current user has the required role.
 * Throws an unauthorized error if check fails.
 */
export async function requireUserRole(requiredRole: UserRole | UserRole[]): Promise<UserSession> {
  const session = await getCurrentUserSession();
  const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  if (!session.isAuthenticated) {
    throw new Error("Authentication required: Please sign in with Clerk");
  }

  if (!allowed.includes(session.role) && session.role !== "admin") {
    throw new Error(
      `Forbidden: Requires role '${allowed.join(" or ")}', but current role is '${session.role}'`,
    );
  }

  return session;
}
