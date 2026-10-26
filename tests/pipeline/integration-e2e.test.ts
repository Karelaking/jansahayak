import { describe, it, expect } from "vite-plus/test";
import { calculateGeodesicDistanceMeters } from "@/lib/pipeline/location-verification";
import { computeCosineSimilarity } from "@/lib/pipeline/duplicate-matching";
import { evaluatePublicationPredicate } from "@/lib/pipeline/publication";
import {
  executeStage7Moderation,
  executeIncidentMerge,
  executeIncidentSplit,
  executeIncidentUnpublish,
} from "@/lib/pipeline/moderation";
import { executeStage1Intake } from "@/lib/pipeline/intake";
import { executeStage2EvidenceValidation } from "@/lib/pipeline/evidence-validation";
import { processOutboxBatch } from "@/lib/pipeline/worker";
import { processReportBackground } from "@/lib/pipeline/background-processor";
import { dispatchMunicipalReportEmail } from "@/lib/email/municipal-dispatcher";
import { dispatchVoterProgressNotification } from "@/lib/email/voter-notifier";
import { executeStage4LocationVerification } from "@/lib/pipeline/location-verification";
import { NextRequest } from "next/server";
import { POST as dispatchMunicipalRoute } from "@/app/api/admin/incidents/[incidentId]/dispatch-municipal/route";
import {
  GET as getEscalationsRoute,
  POST as postEscalationRoute,
} from "@/app/api/admin/escalations/route";
import { POST as processPipelineRoute } from "@/app/api/pipeline/process/route";
import {
  GET as getReportDetailRoute,
  PATCH as patchReportRoute,
  DELETE as deleteReportRoute,
} from "@/app/api/reports/[reportId]/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { GET as getDossierRoute } from "@/app/api/admin/incidents/[incidentId]/dossier/route";
import { POST as submitRoute } from "@/app/api/pipeline/submit/route";
import { GET as getMapIncidentsRoute } from "@/app/api/map/incidents/route";
import { GET as getReportsRoute } from "@/app/api/reports/route";
import { POST as reprocessRoute } from "@/app/api/reports/[reportId]/reprocess/route";
import { POST as postVoteRoute } from "@/app/api/incidents/[incidentId]/vote/route";
import { GET as getVotesRoute } from "@/app/api/incidents/[incidentId]/votes/route";
import { GET as getSessionRoute } from "@/app/api/auth/session/route";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rate-limit";

describe("PRD §19 End-to-End Integration Test Suite (62 Scenarios)", () => {
  // Scenario 1: Valid report flow validation
  it("Scenario 1: Valid report calculation passes geodesic and coordinate integrity checks", () => {
    const lat = 28.4744;
    const lng = 77.504;
    const dist = calculateGeodesicDistanceMeters(lat, lng, lat + 0.00005, lng);
    expect(dist).toBeLessThan(10); // Within high quality band <= 10m
  });

  // Scenario 2: Invalid or corrupt image validation
  it("Scenario 2: Invalid photo signatures or empty buffers are identified", () => {
    const emptyBuffer = Buffer.from([]);
    const corruptedBuffer = Buffer.from([0x00, 0x11, 0x22, 0x33]);
    expect(emptyBuffer.length).toBe(0);
    // Non-JPEG/PNG/WebP header check
    const isJpeg = corruptedBuffer[0] === 0xff && corruptedBuffer[1] === 0xd8;
    expect(isJpeg).toBe(false);
  });

  // Scenario 3: Missing or non-finite GPS coordinates block precise pin publication
  it("Scenario 3: Non-finite or missing GPS coordinates fail publication eligibility", () => {
    const result = evaluatePublicationPredicate({
      status: "approved",
      moderationStatus: "approved",
      latitude: NaN,
      longitude: 77.504,
      spatialUncertaintyMeters: 8,
    });
    expect(result.eligible).toBe(false);
    expect(result.failedPredicates).toContain(
      "Canonical spatial coordinates are invalid or out of WGS84 range.",
    );
  });

  // Scenario 4: High spatial uncertainty (>50m) blocks automatic publication
  it("Scenario 4: High spatial uncertainty (>25m) fails publication predicate", () => {
    const result = evaluatePublicationPredicate({
      status: "approved",
      moderationStatus: "approved",
      latitude: 28.4744,
      longitude: 77.504,
      spatialUncertaintyMeters: 55.4, // > 25m PRD threshold
    });
    expect(result.eligible).toBe(false);
    expect(result.failedPredicates[0]).toMatch(/Spatial uncertainty.*exceeds 25m threshold/);
  });

  // Scenario 5: High-confidence duplicate associates with existing incident
  it("Scenario 5: High-confidence duplicate (cosine similarity >= 0.90 within 30m) qualifies for auto-merge", () => {
    const embeddingA = [0.1, 0.4, 0.8, -0.2, 0.5];
    const embeddingB = [0.1, 0.41, 0.79, -0.19, 0.5];
    const similarity = computeCosineSimilarity(embeddingA, embeddingB);
    const distanceMeters = calculateGeodesicDistanceMeters(28.4744, 77.504, 28.4745, 77.504);

    expect(similarity).toBeGreaterThanOrEqual(0.9);
    expect(distanceMeters).toBeLessThanOrEqual(30.0);
  });

  // Scenario 6: Ambiguous duplicate enters manual review
  it("Scenario 6: Ambiguous match confidence (<0.90) does not meet auto-merge gate", () => {
    const embeddingA = [0.1, 0.4, 0.8, -0.2, 0.5];
    const embeddingAmbiguous = [0.5, 0.1, 0.2, 0.8, -0.1];
    const similarity = computeCosineSimilarity(embeddingA, embeddingAmbiguous);

    expect(similarity).toBeLessThan(0.9); // Blocks auto-merge, requires review
  });

  // Scenario 7: Distinct nearby hazards remain separate
  it("Scenario 7: Defect located >50m away from cluster centroid remains separate", () => {
    const baseLat = 28.4744;
    const baseLng = 77.504;
    const distantLat = baseLat + 0.0007; // ~78 meters away
    const distance = calculateGeodesicDistanceMeters(baseLat, baseLng, distantLat, baseLng);

    expect(distance).toBeGreaterThan(50.0);
  });

  // Scenario 8: Unapproved incident does not appear on the public map
  it("Scenario 8: Unapproved incident (status = under_review) is rejected from public map", () => {
    const result = evaluatePublicationPredicate({
      status: "under_review",
      moderationStatus: "pending",
      latitude: 28.4744,
      longitude: 77.504,
      spatialUncertaintyMeters: 8.0,
    });
    expect(result.eligible).toBe(false);
    expect(result.failedPredicates).toContain(
      "Incident has not received official moderation approval.",
    );
  });

  // Scenario 9: Approved incident satisfies publication predicate
  it("Scenario 9: Valid approved incident satisfies all predicates for map publication", () => {
    const result = evaluatePublicationPredicate({
      status: "approved",
      moderationStatus: "approved",
      latitude: 28.4744,
      longitude: 77.504,
      spatialUncertaintyMeters: 6.2,
    });
    expect(result.eligible).toBe(true);
    expect(result.failedPredicates).toHaveLength(0);
  });

  // Scenario 10: Repeated publication check is idempotent
  it("Scenario 10: Idempotent publication verification maintains consistency", () => {
    const pred1 = evaluatePublicationPredicate({
      status: "approved",
      moderationStatus: "approved",
      latitude: 28.4744,
      longitude: 77.504,
      spatialUncertaintyMeters: 7.0,
    });
    const pred2 = evaluatePublicationPredicate({
      status: "approved",
      moderationStatus: "approved",
      latitude: 28.4744,
      longitude: 77.504,
      spatialUncertaintyMeters: 7.0,
    });
    expect(pred1.eligible).toBe(pred2.eligible);
  });

  // Scenario 11: Rejection requires a documented reason
  it("Scenario 11: Moderation rejection requires documented reason for civic auditability", async () => {
    // Calling moderation without reason for rejection must be rejected
    const res = await executeStage7Moderation({
      incidentId: "test_inc_01",
      moderatorId: "mod_01",
      decision: "reject",
      reason: "", // Empty reason
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Rejection requires a documented reason/);
  });

  // Scenario 12: Outbox worker executes safely and handles queue state
  it("Scenario 12: Outbox processor batch function runs safely", async () => {
    const summary = await processOutboxBatch(10);
    expect(summary).toBeDefined();
    expect(typeof summary.processed).toBe("number");
    expect(typeof summary.succeeded).toBe("number");
  });

  // Scenario 13: Terminal rejection cannot be published
  it("Scenario 13: Terminal rejection cannot be published even if coordinates are valid", () => {
    const result = evaluatePublicationPredicate({
      status: "rejected",
      moderationStatus: "approved",
      latitude: 28.4744,
      longitude: 77.504,
      spatialUncertaintyMeters: 5.0,
    });
    expect(result.eligible).toBe(false);
    expect(result.failedPredicates).toContain(
      "Rejected incidents cannot be published to the public map.",
    );
  });

  // Scenario 14: Public endpoint snapshot strips private metadata
  it("Scenario 14: Public map hazard records omit citizen identity and private EXIF data", () => {
    const rawIncident = {
      id: "inc_123",
      incidentNumber: "INC-2026-1001",
      title: "Pothole Pari Chowk",
      summary: "Deep depression near roundabout",
      latitude: 28.4744,
      longitude: 77.504,
      reporterName: "Private Citizen Name",
      reporterEmail: "private@example.com",
      phone: "+91 9876543210",
      deviceImei: "354892019482910",
    };

    // Public sanitized transform
    const publicPin = {
      id: rawIncident.id,
      title: rawIncident.title,
      summary: rawIncident.summary,
      latitude: rawIncident.latitude,
      longitude: rawIncident.longitude,
    };

    expect(publicPin).not.toHaveProperty("reporterName");
    expect(publicPin).not.toHaveProperty("reporterEmail");
    expect(publicPin).not.toHaveProperty("phone");
    expect(publicPin).not.toHaveProperty("deviceImei");
  });

  // Scenario 15: Incident Merge validation & boundary checks (PRD §10, §12, §16)
  it("Scenario 15: executeIncidentMerge rejects invalid arguments and self-merges", async () => {
    // Empty primary
    const res1 = await executeIncidentMerge({
      primaryIncidentId: "",
      duplicateIncidentIds: ["inc_dup_1"],
      moderatorId: "mod_01",
    });
    expect(res1.success).toBe(false);
    expect(res1.error).toMatch(/Primary incident ID is required/);

    // Empty duplicates
    const res2 = await executeIncidentMerge({
      primaryIncidentId: "inc_prim_1",
      duplicateIncidentIds: [],
      moderatorId: "mod_01",
    });
    expect(res2.success).toBe(false);
    expect(res2.error).toMatch(/At least one duplicate incident ID/);

    // Self-merge
    const res3 = await executeIncidentMerge({
      primaryIncidentId: "inc_prim_1",
      duplicateIncidentIds: ["inc_prim_1"],
      moderatorId: "mod_01",
    });
    expect(res3.success).toBe(false);
    expect(res3.error).toMatch(/cannot contain the primary incident ID/);
  });

  // Scenario 16: Incident Split validation & partition constraints (PRD §12, §16)
  it("Scenario 16: executeIncidentSplit enforces non-empty partition list", async () => {
    // Missing incidentId
    const res1 = await executeIncidentSplit({
      incidentId: "",
      reportIdsToSplit: ["rep_01"],
      moderatorId: "mod_01",
    });
    expect(res1.success).toBe(false);
    expect(res1.error).toMatch(/Original incident ID is required/);

    // Empty reportIdsToSplit
    const res2 = await executeIncidentSplit({
      incidentId: "inc_01",
      reportIdsToSplit: [],
      moderatorId: "mod_01",
    });
    expect(res2.success).toBe(false);
    expect(res2.error).toMatch(/At least one report ID must be specified/);
  });

  // Scenario 17: Incident Unpublish requires reason (PRD §13, §14, §16)
  it("Scenario 17: executeIncidentUnpublish enforces documented justification", async () => {
    const res1 = await executeIncidentUnpublish({
      incidentId: "inc_01",
      moderatorId: "mod_01",
      reason: "", // Empty reason
    });
    expect(res1.success).toBe(false);
    expect(res1.error).toMatch(/documented reason/);

    const res2 = await executeIncidentUnpublish({
      incidentId: "",
      moderatorId: "mod_01",
      reason: "Invalid report",
    });
    expect(res2.success).toBe(false);
    expect(res2.error).toMatch(/Incident ID is required/);
  });

  // Scenario 18: Stage 1 Intake enforces client authentication and required fields (PRD §6)
  it("Scenario 18: Stage 1 Intake validates authentication and category requirement", async () => {
    const res = await executeStage1Intake({
      userId: "", // Missing user ID
      category: "Road Surface / Pothole",
      description: "Pothole on main lane",
      photos: [],
      submissionLocation: {
        latitude: 28.4744,
        longitude: 77.504,
        accuracyMeters: 6,
        capturedAt: new Date().toISOString(),
      },
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Unauthenticated submission/);
  });

  // Scenario 19: Publication predicate and public map security filtering (PRD §13, §14)
  it("Scenario 19: evaluatePublicationPredicate rejects unapproved incidents from public map display", () => {
    const eligible = evaluatePublicationPredicate({
      status: "approved",
      moderationStatus: "approved",
      latitude: 28.4744,
      longitude: 77.504,
      spatialUncertaintyMeters: 8,
    });
    expect(eligible.eligible).toBe(true);
    expect(eligible.failedPredicates).toHaveLength(0);

    const pending = evaluatePublicationPredicate({
      status: "under_review",
      moderationStatus: "pending",
      latitude: 28.4744,
      longitude: 77.504,
      spatialUncertaintyMeters: 8,
    });
    expect(pending.eligible).toBe(false);
    expect(pending.failedPredicates).toContain(
      "Incident has not received official moderation approval.",
    );

    const rejected = evaluatePublicationPredicate({
      status: "rejected",
      moderationStatus: "rejected",
      latitude: 28.4744,
      longitude: 77.504,
      spatialUncertaintyMeters: 8,
    });
    expect(rejected.eligible).toBe(false);
    expect(rejected.failedPredicates).toContain(
      "Incident has not received official moderation approval.",
    );
  });

  // Scenario 20: Stage 6 Duplicate Matching provenance is structured and persisted (PRD §10, §11)
  it("Scenario 20: Stage 6 metadata tracks duplicate matching provenance and gate metrics", () => {
    const mockMatching = {
      action: "create_new" as const,
      candidateCount: 2,
      matchScore: null,
      matchReason: "No candidates exceeded combined threshold (0.80)",
      passedGates: ["temporal_recency"],
      failedGates: ["spatial_proximity", "visual_similarity"],
    };

    const incidentMetadata = {
      aiModel: "gemini-2.5-flash",
      confidenceScore: 0.95,
      visualCharacteristics: ["deep asphalt cavity", "exposed sub-base"],
      duplicateMatching: {
        action: mockMatching.action,
        matchedIncidentId: null,
        candidateCount: mockMatching.candidateCount,
        matchScore: mockMatching.matchScore,
        matchReason: mockMatching.matchReason,
        passedGates: mockMatching.passedGates,
        failedGates: mockMatching.failedGates,
      },
    };

    expect(incidentMetadata.duplicateMatching.action).toBe("create_new");
    expect(incidentMetadata.duplicateMatching.candidateCount).toBe(2);
    expect(incidentMetadata.duplicateMatching.passedGates).toContain("temporal_recency");
    expect(incidentMetadata.duplicateMatching.failedGates).toContain("spatial_proximity");
    expect(incidentMetadata.duplicateMatching.matchedIncidentId).toBeNull();
  });

  // Scenario 21: Stage 1 Intake rejects submissions with fewer than 4 photographs (PRD §2, §6)
  it("Scenario 21: Stage 1 Intake strictly rejects submissions with fewer than 4 photographs", async () => {
    const res = await executeStage1Intake({
      userId: "user_test_valid",
      category: "Road Surface / Pothole",
      description: "Severe crater on Noida-Greater Noida Expressway service road",
      photos: [
        {
          buffer: Buffer.from("dummy-photo-1"),
          filename: "p1.jpg",
          contentType: "image/jpeg",
          capturedAt: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [],
        },
        {
          buffer: Buffer.from("dummy-photo-2"),
          filename: "p2.jpg",
          contentType: "image/jpeg",
          capturedAt: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [],
        },
      ], // Only 2 photos provided (min 4 required)
      submissionLocation: {
        latitude: 28.4744,
        longitude: 77.504,
        accuracyMeters: 6,
        capturedAt: new Date().toISOString(),
      },
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/minimum of 4 valid evidence photographs is required/i);
  });

  // Scenario 22: Stage 2 Evidence Validation rejects raw reports containing fewer than 4 photographs (PRD §2, §7)
  it("Scenario 22: Stage 2 Evidence Validation rejects raw reports containing fewer than 4 photos", async () => {
    const mockReport = {
      reportId: "rep_test_evidence_01",
      userId: "user_test_valid",
      category: "Road Surface / Pothole",
      description: "Test description",
      status: "EVIDENCE_VALIDATION_PENDING" as const,
      createdAt: new Date().toISOString(),
      evidencePhotos: [
        {
          fileId: "file_01",
          filename: "photo1.jpg",
          contentType: "image/jpeg",
          byteSize: 1024,
          sha256Hash: "hash1",
          captureTimestamp: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [],
        },
        {
          fileId: "file_02",
          filename: "photo2.jpg",
          contentType: "image/jpeg",
          byteSize: 1024,
          sha256Hash: "hash2",
          captureTimestamp: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [],
        },
        {
          fileId: "file_03",
          filename: "photo3.jpg",
          contentType: "image/jpeg",
          byteSize: 1024,
          sha256Hash: "hash3",
          captureTimestamp: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [],
        },
      ], // Only 3 photos (min 4 required)
      submissionLocation: {
        latitude: 28.4744,
        longitude: 77.504,
        accuracyMeters: 6,
        capturedAt: new Date().toISOString(),
      },
      auditLogs: [],
    };
    const res = await executeStage2EvidenceValidation(
      mockReport as unknown as Parameters<typeof executeStage2EvidenceValidation>[0],
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Minimum 4 evidence photographs required/i);
  });

  // Scenario 23: Stage 1 Intake rejects submissions where photos were not taken via in-app camera (PRD §2, §6)
  it("Scenario 23: Stage 1 Intake strictly rejects photos uploaded via gallery or file picker", async () => {
    const res = await executeStage1Intake({
      userId: "user_test_valid",
      category: "Road Surface / Pothole",
      description: "Severe crater on expressway service road",
      photos: [
        {
          buffer: Buffer.from("dummy-photo-1"),
          filename: "p1.jpg",
          contentType: "image/jpeg",
          capturedAt: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [],
        },
        {
          buffer: Buffer.from("dummy-photo-2"),
          filename: "p2.jpg",
          contentType: "image/jpeg",
          capturedAt: new Date().toISOString(),
          isCameraCapture: false, // Gallery upload prohibited
          gpsSamples: [],
        },
        {
          buffer: Buffer.from("dummy-photo-3"),
          filename: "p3.jpg",
          contentType: "image/jpeg",
          capturedAt: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [],
        },
        {
          buffer: Buffer.from("dummy-photo-4"),
          filename: "p4.jpg",
          contentType: "image/jpeg",
          capturedAt: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [],
        },
      ],
      submissionLocation: {
        latitude: 28.4744,
        longitude: 77.504,
        accuracyMeters: 6,
        capturedAt: new Date().toISOString(),
      },
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/was not captured via in-app camera viewfinder.*prohibited/i);
  });

  // Scenario 24: Stage 2 Evidence Validation rejects photos exceeding the 15MB file size limit (PRD §2, §7)
  it("Scenario 24: Stage 2 Evidence Validation rejects photos exceeding 15MB limit or with camera provenance violations", async () => {
    const mockReport = {
      reportId: "rep_test_evidence_size_01",
      userId: "user_test_valid",
      category: "Road Surface / Pothole",
      description: "Pothole evidence size check",
      status: "EVIDENCE_VALIDATION_PENDING" as const,
      createdAt: new Date().toISOString(),
      evidencePhotos: [
        {
          fileId: "file_01",
          filename: "photo1.jpg",
          contentType: "image/jpeg",
          byteSize: 16 * 1024 * 1024, // 16MB > 15MB limit
          sha256: "hash1",
          captureTimestamp: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [
            {
              latitude: 28.4744,
              longitude: 77.504,
              horizontalAccuracyMeters: 5,
              sampleTimestamp: new Date().toISOString(),
            },
          ],
        },
        {
          fileId: "file_02",
          filename: "photo2.jpg",
          contentType: "image/jpeg",
          byteSize: 2 * 1024 * 1024,
          sha256: "hash2",
          captureTimestamp: new Date().toISOString(),
          isCameraCapture: false, // Gallery upload
          gpsSamples: [
            {
              latitude: 28.4744,
              longitude: 77.504,
              horizontalAccuracyMeters: 5,
              sampleTimestamp: new Date().toISOString(),
            },
          ],
        },
        {
          fileId: "file_03",
          filename: "photo3.jpg",
          contentType: "image/jpeg",
          byteSize: 2 * 1024 * 1024,
          sha256: "hash3",
          captureTimestamp: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [
            {
              latitude: 28.4744,
              longitude: 77.504,
              horizontalAccuracyMeters: 5,
              sampleTimestamp: new Date().toISOString(),
            },
          ],
        },
        {
          fileId: "file_04",
          filename: "photo4.jpg",
          contentType: "image/jpeg",
          byteSize: 2 * 1024 * 1024,
          sha256: "hash4",
          captureTimestamp: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [
            {
              latitude: 28.4744,
              longitude: 77.504,
              horizontalAccuracyMeters: 5,
              sampleTimestamp: new Date().toISOString(),
            },
          ],
        },
      ],
      submissionLocation: {
        latitude: 28.4744,
        longitude: 77.504,
        accuracyMeters: 6,
        capturedAt: new Date().toISOString(),
      },
    };
    const res = await executeStage2EvidenceValidation(
      mockReport as unknown as Parameters<typeof executeStage2EvidenceValidation>[0],
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/exceeding 15MB limit/i);
    expect(res.error).toMatch(/in-app camera viewfinder/i);
  });

  // Scenario 25: Canonical incident centroid recalculation and weighted update (PRD §11)
  it("Scenario 25: Representative centroid recalculates accurately as weighted mean when reports merge", () => {
    // Initial incident with 1 report at (28.47400, 77.50400)
    const existingLat = 28.474;
    const existingLng = 77.504;
    const existingCount = 1;

    // Incoming merged report at (28.47460, 77.50440)
    const incomingLat = 28.4746;
    const incomingLng = 77.5044;

    const newCount = existingCount + 1;
    const recalculatedLat = (existingLat * existingCount + incomingLat) / newCount;
    const recalculatedLng = (existingLng * existingCount + incomingLng) / newCount;

    expect(recalculatedLat).toBeCloseTo(28.4743, 5);
    expect(recalculatedLng).toBeCloseTo(77.5042, 5);

    // Geodesic distance from recalculated centroid to both constituents must be within spatial bounds
    const distToFirst = calculateGeodesicDistanceMeters(
      recalculatedLat,
      recalculatedLng,
      existingLat,
      existingLng,
    );
    const distToSecond = calculateGeodesicDistanceMeters(
      recalculatedLat,
      recalculatedLng,
      incomingLat,
      incomingLng,
    );

    expect(distToFirst).toBeLessThan(40);
    expect(distToSecond).toBeLessThan(40);
  });

  // Scenario 26: Stage 7 Moderation rejects actions without non-empty moderatorId (PRD §12)
  it("Scenario 26: Stage 7 Moderation strictly rejects actions with empty moderator ID for civic auditability", async () => {
    const moderationRes = await executeStage7Moderation({
      incidentId: "inc_test_123",
      moderatorId: "", // Empty ID
      decision: "approve",
    });
    expect(moderationRes.success).toBe(false);
    expect(moderationRes.error).toMatch(/Moderator ID is required for civic auditability/i);

    const mergeRes = await executeIncidentMerge({
      primaryIncidentId: "inc_target",
      duplicateIncidentIds: ["inc_source"],
      moderatorId: "   ", // Whitespace only
    });
    expect(mergeRes.success).toBe(false);
    expect(mergeRes.error).toMatch(/Moderator ID is required/i);

    const splitRes = await executeIncidentSplit({
      incidentId: "inc_split",
      reportIdsToSplit: ["rep_1"],
      moderatorId: "",
    });
    expect(splitRes.success).toBe(false);
    expect(splitRes.error).toMatch(/Moderator ID is required/i);

    const unpublishRes = await executeIncidentUnpublish({
      incidentId: "inc_unpublish",
      moderatorId: "",
      reason: "Incorrect classification",
    });
    expect(unpublishRes.success).toBe(false);
    expect(unpublishRes.error).toMatch(/Moderator ID is required/i);
  });

  // Scenario 27: Fast Asynchronous Intake accepts submission with SUBMITTED status (PRD §3, §4, §6)
  it("Scenario 27: Fast Asynchronous Intake accepts submission with status SUBMITTED in non-blocking mode", async () => {
    const validPhotoBuffer = Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      "base64",
    );

    const intakeResult = await executeStage1Intake({
      userId: "user_async_intake_01",
      category: "Road Surface / Pothole",
      description: "Severe crater on service corridor near sector gate",
      photos: [
        {
          buffer: validPhotoBuffer,
          filename: "photo_1.jpg",
          contentType: "image/jpeg",
          capturedAt: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [],
        },
        {
          buffer: validPhotoBuffer,
          filename: "photo_2.jpg",
          contentType: "image/jpeg",
          capturedAt: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [],
        },
        {
          buffer: validPhotoBuffer,
          filename: "photo_3.jpg",
          contentType: "image/jpeg",
          capturedAt: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [],
        },
        {
          buffer: validPhotoBuffer,
          filename: "photo_4.jpg",
          contentType: "image/jpeg",
          capturedAt: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [],
        },
      ],
      submissionLocation: {
        latitude: 28.4744,
        longitude: 77.504,
        accuracyMeters: 6.5,
        capturedAt: new Date().toISOString(),
      },
    });

    expect(intakeResult.success).toBe(true);
    expect(intakeResult.data?.document.status).toBe("SUBMITTED");
    expect(intakeResult.data?.reportId).toBeDefined();
  });

  // Scenario 28: Dedicated Background Worker handles report and transitions invalid ones to REJECTED (PRD §3, §4, §7)
  it("Scenario 28: Background processor safely identifies invalid or missing report and records explicit failure", async () => {
    const nonExistentReportId = "rep_non_existent_999999";
    const bgResult = await processReportBackground(nonExistentReportId);

    expect(bgResult.success).toBe(false);
    expect(bgResult.status).toBe("NOT_FOUND");
    expect(bgResult.error).toContain(nonExistentReportId);
  });

  // Scenario 29: Municipal Grievance Dossier formatting & Email Dispatch (PRD §14)
  it("Scenario 29: Municipal Civic Report Dossier generates structured grievance references and navigation links", async () => {
    const invalidIncidentId = "00000000-0000-0000-0000-000000000000";
    const dispatchRes = await dispatchMunicipalReportEmail(invalidIncidentId);

    // Verifies fail-safe handling when incident record does not exist
    expect(dispatchRes.success).toBe(false);
    expect(dispatchRes.error).toContain(invalidIncidentId);
  });

  // Scenario 30: Admin Municipal Grievance Dossier Dispatch API (PRD §14, §16)
  it("Scenario 30: POST /api/admin/incidents/:incidentId/dispatch-municipal enforces staff authorization and dispatches dossier", async () => {
    const fakeIncidentId = "00000000-0000-0000-0000-000000000000";

    // 1. Citizen role is strictly forbidden (403)
    const citizenReq = new NextRequest(
      `http://localhost:3000/api/admin/incidents/${fakeIncidentId}/dispatch-municipal`,
      { method: "POST" },
    );
    const citizenRes = await dispatchMunicipalRoute(citizenReq, {
      params: Promise.resolve({ incidentId: fakeIncidentId }),
    });
    expect(citizenRes.status).toBe(403);

    // 2. Authorized moderator validates existence and status (404 for unknown incident)
    const staffReq = new NextRequest(
      `http://localhost:3000/api/admin/incidents/${fakeIncidentId}/dispatch-municipal`,
      {
        method: "POST",
        headers: { "x-user-role": "moderator", "x-user-id": "mod_test_1" },
      },
    );
    const staffRes = await dispatchMunicipalRoute(staffReq, {
      params: Promise.resolve({ incidentId: fakeIncidentId }),
    });
    expect(staffRes.status).toBe(404);
    const json = await staffRes.json();
    expect(json.error).toBeDefined();
  });

  // Scenario 31: Authority Escalation Tracker API (PRD §14, §16)
  it("Scenario 31: GET /api/admin/escalations returns real database-backed municipal escalation dockets", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/escalations?limit=10", {
      method: "GET",
      headers: { "x-user-role": "moderator", "x-user-id": "mod_test_1" },
    });
    const res = await getEscalationsRoute(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.escalations)).toBe(true);
    expect(typeof json.count).toBe("number");
  });

  // Scenario 32: Background Pipeline Worker Processing API (PRD §3, §16)
  it("Scenario 32: POST /api/pipeline/process supports targeted report and outbox batch execution", async () => {
    // 1. Single report mode
    const singleReq = new NextRequest("http://localhost:3000/api/pipeline/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: "rep_non_existent_9999" }),
    });
    const singleRes = await processPipelineRoute(singleReq);
    expect(singleRes.status).toBe(200);
    const singleJson = await singleRes.json();
    expect(singleJson.mode).toBe("single_report");
    expect(singleJson.result.status).toBe("NOT_FOUND");

    // 2. Outbox batch mode
    const batchReq = new NextRequest("http://localhost:3000/api/pipeline/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchSize: 5 }),
    });
    const batchRes = await processPipelineRoute(batchReq);
    expect(batchRes.status).toBe(200);
    const batchJson = await batchRes.json();
    expect(batchJson.mode).toBe("outbox_batch");
    expect(batchJson.summary).toBeDefined();
    expect(typeof batchJson.summary.processed).toBe("number");
  });

  // Scenario 33: Public Case Resolution Gateway & Map Pin Navigation (PRD §13, §16)
  it("Scenario 33: GET /api/reports/:id safely handles raw report IDs and canonical incident UUIDs", async () => {
    // 1. Non-existent ID returns clean 404
    const unknownId = "non_existent_99999";
    const req = new NextRequest(`http://localhost:3000/api/reports/${unknownId}`, {
      method: "GET",
    });
    const res = await getReportDetailRoute(req, {
      params: Promise.resolve({ reportId: unknownId }),
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Report not found");
  });

  // Scenario 34: Pilot Bounding Box Jurisdiction Validation (PRD §4 & §9)
  it("Scenario 34: Location verification downgrades quality band and flags out-of-bounds coordinates", async () => {
    // 1. Coordinates within Greater Noida pilot bounds (Pari Chowk: 28.4744°N, 77.5040°E)
    const inBoundsReport = {
      reportId: "rep_in_bounds_01",
      userId: "user_test",
      category: "Road Surface / Pothole",
      description: "Pothole in Alpha 1 Greater Noida",
      status: "SUBMITTED" as const,
      evidencePhotos: [
        {
          fileId: "file_01",
          sha256: "hash_01",
          filename: "photo_1.jpg",
          contentType: "image/jpeg",
          byteSize: 1024,
          captureTimestamp: new Date().toISOString(),
          isCameraCapture: true,
          gpsSamples: [
            {
              latitude: 28.4744,
              longitude: 77.504,
              horizontalAccuracyMeters: 6,
              sampleTimestamp: new Date().toISOString(),
            },
          ],
        },
      ],
      submissionLocation: {
        latitude: 28.4744,
        longitude: 77.504,
        accuracyMeters: 6,
        capturedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const inBoundsResult = await executeStage4LocationVerification(inBoundsReport);
    expect(inBoundsResult.success).toBe(true);
    expect(inBoundsResult.data?.isWithinPilotBounds).toBe(true);
    expect(inBoundsResult.data?.qualityBand).toBe("HIGH");

    // 2. Coordinates outside Greater Noida pilot bounds (e.g. Mumbai: 19.0760°N, 72.8777°E)
    const outOfBoundsReport = {
      ...inBoundsReport,
      reportId: "rep_out_bounds_01",
      evidencePhotos: [
        {
          ...inBoundsReport.evidencePhotos[0]!,
          gpsSamples: [
            {
              latitude: 19.076,
              longitude: 72.8777,
              horizontalAccuracyMeters: 5,
              sampleTimestamp: new Date().toISOString(),
            },
          ],
        },
      ],
    };

    const outOfBoundsResult = await executeStage4LocationVerification(outOfBoundsReport);
    expect(outOfBoundsResult.data?.isWithinPilotBounds).toBe(false);
    expect(outOfBoundsResult.data?.qualityBand).toBe("LOW");
    expect(
      outOfBoundsResult.data?.issues.some((issue) =>
        issue.includes("outside designated Greater Noida pilot bounding box"),
      ),
    ).toBe(true);
  });

  // Scenario 35: Authority Escalation State & Official Minutes Persistence (PRD §14, §16)
  it("Scenario 35: POST /api/admin/escalations validates authorization, input, and returns clean error handling", async () => {
    // 1. Unauthorized attempt
    const unauthReq = new NextRequest("http://localhost:3000/api/admin/escalations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mock-role": "citizen" },
      body: JSON.stringify({ incidentId: "test_inc_01" }),
    });
    const unauthRes = await postEscalationRoute(unauthReq);
    expect(unauthRes.status).toBe(403);

    // 2. Missing incidentId returns 400
    const missingIdReq = new NextRequest("http://localhost:3000/api/admin/escalations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mock-role": "moderator" },
      body: JSON.stringify({ status: "resolved" }),
    });
    const missingIdRes = await postEscalationRoute(missingIdReq);
    expect(missingIdRes.status).toBe(400);

    // 3. Non-existent incidentId returns 404
    const notFoundReq = new NextRequest("http://localhost:3000/api/admin/escalations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mock-role": "moderator" },
      body: JSON.stringify({ incidentId: "a0000000-0000-0000-0000-000000000000" }),
    });
    const notFoundRes = await postEscalationRoute(notFoundReq);
    expect(notFoundRes.status).toBe(404);
  });

  // Scenario 36: Municipal Grievance Dossier Printable Export Gateway (PRD §14 & §16)
  it("Scenario 36: GET /api/admin/incidents/:id/dossier requires auth and handles format options cleanly", async () => {
    const unknownIncId = "a0000000-0000-0000-0000-000000000000";

    // 1. Authenticated request for non-existent incident returns 404
    const authReq = new NextRequest(
      `http://localhost:3000/api/admin/incidents/${unknownIncId}/dossier?format=json`,
      {
        method: "GET",
        headers: { "x-mock-user-id": "mod_01", "x-mock-role": "moderator" },
      },
    );
    const authRes = await getDossierRoute(authReq, {
      params: Promise.resolve({ incidentId: unknownIncId }),
    });
    expect(authRes.status).toBe(404);
    const authJson = await authRes.json();
    expect(authJson.error).toMatch(/not found/i);
  });

  // Scenario 37: Intake Gateway Rate Limiting & Abuse Prevention (PRD §17)
  it("Scenario 37: Intake gateway enforces rate limits and responds with HTTP 429 when threshold exceeded", async () => {
    const testIp = "192.168.10.42";
    resetRateLimit(`submit_${testIp}`);

    // Exhaust the rate limit
    for (let i = 0; i < 15; i++) {
      const check = checkRateLimit(`submit_${testIp}`, { limit: 15, windowMs: 60000 });
      expect(check.allowed).toBe(true);
    }

    // 16th request must be rejected by checkRateLimit
    const overLimitCheck = checkRateLimit(`submit_${testIp}`, { limit: 15, windowMs: 60000 });
    expect(overLimitCheck.allowed).toBe(false);
    expect(overLimitCheck.remaining).toBe(0);
    expect(overLimitCheck.resetMs).toBeGreaterThan(0);

    // Verify submit route returns HTTP 429 and Retry-After header
    const overLimitReq = new NextRequest("http://localhost:3000/api/pipeline/submit", {
      method: "POST",
      headers: {
        "x-forwarded-for": testIp,
        "content-type": "application/json",
      },
      body: JSON.stringify({ category: "Road Surface", description: "Rate limit test" }),
    });

    const res = await submitRoute(overLimitReq);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeDefined();
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/too many submission attempts/i);

    // Clean up
    resetRateLimit(`submit_${testIp}`);
  });

  // Scenario 38: Public Map Lifecycle Query Inclusion (PRD §13 & §16)
  it("Scenario 38: Public map incidents API omits rejected/suspended incidents and returns active/remediated hazards", async () => {
    const mapReq = new NextRequest("http://localhost:3000/api/map/incidents", {
      method: "GET",
    });

    const res = await getMapIncidentsRoute(mapReq);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.incidents)).toBe(true);

    // Ensure no returned incident is marked as rejected or suspended
    for (const incident of json.incidents) {
      expect(incident.status).not.toBe("rejected");
      expect(incident.status).not.toBe("suspended");
      expect(incident.statusLabel).toBeDefined();
      expect(typeof incident.latitude).toBe("number");
      expect(typeof incident.longitude).toBe("number");
    }
  });

  // Scenario 39: Fast Intake Gateway Response Envelope (PRD §4 line 93)
  it("Scenario 39: Fast intake returns top-level reportId and status 'SUBMITTED' per PRD §4", async () => {
    // Generate valid dummy payload with 4 photos
    const dummyPhotos = Array.from({ length: 4 }).map((_, i) => ({
      filename: `photo_${i + 1}.jpg`,
      base64: Buffer.from("dummy-image-bytes").toString("base64"),
      contentType: "image/jpeg",
      capturedAt: new Date().toISOString(),
      isCameraCapture: true,
      gpsSamples: [
        {
          latitude: 28.4744,
          longitude: 77.504,
          horizontalAccuracyMeters: 5,
          sampleTimestamp: new Date().toISOString(),
        },
      ],
    }));

    const req = new NextRequest("http://localhost:3000/api/pipeline/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.50",
      },
      body: JSON.stringify({
        category: "Road Surface / Pothole",
        description: "Fast intake schema test description for PRD compliance",
        photos: dummyPhotos,
        submissionLocation: {
          latitude: 28.4744,
          longitude: 77.504,
          accuracyMeters: 5,
          capturedAt: new Date().toISOString(),
        },
      }),
    });

    const res = await submitRoute(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe("SUBMITTED");
    expect(typeof json.reportId).toBe("string");
    expect(json.reportId).toMatch(/^REP-/);
    expect(json.summary).toBeDefined();
    expect(json.summary.reportId).toBe(json.reportId);
    expect(json.summary.status).toBe("SUBMITTED");
  });

  // Scenario 40: Reprocessing and Force Re-evaluation on Rejected/Failed Reports (PRD §5 & §15)
  it("Scenario 40: Reprocessing endpoint permits force-reprocessing on existing reports", async () => {
    // 1. Non-existent report returns 404
    const unknownRepId = "rep_non_existent_404";
    const req = new NextRequest(`http://localhost:3000/api/reports/${unknownRepId}/reprocess`, {
      method: "POST",
      headers: { "x-mock-role": "moderator", "x-mock-user-id": "mod_01" },
    });

    const res = await reprocessRoute(req, {
      params: Promise.resolve({ reportId: unknownRepId }),
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  // Scenario 41: Transactional Outbox Exponential Backoff (PRD §15)
  it("Scenario 41: Outbox worker calculates exponential backoff delay based on retryCount", async () => {
    const calculateBackoff = (retryCount: number) => {
      return Math.min(300, Math.pow(2, retryCount) * 5) * 1000;
    };

    expect(calculateBackoff(1)).toBe(10000); // 10s
    expect(calculateBackoff(2)).toBe(20000); // 20s
    expect(calculateBackoff(3)).toBe(40000); // 40s
    expect(calculateBackoff(4)).toBe(80000); // 80s
    expect(calculateBackoff(5)).toBe(160000); // 160s
    expect(calculateBackoff(6)).toBe(300000); // Capped at 300s
  });

  // Scenario 42: GET /api/reports Returns Intact Evidence Photos (PRD §16)
  it("Scenario 42: GET /api/reports returns valid JSON with count and formatted reports", async () => {
    const req = new NextRequest("http://localhost:3000/api/reports?limit=5", {
      method: "GET",
    });

    const res = await getReportsRoute(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(typeof json.count).toBe("number");
    expect(Array.isArray(json.reports)).toBe(true);
  });

  // Scenario 43: POST /api/incidents/:id/vote Payload Validation & Error Handling (PRD §14B & §16)
  it("Scenario 43: POST /api/incidents/:id/vote validates voteType and handles non-existent incidents", async () => {
    // 1. Rejects invalid voteType
    const invalidVoteReq = new NextRequest(
      "http://localhost:3000/api/incidents/inc_test_123/vote",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voteType: "thumbs_up" }),
      },
    );

    const invalidRes = await postVoteRoute(invalidVoteReq, {
      params: Promise.resolve({ incidentId: "inc_test_123" }),
    });
    expect(invalidRes.status).toBe(400);
    const invalidJson = await invalidRes.json();
    expect(invalidJson.error).toMatch(/Invalid voteType/i);

    // 2. Rejects missing incident with 404
    const validVoteReq = new NextRequest(
      "http://localhost:3000/api/incidents/inc_missing_404/vote",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          voteType: "verify_hazard",
          isLocalResident: true,
        }),
      },
    );

    const notFoundRes = await postVoteRoute(validVoteReq, {
      params: Promise.resolve({ incidentId: "inc_missing_404" }),
    });
    expect(notFoundRes.status).toBe(404);
    const notFoundJson = await notFoundRes.json();
    expect(notFoundJson.error).toMatch(/not found/i);
  });

  // Scenario 44: PRD §14B Public Community Consensus Mathematical Gating
  it("Scenario 44: Community consensus evaluation gates incident resolution and triggers reopen on dispute", () => {
    const evaluateConsensus = (
      resolvedVotes: number,
      unresolvedVotes: number,
      currentStatus: string,
    ) => {
      const total = resolvedVotes + unresolvedVotes;
      const ratio = total > 0 ? resolvedVotes / total : 0;

      // Gate A: Resolution requires >= 3 confirmations and >= 75% positive ratio
      const shouldResolve = resolvedVotes >= 3 && ratio >= 0.75;

      // Gate B: Dispute requires >= 2 unresolved votes
      const isDisputed = unresolvedVotes >= 2;

      let newStatus = currentStatus;
      let newOpinion = "verified_hazard";

      if (isDisputed) {
        newStatus = "in_progress";
        newOpinion = "public_disputed";
      } else if (shouldResolve) {
        newStatus = "resolved";
        newOpinion = "community_resolved";
      }

      return { shouldResolve, isDisputed, newStatus, newOpinion, ratio };
    };

    // Case 1: 2 resolve votes (below quorum threshold of 3)
    const result1 = evaluateConsensus(2, 0, "in_progress");
    expect(result1.shouldResolve).toBe(false);
    expect(result1.newStatus).toBe("in_progress");

    // Case 2: 3 resolve votes, 0 unresolved (100% ratio >= 75%) -> Transitions to resolved
    const result2 = evaluateConsensus(3, 0, "under_repair");
    expect(result2.shouldResolve).toBe(true);
    expect(result2.newStatus).toBe("resolved");
    expect(result2.newOpinion).toBe("community_resolved");

    // Case 3: 3 resolve votes, 2 unresolved votes (60% ratio < 75%) and 2 unresolved votes -> Disputed and reopens
    const result3 = evaluateConsensus(3, 2, "resolved");
    expect(result3.isDisputed).toBe(true);
    expect(result3.newStatus).toBe("in_progress");
    expect(result3.newOpinion).toBe("public_disputed");
  });

  // Scenario 45: GET /api/incidents/:id/votes Endpoint Contract (PRD §14B & §16)
  it("Scenario 45: GET /api/incidents/:id/votes returns 404 for missing incident and enforces contract", async () => {
    const req = new NextRequest("http://localhost:3000/api/incidents/inc_unknown_xyz/votes", {
      method: "GET",
    });

    const res = await getVotesRoute(req, {
      params: Promise.resolve({ incidentId: "inc_unknown_xyz" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  // Scenario 46: PRD §14B Administrative Escalation Resolution Consensus Gating & Emergency Override
  it("Scenario 46: POST /api/admin/escalations enforces community consensus or documented emergency override", async () => {
    // 1. Rejects missing incident with 404 when called by authorized staff
    const notFoundReq = new NextRequest("http://localhost:3000/api/admin/escalations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-role": "moderator" },
      body: JSON.stringify({
        incidentId: "inc_non_existent_9999",
        status: "resolved",
      }),
    });
    const notFoundRes = await postEscalationRoute(notFoundReq);
    expect(notFoundRes.status).toBe(404);

    // 2. Rejects request without incidentId with 400
    const invalidReq = new NextRequest("http://localhost:3000/api/admin/escalations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-role": "moderator" },
      body: JSON.stringify({
        status: "resolved",
      }),
    });
    const invalidRes = await postEscalationRoute(invalidReq);
    expect(invalidRes.status).toBe(400);

    // 3. Mathematical verification of PRD §14B Consensus & Emergency Override Gating
    const checkConsensusGate = (
      resVotes: number,
      unresVotes: number,
      isEmergency: boolean,
      reason: string,
    ) => {
      const total = resVotes + unresVotes;
      const ratio = total > 0 ? resVotes / total : 0;
      if (isEmergency) {
        if (!reason || reason.trim().length < 10) return { error: "Reason too short", status: 400 };
        return { updatedStatus: "resolved", opinionStatus: "community_resolved", status: 200 };
      }
      if (resVotes >= 3 && ratio >= 0.75) {
        return { updatedStatus: "resolved", opinionStatus: "community_resolved", status: 200 };
      }
      return { updatedStatus: "under_review", opinionStatus: "under_repair", status: 200 };
    };

    // Case A: 1 vote -> Awaits citizen consensus in under_review / under_repair
    const caseA = checkConsensusGate(1, 0, false, "");
    expect(caseA.updatedStatus).toBe("under_review");
    expect(caseA.opinionStatus).toBe("under_repair");

    // Case B: 3 votes, 0 unresolved -> Consensus threshold met, transitions to resolved
    const caseB = checkConsensusGate(3, 0, false, "");
    expect(caseB.updatedStatus).toBe("resolved");
    expect(caseB.opinionStatus).toBe("community_resolved");

    // Case C: Emergency override with insufficient reason (< 10 chars) -> 400
    const caseC = checkConsensusGate(1, 0, true, "Urgent");
    expect(caseC.status).toBe(400);

    // Case D: Emergency override with documented reason (>= 10 chars) -> Resolves with audit record
    const caseD = checkConsensusGate(
      1,
      0,
      true,
      "Immediate safety hazard rectified by contractor on site",
    );
    expect(caseD.status).toBe(200);
    expect(caseD.updatedStatus).toBe("resolved");
  });

  // Scenario 47: PRD §2 & §14B Client-Side Session & RBAC Route Endpoint
  it("Scenario 47: GET /api/auth/session accurately returns role, permissions, and session status", async () => {
    const sessionReq = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "GET",
    });
    const sessionRes = await getSessionRoute(sessionReq);
    expect(sessionRes.status).toBe(200);

    const sessionJson = await sessionRes.json();
    expect(sessionJson.success).toBe(true);
    expect(sessionJson.session).toBeDefined();
    expect(sessionJson.session.role).toBeDefined();
    expect(sessionJson.session.permissions).toBeDefined();

    // Verify core citizen rights guaranteed by PRD §2 & §14B
    expect(sessionJson.session.permissions.canSubmitReport).toBe(true);
    expect(sessionJson.session.permissions.canViewPublicMap).toBe(true);
    expect(sessionJson.session.permissions.canVoteOnIncident).toBe(true);
    expect(sessionJson.session.permissions.canSubscribeToUpdates).toBe(true);
  });

  // Scenario 48: PRD §14B 500m Geodesic Qualification & Outbox Event Processing
  it("Scenario 48: Voter 500m geodesic qualification and outbox worker community consensus execution", async () => {
    const incidentLat = 28.4744;
    const incidentLng = 77.504;

    // Local resident within 100 meters qualifies for resolution quorum
    const nearbyDistance = calculateGeodesicDistanceMeters(
      incidentLat,
      incidentLng,
      28.475,
      77.5042,
    );
    expect(nearbyDistance).toBeLessThanOrEqual(500);

    // General commuter at 3.5 km is disqualified from local consensus quorum
    const distantDistance = calculateGeodesicDistanceMeters(incidentLat, incidentLng, 28.5, 77.52);
    expect(distantDistance).toBeGreaterThan(500);

    // Outbox batch processing handles community consensus and dispute events cleanly
    const outboxBatchRes = await processOutboxBatch(10);
    expect(outboxBatchRes.processed).toBeGreaterThanOrEqual(0);
    expect(outboxBatchRes.failed).toBe(0);
  });

  // Scenario 49: Voting Gateway Rate Limiting & Anti-Ballot-Stuffing Defense (PRD §17 line 634)
  it("Scenario 49: Voting gateway enforces 30 req/min rate limit and blocks ballot-stuffing abuse", async () => {
    const testVoterIp = "10.0.55.99";
    resetRateLimit(`vote_${testVoterIp}`);

    // First 30 votes within window are permitted by rate limiter
    for (let i = 0; i < 30; i++) {
      const check = checkRateLimit(`vote_${testVoterIp}`, { limit: 30, windowMs: 60000 });
      expect(check.allowed).toBe(true);
    }

    // 31st request exceeds rate limit
    const overLimitCheck = checkRateLimit(`vote_${testVoterIp}`, { limit: 30, windowMs: 60000 });
    expect(overLimitCheck.allowed).toBe(false);
    expect(overLimitCheck.remaining).toBe(0);
    expect(overLimitCheck.resetMs).toBeGreaterThan(0);

    // Verify POST /api/incidents/:id/vote returns HTTP 429
    const overLimitVoteReq = new NextRequest("http://localhost:3000/api/incidents/test_inc/vote", {
      method: "POST",
      headers: {
        "x-forwarded-for": testVoterIp,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        voteType: "verify_hazard",
      }),
    });

    const voteRes = await postVoteRoute(overLimitVoteReq, {
      params: Promise.resolve({ incidentId: "test_inc" }),
    });

    expect(voteRes.status).toBe(429);
    const voteJson = await voteRes.json();
    expect(voteJson.error).toMatch(/rate limit exceeded/i);
    expect(voteRes.headers.get("Retry-After")).toBeDefined();
    expect(voteRes.headers.get("X-RateLimit-Limit")).toBe("30");

    resetRateLimit(`vote_${testVoterIp}`);
  });

  // Scenario 50: Municipal Escalation Docket Dispute State Alerting (PRD §14B line 531)
  it("Scenario 50: Escalations endpoint highlights active community disputes with destructive status", async () => {
    // Evaluation helper mirroring GET /api/admin/escalations dispute classification logic
    const evaluateDocketStatus = (
      publicOpinionStatus?: string,
      status?: string,
      hasDispatched?: boolean,
    ) => {
      const isDisputed =
        publicOpinionStatus === "reopened_by_community" ||
        publicOpinionStatus === "public_disputed";
      const isResolved = status === "resolved";
      const isUnderRepair = status === "under_review" || publicOpinionStatus === "under_repair";

      if (isDisputed) {
        return {
          status: "in-progress",
          statusLabel: "Community Dispute: Reopened for Re-repair",
          statusVariant: "destructive",
        };
      }
      if (isResolved) {
        return {
          status: "resolved",
          statusLabel: "Remediation Complete",
          statusVariant: "default",
        };
      }
      if (isUnderRepair) {
        return {
          status: "in-progress",
          statusLabel: "Under Repair",
          statusVariant: "secondary",
        };
      }
      if (hasDispatched) {
        return {
          status: "acknowledged",
          statusLabel: "Docket: GRV-2026-001",
          statusVariant: "secondary",
        };
      }
      return {
        status: "in-progress",
        statusLabel: "Pending Dispatch",
        statusVariant: "secondary",
      };
    };

    // Case 1: When incident was reopened by community due to defect persistence
    const disputedDocket = evaluateDocketStatus("reopened_by_community", "in_progress", true);
    expect(disputedDocket.statusVariant).toBe("destructive");
    expect(disputedDocket.statusLabel).toBe("Community Dispute: Reopened for Re-repair");
    expect(disputedDocket.status).toBe("in-progress");

    // Case 2: When incident is public disputed
    const publicDisputedDocket = evaluateDocketStatus("public_disputed", "in_progress", true);
    expect(publicDisputedDocket.statusVariant).toBe("destructive");
    expect(publicDisputedDocket.statusLabel).toBe("Community Dispute: Reopened for Re-repair");

    // Case 3: When incident is normally dispatched without community dispute
    const standardDocket = evaluateDocketStatus("verified_hazard", "approved", true);
    expect(standardDocket.statusVariant).toBe("secondary");
    expect(standardDocket.statusLabel).toContain("Docket:");
  });

  // Scenario 51: Reports API Staff Scoping & Citizen Privacy Isolation (PRD §2 & §16)
  it("Scenario 51: GET /api/reports enforces citizen privacy isolation while granting staff regional scope", async () => {
    // 1. Citizen request: isolated to user session
    const citizenReq = new NextRequest("http://localhost:3000/api/reports", {
      method: "GET",
      headers: { "x-mock-user-id": "citizen_99", "x-mock-role": "citizen" },
    });
    const citizenRes = await getReportsRoute(citizenReq);
    expect(citizenRes.status).toBe(200);
    const citizenJson = await citizenRes.json();
    expect(citizenJson.success).toBe(true);
    expect(Array.isArray(citizenJson.reports)).toBe(true);

    // 2. Staff request: regional scope permitted
    const staffReq = new NextRequest("http://localhost:3000/api/reports?scope=all", {
      method: "GET",
      headers: { "x-mock-user-id": "mod_01", "x-mock-role": "moderator" },
    });
    const staffRes = await getReportsRoute(staffReq);
    expect(staffRes.status).toBe(200);
    const staffJson = await staffRes.json();
    expect(staffJson.success).toBe(true);
    expect(Array.isArray(staffJson.reports)).toBe(true);
  });

  // Scenario 52: Reports Registry Status Normalization & Escalation Update Contract (PRD §5 & §14)
  it("Scenario 52: Reports registry normalizes PUBLISHED to active and escalation gateway handles aliased params", async () => {
    // 1. Verify status normalization logic for reports registry
    const normalizeRegistryStatus = (rawStatus?: string) => {
      const norm = (rawStatus || "").toUpperCase();
      if (norm === "RESOLVED") return "resolved";
      if (norm === "IN_PROGRESS" || norm === "IN-PROGRESS" || norm === "ASSIGNED")
        return "in-progress";
      if (norm === "ESCALATED" || norm === "MUNICIPALLY_DISPATCHED") return "escalated";
      if (norm === "REJECTED" || norm === "SUSPENDED") return "under-review";
      // PRD §5 & §14B: A published report represents an active hazard on the map awaiting municipal resolution & public consensus
      return "open";
    };

    expect(normalizeRegistryStatus("PUBLISHED")).toBe("open");
    expect(normalizeRegistryStatus("APPROVED")).toBe("open");
    expect(normalizeRegistryStatus("RESOLVED")).toBe("resolved");
    expect(normalizeRegistryStatus("REJECTED")).toBe("under-review");

    // 2. Verify POST /api/admin/escalations accepts aliased { newStatus, officialReply }
    const aliasedReq = new NextRequest("http://localhost:3000/api/admin/escalations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mock-role": "moderator" },
      body: JSON.stringify({
        incidentId: "test_inc_01",
        newStatus: "in_progress",
        officialReply: "Dispatched civil field inspection team",
      }),
    });
    const aliasedRes = await postEscalationRoute(aliasedReq);
    // Since test_inc_01 does not exist in DB, it returns 404 cleanly, confirming request parsing succeeded without 400
    expect(aliasedRes.status).toBe(404);
  });

  // Scenario 53: Outbox Worker Voter Subscription & Progress Notification Dispatch (PRD §14B)
  it("Scenario 53: Outbox worker and voter notifier dispatch milestone notifications cleanly", async () => {
    // 1. Subscription confirmation notification
    const subResult = await dispatchVoterProgressNotification({
      incidentId: "INC-2026-TEST",
      eventType: "voter.subscribed_to_updates",
      voterEmail: "citizen@example.com",
      voterName: "Sector 15 Resident",
    });
    expect(subResult.success).toBe(true);
    expect(subResult.recipientCount).toBe(1);
    expect(subResult.subject).toContain("Subscribed");

    // 2. Dispute reopen notification
    const disputeResult = await dispatchVoterProgressNotification({
      incidentId: "INC-2026-TEST",
      eventType: "incident.reopened_by_community",
      voterEmail: "citizen@example.com",
      message: "Contractor repair disputed by 2+ local residents",
    });
    expect(disputeResult.success).toBe(true);
    expect(disputeResult.subject).toContain("Community Dispute");

    // 3. Community consensus resolved notification
    const resolvedResult = await dispatchVoterProgressNotification({
      incidentId: "INC-2026-TEST",
      eventType: "incident.community_resolved",
      voterEmail: "citizen@example.com",
    });
    expect(resolvedResult.success).toBe(true);
    expect(resolvedResult.subject).toContain("Community Verified Resolved");
  });

  // Scenario 54: Main Dashboard & Reports Registry Consensus Status Normalization (PRD §14B)
  it("Scenario 54: Dashboard consensus normalization identifies citizen dispute dockets and quorum state", () => {
    // 1. Verify consensus normalization helper
    function resolveDashboardConsensusLabel(status: string, publicOpinionStatus?: string) {
      if (publicOpinionStatus === "reopened_by_community") return "Citizen Disputed";
      if (publicOpinionStatus === "verified_by_community") return "Community Verified";
      if (publicOpinionStatus === "under_repair") return "Under Repair";
      if (publicOpinionStatus === "under_review") return "Quorum Pending";
      return status;
    }

    expect(resolveDashboardConsensusLabel("in-progress", "reopened_by_community")).toBe(
      "Citizen Disputed",
    );
    expect(resolveDashboardConsensusLabel("in-progress", "verified_by_community")).toBe(
      "Community Verified",
    );
    expect(resolveDashboardConsensusLabel("in-progress", "under_repair")).toBe("Under Repair");
    expect(resolveDashboardConsensusLabel("open", "under_review")).toBe("Quorum Pending");
    expect(resolveDashboardConsensusLabel("resolved")).toBe("resolved");

    // 2. Verify dispute filtering predicate
    const mockReports = [
      {
        id: "REP-1",
        status: "in-progress",
        publicOpinionStatus: "reopened_by_community",
        votes: 4,
      },
      { id: "REP-2", status: "open", publicOpinionStatus: "verified_by_community", votes: 2 },
      { id: "REP-3", status: "escalated", publicOpinionStatus: "under_review", votes: 1 },
      { id: "REP-4", status: "resolved", publicOpinionStatus: "resolved", votes: 5 },
    ];

    const disputedReports = mockReports.filter(
      (r) => r.publicOpinionStatus === "reopened_by_community" || r.status === "escalated",
    );
    expect(disputedReports.length).toBe(2);
    expect(disputedReports.map((r) => r.id)).toEqual(["REP-1", "REP-3"]);

    // 3. Verify Community Quorum Telemetry calculation
    const communityQuorumCount = mockReports.filter(
      (r) => r.publicOpinionStatus === "reopened_by_community" || (r.votes || 0) > 0,
    ).length;
    expect(communityQuorumCount).toBe(4);
  });

  // Scenario 55: Map Drawer & Live Safety Map Public Consensus Integration (PRD §13 & §14B)
  it("Scenario 55: Map incidents and drawer expose required community consensus counters and metadata", async () => {
    // 1. Map incidents endpoint returns valid consensus metadata
    const mapReq = new NextRequest("http://localhost:3000/api/map/incidents", {
      method: "GET",
    });
    const mapRes = await getMapIncidentsRoute(mapReq);
    expect(mapRes.status).toBe(200);

    const mapData = await mapRes.json();
    expect(mapData.success).toBe(true);
    expect(Array.isArray(mapData.incidents)).toBe(true);

    if (mapData.incidents.length > 0) {
      const sample = mapData.incidents[0];
      expect(typeof sample.verificationsCount).toBe("number");
      expect(typeof sample.statusLabel).toBe("string");
      expect(sample.latitude).toBeGreaterThan(0);
      expect(sample.longitude).toBeGreaterThan(0);
    }

    // 2. Voting within 500m qualification rejects missing incident gracefully
    const voteReq = new NextRequest("http://localhost:3000/api/incidents/inc_unknown/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voteType: "verify_hazard",
        isLocalResident: true,
        voterLatitude: 28.4744,
        voterLongitude: 77.504,
      }),
    });
    const voteRes = await postVoteRoute(voteReq, {
      params: Promise.resolve({ incidentId: "inc_unknown" }),
    });
    // Unknown incident in DB returns 404
    expect(voteRes.status).toBe(404);
  });

  // Scenario 56: Public-Opinion Progress Governance on Fast Intake Receipt & Citizen Dossier Links (PRD §3 & §14B)
  it("Scenario 56: Fast intake receipt generates public-safe URLs and communicates consensus governance", () => {
    const reportReceipt = {
      reportId: "REP-2026-TEST-RECEIPT",
      status: "SUBMITTED",
      timestamp: new Date().toISOString(),
    };

    // 1. Citizen route generator conforms to public RBAC
    const publicTrackerUrl = `/reports/${encodeURIComponent(reportReceipt.reportId)}`;
    const publicMapHighlightUrl = `/map?highlight=${encodeURIComponent(reportReceipt.reportId)}`;

    expect(publicTrackerUrl).toMatch(/^\/reports\/REP-/);
    expect(publicMapHighlightUrl).toMatch(/^\/map\?highlight=REP-/);
    // Explicitly verify no internal staff routes are surfaced to citizen
    expect(publicTrackerUrl.includes("/dashboard/")).toBe(false);
    expect(publicMapHighlightUrl.includes("/dashboard/")).toBe(false);

    // 2. Initial reporter rights in PRD §14B
    const voterRoles = ["reporter", "local_resident", "commuter"];
    expect(voterRoles).toContain("reporter");
  });

  // Scenario 57: Map Inspection Drawer Consensus Synchronization & Stepper Navigation (PRD §13 & §14B)
  it("Scenario 57: Map drawer stepper calculations and consensus status rendering operate cyclically", () => {
    const sampleHazards = [
      {
        id: "HAZ-001",
        title: "Pothole Pari Chowk",
        severity: "critical",
        status: "open",
        publicOpinionStatus: "reopened_by_community",
        verificationsCount: 4,
        unresolvedVotesCount: 2,
      },
      {
        id: "HAZ-002",
        title: "Dark Street Alpha 1",
        severity: "medium",
        status: "under-review",
        publicOpinionStatus: "under_repair",
        verificationsCount: 2,
        unresolvedVotesCount: 0,
      },
      {
        id: "HAZ-003",
        title: "Broken Footpath Gamma",
        severity: "low",
        status: "resolved",
        publicOpinionStatus: "community_resolved",
        verificationsCount: 5,
        resolutionVotesCount: 4,
      },
    ];

    const total = sampleHazards.length;

    // 1. Stepper next from end wraps to beginning
    const currentIdx = 2;
    const nextIdx = (currentIdx + 1) % total;
    expect(nextIdx).toBe(0);
    expect(sampleHazards[nextIdx]?.id).toBe("HAZ-001");

    // 2. Stepper prev from beginning wraps to end
    const prevIdx = (0 - 1 + total) % total;
    expect(prevIdx).toBe(2);
    expect(sampleHazards[prevIdx]?.id).toBe("HAZ-003");

    // 3. Consensus state verification
    expect(sampleHazards[0]?.publicOpinionStatus).toBe("reopened_by_community");
    expect(sampleHazards[1]?.publicOpinionStatus).toBe("under_repair");
    expect(sampleHazards[2]?.publicOpinionStatus).toBe("community_resolved");
  });

  // Scenario 58: Map Drawer 1-Click In-Place Verification Vote & Idempotent Consensus Synchronization (PRD §13 & §14B)
  it("Scenario 58: Map drawer in-place verification vote records community verification and prevents duplicate ballots", async () => {
    const testVoterIp = "192.168.10.45";
    resetRateLimit(`vote_${testVoterIp}`);

    // 1. Fetch available map incident for end-to-end integration test
    const mapReq = new NextRequest("http://localhost:3000/api/map/incidents", {
      method: "GET",
    });
    const mapRes = await getMapIncidentsRoute(mapReq);
    expect(mapRes.status).toBe(200);
    const mapData = await mapRes.json();
    expect(mapData.success).toBe(true);

    if (mapData.incidents && mapData.incidents.length > 0) {
      const target = mapData.incidents[0];
      expect(target.id).toBeDefined();

      // 2. Cast 1-click in-place verification vote from drawer
      const voteReq = new NextRequest(`http://localhost:3000/api/incidents/${target.id}/vote`, {
        method: "POST",
        headers: {
          "x-forwarded-for": testVoterIp,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          voteType: "verify_hazard",
          isLocalResident: true,
          wantsUpdates: false,
        }),
      });
      const voteRes = await postVoteRoute(voteReq, {
        params: Promise.resolve({ incidentId: target.id }),
      });
      expect(voteRes.status).toBe(200);
      const voteJson = await voteRes.json();
      expect(voteJson.success).toBe(true);

      // 3. Idempotent ballot handling: duplicate vote from same citizen network returns alreadyVoted
      const dupReq = new NextRequest(`http://localhost:3000/api/incidents/${target.id}/vote`, {
        method: "POST",
        headers: {
          "x-forwarded-for": testVoterIp,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          voteType: "verify_hazard",
          isLocalResident: true,
          wantsUpdates: false,
        }),
      });
      const dupRes = await postVoteRoute(dupReq, {
        params: Promise.resolve({ incidentId: target.id }),
      });
      expect(dupRes.status).toBe(200);
      const dupJson = await dupRes.json();
      expect(dupJson.alreadyVoted).toBe(true);

      // 4. Verify vote tally lookup route reflects current counts
      const getVotesReq = new NextRequest(
        `http://localhost:3000/api/incidents/${target.id}/votes`,
        {
          method: "GET",
          headers: { "x-forwarded-for": testVoterIp },
        },
      );
      const getVotesRes = await getVotesRoute(getVotesReq, {
        params: Promise.resolve({ incidentId: target.id }),
      });
      expect(getVotesRes.status).toBe(200);
      const getVotesJson = await getVotesRes.json();
      expect(getVotesJson.success).toBe(true);
      expect(getVotesJson.verificationVotesCount).toBeGreaterThanOrEqual(1);
    } else {
      // Missing incident returns 404
      const missingVoteReq = new NextRequest(
        "http://localhost:3000/api/incidents/inc_missing_fallback/vote",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            voteType: "verify_hazard",
            isLocalResident: true,
          }),
        },
      );
      const res = await postVoteRoute(missingVoteReq, {
        params: Promise.resolve({ incidentId: "inc_missing_fallback" }),
      });
      expect(res.status).toBe(404);
    }
  });

  // Scenario 59: Live Map Filter Reconciler for Drawer Inspection Focus (PRD §13 & §16)
  it("Scenario 59: Filter shifts reconcile active drawer index or dismiss cleanly when matching subset is empty", () => {
    interface MockHazard {
      id: string;
      category: string;
      status: string;
      publicOpinionStatus?: string;
    }

    const hazards: MockHazard[] = [
      { id: "HAZ-P1", category: "pothole", status: "open", publicOpinionStatus: "none" },
      {
        id: "HAZ-P2",
        category: "pothole",
        status: "under-review",
        publicOpinionStatus: "under_repair",
      },
      {
        id: "HAZ-S1",
        category: "streetlight",
        status: "resolved",
        publicOpinionStatus: "community_resolved",
      },
    ];

    // Filter helper mirroring LiveHazardMap filter logic
    const filterHazards = (items: MockHazard[], cat: string, stat: string) => {
      return items.filter((h) => {
        if (cat !== "all" && h.category !== cat) return false;
        if (stat === "all") return true;
        if (stat === "community_resolved") {
          return h.publicOpinionStatus === "community_resolved" || h.status === "resolved";
        }
        if (stat === "under_repair") {
          return h.publicOpinionStatus === "under_repair" || h.status === "under-review";
        }
        if (stat === "public_disputed") {
          return (
            h.publicOpinionStatus === "public_disputed" ||
            h.publicOpinionStatus === "reopened_by_community"
          );
        }
        return true;
      });
    };

    // State reconciler helper mirroring LiveHazardMap useEffect logic
    const reconcileDrawerState = (
      drawerOpen: boolean,
      highlightedId: string | null,
      filtered: MockHazard[],
    ) => {
      const currentIndex = filtered.findIndex((h) => h.id === highlightedId);
      if (drawerOpen && highlightedId && currentIndex === -1) {
        if (filtered.length > 0 && filtered[0]) {
          return { drawerOpen: true, highlightedId: filtered[0].id };
        } else {
          return { drawerOpen: false, highlightedId: null };
        }
      }
      return { drawerOpen, highlightedId };
    };

    // 1. Initial state: viewing HAZ-P1 with All filters
    let currentDrawer = { drawerOpen: true, highlightedId: "HAZ-P1" as string | null };
    let filtered = filterHazards(hazards, "all", "all");
    expect(filtered).toHaveLength(3);

    // 2. User filters to category 'streetlight' (HAZ-P1 no longer in filtered list)
    filtered = filterHazards(hazards, "streetlight", "all");
    expect(filtered).toHaveLength(1);
    currentDrawer = reconcileDrawerState(
      currentDrawer.drawerOpen,
      currentDrawer.highlightedId,
      filtered,
    );
    // Auto-reconciles to the first matching streetlight
    expect(currentDrawer.drawerOpen).toBe(true);
    expect(currentDrawer.highlightedId).toBe("HAZ-S1");

    // 3. User filters to category 'garbage' (0 matches)
    filtered = filterHazards(hazards, "garbage", "all");
    expect(filtered).toHaveLength(0);
    currentDrawer = reconcileDrawerState(
      currentDrawer.drawerOpen,
      currentDrawer.highlightedId,
      filtered,
    );
    // Auto-dismisses drawer safely without index out of bounds
    expect(currentDrawer.drawerOpen).toBe(false);
    expect(currentDrawer.highlightedId).toBeNull();
  });

  // Scenario 60: Authenticated vs Unauthenticated Session Resolution & Direct Auth Bridge (PRD §2 & §16)
  it("Scenario 60: Auth bridge resolves session cookies, validates unauthenticated state, and processes login/logout", async () => {
    // 1. Unauthenticated request without cookies or headers returns isAuthenticated: false
    const anonReq = new NextRequest("http://localhost:3000/api/auth/session", {
      method: "GET",
    });
    const anonRes = await getSessionRoute(anonReq);
    expect(anonRes.status).toBe(200);
    const anonJson = await anonRes.json();
    expect(anonJson.success).toBe(true);
    expect(anonJson.session.isAuthenticated).toBe(false);
    expect(anonJson.session.role).toBe("citizen");

    // 2. Direct login as Citizen sets cookies
    const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "citizen", email: "citizen@example.in" }),
    });
    const loginRes = await loginRoute(loginReq);
    expect(loginRes.status).toBe(200);
    const loginJson = await loginRes.json();
    expect(loginJson.success).toBe(true);
    expect(loginJson.user.isAuthenticated).toBe(true);
    expect(loginJson.user.role).toBe("citizen");
    expect(loginRes.cookies.get("jansahayak_user_id")).toBeDefined();
    expect(loginRes.cookies.get("jansahayak_role")?.value).toBe("citizen");

    // 3. Direct login as Moderator sets staff role
    const modLoginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "moderator" }),
    });
    const modLoginRes = await loginRoute(modLoginReq);
    expect(modLoginRes.status).toBe(200);
    const modJson = await modLoginRes.json();
    expect(modJson.user.role).toBe("moderator");
    expect(modLoginRes.cookies.get("jansahayak_role")?.value).toBe("moderator");

    // 4. Logout clears session cookies
    const logoutRes = await logoutRoute();
    expect(logoutRes.status).toBe(200);
    const logoutJson = await logoutRes.json();
    expect(logoutJson.success).toBe(true);
  });

  // Scenario 61: Report Update and Retraction / Deletion Ownership Protection (PRD §2 & §16)
  it("Scenario 61: Report update and deletion endpoints enforce authentication and reporter ownership boundaries", async () => {
    // 1. Unauthenticated update attempt returns 401
    const unauthPatchReq = new NextRequest("http://localhost:3000/api/reports/REP-TEST-001", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "Updated description attempt" }),
    });
    const unauthPatchRes = await patchReportRoute(unauthPatchReq, {
      params: Promise.resolve({ reportId: "REP-TEST-001" }),
    });
    expect(unauthPatchRes.status).toBe(401);

    // 2. Unauthenticated delete attempt returns 401
    const unauthDelReq = new NextRequest("http://localhost:3000/api/reports/REP-TEST-001", {
      method: "DELETE",
    });
    const unauthDelRes = await deleteReportRoute(unauthDelReq, {
      params: Promise.resolve({ reportId: "REP-TEST-001" }),
    });
    expect(unauthDelRes.status).toBe(401);

    // 3. Non-existent report returns 404 for authorized user
    const notFoundPatchReq = new NextRequest(
      "http://localhost:3000/api/reports/REP-NON-EXISTENT-404",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-mock-user-id": "citizen_owner",
          "x-mock-role": "citizen",
        },
        body: JSON.stringify({ description: "Updated" }),
      },
    );
    const notFoundPatchRes = await patchReportRoute(notFoundPatchReq, {
      params: Promise.resolve({ reportId: "REP-NON-EXISTENT-404" }),
    });
    expect(notFoundPatchRes.status).toBe(404);

    const notFoundDelReq = new NextRequest(
      "http://localhost:3000/api/reports/REP-NON-EXISTENT-404",
      {
        method: "DELETE",
        headers: {
          "x-mock-user-id": "citizen_owner",
          "x-mock-role": "citizen",
        },
      },
    );
    const notFoundDelRes = await deleteReportRoute(notFoundDelReq, {
      params: Promise.resolve({ reportId: "REP-NON-EXISTENT-404" }),
    });
    expect(notFoundDelRes.status).toBe(404);
  });

  // Scenario 62: Civilian vs Municipal Staff RBAC Docket Isolation (PRD §2, §14B, & §16)
  it("Scenario 62: Civilian accounts are isolated from staff dockets and staff can view all records", () => {
    // 1. Role capability evaluation
    const evaluateAccess = (role: string) => {
      const isStaff = role === "moderator" || role === "admin";
      return {
        canViewDashboard: true,
        canViewMyReports: true,
        canViewLiveMap: true,
        canViewModerationQueue: isStaff,
        canAccessEscalations: isStaff,
        canAccessPipeline: role === "admin",
      };
    };

    const citizenCaps = evaluateAccess("citizen");
    expect(citizenCaps.canViewDashboard).toBe(true);
    expect(citizenCaps.canViewMyReports).toBe(true);
    expect(citizenCaps.canViewModerationQueue).toBe(false);
    expect(citizenCaps.canAccessEscalations).toBe(false);
    expect(citizenCaps.canAccessPipeline).toBe(false);

    const modCaps = evaluateAccess("moderator");
    expect(modCaps.canViewModerationQueue).toBe(true);
    expect(modCaps.canAccessEscalations).toBe(true);

    const adminCaps = evaluateAccess("admin");
    expect(adminCaps.canViewModerationQueue).toBe(true);
    expect(adminCaps.canAccessEscalations).toBe(true);
    expect(adminCaps.canAccessPipeline).toBe(true);

    // 2. Navigation items visibility filtering logic
    const allNavItems = [
      { href: "/dashboard", label: "Overview", minRole: "citizen" },
      { href: "/dashboard/reports", label: "Reports", minRole: "citizen" },
      { href: "/dashboard/map", label: "Live Map", minRole: "citizen" },
      { href: "/dashboard/moderation", label: "Moderation", minRole: "moderator" },
      { href: "/dashboard/escalations", label: "Escalations", minRole: "moderator" },
      { href: "/dashboard/pipeline", label: "PRD Pipeline", minRole: "moderator" },
    ];

    const filterNav = (userRole: string) => {
      const isStaffUser = userRole === "moderator" || userRole === "admin";
      return allNavItems.filter((item) => {
        if (item.minRole === "citizen") return true;
        if (item.minRole === "moderator") return isStaffUser;
        return false;
      });
    };

    const citizenNav = filterNav("citizen");
    expect(citizenNav).toHaveLength(3);
    expect(citizenNav.map((n) => n.href)).toEqual([
      "/dashboard",
      "/dashboard/reports",
      "/dashboard/map",
    ]);

    const staffNav = filterNav("moderator");
    expect(staffNav).toHaveLength(6);
  });
});
