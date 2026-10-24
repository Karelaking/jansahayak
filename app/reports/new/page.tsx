import Link from "next/link";
import { ArrowRight } from "@/components/icons";

export default function NewReportPage() {
  return (
    <main className="report-page">
      <Link className="report-back" href="/">
        <ArrowRight /> Back to JanSahayak
      </Link>
      <section className="report-panel" aria-labelledby="report-title">
        <p className="location-note">
          <span className="location-dot" /> Greater Noida pilot
        </p>
        <h1 id="report-title">Report a hazard</h1>
        <p className="report-intro">
          Start a clear record of an unsafe road condition. You can add location and evidence
          details next.
        </p>
        <form className="report-form">
          <label>
            What needs attention?
            <select defaultValue="">
              <option value="" disabled>
                Select a hazard type
              </option>
              <option>Unsafe crossing</option>
              <option>Broken footpath</option>
              <option>Poorly lit street</option>
              <option>Other road-safety issue</option>
            </select>
          </label>
          <label>
            Where is it?
            <input type="text" placeholder="Street, landmark, or neighbourhood" />
          </label>
          <button type="button" className="button button-dark">
            Continue report <ArrowRight />
          </button>
        </form>
      </section>
    </main>
  );
}
