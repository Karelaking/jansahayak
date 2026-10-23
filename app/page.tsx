import { ActionStrip } from "@/components/landing/action-strip";
import { HazardSection } from "@/components/landing/hazard-section";
import { Hero } from "@/components/landing/hero";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";

export default function Home() {
  return (
    <main>
      <section className="hero-shell">
        <SiteNav />
        <Hero />
      </section>
      <ActionStrip />
      <HazardSection />
      <SiteFooter />
    </main>
  );
}
