import Link from "next/link";
import { Brand } from "@/components/brand";
import Section from "./section";

export function SiteFooter() {
  return (
    <Section className="footer-box">
      <footer className="site-footer">
        <div className="footer-brand">
          <Link className="brand" href="/" aria-label="JanSahayak SafeStreets home">
            <Brand />
          </Link>
          <p>
            Making road hazards visible,
            <br />
            follow-up traceable.
          </p>
        </div>
        <div className="footer-links">
          <Link href="/about">About the pilot</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/accessibility">Accessibility</Link>
          <Link href="/help">Help</Link>
        </div>
        <p className="footer-note">
          Not a government portal. Official routes remain the source of formal complaints.
        </p>
      </footer>
    </Section>
  );
}
