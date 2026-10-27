import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@/lib/auth/clerk-config";

/**
 * Clerk middleware is only mounted when both Clerk keys are present. Without
 * them the proxy is a no-op so local development and the automated harness can
 * run without contacting Clerk.
 */
const handler = isClerkConfigured() ? clerkMiddleware() : () => NextResponse.next();

export default handler;
export const proxy = handler;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
