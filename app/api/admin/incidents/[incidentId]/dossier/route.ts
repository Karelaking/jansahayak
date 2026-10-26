import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/auth/session";
import { compileMunicipalDossier } from "@/lib/email/municipal-dispatcher";
import { db, incidentReports } from "@/lib/db";
import { getReportsCollection } from "@/lib/db/mongodb";
import { eq, and } from "drizzle-orm";

/**
 * PRD §14 & §16 Municipal Grievance Dossier Export & Print Gateway
 * GET /api/admin/incidents/:incidentId/dossier
 *
 * Renders the official, structured Municipal Civic Grievance Dossier for field engineers,
 * municipal liaison officers, and public records export.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ incidentId: string }> },
) {
  try {
    const session = await getCurrentUserSession(req);

    if (!session.isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in to inspect official grievance dossiers." },
        { status: 401 },
      );
    }

    const { incidentId } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format");

    const compiled = await compileMunicipalDossier(incidentId);

    if (!compiled.success || !compiled.dossier) {
      return NextResponse.json(
        { error: compiled.error || `Dossier for incident ${incidentId} could not be found.` },
        { status: 404 },
      );
    }

    // Role & Publication Status Gating (PRD §1 & §16)
    const isStaff = session.role === "moderator" || session.role === "admin";
    if (compiled.incident && !compiled.incident.isPublished && !isStaff) {
      let isSubmitter = false;
      if (session.userId) {
        try {
          const linked = await db
            .select()
            .from(incidentReports)
            .where(
              and(
                eq(incidentReports.incidentId, incidentId),
                eq(incidentReports.userId, session.userId),
              ),
            )
            .limit(1);

          if (linked.length > 0) {
            isSubmitter = true;
          } else {
            const reportsColl = await getReportsCollection();
            const userDoc = await reportsColl.findOne({
              associatedIncidentId: incidentId,
              userId: session.userId,
            });
            if (userDoc) isSubmitter = true;
          }
        } catch {
          // Fallback to strict security rejection
        }
      }

      if (!isSubmitter) {
        return NextResponse.json(
          {
            error:
              "Forbidden: You are not authorized to inspect unapproved or unpublished grievance dossiers.",
          },
          { status: 403 },
        );
      }
    }

    // Support JSON format for API consumers
    if (format === "json") {
      return NextResponse.json({
        success: true,
        docketNumber: compiled.docketNumber,
        recipient: compiled.recipient,
        dossier: compiled.dossier,
      });
    }

    const { dossier } = compiled;

    // Inject Printable Government Grievance Action Bar and Print Stylesheet
    const printableHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JanSahayak Civic Redressal Docket &mdash; ${dossier.docketNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a; margin: 0; padding: 0; line-height: 1.5; }
    .action-bar { background: #0e2b24; color: #f5f3ed; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
    .action-title { font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    .action-btns { display: flex; gap: 10px; align-items: center; }
    .btn-print { background: #10b981; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; transition: background 0.15s ease; display: inline-flex; align-items: center; gap: 6px; }
    .btn-print:hover { background: #059669; }
    .btn-back { color: #dce8d9; text-decoration: none; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(220,232,217,0.3); }
    .btn-back:hover { background: rgba(255,255,255,0.1); color: #ffffff; }
    .dossier-wrap { max-width: 760px; margin: 32px auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .header { background: #0f172a; color: #f8fafc; padding: 32px 40px; border-bottom: 4px solid #10b981; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .emblem { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; font-weight: 700; margin-bottom: 6px; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
    .badge-bar { display: flex; gap: 8px; margin-top: 16px; }
    .badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; font-family: monospace; }
    .badge-crit { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .badge-high { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }
    .badge-norm { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
    .content { padding: 36px 40px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; font-size: 13px; color: #334155; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; }
    .card-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.05em; }
    .card-value { font-size: 14px; font-weight: 700; color: #0f172a; font-family: monospace; }
    .section-title { font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 28px; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
    .ai-findings { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 6px; padding: 14px 18px; font-size: 13px; color: #166534; margin-top: 12px; }
    .btn-nav { display: inline-block; background: #059669; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 12px; font-weight: 700; margin-top: 12px; }
    .footer { background: #f8fafc; padding: 24px 40px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6; }
    .qr-stamp { display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #cbd5e1; padding-top: 16px; margin-top: 24px; font-size: 11px; color: #64748b; font-family: monospace; }

    @media print {
      body { background: #ffffff !important; color: #000000 !important; }
      .action-bar { display: none !important; }
      .dossier-wrap { border: none !important; box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
      .header { background: #0f172a !important; color: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .btn-nav { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <div class="action-title">JanSahayak SafeStreets &bull; Official Municipal Docket</div>
    <div class="action-btns">
      ${
        isStaff
          ? `<a href="/dashboard/escalations" class="btn-back">&larr; Back to Escalations</a>`
          : `<a href="javascript:window.history.length > 1 ? window.history.back() : window.close()" class="btn-back">&larr; Back to Report</a>`
      }
      <button onclick="window.print()" class="btn-print">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print Dossier / Save PDF
      </button>
    </div>
  </div>

  <div class="dossier-wrap">
    <div class="header">
      <div class="header-top">
        <div>
          <div class="emblem">JanSahayak SafeStreets &bull; Civic Redressal Desk</div>
          <h1>MUNICIPAL ROAD HAZARD NOTICE</h1>
        </div>
      </div>
      <div class="badge-bar">
        <span class="badge ${dossier.severity === "CRITICAL" ? "badge-crit" : dossier.severity === "HIGH" ? "badge-high" : "badge-norm"}">Priority: ${dossier.severity}</span>
        <span class="badge badge-norm">Docket: ${dossier.docketNumber}</span>
      </div>
    </div>

    <div class="content">
      <div class="meta-box">
        <strong>Forwarded To:</strong> ${dossier.municipalityRecipient}<br>
        <strong>Competent Authority:</strong> Public Works Department (PWD) / GNIDA Civil Maintenance Wing<br>
        <strong>Subject:</strong> Formal Roadway Hazard Redressal Docket &mdash; ${dossier.incidentNumber}
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-label">Hazard Category</div>
          <div class="card-value">${dossier.category}</div>
        </div>
        <div class="card">
          <div class="card-label">Citizen Reports Linked</div>
          <div class="card-value">${dossier.reportCount} Verified Submission${dossier.reportCount > 1 ? "s" : ""}</div>
        </div>
        <div class="card">
          <div class="card-label">WGS84 Coordinates</div>
          <div class="card-value">${dossier.latitude.toFixed(6)}&deg; N, ${dossier.longitude.toFixed(6)}&deg; E</div>
        </div>
        <div class="card">
          <div class="card-label">Spatial Precision</div>
          <div class="card-value">&plusmn;${dossier.spatialUncertaintyMeters} meters (Haversine Centroid)</div>
        </div>
      </div>

      <div class="section-title">Field Inspection Summary</div>
      <p style="font-size: 13px; color: #334155; line-height: 1.6; margin: 0;">${dossier.summary}</p>

      ${
        dossier.aiFindings.defectSummary
          ? `<div class="ai-findings">
              <strong>AI Structural Inspection:</strong> ${dossier.aiFindings.defectSummary}
              ${
                dossier.aiFindings.visualCharacteristics &&
                dossier.aiFindings.visualCharacteristics.length > 0
                  ? `<div style="margin-top: 6px; font-size: 12px; color: #15803d;">Observable Attributes: ${dossier.aiFindings.visualCharacteristics.join(", ")}</div>`
                  : ""
              }
            </div>`
          : ""
      }

      <div class="section-title">Navigation & Verification Links</div>
      <p style="font-size: 12px; color: #64748b; margin-bottom: 8px;">Direct field inspection links for contractor teams and site engineers:</p>
      <a href="${dossier.googleMapsUrl}" target="_blank" class="btn-nav">Open Location in Google Maps &rarr;</a>
      &nbsp;
      <a href="${dossier.publicMapUrl}" target="_blank" style="font-size: 12px; color: #059669; font-weight: 700; text-decoration: underline; margin-left: 12px;">Inspect on JanSahayak Public Safety Map</a>

      <div class="qr-stamp">
        <span>Generated: ${dossier.generatedAt}</span>
        <span>JanSahayak Canonical ID: ${dossier.incidentId}</span>
      </div>
    </div>

    <div class="footer">
      This is an official civic grievance dossier generated by JanSahayak SafeStreets following multi-stage AI vision verification, geodesic clustering, and formal publication. Please record this docket in the municipal maintenance register and assign field crews per standard road-safety SLA guidelines.
    </div>
  </div>
</body>
</html>
`;

    return new NextResponse(printableHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
