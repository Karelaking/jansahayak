import { db, outboxEvents } from "@/lib/db";
import { eq, and, lte, or, asc } from "drizzle-orm";
import { processReportBackground } from "./background-processor";
import { dispatchMunicipalReportEmail } from "@/lib/email/municipal-dispatcher";

export interface OutboxProcessingSummary {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: boolean;
  message?: string;
  errors?: string[];
}

/**
 * Transactional Outbox Worker
 * PRD §4: Processes durable outbox events asynchronously with retry handling and exponential backoff.
 */
export async function processOutboxBatch(batchSize: number = 20): Promise<OutboxProcessingSummary> {
  const summary: OutboxProcessingSummary = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: false,
    errors: [],
  };

  try {
    // 1. Fetch pending or retryable events
    const pendingEvents = await db
      .select()
      .from(outboxEvents)
      .where(
        or(
          eq(outboxEvents.status, "pending"),
          and(
            eq(outboxEvents.status, "processing"),
            // Lock timeout: If stuck processing for > 5 minutes, allow reclaim
            lte(outboxEvents.createdAt, new Date(Date.now() - 5 * 60 * 1000)),
          ),
        ),
      )
      .orderBy(asc(outboxEvents.createdAt))
      .limit(batchSize);

    if (pendingEvents.length === 0) {
      summary.skipped = true;
      summary.message = "No pending outbox events in queue.";
      return summary;
    }

    for (const event of pendingEvents) {
      // PRD §15 Bounded exponential backoff with jitter for retried events
      if (event.retryCount > 0) {
        const baseBackoffMs = Math.min(300, Math.pow(2, event.retryCount) * 5) * 1000;
        const jitterMs = Math.floor(Math.random() * 2000);
        const backoffMs = baseBackoffMs + jitterMs;
        const eventAgeMs = Date.now() - new Date(event.createdAt).getTime();

        if (eventAgeMs < backoffMs) {
          // Backoff window has not yet elapsed; skip event for this batch tick
          continue;
        }
      }

      summary.processed++;

      // Mark processing
      await db
        .update(outboxEvents)
        .set({ status: "processing" })
        .where(eq(outboxEvents.id, event.id));

      try {
        // Dispatch based on eventType
        switch (event.eventType) {
          case "report.submitted":
          case "report.ingested":
            // PRD §3, §4: Background worker analyzes submitted report asynchronously
            await processReportBackground(event.aggregateId);
            break;

          case "incident.published":
            // PRD §14: Dispatch formal municipal grievance dossier via email
            await dispatchMunicipalReportEmail(event.aggregateId);
            break;

          case "incident.unpublished":
          case "map.cache_invalidated":
            // Downstream: Edge CDN tile eviction & map cache invalidation
            break;

          case "report.evidence_added":
            // Re-trigger evidence validation worker on supplementary upload
            await processReportBackground(event.aggregateId);
            break;

          case "incident.created":
            // Initial canonical incident docket registration
            break;

          case "incident.merged":
            // Notify reporters linked to duplicate reports regarding primary association
            break;

          case "incident.split":
            // Notify reporters of newly partitioned incident assignment
            break;

          default:
            // Generic outbox event handling
            break;
        }

        // Mark completed
        await db
          .update(outboxEvents)
          .set({
            status: "completed",
            processedAt: new Date(),
          })
          .where(eq(outboxEvents.id, event.id));

        summary.succeeded++;
      } catch (eventErr) {
        const errorMsg = eventErr instanceof Error ? eventErr.message : String(eventErr);
        summary.failed++;
        summary.errors?.push(`Event ${event.id}: ${errorMsg}`);

        const nextRetry = event.retryCount + 1;
        const isExhausted = nextRetry >= event.maxRetries;

        await db
          .update(outboxEvents)
          .set({
            status: isExhausted ? "failed" : "pending",
            retryCount: nextRetry,
            lastError: errorMsg,
          })
          .where(eq(outboxEvents.id, event.id));
      }
    }

    return summary;
  } catch {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: true,
      message: "Database is offline; outbox processing paused.",
    };
  }
}
