import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isClerkConfigured, isTestEnvironment } from "@/lib/auth/clerk-config";
import { parseUserRole, UserRole } from "@/lib/auth/roles";

/**
 * Clerk webhooks keep the Postgres mirror of the user directory in sync.
 *
 * Payload fields arrive in snake_case over HTTP, while the SDK types describe the
 * camelCase backend shape; both are accepted so the handler stays correct.
 */
interface ClerkWebhookUserData {
  id: string;
  email_addresses?: Array<{ email_address: string; id: string }>;
  emailAddresses?: Array<{ emailAddress: string; id: string }>;
  primary_email_address_id?: string | null;
  primaryEmailAddressId?: string | null;
  first_name?: string | null;
  firstName?: string | null;
  last_name?: string | null;
  lastName?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  public_metadata?: { role?: unknown; [key: string]: unknown };
  publicMetadata?: { role?: unknown; [key: string]: unknown };
  [key: string]: unknown;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkWebhookUserData;
}

function getSigningSecret(): string {
  return process.env.CLERK_WEBHOOK_SIGNING_SECRET || process.env.CLERK_WEBHOOK_SECRET || "";
}

function resolveEmail(data: ClerkWebhookUserData): string {
  const snakeAddresses = data.email_addresses ?? [];
  const camelAddresses = data.emailAddresses ?? [];
  const primaryId = data.primary_email_address_id ?? data.primaryEmailAddressId;

  const primary =
    snakeAddresses.find((address) => address.id === primaryId)?.email_address ||
    camelAddresses.find((address) => address.id === primaryId)?.emailAddress;

  return primary || snakeAddresses[0]?.email_address || camelAddresses[0]?.emailAddress || "";
}

function resolveMetadata(data: ClerkWebhookUserData): Record<string, unknown> {
  return data.public_metadata || data.publicMetadata || {};
}

/**
 * Verifies the request signature when a signing secret is configured. Without a
 * secret, unverified payloads are only tolerated in local development and the
 * test harness; production and Clerk-enabled deployments reject them.
 */
async function readEvent(req: NextRequest): Promise<ClerkWebhookEvent | null> {
  const signingSecret = getSigningSecret();

  if (signingSecret) {
    try {
      return (await verifyWebhook(req, { signingSecret })) as unknown as ClerkWebhookEvent;
    } catch (error) {
      console.error("Clerk webhook signature verification failed:", error);
      return null;
    }
  }

  const maySkipVerification = isTestEnvironment() || (!isClerkConfigured() && process.env.NODE_ENV !== "production");

  if (!maySkipVerification) {
    console.error("Clerk webhook rejected: CLERK_WEBHOOK_SIGNING_SECRET is not configured.");
    return null;
  }

  try {
    return (await req.json()) as ClerkWebhookEvent;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await readEvent(req);

    if (!payload) {
      return NextResponse.json({ error: "Invalid or unverified webhook payload" }, { status: 400 });
    }

    const { type, data } = payload;

    if (!data?.id) {
      return NextResponse.json({ error: "Missing Clerk user ID in event data" }, { status: 400 });
    }

    switch (type) {
      case "user.created":
      case "user.updated": {
        const [existing] = await db.select().from(users).where(eq(users.id, data.id)).limit(1);

        const email = resolveEmail(data) || existing?.email || "";
        const fullName =
          [data.first_name ?? data.firstName, data.last_name ?? data.lastName]
            .filter((part): part is string => Boolean(part && part.trim()))
            .join(" ")
            .trim() ||
          existing?.fullName ||
          null;
        const avatarUrl = data.image_url || data.imageUrl || existing?.avatarUrl || null;
        const metadata = resolveMetadata(data);

        // Clerk metadata is authoritative when it carries a role. Otherwise keep
        // the role already granted locally instead of resetting staff to citizen.
        const role: UserRole =
          parseUserRole(metadata.role) ?? parseUserRole(existing?.role) ?? "citizen";

        // `users.email` is NOT NULL; a payload without an address cannot be mirrored.
        if (!email) {
          return NextResponse.json({
            success: true,
            skipped: true,
            message: `User ${data.id} has no email address to mirror`,
          });
        }

        await db
          .insert(users)
          .values({
            id: data.id,
            email,
            fullName,
            role,
            avatarUrl,
            metadata,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              email,
              fullName,
              role,
              avatarUrl,
              metadata,
              updatedAt: new Date(),
            },
          });

        return NextResponse.json({
          success: true,
          message: `User ${data.id} synced to Postgres`,
          role,
        });
      }

      case "user.deleted": {
        await db.delete(users).where(eq(users.id, data.id));
        return NextResponse.json({
          success: true,
          message: `User ${data.id} removed from Postgres`,
        });
      }

      default:
        return NextResponse.json({ received: true, ignored: true });
    }
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error("Clerk Webhook processing error:", err);
    return NextResponse.json({ error: err }, { status: 500 });
  }
}
