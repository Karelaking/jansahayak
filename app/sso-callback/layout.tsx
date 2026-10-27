import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Signing In | JanSahayak SafeStreets",
  robots: { index: false, follow: false },
};

export default function SSOCallbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
