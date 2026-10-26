import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";

interface ClerkProviderWrapperProps {
  children: React.ReactNode;
}

/**
 * ClerkProviderWrapper
 *
 * Wraps the application with ClerkProvider when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
 * is configured with a valid public key. When running in local development or test
 * environments without external keys, passes through children safely so unit tests
 * and local database sessions continue uninterrupted.
 */
export function ClerkProviderWrapper({ children }: ClerkProviderWrapperProps) {
  const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (pubKey && pubKey.startsWith("pk_") && !pubKey.includes("placeholder")) {
    return (
      <ClerkProvider
        publishableKey={pubKey}
        appearance={{
          variables: {
            colorPrimary: "#0e2b24",
            colorBackground: "#faf9f5",
            borderRadius: "0.5rem",
          },
        }}
      >
        {children}
      </ClerkProvider>
    );
  }

  return <>{children}</>;
}
