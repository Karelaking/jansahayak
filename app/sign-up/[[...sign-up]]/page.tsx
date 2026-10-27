import * as React from "react";
import type { Metadata } from "next";
import { CustomSignUp } from "@/components/auth/custom-sign-up";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "Create an Account | JanSahayak SafeStreets",
  description:
    "Create a citizen account to report road hazards and follow local road-safety cases.",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
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
      <CustomSignUp hasClerkKeys={hasClerkKeys} />
    </React.Suspense>
  );
}
