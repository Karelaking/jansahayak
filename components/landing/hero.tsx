import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@/components/icons";
import { siteConfig } from "@/lib/site";
import { MapIllustration } from "./map-illustration";

export function Hero() {
  return (
    <div className="hero-grid">
      <div className="hero-copy">
        <p className="location-note"><span className="location-dot" /> Pilot area · {siteConfig.pilotArea}</p>
        <h1>Safer streets<br /><span>start with us.</span></h1>
        <p className="hero-intro">
          Spot something unsafe? Document it once, help others find it, and follow the recorded path towards a fix.
        </p>
        <div className="hero-actions">
          <Link className="button button-dark" href="/reports/new">Report a hazard <ArrowUpRight /></Link>
          <Link className="text-link" href="#map">Explore the map <ArrowRight /></Link>
        </div>
        <p className="trust-note"><span className="trust-check">✓</span> A civic coordination layer that complements official channels.</p>
      </div>
      <MapIllustration />
    </div>
  );
}
