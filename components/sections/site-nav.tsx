import Link from "next/link";
import { ArrowUpRight } from "@/components/icons";
import { Brand } from "@/components/brand";
import { siteConfig } from "@/lib/site";

export function SiteNav() {
  return (
    <nav className="site-nav" aria-label="Main navigation">
      <Link className="brand" href="/" aria-label={`${siteConfig.productName} home`}>
        <Brand />
      </Link>
      <div className="nav-links">
        {siteConfig.navigation.map((item) => (
          <Link href={item.href} key={item.href}>{item.label}</Link>
        ))}
      </div>
      <div className="nav-actions">
        <span className="language-display" aria-label="Current language: English">EN</span>
        <Link className="button button-small button-dark" href="/reports/new">
          Report a hazard <ArrowUpRight />
        </Link>
      </div>
    </nav>
  );
}
