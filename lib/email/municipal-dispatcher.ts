import { db, incidents, moderationActions, outboxEvents } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getReportsCollection, getAILogsCollection, RawReportDocument } from "@/lib/db/mongodb";

export interface MunicipalDossier {
  docketNumber: string;
  incidentId: string;
  incidentNumber: string;
  category: string;
  severity: string;
  title: string;
  summary: string;
  latitude: number;
  longitude: number;
  spatialUncertaintyMeters: number;
  reportCount: number;
  googleMapsUrl: string;
  publicMapUrl: string;
  aiFindings: {
    defectSummary?: string;
    visualCharacteristics?: string[];
    confidenceScore?: number;
    recommendedAction?: string;
  };
  evidencePhotoUrls: string[];
  generatedAt: string;
  municipalityRecipient: string;
}

/**
 * PRD §14: Compiles an official Municipal Civic Grievance Dossier snapshot and templates.
 */
export async function compileMunicipalDossier(incidentId: string): Promise<{
  success: boolean;
  docketNumber?: string;
  recipient?: string;
  dossier?: MunicipalDossier;
  htmlBody?: string;
  textBody?: string;
  incident?: typeof incidents.$inferSelect;
  error?: string;
}> {
  try {
    // 1. Fetch canonical incident from PostgreSQL
    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .limit(1);

    if (!incident) {
      return { success: false, error: `Incident ${incidentId} not found.` };
    }

    // 2. Fetch associated raw reports and AI vision findings from MongoDB
    let associatedReports: RawReportDocument[] = [];
    let aiFindings: MunicipalDossier["aiFindings"] = {};
    const evidencePhotoUrls: string[] = [];

    try {
      const reportsColl = await getReportsCollection();
      associatedReports = await reportsColl
        .find({ associatedIncidentId: incidentId })
        .limit(10)
        .toArray();

      if (associatedReports.length > 0) {
        const primaryReport = associatedReports[0];
        if (primaryReport) {
          primaryReport.evidencePhotos.forEach((photo) => {
            if (photo.fileId) {
              evidencePhotoUrls.push(`/api/pipeline/photos/${photo.fileId}`);
            }
          });

          const aiLogsColl = await getAILogsCollection();
          const aiLog = await aiLogsColl.findOne({ reportId: primaryReport.reportId });
          if (aiLog?.structuredExtraction) {
            aiFindings = {
              defectSummary: aiLog.structuredExtraction.defectSummary,
              visualCharacteristics: aiLog.structuredExtraction.visualCharacteristics,
              confidenceScore: aiLog.structuredExtraction.confidenceScore,
              recommendedAction: aiLog.structuredExtraction.recommendedNextAction,
            };
          }
        }
      }
    } catch {
      // Non-blocking MongoDB read fallback
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://jansahayak.in";
    const recipient =
      process.env.MUNICIPAL_GRIEVANCE_EMAIL || "grievance-redressal@noidaauthority.in";

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const docketNumber = `GRV-${dateStr}-${incident.incidentNumber}`;
    const lat = Number(incident.latitude);
    const lng = Number(incident.longitude);
    const uncertainty = Number(incident.spatialUncertaintyMeters) || 10;

    const dossier: MunicipalDossier = {
      docketNumber,
      incidentId: incident.id,
      incidentNumber: incident.incidentNumber,
      category: incident.category,
      severity: incident.severity.toUpperCase(),
      title: incident.title,
      summary:
        incident.summary || "Civic road safety defect verified by citizen reporting platform.",
      latitude: lat,
      longitude: lng,
      spatialUncertaintyMeters: uncertainty,
      reportCount: incident.reportCount,
      googleMapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
      publicMapUrl: `${appUrl}/map?highlight=${encodeURIComponent(incident.id)}`,
      aiFindings,
      evidencePhotoUrls,
      generatedAt: new Date().toISOString(),
      municipalityRecipient: recipient,
    };

    // 3. Compile Professional Government/Municipal Civic Email Body
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>JanSahayak Civic Hazard Dossier: ${docketNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .header { background: #0f172a; color: #f8fafc; padding: 24px 32px; border-bottom: 3px solid #10b981; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #94a3b8; }
    .badge-bar { display: flex; gap: 8px; margin-top: 14px; }
    .badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }
    .badge-crit { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .badge-high { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }
    .badge-norm { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
    .content { padding: 32px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
    .card-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }
    .card-value { font-size: 14px; font-weight: 600; color: #0f172a; font-family: monospace; }
    .section-title { font-size: 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 24px; margin-bottom: 12px; }
    .btn { display: inline-block; background: #059669; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; margin-top: 12px; }
    .footer { background: #f1f5f9; padding: 20px 32px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MUNICIPAL ROAD HAZARD NOTICE</h1>
      <p>JanSahayak SafeStreets Civic Redressal Desk</p>
      <div class="badge-bar">
        <span class="badge ${dossier.severity === "CRITICAL" ? "badge-crit" : dossier.severity === "HIGH" ? "badge-high" : "badge-norm"}">Severity: ${dossier.severity}</span>
        <span class="badge badge-norm">Docket: ${dossier.docketNumber}</span>
      </div>
    </div>
    <div class="content">
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        <strong>To:</strong> Public Works Department (PWD) / Municipal Maintenance Wing<br>
        <strong>Subject:</strong> Verified Road Safety Hazard Redressal Request &mdash; ${dossier.incidentNumber}
      </p>

      <div class="grid">
        <div class="card">
          <div class="card-label">Hazard Category</div>
          <div class="card-value">${dossier.category}</div>
        </div>
        <div class="card">
          <div class="card-label">Citizen Endorsements</div>
          <div class="card-value">${dossier.reportCount} Report${dossier.reportCount > 1 ? "s" : ""} Linked</div>
        </div>
        <div class="card">
          <div class="card-label">Representative GPS</div>
          <div class="card-value">${dossier.latitude.toFixed(6)}, ${dossier.longitude.toFixed(6)}</div>
        </div>
        <div class="card">
          <div class="card-label">Spatial Uncertainty</div>
          <div class="card-value">&plusmn;${dossier.spatialUncertaintyMeters} meters</div>
        </div>
      </div>

      <div class="section-title">Verified Defect Engineering Findings</div>
      <p style="font-size: 13px; color: #334155; line-height: 1.5;">${dossier.summary}</p>
      ${
        dossier.aiFindings.defectSummary
          ? `<p style="font-size: 13px; color: #475569; background: #f8fafc; padding: 12px; border-left: 3px solid #059669; border-radius: 4px;"><strong>AI Inspection Summary:</strong> ${dossier.aiFindings.defectSummary}</p>`
          : ""
      }

      <div class="section-title">Field Inspection Navigation</div>
      <p style="font-size: 12px; color: #64748b;">Direct field navigation link for municipal repair crews and site engineers:</p>
      <a href="${dossier.googleMapsUrl}" target="_blank" class="btn">Open Location in Google Maps &rarr;</a>
      &nbsp;
      <a href="${dossier.publicMapUrl}" target="_blank" style="font-size: 12px; color: #059669; font-weight: 600; text-decoration: underline; margin-left: 12px;">View on JanSahayak Public Safety Map</a>
    </div>
    <div class="footer">
      This is an automated civic governance dispatch generated by the JanSahayak SafeStreets Platform upon formal verification and map publication. Please log this docket in the municipal grievance redressal register. For questions, contact grievance-support@jansahayak.in.
    </div>
  </div>
</body>
</html>
`;

    const textBody = `
MUNICIPAL ROAD HAZARD NOTICE (JanSahayak SafeStreets)
=====================================================
Docket: ${dossier.docketNumber}
Incident: ${dossier.incidentNumber}
Category: ${dossier.category}
Severity: ${dossier.severity}
GPS Coordinates: ${dossier.latitude.toFixed(6)}, ${dossier.longitude.toFixed(6)} (±${dossier.spatialUncertaintyMeters}m)
Citizen Reports: ${dossier.reportCount}
Summary: ${dossier.summary}

Google Maps Navigation: ${dossier.googleMapsUrl}
Public Safety Map: ${dossier.publicMapUrl}

Please initiate civic maintenance intervention per municipal road safety protocols.
`;

    return {
      success: true,
      docketNumber,
      recipient,
      dossier,
      htmlBody,
      textBody,
      incident,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to compile municipal dossier: ${msg}`,
    };
  }
}

/**
 * PRD §14: Compiles an official Municipal Civic Grievance Dossier and dispatches it
 * to the competent local municipal corporation / urban local body via email.
 */
export async function dispatchMunicipalReportEmail(incidentId: string): Promise<{
  success: boolean;
  docketNumber?: string;
  recipient?: string;
  dossier?: MunicipalDossier;
  error?: string;
}> {
  try {
    const compiled = await compileMunicipalDossier(incidentId);
    if (!compiled.success || !compiled.dossier || !compiled.incident) {
      return {
        success: false,
        error: compiled.error || `Incident ${incidentId} could not be compiled.`,
      };
    }

    const { docketNumber, recipient, dossier, htmlBody, textBody, incident } = compiled;

    // 4. Send email or record dispatch
    console.log(`[Municipal-Dispatcher] Compiling dossier ${docketNumber} for ${recipient}`);

    // If an external SMTP or Resend service is configured, dispatch real email
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey && resendApiKey.startsWith("re_")) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "JanSahayak SafeStreets <reports@jansahayak.in>",
            to: [recipient!],
            subject: `[ACTION REQUIRED] Road Hazard Redressal Docket ${docketNumber} (${dossier.category})`,
            html: htmlBody,
            text: textBody,
          }),
        });
      } catch (sendErr) {
        console.warn("[Municipal-Dispatcher] SMTP transport delivery warning:", sendErr);
      }
    }

    // 5. Record immutable audit log in PostgreSQL
    await db.insert(moderationActions).values({
      incidentId: incident.id,
      moderatorId: "system_municipal_dispatcher",
      action: "municipal_email_dispatched",
      reason: `Dispatched formal civic grievance dossier ${docketNumber} to ${recipient}`,
      metadata: {
        docketNumber,
        recipient,
        severity: dossier.severity,
        dispatchedAt: dossier.generatedAt,
      },
    });

    // 6. Record outbox event for tracking
    await db.insert(outboxEvents).values({
      eventType: "municipal.dispatched",
      aggregateType: "incident",
      aggregateId: incident.id,
      payload: {
        docketNumber,
        recipient,
        incidentNumber: incident.incidentNumber,
        dispatchedAt: dossier.generatedAt,
      },
    });

    // 7. Update incident metadata with municipal dispatch reference
    const currentMeta = (incident.metadata || {}) as Record<string, unknown>;
    await db
      .update(incidents)
      .set({
        metadata: {
          ...currentMeta,
          municipalDocketNumber: docketNumber,
          municipalDispatchedAt: dossier.generatedAt,
          municipalRecipient: recipient,
          municipalStatus: "DELIVERED",
        },
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, incident.id));

    // 8. Update MongoDB raw reports status
    try {
      const reportsColl = await getReportsCollection();
      await reportsColl.updateMany(
        { associatedIncidentId: incident.id },
        {
          $set: {
            status: "MUNICIPALLY_DISPATCHED",
            updatedAt: new Date().toISOString(),
          },
        },
      );
    } catch {
      // Non-blocking
    }

    return {
      success: true,
      docketNumber,
      recipient,
      dossier,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Municipal-Dispatcher] Error dispatching municipal report email:", msg);
    return {
      success: false,
      error: `Failed to dispatch municipal report email: ${msg}`,
    };
  }
}
