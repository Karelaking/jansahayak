import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ClerkProviderWrapper } from "@/components/auth/clerk-provider-wrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#faf9f5",
};

export const metadata: Metadata = {
  title: "JanSahayak SafeStreets | Safer streets start with us",
  description:
    "Document road-safety hazards, discover existing reports, and follow recorded civic updates in Greater Noida.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-16 md:pb-0 bg-[#f5f3ed] text-[#17382f]">
        <ClerkProviderWrapper>
          <TooltipProvider>
            {children}
            <Suspense fallback={null}>
              <MobileBottomNav />
            </Suspense>
          </TooltipProvider>
        </ClerkProviderWrapper>
      </body>
    </html>
  );
}
