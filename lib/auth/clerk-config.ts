/**
 * Centralized Clerk environment detection.
 *
 * Keeping these checks in one place prevents individual routes from drifting into
 * inconsistent auth behaviour (for example, calling the Clerk backend during tests
 * or falling back to cookie impersonation while Clerk is active).
 */

export function hasClerkPublishableKey(value: string | undefined): value is string {
  return Boolean(value && value.startsWith("pk_") && !value.includes("placeholder"));
}

/**
 * True when the deployment has enough configuration to run Clerk end-to-end.
 * Requires both the public key (browser) and secret key (server).
 */
export function isClerkConfigured(): boolean {
  return hasClerkPublishableKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY);
}

/** Vitest sets NODE_ENV=test; the harness must never call Clerk in that mode. */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * The cookie-based login/registration bridge exists only for automated tests and
 * for local development on machines without Clerk credentials. It is never
 * available in production and never shadows a configured Clerk instance.
 */
export function isLocalAuthBridgeEnabled(): boolean {
  if (isTestEnvironment()) return true;
  if (process.env.NODE_ENV === "production") return false;
  return !isClerkConfigured();
}

/**
 * Clerk's server-side Backend API (user listing, metadata writes) is only safe to
 * call outside the test harness and when the secret key is present.
 */
export function isClerkBackendEnabled(): boolean {
  return isClerkConfigured() && !isTestEnvironment();
}
