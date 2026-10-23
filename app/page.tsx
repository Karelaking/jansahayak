const hazards = [
  { label: "Broken footpaths", count: "Walkability", color: "coral" },
  { label: "Unsafe crossings", count: "Pedestrian safety", color: "amber" },
  { label: "Poorly lit streets", count: "Visibility", color: "sage" },
];

function Pin({ color = "green" }: { color?: "green" | "coral" | "amber" }) {
  return (
    <span className={`map-pin map-pin-${color}`} aria-hidden="true">
      <span />
    </span>
  );
}

function ArrowUpRight() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
      <path d="M3 13 13 3M5 3h8v8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function HazardIcon({ type }: { type: "path" | "crossing" | "light" }) {
  if (type === "path") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="m5 18 5-5 3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 9h3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "crossing") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M4 8h16M4 12h16M4 16h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M8 9h8M8 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <main>
      <section className="hero-shell">
        <nav className="site-nav" aria-label="Main navigation">
          <a className="brand" href="/" aria-label="JanSahayak SafeStreets home">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>
              <strong>JanSahayak</strong>
              <small>SafeStreets</small>
            </span>
          </a>
          <div className="nav-links">
            <a href="#map">Explore map</a>
            <a href="#how-it-works">How it works</a>
            <a href="#community">Community impact</a>
          </div>
          <div className="nav-actions">
            <span className="language-display" aria-label="Current language: English">EN</span>
            <a className="button button-small button-dark" href="/reports/new">
              Report a hazard <ArrowUpRight />
            </a>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="location-note"><span className="location-dot" /> Pilot area · Greater Noida, Uttar Pradesh</p>
            <h1>Safer streets<br /><em>start with us.</em></h1>
            <p className="hero-intro">
              Spot something unsafe? Document it once, help others find it, and follow the recorded path towards a fix.
            </p>
            <div className="hero-actions">
              <a className="button button-dark" href="/reports/new">Report a hazard <ArrowUpRight /></a>
              <a className="text-link" href="#map">Explore the map <ArrowRight /></a>
            </div>
            <p className="trust-note"><span className="trust-check">✓</span> A civic coordination layer that complements official channels.</p>
          </div>

          <div className="map-card" id="map" aria-label="Illustration of reported road hazards in Greater Noida">
            <div className="map-card-top">
              <span className="map-label">SAFETY MAP</span>
              <span className="map-status"><i /> Illustrative view</span>
            </div>
            <div className="map-art">
              <div className="map-road road-one" />
              <div className="map-road road-two" />
              <div className="map-road road-three" />
              <div className="map-road road-four" />
              <div className="map-block block-one" />
              <div className="map-block block-two" />
              <div className="map-block block-three" />
              <div className="map-block block-four" />
              <div className="map-block block-five" />
              <div className="map-water" />
              <Pin color="coral" />
              <span className="pin-label pin-label-one">Unsafe crossing</span>
              <Pin color="amber" />
              <span className="pin-label pin-label-two">Broken footpath</span>
              <Pin color="green" />
              <span className="pin-label pin-label-three">Poor lighting</span>
            </div>
            <div className="map-card-bottom">
              <span>Explore reports near you</span>
              <a href="/map" aria-label="Open the public safety map"><ArrowUpRight /></a>
            </div>
          </div>
        </div>
      </section>

      <section className="action-strip" id="how-it-works">
        <p className="section-label">One observation can move further</p>
        <div className="action-list">
          <a href="/reports/new" className="action-item">
            <span className="action-number">01</span>
            <span><strong>Report a hazard</strong><small>Give an unsafe place a clear record.</small></span>
            <ArrowRight />
          </a>
          <a href="/map" className="action-item">
            <span className="action-number">02</span>
            <span><strong>Connect related reports</strong><small>See what your neighbourhood already knows.</small></span>
            <ArrowRight />
          </a>
          <a href="/how-it-works" className="action-item">
            <span className="action-number">03</span>
            <span><strong>Follow recorded updates</strong><small>Understand what has happened since.</small></span>
            <ArrowRight />
          </a>
          <a href="/how-it-works" className="action-item">
            <span className="action-number">04</span>
            <span><strong>Review evidence of a fix</strong><small>Keep progress grounded in what is known.</small></span>
            <ArrowRight />
          </a>
        </div>
      </section>

      <section className="categories-section" id="community">
        <div className="section-heading">
          <div>
            <p className="section-label">What needs attention</p>
            <h2>Small observations.<br /><em>Shared visibility.</em></h2>
          </div>
          <p>From a broken path to a dark school route, a structured report helps turn a daily frustration into useful civic information.</p>
        </div>
        <div className="hazard-list">
          {hazards.map((hazard, index) => (
            <a className="hazard-row" href="/reports/new" key={hazard.label}>
              <span className={`hazard-symbol hazard-symbol-${hazard.color}`} aria-hidden="true">
                <HazardIcon type={index === 0 ? "path" : index === 1 ? "crossing" : "light"} />
              </span>
              <span className="hazard-name"><strong>{hazard.label}</strong><small>{hazard.count}</small></span>
              <span className="hazard-cta">Report this <ArrowUpRight /></span>
            </a>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <a className="brand" href="/" aria-label="JanSahayak SafeStreets home">
            <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
            <span><strong>JanSahayak</strong><small>SafeStreets</small></span>
          </a>
          <p>Making road hazards visible,<br />follow-up traceable.</p>
        </div>
        <div className="footer-links">
          <a href="/about">About the pilot</a>
          <a href="/privacy">Privacy</a>
          <a href="/accessibility">Accessibility</a>
          <a href="/help">Help</a>
        </div>
        <p className="footer-note">Not a government portal. Official routes remain the source of formal complaints.</p>
      </footer>
    </main>
  );
}
