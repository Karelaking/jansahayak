import {
  HazardSection,
  HeroSection,
  ProcessSection,
  SiteFooter,
  SiteNav,
} from "@/components/sections";

export default function Home() {
  return (
    <main>
      <section className="hero-shell">
        <SiteNav />
        <HeroSection />
      </section>
      <ProcessSection />
      <HazardSection />
      <SiteFooter />
    </main>
  );
}
