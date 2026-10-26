import { db, users } from "@/lib/db";
import { UserRole } from "@/lib/auth/roles";
import { eq, desc } from "drizzle-orm";

export interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __jansahayak_users_store__: Map<string, UserRecord> | undefined;
}

const DEFAULT_SEED_USERS: UserRecord[] = [
  {
    id: "admin_dev_01",
    email: "admin@jansahayak.in",
    fullName: "Civic Administrator",
    role: "admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "mod_dev_01",
    email: "moderator@jansahayak.in",
    fullName: "Municipal Officer",
    role: "moderator",
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "citizen_dev",
    email: "citizen@jansahayak.in",
    fullName: "Verified Citizen",
    role: "citizen",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
];

function getStore(): Map<string, UserRecord> {
  if (!global.__jansahayak_users_store__) {
    const store = new Map<string, UserRecord>();
    for (const u of DEFAULT_SEED_USERS) {
      store.set(u.id, { ...u });
    }
    global.__jansahayak_users_store__ = store;
  }
  return global.__jansahayak_users_store__;
}

/**
 * Lists all registered users with optional search and role filtering.
 * Tries PostgreSQL first; falls back to in-memory store if DB is offline.
 */
export async function listAllUsers(filters?: {
  search?: string;
  role?: string;
}): Promise<UserRecord[]> {
  const store = getStore();

  let results: UserRecord[] = [];

  try {
    const dbRows = await db.select().from(users).orderBy(desc(users.createdAt));
    if (dbRows.length > 0) {
      const dbMap = new Map<string, UserRecord>();
      for (const row of dbRows) {
        const u: UserRecord = {
          id: row.id,
          email: row.email,
          fullName: row.fullName || "Unnamed Citizen",
          role: (row.role as UserRole) || "citizen",
          phoneNumber: row.phoneNumber,
          avatarUrl: row.avatarUrl,
          createdAt: row.createdAt
            ? new Date(row.createdAt).toISOString()
            : new Date().toISOString(),
          updatedAt: row.updatedAt
            ? new Date(row.updatedAt).toISOString()
            : new Date().toISOString(),
        };
        dbMap.set(u.id, u);
        store.set(u.id, u);
      }
      // Also include seed users not in DB
      for (const [id, user] of store.entries()) {
        if (!dbMap.has(id)) {
          dbMap.set(id, user);
        }
      }
      results = Array.from(dbMap.values());
    } else {
      results = Array.from(store.values());
    }
  } catch {
    results = Array.from(store.values());
  }

  // Apply filters
  if (filters?.role && filters.role !== "all") {
    results = results.filter((u) => u.role === filters.role);
  }

  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    results = results.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }

  // Sort: newest first
  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Finds a specific user by ID.
 */
export async function findUserById(userId: string): Promise<UserRecord | null> {
  const store = getStore();

  try {
    const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (row) {
      const u: UserRecord = {
        id: row.id,
        email: row.email,
        fullName: row.fullName || "Unnamed Citizen",
        role: (row.role as UserRole) || "citizen",
        phoneNumber: row.phoneNumber,
        avatarUrl: row.avatarUrl,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
      };
      store.set(u.id, u);
      return u;
    }
  } catch {
    // DB fallback
  }

  return store.get(userId) || null;
}

/**
 * Registers or upserts a civilian user into the system.
 * Enforces role: "citizen" for public self-registration.
 */
export async function registerCivilianUser(params: {
  id?: string;
  email: string;
  fullName: string;
}): Promise<UserRecord> {
  const store = getStore();
  const userId =
    params.id || `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const user: UserRecord = {
    id: userId,
    email: params.email.trim().toLowerCase(),
    fullName: params.fullName.trim(),
    role: "citizen", // Explicitly locked to citizen
    createdAt: now,
    updatedAt: now,
  };

  store.set(userId, user);

  try {
    await db
      .insert(users)
      .values({
        id: userId,
        email: user.email,
        fullName: user.fullName,
        role: "citizen",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          fullName: user.fullName,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.warn("User store DB registration fallback:", err);
  }

  return user;
}

/**
 * Updates a user's role in the database and in-memory store.
 */
export async function updateUserRoleInStore(
  userId: string,
  newRole: UserRole,
): Promise<UserRecord | null> {
  const store = getStore();
  const now = new Date().toISOString();

  let existing = await findUserById(userId);
  if (!existing) {
    // If user does not exist yet, initialize it
    existing = {
      id: userId,
      email: `${userId}@jansahayak.internal`,
      fullName: "Civic Resident",
      role: newRole,
      createdAt: now,
      updatedAt: now,
    };
  } else {
    existing.role = newRole;
    existing.updatedAt = now;
  }

  store.set(userId, existing);

  try {
    await db
      .insert(users)
      .values({
        id: userId,
        email: existing.email,
        fullName: existing.fullName,
        role: newRole,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          role: newRole,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.warn("User role DB update fallback:", err);
  }

  return existing;
}
