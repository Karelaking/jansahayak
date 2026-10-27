import * as React from "react";
import type { Metadata } from "next";
import { CustomSignIn } from "@/components/auth/custom-sign-in";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "Sign In | JanSahayak SafeStreets",
  description:
    "Sign in to your JanSahayak account to file reports and follow local road-safety cases.",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  const hasClerkKeys = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_") &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder"),
  );

  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#f5f3ed]">
          <Spinner className="size-6 text-[#0e2b24]" />
        </div>
      }
    >
      <CustomSignIn hasClerkKeys={hasClerkKeys} />
    </React.Suspense>
  );
}
