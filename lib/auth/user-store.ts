import { db, users } from "@/lib/db";
import {
  ANONYMOUS_USER_ID,
  isUserRole,
  parseUserRole,
  UserRole,
} from "@/lib/auth/roles";
import { desc, eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { isClerkBackendEnabled, isTestEnvironment } from "./clerk-config";

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

/**
 * Clerk's user objects are structurally compatible with this subset. Keeping the
 * shape local avoids importing transitive backend types that pnpm does not expose
 * to the application.
 */
interface ClerkUserLike {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  imageUrl?: string;
  primaryEmailAddressId?: string | null;
  emailAddresses?: Array<{ id: string; emailAddress: string }>;
  publicMetadata?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

type DbUser = typeof users.$inferSelect;

function getStore(): Map<string, UserRecord> {
  if (!global.__jansahayak_users_store__) {
    // Intentionally empty: the directory is populated from Clerk (or the database
    // in test/local mode), never from seeded demo personas.
    global.__jansahayak_users_store__ = new Map<string, UserRecord>();
  }
  return global.__jansahayak_users_store__;
}

function toIsoDate(
  value: Date | string | number | null | undefined,
  fallback = new Date(),
): string {
  if (!value) return fallback.toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString();
}

function mapDbRow(row: DbUser): UserRecord {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName || row.email || row.id,
    role: parseUserRole(row.role) ?? "citizen",
    phoneNumber: row.phoneNumber,
    avatarUrl: row.avatarUrl,
    createdAt: toIsoDate(row.createdAt),
    updatedAt: toIsoDate(row.updatedAt),
  };
}

function mapClerkUser(clerkUser: ClerkUserLike, dbRow?: DbUser): UserRecord {
  const primaryEmail =
    clerkUser.emailAddresses?.find((address) => address.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ||
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    "";
  const email = primaryEmail || dbRow?.email || "";
  const name = [clerkUser.firstName?.trim(), clerkUser.lastName?.trim()]
    .filter(Boolean)
    .join(" ");

  return {
    id: clerkUser.id,
    email,
    fullName: name || clerkUser.username || dbRow?.fullName || email || clerkUser.id,
    role: parseUserRole(clerkUser.publicMetadata?.role) ?? parseUserRole(dbRow?.role) ?? "citizen",
    phoneNumber: dbRow?.phoneNumber ?? null,
    avatarUrl: clerkUser.imageUrl || dbRow?.avatarUrl || null,
    createdAt: toIsoDate(clerkUser.createdAt, dbRow?.createdAt ? new Date(dbRow.createdAt) : undefined),
    updatedAt: toIsoDate(clerkUser.updatedAt, dbRow?.updatedAt ? new Date(dbRow.updatedAt) : undefined),
  };
}

async function readDbUsers(): Promise<DbUser[]> {
  try {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  } catch {
    return [];
  }
}

async function readDbUser(userId: string): Promise<DbUser | undefined> {
  if (!userId || userId === ANONYMOUS_USER_ID) return undefined;
  try {
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return rows[0];
  } catch {
    return undefined;
  }
}

async function upsertDbUser(record: UserRecord): Promise<void> {
  if (!record.email) return;

  try {
    await db
      .insert(users)
      .values({
        id: record.id,
        email: record.email,
        fullName: record.fullName || null,
        role: record.role,
        avatarUrl: record.avatarUrl || null,
        updatedAt: new Date(record.updatedAt),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: record.email,
          fullName: record.fullName || null,
          role: record.role,
          avatarUrl: record.avatarUrl || null,
          updatedAt: new Date(record.updatedAt),
        },
      });
  } catch (error) {
    console.warn("User store DB sync fallback:", error);
  }
}

function applyFilters(results: UserRecord[], filters?: { search?: string; role?: string }) {
  let filtered = results;

  if (filters?.role && filters.role !== "all") {
    filtered = filtered.filter((user) => user.role === filters.role);
  }

  if (filters?.search && filters.search.trim()) {
    const query = filters.search.trim().toLowerCase();
    filtered = filtered.filter(
      (user) =>
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query),
    );
  }

  return filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Lists registered users with optional search and role filtering.
 *
 * With Clerk configured, Clerk is the directory of record and Postgres only
 * supplies roles/details that have not been written back to Clerk metadata yet.
 * In test/local mode the Postgres table (plus the in-memory mirror) is used.
 */
export async function listAllUsers(filters?: {
  search?: string;
  role?: string;
}): Promise<UserRecord[]> {
  if (isClerkBackendEnabled()) {
    try {
      const client = await clerkClient();
      const response = await client.users.getUserList({ limit: 100 });
      const dbRows = await readDbUsers();
      const dbById = new Map(dbRows.map((row) => [row.id, row]));

      return applyFilters(
        response.data.map((user) =>
          mapClerkUser(user as unknown as ClerkUserLike, dbById.get(user.id)),
        ),
        filters,
      );
    } catch (error) {
      console.warn("Clerk user directory lookup failed, using Postgres mirror:", error);
    }
  }

  const store = getStore();
  const dbRows = await readDbUsers();
  const results = new Map<string, UserRecord>();

  for (const row of dbRows) {
    const record = mapDbRow(row);
    store.set(record.id, record);
    results.set(record.id, record);
  }

  // In-memory entries cover test users created while the database is unreachable.
  for (const [id, user] of store.entries()) {
    if (!results.has(id)) results.set(id, user);
  }

  return applyFilters(Array.from(results.values()), filters);
}

/**
 * Finds a specific user by ID. Returns null for unknown users outside the test
 * harness instead of inventing a placeholder identity.
 */
export async function findUserById(userId: string): Promise<UserRecord | null> {
  if (!userId || userId === ANONYMOUS_USER_ID) return null;

  const store = getStore();

  if (isClerkBackendEnabled()) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      const dbRow = await readDbUser(userId);
      const record = mapClerkUser(clerkUser as unknown as ClerkUserLike, dbRow);
      store.set(record.id, record);
      return record;
    } catch {
      // Clerk 404 or transient API failure: fall back to the Postgres mirror.
    }
  }

  const dbRow = await readDbUser(userId);
  if (dbRow) {
    const record = mapDbRow(dbRow);
    store.set(record.id, record);
    return record;
  }

  return store.get(userId) ?? null;
}

/**
 * Registers a civilian user for the local development bridge.
 * Enforces role: "citizen" for public self-registration.
 */
export async function registerCivilianUser(params: {
  id?: string;
  email: string;
  fullName: string;
}): Promise<UserRecord> {
  const store = getStore();
  const requestedId = params.id?.trim();
  const userId =
    requestedId && isTestEnvironment()
      ? requestedId
      : `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const existing = await findUserById(userId);

  const user: UserRecord = {
    id: userId,
    email: params.email.trim().toLowerCase(),
    fullName: params.fullName.trim(),
    role: existing?.role ?? "citizen",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  store.set(userId, user);
  await upsertDbUser(user);

  return user;
}

/**
 * Updates a user's role in Clerk (when configured) and mirrors it to Postgres.
 *
 * In test mode unknown IDs are created on demand so delegation tests can target
 * arbitrary user IDs. Outside tests, unknown IDs resolve to null rather than a
 * fabricated account.
 */
export async function updateUserRoleInStore(
  userId: string,
  newRole: UserRole,
): Promise<UserRecord | null> {
  if (!userId || userId === ANONYMOUS_USER_ID || !isUserRole(newRole)) return null;

  const store = getStore();
  const now = new Date().toISOString();

  if (isClerkBackendEnabled()) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      const publicMetadata = {
        ...(clerkUser.publicMetadata || {}),
        role: newRole,
      };

      await client.users.updateUserMetadata(userId, { publicMetadata });

      const dbRow = await readDbUser(userId);
      const record = mapClerkUser(
        { ...(clerkUser as unknown as ClerkUserLike), publicMetadata },
        dbRow,
      );
      store.set(userId, record);
      await upsertDbUser(record);
      return record;
    } catch (error) {
      console.warn("Clerk role update failed:", error);
      return null;
    }
  }

  const existing = await findUserById(userId);
  if (!existing && !isTestEnvironment()) {
    return null;
  }

  const user: UserRecord = existing
    ? { ...existing, role: newRole, updatedAt: now }
    : {
        id: userId,
        email: `${userId}@test.invalid`,
        fullName: userId,
        role: newRole,
        createdAt: now,
        updatedAt: now,
      };

  store.set(userId, user);
  await upsertDbUser(user);
  return user;
}
