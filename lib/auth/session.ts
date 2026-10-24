import { UserRole, UserSession } from "./roles";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * Server-side helper to retrieve the current authenticated user session.
 * Integrates directly with Clerk JS while maintaining a graceful fallback for local development.
 */
export async function getCurrentUserSession(): Promise<UserSession> {
  // Check if Clerk environment variables are configured
  const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkSecret = process.env.CLERK_SECRET_KEY;

  if (clerkPubKey && clerkSecret && !clerkPubKey.includes("placeholder")) {
    try {
      // Dynamic import using variable to avoid build-time failure before user runs manual pnpm add @clerk/nextjs
      const clerkPkgName = "@clerk/nextjs/server";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clerkServer: any = await Function(
        "moduleName",
        "return import(moduleName)",
      )(clerkPkgName).catch(() => null);

      if (clerkServer && typeof clerkServer.auth === "function") {
        const { userId } = await clerkServer.auth();

        if (userId) {
          // Look up user role in PostgreSQL
          try {
            const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

            if (dbUser) {
              return {
                userId: dbUser.id,
                email: dbUser.email,
                fullName: dbUser.fullName || undefined,
                role: (dbUser.role as UserRole) || "citizen",
                avatarUrl: dbUser.avatarUrl || undefined,
                isAuthenticated: true,
              };
            }
          } catch {
            // DB query fallback if DB is still starting
          }

          // Fetch user details from Clerk client
          if (typeof clerkServer.currentUser === "function") {
            const clerkUser = await clerkServer.currentUser();
            const email = clerkUser?.emailAddresses?.[0]?.emailAddress || "user@jansahayak.in";
            const role = (clerkUser?.publicMetadata?.role as UserRole) || "citizen";

            return {
              userId,
              email,
              fullName:
                `${clerkUser?.firstName || ""} ${clerkUser?.lastName || ""}`.trim() || undefined,
              role,
              avatarUrl: clerkUser?.imageUrl || undefined,
              isAuthenticated: true,
            };
          }

          return {
            userId,
            email: "user@jansahayak.in",
            role: "citizen",
            isAuthenticated: true,
          };
        }
      }
    } catch (err) {
      console.warn("Clerk auth evaluation fallback:", err);
    }
  }

  // Development / Local Sandbox Session Fallback
  return {
    userId: "dev_moderator_01",
    email: "lead.moderator@jansahayak.in",
    fullName: "Aditi Rao (Senior Inspector)",
    role: "moderator",
    avatarUrl: undefined,
    isAuthenticated: true,
  };
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
