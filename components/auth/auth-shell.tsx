import * as React from "react";

import { SiteFooter, SiteNav } from "@/components/sections";

export interface AuthNoticePoint {
  title: string;
  body: string;
}

export interface AuthNotice {
  title: string;
  body: string;
  points?: readonly AuthNoticePoint[];
  meta?: string;
}

/**
 * Shared frame for every authentication screen. The form panel comes first in
 * the document; the supporting notice sits beside it on desktop and after it
 * on smaller screens, so the task is always the first thing in reach.
 */
export function AuthShell({ notice, children }: { notice: AuthNotice; children: React.ReactNode }) {
  return (
    <div className="box-grid auth-page">
      <SiteNav />
      <main className="auth-main">
        <section className="section-box auth-board" aria-labelledby="auth-title">
          <div className="auth-panel">
            <div className="auth-panel-inner">{children}</div>
          </div>

          <aside className="auth-notice" aria-labelledby="auth-notice-title">
            <div className="auth-notice-intro">
              <h2 id="auth-notice-title">{notice.title}</h2>
              <p>{notice.body}</p>
            </div>

            {notice.points?.length ? (
              <ul className="auth-notice-list">
                {notice.points.map((point) => (
                  <li key={point.title}>
                    <strong>{point.title}</strong>
                    <span>{point.body}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {notice.meta ? <p className="auth-notice-meta">{notice.meta}</p> : null}
          </aside>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
