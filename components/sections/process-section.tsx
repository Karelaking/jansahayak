import Link from "next/link";
import { ArrowRight } from "@/components/icons";

const actions = [
  ["Report a hazard", "Give an unsafe place a clear record.", "/reports/new"],
  ["Connect related reports", "See what your neighbourhood already knows.", "/map"],
  ["Follow recorded updates", "Understand what has happened since.", "/how-it-works"],
  ["Review evidence of a fix", "Keep progress grounded in what is known.", "/how-it-works"],
] as const;

export function ProcessSection() {
  return (
    <section className="action-strip" id="how-it-works">
      <p className="section-label">One observation can move further</p>
      <div className="action-list">
        {actions.map(([title, description, href], index) => (
          <Link href={href} className="action-item" key={title}>
            <span className="action-number">{String(index + 1).padStart(2, "0")}</span>
            <span><strong>{title}</strong><small>{description}</small></span>
            <ArrowRight />
          </Link>
        ))}
      </div>
    </section>
  );
}
