# PRD: Asynchronous Citizen Report Intake, Background Verification Pipeline, Map Publication, and Municipal Email Dispatch

**Product:** JanSahayak SafeStreets  
**Module:** Asynchronous Report Intake & Background Processing Pipeline  
**Priority:** Critical  
**Implementation objective:** Deliver an instant, non-blocking citizen submission experience by decoupling intake from multi-stage processing. Submissions are accepted immediately (<500ms) and staged with status `SUBMITTED`. A dedicated background analysis worker executes evidence validation, AI vision analysis, location verification, and duplicate matching, marking invalid submissions as `REJECTED` and advancing valid ones to moderation and canonical incident synthesis. Approved incidents are published to the public map, and a formal civic report dossier is automatically compiled and dispatched to the local municipality via email for field action.

---

## 1. Product objective

Implement an end-to-end decoupled pipeline that accepts a citizen's road-safety report with near-instantaneous feedback, processes the evidence asynchronously through a background analysis worker, resolves incident associations, publishes verified hazards to the public map, and automatically dispatches an official civic report dossier to the local municipal authority via email.

The system must automate every processing stage that can be reliably automated. Human intervention is permitted only where required by configured business rules, insufficient evidence, ambiguous AI predictions, moderation policies or operational failures.

The system must never publish a report or incident when a required processing stage has failed, has not completed, or has produced an invalid result.

### Core principles

1. **Instant, non-blocking intake**: The user submission HTTP request must never block on long-running AI vision, geospatial matching, or external network calls. Intake must persist raw evidence and return a durable tracking receipt within 500ms.
2. **Asynchronous background processing**: A dedicated worker picks up queued submissions in the background, executing verification and updating report status explicitly (`SUBMITTED` → `PROCESSING` → `APPROVED` / `REJECTED`).
3. **Fail closed**: Incomplete or unverified processing cannot produce a public map pin.
4. **Preserve evidence**: Processing failures or rejections must not destroy original reports or uploaded evidence.
5. **Idempotent execution**: Retries must not create duplicate incidents, merges, map pins, or municipal email dispatches.
6. **Evidence-first decisions**: AI predictions must be supported by recorded evidence and confidence information.
7. **Strict automatic merging**: Automatically merge only calibrated high-confidence matches that pass every hard rule.
8. **Human-review fallback**: Uncertain or contradictory cases must enter an appropriate review queue.
9. **Transactional publication**: Public incident visibility and canonical map-pin creation must happen atomically from the application's perspective.
10. **Direct municipal accountability**: Once an incident is verified and published, the system must generate a formal civic report dossier and automatically dispatch it to the local municipality via email.
11. **Full auditability**: Every stage, decision, failure, retry, override, publication, and municipal email dispatch must be traceable.
12. **Privacy by default**: Private citizen data, raw device metadata and unnecessary precise location information must not be exposed publicly.
13. **Recoverability**: Infrastructure failures must result in retries or explicit failed states, never silent data loss.

## 2. Scope

### Included

- Authenticated report submission with instant non-blocking intake (<500ms SLA).
- In-app camera evidence capture integration with minimum four valid photographs.
- Capture-time GPS sampling and location-quality validation.
- Secure evidence upload to MongoDB GridFS.
- Asynchronous background report analysis worker.
- Server-side evidence validation and corruption checks.
- AI image-quality assessment, hazard classification, and structured defect extraction.
- Image embeddings and duplicate-image detection.
- Candidate incident discovery using geospatial PostGIS queries.
- Image, location, category, temporal and defect-context matching.
- Strict automatic merge eligibility and manual merge/split review.
- Evidence-based representative incident location calculation.
- Moderation and approval workflow.
- Explicit terminal rejection with documented reasons (`REJECTED` status).
- Canonical incident creation and public map publication upon complete verification.
- **Role-Based Access Control (RBAC)**: Public/Citizen tier (map exploration, report submission, and localized community voting) vs. Staff/Moderator/Admin tier (moderation queues, dossier review, merge/split operations, and municipal escalation).
- **Municipal civic report dossier generation and automatic email dispatch to the local municipality**.
- **Community Hazard Verification & Resolution Voting (Public-Opinion-Driven Project Progress)**: Local residents and reporting citizens vote to verify hazards, subscribe to progress updates, and gate final resolution status based on community consensus.
- Automatic retries, transactional outbox pattern, failure handling, and operational monitoring.
- Audit logs, citizen notifications, and automated integration tests.

### Excluded from this module

- Authority performance scoring and SLA penalties.
- Proprietary closed-source municipal ERP integrations (the open standard email dossier is the primary dispatch channel).
- Commercial contractor payout or procurement management.

These later workflows must consume the canonical incident created by this pipeline without weakening its validation or publication requirements.

## 3. User workflow

1. A citizen creates an account and starts a report.
2. The citizen selects a problem category and enters a description.
3. The citizen captures at least four photographs using the in-app camera viewfinder.
4. The application samples device location at each capture and associates it with the corresponding evidence record.
5. **Instant Intake & Staging (<500ms)**: The citizen taps "Submit Report". The backend fast-intake API authenticates the citizen, verifies minimum photograph count, streams images to MongoDB GridFS, persists a durable `raw_reports` document with status `SUBMITTED`, logs an outbox event, and immediately returns a success receipt with `reportId`. The user sees an instant confirmation screen without waiting for downstream AI or spatial processing.
6. **Asynchronous Background Processing Worker**: A dedicated background analysis worker picks up the `SUBMITTED` report.
7. **Evidence & Corruption Validation**: The worker validates image bitstreams, dimensions, metadata, and timestamps. If the submission fails validation or is deemed invalid/abusive, the worker marks the report status as `REJECTED` with a documented rejection rationale, notifying the citizen.
8. **AI Vision & Hazard Classification**: If valid, the worker invokes the AI vision model to extract structured attributes, defect severity, usability metrics, and feature embeddings.
9. **Location Geodesic Calculation**: The system calculates a robust representative location and uncertainty radius from validated GPS samples.
10. **Duplicate Discovery & Candidate Matching**: The system searches PostGIS for existing nearby incidents and determines if the submission matches an existing incident.
11. **Incident Association**: A qualifying high-confidence duplicate is associated with the existing canonical incident; otherwise, a new canonical incident is created.
12. **Moderation & Publication**: The configured moderation policy determines whether automatic or manual human approval applies.
13. **Map Publication**: Only upon complete, approved workflow execution does the incident transition to `PUBLISHED` and appear on the public safety map.
14. **Municipal Civic Report Generation & Email Dispatch**: Immediately following publication, the system compiles a formal civic report docket containing the incident details, verified coordinates, AI findings, and evidence photos, and automatically dispatches it to the local municipality grievance redressal authority via email.
15. **Citizen Tracking**: The citizen can track progress at any time via `/reports/:reportId`, observing stage transitions in real-time (`SUBMITTED` → `PROCESSING` → `APPROVED` / `REJECTED` → `PUBLISHED` & `MUNICIPALLY_DISPATCHED`).
16. **Community Hazard Verification & Public-Opinion Progress Gating**: Once pinned to the public map, citizens living or commuting in the affected neighborhood (and the original reporter) can cast verification votes, subscribe to municipal progress updates, and vote on physical repair completion. Overall project progress and final transition to `RESOLVED` directly depend on public community consensus rather than unilateral administrative sign-off.

## 4. Processing architecture

Use a decoupled, asynchronous two-phase architecture:

1. **Phase A: Fast Intake Gateway (`POST /api/reports`, `POST /api/pipeline/submit`)**:
   - Validates authentication and payload schema.
   - Stores photos in MongoDB GridFS.
   - Inserts raw report into MongoDB with status `SUBMITTED`.
   - Records transactional outbox event `report.submitted` in PostgreSQL.
   - Immediately returns HTTP 200/202 with `{ success: true, reportId, status: "SUBMITTED" }` in under 500ms.
   - The user is never blocked by downstream AI vision, GIS queries, or municipal dispatch.

2. **Phase B: Background Pipeline Worker (`lib/pipeline/worker.ts`, `/api/cron/process-outbox`)**:
   - Polls or receives `report.submitted` events asynchronously.
   - Transitions report status to `PROCESSING` (or specific stage pending status).
   - Executes Stage 2 (Evidence Validation), Stage 3 (AI Analysis), Stage 4 (Location Verification), Stage 5 (Candidate Matching), Stage 6 (Canonical Incident Synthesis).
   - **Terminal Branch A (Rejection)**: If evidence is corrupted, fraudulent, or missing required camera provenance, the worker sets status to `REJECTED` with an immutable reason in MongoDB and PostgreSQL audit logs.
   - **Terminal Branch B (Approval & Publication)**: If valid, the report is linked to a canonical incident. Upon moderation approval, Stage 8 marks `isPublished = true`, rendering the pin on the public map.
   - **Municipal Dispatch (Stage 9)**: The worker compiles a standardized civic complaint dossier and emails it to the municipal corporation / PWD authority.

Recommended logical components:

- Report Intake Gateway: validates and stages submissions (<500ms).
- Evidence Storage: handles secure GridFS image storage and metadata.
- Background Processing Worker: manages asynchronous stage transitions and error handling.
- Validation Worker: validates files, capture records and evidence quality; marks `REJECTED` if invalid.
- AI Analysis Worker: performs vision analysis and structured defect extraction.
- Geospatial Worker: calculates representative locations and finds nearby incidents.
- Matching Worker: evaluates candidate merge eligibility.
- Incident Service: manages canonical incidents and Postgres records.
- Moderation Service: handles manual review and approval overrides.
- Publication Service: exposes eligible approved incidents to the public map.
- **Municipal Email Dispatch Service**: compiles civic report dossiers and emails local municipal grievance authorities.
- Notification Worker: sends user status updates upon committed state changes.
- Audit Service: records immutable decision history.

Persist job and incident state in PostgreSQL. Use transactional outbox patterns to reliably dispatch jobs and external email notifications after database transactions commit.

## 5. State machine

Implement explicit, validated state transitions.

Report processing states:

- `DRAFT`: Report composition in progress on client.
- `SUBMITTED`: Fast intake accepted; evidence persisted in GridFS; awaiting background worker.
- `PROCESSING`: Background worker has picked up the report and is analyzing evidence.
- `EVIDENCE_VALIDATED`: Evidence passed server-side integrity and camera provenance checks.
- `AI_ANALYZED`: Multimodal vision extraction and usability assessment completed.
- `LOCATION_VERIFIED`: Geodesic representative coordinates and uncertainty computed.
- `INCIDENT_ASSOCIATED`: Associated with an existing or newly synthesized canonical incident.
- `MODERATION_PENDING`: Awaiting civic staff review or policy verification.
- `APPROVED`: Report verified and approved for canonical inclusion and map publication.
- `REJECTED`: Terminal rejection due to invalid/corrupted evidence, failed criteria, or moderator rejection.
- `PUBLISHED`: Incident pin is live and visible on the public safety map.
- `MUNICIPALLY_DISPATCHED`: Formal civic report docket generated and emailed to the local municipality.
- `PROCESSING_FAILED`: Transient worker failure; scheduled for retry with exponential backoff.

Suggested report processing states:

- `DRAFT`
- `SUBMITTED`
- `EVIDENCE_VALIDATION_PENDING`
- `EVIDENCE_VALIDATION_FAILED`
- `EVIDENCE_VALIDATED`
- `AI_ANALYSIS_PENDING`
- `AI_ANALYSIS_FAILED`
- `LOCATION_VERIFICATION_PENDING`
- `LOCATION_VERIFICATION_FAILED`
- `MATCHING_PENDING`
- `MATCH_REVIEW_REQUIRED`
- `INCIDENT_ASSOCIATION_PENDING`
- `INCIDENT_ASSOCIATED`
- `MODERATION_PENDING`
- `ADDITIONAL_EVIDENCE_REQUIRED`
- `APPROVED`
- `REJECTED`
- `PUBLICATION_PENDING`
- `PUBLISHED`
- `PROCESSING_RETRY_PENDING`
- `PROCESSING_FAILED`

These states represent different concerns and may be normalized into separate report, processing-job, moderation and publication state machines during implementation. Do not create one unbounded status enum if separate entities provide better consistency.

### Transition requirements

- A transition must be validated server-side.
- Only authorized services and users may execute a transition.
- A failed stage must not advance to a later mandatory stage.
- A retryable failure must retain its original failure information.
- A terminal moderation rejection must never publish the incident.
- Additional evidence requests must block publication until the required evidence is provided and validated.
- A manual review requirement must not be interpreted as a successful automatic decision.
- Reprocessing must use explicit transition rules and must not silently erase prior decisions.
- A published incident must have a valid canonical location, valid evidence references, a valid incident association and an approved publication record.

## 6. Stage 1: Report submission

### Requirements

- Require an authenticated user.
- Validate problem category, description and required form fields.
- Require at least four valid in-app camera photographs.
- Associate every photo with a report draft and capture record.
- Sample location at capture time.
- Store latitude, longitude, reported horizontal accuracy, capture timestamp and location acquisition status when available.
- Distinguish capture-time location from submission-time device location.
- Reject gallery/file-picker uploads for this workflow.
- Prevent clients from directly setting `APPROVED` or `PUBLISHED`.
- Create the report, evidence references and initial processing job reliably.

### Acceptance criteria

- A report with fewer than four valid evidence photos cannot be submitted.
- A repeated submission request using the same idempotency key does not create duplicate reports.
- A failure to dispatch a processing job does not leave a report permanently untracked.
- The user receives a durable submission reference after successful acceptance.

## 7. Stage 2: Evidence validation

Perform server-side validation even when the client has already validated the evidence.

Validate:

- File signature and actual decoded content.
- Supported image formats.
- Configurable size and resolution limits.
- Image decoding and corruption.
- Image quality and usability.
- Exact duplicate file hashes.
- Near-duplicate or highly redundant photographs.
- Capture-record association.
- GPS field validity and accuracy availability.
- Timestamp plausibility.
- Potential replay and suspicious evidence patterns.

Never trust client-provided MIME types or timestamps without validation.

Preserve original evidence in protected storage. Generate sanitized derivatives for public use where required. Do not overwrite original evidence during resizing, redaction or image processing.

### Failure behaviour

- Invalid or corrupt images: request replacement or enter an evidence-validation failure state.
- Missing location: apply the configured location fallback/review policy; do not mark location verified.
- Poor GPS accuracy: request a new location fix or route to location review.
- Excessively redundant photos: request additional independent evidence or moderation review.
- Storage outage: retain the submission in a recoverable state and retry safely.

The application must not silently lower the four-photo requirement to bypass a failure.

## 8. Stage 3: AI evidence analysis

Use an interchangeable AI provider abstraction. Model selection must be configurable and must not require business logic to depend on one vendor's response format.

### Required structured outputs

- Predicted hazard category.
- Relevant visual characteristics.
- Evidence usability assessment.
- Image embeddings or other representations for similarity search.
- Exact and near-duplicate indicators.
- Possible defect boundaries or spatial extent, when supported.
- Relevant visible landmarks and road context, where reliable.
- Confidence or uncertainty information.
- Contradictions between photos.
- Recommended next action.
- Model identifier and version.
- Processing timestamp and schema version.

Use validated structured output schemas. Invalid model output must fail validation and must not be interpreted as a successful analysis.

The model must not invent geographic coordinates from image content. Image-based location inference may be used only as a separately labelled, confidence-scored supporting signal; verified incident coordinates must come from the location-verification workflow.

### AI safeguards

- Do not automatically reject a legitimate report solely because an AI model reports low confidence.
- Do not merge incidents based only on category similarity.
- Do not treat visual similarity as proof of the same physical defect.
- Do not treat AI-generated severity or urgency labels as verified facts.
- Record model and prompt/configuration versions needed to reconstruct decisions.
- Keep prompts, model outputs and internal analysis private by default.

### Failure behaviour

If the provider times out, returns invalid output or becomes unavailable, retry according to policy. If the retry budget is exhausted, record a processing failure and alert operations. Do not continue into automatic matching or publication using missing mandatory analysis.

## 9. Stage 4: Location verification

### Input data

- Capture-time GPS samples.
- Reported horizontal accuracy.
- Capture timestamps.
- Report-level location estimate.
- Available road-segment and map geometry.
- AI-derived defect context, where available.

### Requirements

- Validate coordinate ranges and reject non-finite values.
- Distinguish missing accuracy from high accuracy.
- Use metric/geodesic distance calculations, not raw latitude/longitude degree differences.
- Identify inconsistent samples and location clusters.
- Calculate a robust representative location.
- Record estimated location uncertainty.
- Detect possible different hazards within one submission.
- Check for road-side or road-segment conflicts.
- Preserve all original capture coordinates.
- Allow authorized moderator correction with an audit trail.

### Proposed initial quality bands

These values are configurable and must be validated against pilot data:

- Estimated uncertainty up to 10 metres: eligible for high-quality location consideration.
- Greater than 10 and up to 25 metres: medium-quality location.
- Greater than 25 and up to 50 metres: low-quality location, generally requiring review.
- Greater than 50 metres or unresolved contradiction: do not publish a precise pin automatically.

These are policy bands, not guarantees of physical GPS accuracy.

### Failure behaviour

A missing or ambiguous location must block precise public pin creation. The report may enter location review or an explicit recovery flow. A guessed or AI-hallucinated coordinate must never substitute for a failed GPS verification stage.

## 10. Stage 5: Candidate incident discovery and matching

Use a geospatial index to search nearby incidents efficiently. Prefer PostgreSQL/PostGIS if it is compatible with the existing project.

### Candidate search

Use configurable initial search ranges, such as:

- 30 metres for normal nearby candidate discovery.
- Up to 50 metres for potentially continuous road defects or context-supported extended searches.

These are candidate-discovery radii, not automatic merge permissions.

Consider:

- Distance and GPS uncertainty.
- Problem category.
- Road segment and carriageway.
- Visual embeddings and defect-specific features.
- Capture timestamps and incident status.
- Continuous-defect evidence.
- Contradictions and independent observations.

### Strict automatic merge policy

Automatic merge is permitted only if:

1. All required evidence validation has passed.
2. Location compatibility is acceptable.
3. Evidence supports the same physical defect or the configured continuous-defect rule.
4. No unresolved contradiction exists.
5. The candidate incident is eligible for merging.
6. Exactly one candidate is unambiguously eligible.
7. Calibrated match confidence meets the approved threshold.
8. The model version is approved for production use.
9. The merge operation passes transactional consistency checks.

If any requirement is not met, route to manual review or create a separate incident candidate, according to the configured decision policy.

An initial score of 0.90 may be evaluated during calibration, but must not be treated as a validated probability without calibration evidence.

### Matching failure behaviour

- Multiple plausible candidates: manual review.
- Model unavailable: retry or pending processing.
- Low confidence: manual review.
- Clear different physical hazards: keep separate.
- Closed incident with new damage: evaluate recurrence/reopening rules; do not blindly merge.
- Uncertain continuous-defect boundaries: manual segmentation review.

## 11. Stage 6: Canonical incident and location

When no eligible duplicate exists, create a new canonical incident candidate. When a strict eligible duplicate exists, associate the new report with the existing canonical incident.

The incident must have:

- Stable incident ID.
- Associated original reports.
- Evidence references.
- Category and reviewed summary.
- Canonical location and uncertainty.
- Optional line/polygon spatial extent for continuous defects.
- Current moderation and publication status.
- Location and merge decision versions.
- Audit history.

### Location calculation

- Calculate a robust representative position using validated samples.
- Avoid treating multiple photos from one report as independent citizen observations.
- Cap the influence of highly precise or correlated samples.
- Detect multiple spatial clusters.
- Preserve raw capture locations.
- Store the algorithm version and uncertainty.
- Permit moderator correction without overwriting original capture records.

For long defects, AI may propose a continuous extent. Distinct hazards or uncertain boundaries must be reviewed instead of automatically collapsed into one incident.

## 12. Stage 7: Moderation and approval

For the initial release, all new canonical incidents require approval before public publication, unless a future explicitly approved policy defines a safe automatic-publication cohort.

Reviewers must see:

- Original report details.
- Evidence photos.
- Capture locations and accuracy.
- AI classification and uncertainty.
- Candidate incidents and match rationale.
- Proposed canonical location and spatial extent.
- Validation failures or warnings.
- Relevant audit history.

Reviewer actions:

- Approve.
- Reject with reason.
- Request additional evidence.
- Confirm or correct canonical location.
- Merge with another eligible incident.
- Keep incidents separate.
- Split an incorrectly grouped incident.

A reviewer must not be able to bypass mandatory validation without a separately authorized and audited exception policy. Exceptions must never fabricate missing evidence or claim an unverified location is verified.

## 13. Stage 8: Map publication

### Publication eligibility predicate

The publication service must independently verify that:

- Required evidence is valid.
- Required AI analysis is valid.
- Location verification has succeeded.
- A canonical incident association exists.
- Matching and merge operations are resolved.
- No unresolved mandatory review is outstanding.
- Moderation approval is recorded.
- Canonical location and spatial representation are valid.
- The incident is eligible for public display.
- Privacy-safe public fields and media are ready.

Publication must not rely solely on the client or on a status value supplied by a previous worker.

### Atomic publication

Implement publication through a database transaction or an equivalent consistent mechanism.

The operation must:

1. Lock or version-check the incident.
2. Revalidate the publication eligibility predicate.
3. Create or activate the public incident representation.
4. Record publication state and timestamp.
5. Write a publication audit event.
6. Commit the transaction.
7. Dispatch map/cache updates and notifications through a durable post-commit mechanism.

Repeated publication requests must be idempotent.

The map must display one canonical pin per public incident. Reports merged into that incident must not produce additional public pins.

If a transaction or required eligibility check fails, publication must not commit.

### Public privacy

Do not expose:

- Citizen identity unless separately authorized and consented to.
- Private report fields.
- Raw EXIF or device metadata.
- Internal model prompts or private moderation notes.
- Exact personal/home location where this creates a privacy risk.

Use sanitized media and the canonical public location.

## 14. Stage 9: Municipal Civic Report Generation & Email Dispatch

Once a canonical incident satisfies the publication eligibility predicate and transitions to `isPublished = true`, the platform automatically compiles an official, structured **Municipal Civic Grievance Dossier** and dispatches it directly to the competent local municipal corporation / urban local body / PWD grievance redressal authority via email.

### Requirements

1. **Dossier Composition**:
   - **Grievance Reference Number**: Stable municipal docket code formatted as `GRV-[YYYYMMDD]-[INCIDENT_NUMBER]`.
   - **Hazard Classification & Urgency**: Verified category (e.g. `Road Surface / Pothole`), severity (`critical`, `high`, `medium`), and defect summary.
   - **Verified Spatial Geolocation**: WGS84 coordinates with 7 decimal precision, estimated spatial uncertainty radius in metres, and clickable navigation links (Google Maps, OpenStreetMap).
   - **Defect Engineering Findings**: AI-extracted visual characteristics (depth, perimeter crumbling, vehicle trap risk), timestamped capture records, and environmental conditions.
   - **Photographic Evidence Matrix**: High-resolution evidence photo URLs hosted securely, preserving date/time and in-app camera provenance.
   - **Civic Impact Metrics**: Number of independent citizen reports merged into the canonical incident, highlighting localized community urgency.
   - **Action Request**: Formally requested municipal response timeframe based on severity (e.g. 24-48 hours for critical roadway hazards).

2. **Automated Dispatch Mechanism**:
   - The municipal dispatch service reads the configured target recipient (e.g. `process.env.MUNICIPAL_GRIEVANCE_EMAIL` or district-specific routing rules).
   - Formats a dual-stream payload:
     - High-fidelity HTML civic report template formatted with official government grievance styling, visual alert callouts, and evidence thumbnails.
     - Accessible, machine-readable plain-text summary suitable for legacy municipal ticketing systems.
   - Dispatches via authenticated SMTP / email provider (or durable transactional outbox delivery).
   - Records an immutable audit entry in PostgreSQL `moderation_actions` and `outbox_events` with recipient address, message ID, timestamp, and payload snapshot.
   - Updates the canonical incident metadata with `municipalDispatchedAt`, `municipalDocketNumber`, and `municipalRecipient`.
   - Transitions report status to `MUNICIPALLY_DISPATCHED`.

3. **Citizen Notification**:
   - The citizen's tracking dossier at `/reports/:reportId` displays a confirmed dispatch badge: _"Official Civic Dossier Dispatched to Local Municipality"_, providing transparent civic accountability.

## 14B. Stage 10: Community Verification & Public-Opinion-Driven Project Progress

Once an approved hazard is verified and pinned to the public map, community members living in or commuting through the affected area—along with the original reporting citizen—become the primary deciders of ongoing hazard verification, priority escalation, and physical repair completion.

### Requirements

1. **Role-Based Access Control (RBAC)**:
   - **General Users (Citizens / Public)**:
     - View all verified incidents and real-time hazard badges on the interactive public map (`/map`).
     - Submit new road safety hazard reports (`/reports/new`) with in-app camera capture and capture-time GPS telemetry.
     - View public-safe incident tracking dossiers (`/reports/:reportId`).
     - Cast localized community verification votes on incidents in their residential or commute sector (`POST /api/incidents/:id/vote`).
     - Subscribe to automated project progress notifications as municipal repairs proceed.
     - Vote to confirm or dispute physical repair resolution.
     - Restricted from accessing operational staff tools (`/dashboard/moderation`, `/dashboard/pipeline`, `/dashboard/escalations`).
   - **Civic Staff & Moderators (`moderator`, `admin`)**:
     - Manage moderation review queues, inspect raw evidence dossiers, and execute merge/split/reject/approve actions.
     - Trigger manual re-dispatch of municipal dossiers, coordinate with GNIDA/PWD engineering wings, and monitor system outbox telemetry.

2. **Localized Community Voting Subsystem**:
   - **Voter Eligibility**:
     - The original citizen who submitted the hazard report.
     - Residents living within the local sector / pilot bounding box (e.g., Pari Chowk, Alpha I/II, Beta I/II, Knowledge Park) or commuters located within 500m of the incident centroid.
   - **Vote Classifications**:
     - `verify_hazard` ("I see this hazard / Confirmed road danger"): Increments incident verification tally, pushing priority higher in municipal escalation reports.
     - `confirm_resolved` ("Fixed & Safe"): Community confirmation that physical repair work has restored road safety.
     - `still_unresolved` ("Repair Failed / Defect Still Present"): Citizen dispute indicating contractor patch failed or hazard remains unaddressed.
   - **Update Subscriptions**:
     - Voters can opt in with their contact information or session to receive real-time notifications when the municipal department acknowledges, begins field repair, or requests community verification.

3. **Public-Opinion-Governed Project Progress**:
   - An incident's lifecycle cannot transition to `RESOLVED` purely by administrative decree or unverified contractor claims.
   - **Community Consensus Gating**:
     - When the municipal authority marks work complete, the incident transitions to `under_review` / `community_verification`.
     - Local residents and reporters cast resolution confirmation votes.
     - If positive confirmation reaches the configured consensus threshold (e.g. minimum 3 local resident votes and >= 75% positive ratio), the incident transitions to `resolved` with a community-verified badge.
     - If local community members report `still_unresolved`, the incident automatically re-opens with status `open` / `reopened`, re-escalating directly to the municipal authority docket with community feedback notes.

## 15. Failure and retry policy

Every stage must classify errors as:

- Retryable infrastructure/transient failure.
- Permanent input/validation failure.
- Business-rule review requirement.
- Terminal authorized rejection.

Use bounded exponential backoff with jitter for transient failures. Set maximum attempts, processing timeouts and dead-letter handling.

A retry must resume from the earliest failed or invalidated stage rather than repeating every expensive operation unnecessarily.

When a stage fails:

1. Persist the failure and reason.
2. Preserve previous valid outputs.
3. Block dependent stages.
4. Retry if eligible.
5. Otherwise mark the report as requiring intervention or processing failure.
6. Notify the user when action is needed.
7. Alert operators for systemic or repeated failures.

Never mark a failed report as published. Never automatically reject a citizen's report because an internal AI provider is unavailable.

If previously published data becomes invalid after a correction or security incident, apply an explicit unpublish/suspend workflow with an audit record rather than silently leaving invalid public data visible.

## 15. Data model requirements

Reuse existing entities where available; do not duplicate the domain model unnecessarily.

Recommended entities:

- `Report`
- `EvidenceAsset`
- `EvidenceValidationResult`
- `ReportProcessingJob`
- `ProcessingStageExecution`
- `AIAnalysisResult`
- `LocationSampleAssessment`
- `Incident`
- `IncidentReportLink`
- `IncidentLocationEstimate`
- `CanonicalIncidentLocation`
- `IncidentMergeEvent`
- `IncidentSegmentationReview`
- `ModerationAction`
- `PublicationRecord`
- `AuditEvent`
- `OutboxEvent`

Use stable IDs, foreign keys, unique constraints and transaction boundaries.

Important constraints:

- A report must not be marked published unless an eligible canonical incident is published.
- Duplicate active report-to-incident links must be prevented.
- Merge and publication operations must be idempotent.
- Evidence references must point to existing protected objects.
- Original evidence records must not be deleted by merge or split operations.
- Canonical location changes must be versioned.
- Every public incident must have a valid canonical location.
- All state changes must be authorized and validated server-side.

## 16. API requirements

Adapt routes to the existing API conventions.

Possible endpoints:

- `POST /api/reports`
- `GET /api/reports/:reportId`
- `GET /api/reports/:reportId/processing`
- `POST /api/reports/:reportId/evidence`
- `POST /api/reports/:reportId/reprocess` (authorized)
- `GET /api/admin/review-queue`
- `GET /api/admin/reports/:reportId/review`
- `POST /api/admin/incidents/:incidentId/approve`
- `POST /api/admin/incidents/:incidentId/reject`
- `POST /api/admin/incidents/:incidentId/request-evidence`
- `POST /api/admin/incidents/:incidentId/location`
- `POST /api/admin/incidents/merge`
- `POST /api/admin/incidents/:incidentId/split`
- `POST /api/admin/incidents/:incidentId/dispatch-municipal`
- `POST /api/cron/process-outbox`
- `POST /api/pipeline/process`
- `GET /api/map/incidents`
- `POST /api/incidents/:incidentId/vote`
- `GET /api/incidents/:incidentId/votes`

All administrative routes must enforce authentication, role-based authorization, input validation and audit logging.

Public map endpoints must return only public-safe incident data.

## 17. Security and abuse prevention

Implement:

- Authentication and role-based access control.
- Server-side schema validation.
- CSRF protections where applicable.
- Rate limiting.
- Secure object storage and short-lived upload/download access.
- MIME/content validation and image decoding safeguards.
- File size and decompression limits.
- Secrets management.
- Audit logging.
- Protection against unauthorized incident merges.
- Idempotency controls.
- Signed or authenticated internal job messages where supported.
- Least-privilege service access.
- Data retention and deletion policies.
- Monitoring for suspicious capture patterns and repeated abuse.

Treat image contents, EXIF metadata, descriptions and AI outputs as untrusted data. Do not allow instructions embedded in uploaded content to change system prompts, tool permissions or processing rules.

## 18. Observability

Track:

- Reports submitted.
- Evidence validation success/failure.
- AI provider latency and failure rate.
- Location verification success and review rate.
- Candidate matches per report.
- Auto-merge precision and later unmerge rate.
- Manual review queue size and turnaround time.
- Processing retries and exhausted retries.
- Publication success/failure.
- Duplicate pin prevention.
- Outbox backlog and notification failures.

Use structured logs and correlation IDs linking report, processing job, stage execution, incident and publication event.

Do not log raw image bytes, credentials or unnecessary precise location information.

## 19. Testing requirements

### Unit tests

- State transition validation.
- Evidence count and file validation.
- GPS quality and representative-location calculations.
- Outlier and multi-cluster handling.
- Match eligibility and confidence gates.
- Publication eligibility predicate.
- Idempotency and authorization.

### Integration tests

- Database transactions.
- Queue/outbox delivery.
- Evidence storage failures.
- AI provider timeout and invalid responses.
- Geospatial candidate search.
- Concurrent merge attempts.
- Moderator correction.
- Publication rollback.
- Notification retry behaviour.

### End-to-end tests

1. Valid report with four valid photos and reliable GPS proceeds through all required stages.
2. Invalid photo blocks processing and publication.
3. Missing or invalid location blocks precise pin publication.
4. AI timeout blocks dependent stages and creates a retryable failure.
5. High-confidence duplicate passing all gates associates with the existing incident.
6. Ambiguous duplicate enters manual review.
7. Distinct nearby hazards remain separate.
8. Unapproved incident does not appear on the public map.
9. A valid approved incident produces exactly one public pin.
10. A repeated job does not create duplicate incidents or pins.
11. A moderator correction preserves original location records and audit history.
12. A merge or publication transaction failure leaves no partial committed state.
13. A split operation preserves report and evidence provenance.
14. Public endpoints never expose private report metadata.

## 20. Definition of done

The module is complete only when:

- All required stages are implemented and wired into a durable pipeline.
- State transitions and publication eligibility are enforced server-side.
- The public map only exposes eligible approved incidents.
- Strict automatic matching rules are implemented.
- Manual review supports ambiguous matches and location correction.
- Retry, failure and recovery behaviour is tested.
- Database constraints and transactional boundaries prevent duplicate or partial publication.
- Security and privacy checks are complete.
- Unit, integration and end-to-end tests pass.
- CI validates linting, types, tests, migrations and build.
- Operational dashboards, logs and alerts exist.
- Documentation explains configuration, model calibration, failure recovery and manual review.

## 21. Coding-agent instructions

Before implementation:

1. Inspect the existing repository, database schema, authentication, storage, map UI and queue infrastructure.
2. Identify reusable dependencies and established project conventions.
3. Produce a short implementation plan identifying schema changes, worker stages, API changes, UI changes and test coverage.
4. Do not replace existing infrastructure without a documented reason.
5. Implement incrementally with migrations and backward-compatible changes where possible.
6. Do not use mock AI results in production code paths.
7. Provide deterministic mock providers only for automated tests.
8. Make model providers configurable and validate every response.
9. Never bypass the publication eligibility predicate.
10. Automatically compile and dispatch the municipal civic grievance dossier via email only after complete verification and publication approval, recording an immutable audit trail in PostgreSQL.
11. Run the full test suite and report any incomplete work or infrastructure dependency honestly.

**Final outcome:** A citizen submits a report and receives instant confirmation (<500ms). A dedicated background worker asynchronously validates evidence, performs AI analysis, verifies geolocation, and synthesizes canonical incidents. Approved incidents appear on the public map, and an official civic report is automatically compiled and emailed to the local municipality. Unverified or rejected submissions remain safely unpinned with transparent citizen auditability.

---

# Part II: Private Organization Civic Impact Dashboard, Civic Problem Adoption, Citizen Verification, and Public Impact Reporting

## 22. Overview and Core Principle

While Part I centers on citizens reporting civic problems and routing them to relevant municipal authorities, Part II introduces the **Private Organization Civic Impact Subsystem**.

Verified private organizations, eligible corporate CSR entities, NGOs, charitable foundations, and approved institutions can register on JanSahayak, discover eligible verified civic problems, propose or adopt an intervention, implement the approved solution under required municipal permissions, submit evidence, and receive public recognition after the resolution claim passes the platform's multi-layered verification process.

The public has full transparency into:
- The original civic problem.
- Whether government authorities, private organizations, or both contributed to its resolution.
- Which private organizations materially contributed (distinguishing funding from implementation).
- The evidence and verification status.
- Aggregate performance reports comparing government-led, private-led, and joint resolutions.

### Product Principle
**Reward verified public benefit, not merely claims, spending, adoption, or publicity.** A simple majority vote or unverified corporate press release must never be treated as conclusive proof of resolution.

---

## 23. Goals and Non-Goals

### 23.1 Goals
1. Provide an organization registration, onboarding, and verification workflow.
2. Provide a dedicated, role-protected Organization Dashboard matching the Noticeboard aesthetic.
3. Make eligible verified civic problems discoverable to approved organizations.
4. Allow organizations to express interest in, propose solutions for, and adopt eligible problems without monopolizing or prematurely closing them.
5. Track municipal permissions, commitments, milestones, and deadlines.
6. Enable organizations to submit resolution claims with structured before/after evidence.
7. Enable authenticated citizens to review evidence and cast verification votes (`RESOLVED`, `NOT_RESOLVED`, `CANNOT_VERIFY`).
8. Combine evidence review, citizen feedback, and risk-based official verification (high-risk public infrastructure requires competent authority sign-off).
9. Accurately attribute roles (government authority, funder, implementer, technical partner, coordinator).
10. Publish canonical public resolution pages and public organization impact profiles.
11. Publish periodic, deduplicated aggregate performance reports comparing government-led, private-led, and joint resolutions.
12. Maintain an immutable, append-only audit trail for all proposals, decisions, votes, and status transitions.
13. Preserve all existing citizen reporting and municipal escalation workflows.

### 23.2 Non-Goals
- Payment gateway or direct custody of funds in release 1.
- Automatic legal certification of CSR eligibility under Companies Act Section 135.
- Unrestricted or unauthorized private repair of public municipal infrastructure.
- Paid access to safety data or paid influence over verification outcomes.
- AI making autonomous final verification decisions without human/citizen verification.

---

## 24. Extended Users and Roles

In addition to `citizen`, `moderator`, `admin`, and `field_official` defined in §14B:

### 24.1 Organization Owner / Administrator (`org_admin`)
- Registers the organization and submits verification documents.
- Manages organizational members, project managers, and evidence submitters.
- Submits adoption proposals and manages accepted projects.
- Submits resolution claims and views impact analytics.
- **Restrictions**: Cannot approve its own organization verification, cannot cast organizational votes on its own claims, cannot alter audit logs or force resolution.

### 24.2 Organization Member (`org_member`)
- Sub-roles: `PROJECT_MANAGER`, `EVIDENCE_SUBMITTER`, `ORG_VIEWER`.
- Submits progress updates, manages milestones, and attaches photographic evidence.

### 24.3 Citizens (§14B)
- Review eligible resolution claims and vote `RESOLVED`, `NOT_RESOLVED`, or `CANNOT_VERIFY`.
- Submit factual feedback or contradictory evidence.
- Protected by 1-vote-per-user database constraints and anti-brigading safeguards.

### 24.4 Platform Verifiers & Administrators (§12)
- Review organization identity verification submissions.
- Review flagged or contested resolution claims and high-risk engineering works.
- Execute binding administrative decisions with documented audit reasons.

---

## 25. Core User Journeys

### 25.1 Organization Onboarding & Identity Verification
1. User authenticates via Clerk / session and selects "Register as an Organization".
2. Submits legal name, registration number (CIN/NGO Darpan/Trust ID), organization type (`corporate`, `ngo`, `foundation`, `contractor`), focus areas, and authorized officer details.
3. Submits verification documents (secure storage references).
4. Organization state enters `PENDING_VERIFICATION`.
5. Platform administrator or verifier reviews and transitions status to `VERIFIED`, `REJECTED`, or `NEEDS_MORE_INFORMATION`. Only `VERIFIED` organizations can adopt problems.

### 25.2 Problem Discovery & Adoption Workflow
1. Verified organization navigates to "Discover Problems".
2. Filters verified, published incidents by sector, category, severity, and adoption eligibility.
3. Reviews required municipal permissions (e.g. asphalt road trenching requires PWD NOC; trash cleanup requires municipal waste cell liaison).
4. Submits an **Adoption Proposal** detailing proposed role (Funder vs. Implementer), estimated budget, proposed milestones, and completion deadline.
5. If multiple organizations submit proposals, municipal authorities and platform moderators evaluate them without granting automatic first-come-first-served monopolies.
6. Approved adoption records scope, milestones, and target completion date. The underlying incident status remains open (`in_progress`); adoption does NOT resolve the incident.

### 25.3 Milestone Execution & Evidence Submission
1. Organization team tracks project milestones (`PERMISSION_OBTAINED`, `PROCUREMENT_COMPLETE`, `FIELD_WORK_IN_PROGRESS`, `FIELD_WORK_COMPLETED`).
2. Upon field completion, organization files a **Resolution Claim**.
3. Attaches structured evidence: before/after photos, completion date, GPS telemetry, contractor details, and municipal work completion sign-off for high-risk work.
4. Claim transitions to `INITIAL_REVIEW`. Automated and verifier checks ensure photos meet resolution, location, and non-duplication criteria.

### 25.4 Citizen Verification & Voting
1. Validated claim opens a **Verification Case** with a defined public window (e.g. 72 hours).
2. Nearby citizens and the original reporter are notified and can inspect the claim on the public resolution page.
3. Eligible citizens submit one vote:
   - `RESOLVED` (Work confirmed effective)
   - `NOT_RESOLVED` (Defect still present or work defective)
   - `CANNOT_VERIFY` (Excluded from decisive ratio calculation)
4. Citizens may attach rebuttal photos or comments.
5. System enforces 1 vote per user ID / verified session via unique database constraints.
6. If decisive votes reach $\ge 75\%$ positive and minimum participation is satisfied, the case is eligible for final verification.
7. For high-risk road/structural repairs, qualified municipal authority inspection is mandatory; citizen voting cannot override public engineering safety.
8. Upon verified approval, the incident transitions to `resolved` with multi-party attribution.

---

## 26. Organization Dashboard Specifications

A dedicated dashboard section (`/dashboard/organization`) matching the Noticeboard aesthetic:
1. **Overview**: Metric cards for active adoptions, pending claims, verified resolutions, total community impact, and earned recognition tier.
2. **Discover Problems**: Filterable catalog of public, verified incidents seeking intervention, displaying required permissions and municipal dockets.
3. **My Adopted Problems**: Project tracker with milestone management, deadline alerts, and team assignments.
4. **Evidence & Verification**: Workflow portal to assemble, submit, and track resolution claims, citizen vote tallies, and verifier notes.
5. **Impact & Recognition**: Transparent impact statistics, resolution rate, median completion time, and earned civic partner badges.
6. **Organization Profile**: Public profile management (logo, mission, focus areas, verified resolutions showcase).

---

## 27. State Machines for Adoption and Resolution

Separate state machines preserve clarity and avoid overloading incident status:

### 27.1 Problem Adoption Status
`PROPOSAL_SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `REJECTED` / `NEEDS_CHANGES` → `IN_PROGRESS` → `COMPLETED` / `WITHDRAWN` / `EXPIRED`.

### 27.2 Resolution Claim Status
`DRAFT` → `SUBMITTED` → `INITIAL_REVIEW` → `UNDER_VERIFICATION` (citizen voting) → `VERIFIED_RESOLVED` / `NOT_VERIFIED` / `INCONCLUSIVE` / `DISPUTED` / `REVOKED`.

### 27.3 Non-Interference Invariant
An incident's canonical status (`incidents.status`) is updated to `resolved` **only** upon successful transition of a resolution claim to `VERIFIED_RESOLVED` following complete verification.

---

## 28. Multi-Party Attribution Model

Resolutions are classified into four mutually exclusive categories:
1. `GOVERNMENT_LED`: Resolved by municipal agency/PWD without private intervention.
2. `PRIVATE_LED`: Fully funded and executed by verified private organization under municipal permission.
3. `JOINT`: Co-funded or jointly executed by municipal authority and private partner.
4. `COMMUNITY_OR_OTHER`: Volunteer, citizen-led, or unclassified resolution.

Role-specific contributor attribution:
- `FUNDER`: Provided financial capital or CSR sponsorship.
- `IMPLEMENTER`: Carried out physical engineering or field repair work.
- `TECHNICAL_PARTNER`: Provided equipment, materials, or diagnostic expertise.
- `GOVERNMENT_AUTHORITY`: Statutory civic authority granting permissions and oversight.

---

## 29. Citizen Verification and Anti-Manipulation Rules

1. **Authentication Requirement**: Voters must be authenticated; anonymous voting is prohibited.
2. **Unique Active Vote**: Unique constraint on `(verification_case_id, user_id)` guarantees one vote per citizen.
3. **Neutral Option (`CANNOT_VERIFY`)**: Recorded for auditability but strictly excluded from the decisive positive/negative consensus ratio.
4. **Consensus Gating**: Suggested pilot threshold is $\ge 75\%$ positive of decisive votes with minimum participation (e.g. 3 local residents).
5. **High-Risk Public Safety Override**: Road surface asphalt repairs, deep drainage, and structural works require municipal inspection records.
6. **Conflict of Interest Protection**: Organization members cannot vote on their own organization's claims; self-votes are rejected server-side.
7. **Dispute & Appeal Workflow**: Rejected claims can be appealed with supplementary evidence; decisions are never erased, but updated with append-only audit entries.

---

## 30. Public Resolution Page & Organization Profiles

1. **Public Resolution Dossier (`/resolutions/:id`)**:
   - Original citizen hazard report and verified coordinates.
   - Comprehensive before-and-after photographic evidence slider.
   - Verified resolution badge with classification (`GOVERNMENT_LED`, `PRIVATE_LED`, `JOINT`).
   - Contributor attribution callouts (e.g. "Funded by TechCorp India · Implemented by SafeRoads Foundation · Coordinated with GNIDA").
   - Summary of citizen verification votes and municipal inspection timestamp.
2. **Public Organization Profile (`/organizations/:slug`)**:
   - Organization name, verified badge, description, and website.
   - Verified resolutions portfolio with before/after case studies.
   - Aggregate verified impact metrics (total hazards resolved, citizens benefited).
   - Earned badges (`CIVIC_CONTRIBUTOR`, `VERIFIED_IMPACT_PARTNER`, `COMMUNITY_SAFETY_CHAMPION`).
   - Zero exposure of internal financial details, employee PII, or confidential documents.

---

## 31. Public Impact Reporting & Fair Comparison

Monthly and quarterly public impact dashboards (`/impact`):
- **Platform Overview**: Total hazards reported, verified, in-progress, and resolved.
- **Deduplication Invariant**: A problem solved jointly is counted **once** in unique incident resolution totals, preventing double-counting while crediting individual contributors in breakdown tables.
- **Government Performance**: Reports received, acknowledged, repaired, and median response time.
- **Private Sector Contributions**: Total CSR/private investments, adopted cases, verified resolutions, and median repair time.
- **Contextual Transparency**: Category complexity mix and statutory boundaries displayed to prevent unfair comparisons between routine cleanups and heavy civil engineering works.

---

## 32. Data Model Extensions (PostgreSQL + Drizzle)

The following tables extend the relational schema:
1. `organizations`: Core profile, legal name, organization type, verification status, slug.
2. `organization_members`: Junction linking `users.id` to `organizations.id` with `role` (`org_admin`, `project_manager`, `evidence_submitter`, `org_viewer`).
3. `organization_verifications`: Review records, submitted compliance documents, and platform administrator decisions.
4. `problem_adoptions`: Proposals and approved interventions linking `incidents.id` to `organizations.id`.
5. `project_milestones`: Discrete deliverables, due dates, and completion timestamps.
6. `resolution_claims`: Formal claims submitted by organizations asserting hazard repair.
7. `resolution_evidence`: Before/after media, document links, timestamps, and inspection records.
8. `verification_cases`: Time-boxed citizen voting and review cases tied to a claim.
9. `citizen_verification_votes`: Citizen votes (`RESOLVED`, `NOT_RESOLVED`, `CANNOT_VERIFY`) with unique constraint on `(verification_case_id, user_id)`.
10. `resolution_decisions`: Immutable final verification outcome, policy version, and reason.
11. `impact_attributions`: Specific role attribution (`FUNDER`, `IMPLEMENTER`, `JOINT`) linking contributors to resolved incidents.
12. `audit_logs`: Append-only system audit table for all adoption, verification, and attribution mutations.

---

## 33. API Route Specifications

- **Organizations**:
  - `POST /api/organizations`: Register organization profile.
  - `GET /api/organizations/me`: Fetch active user's organization.
  - `POST /api/organizations/me/verification`: Submit verification documentation.
  - `GET /api/organizations/:slug`: Public profile.
  - `GET /api/organizations/:id/impact`: Organization impact metrics.
- **Adoption & Milestones**:
  - `GET /api/civic-problems/discover`: Discover eligible adoptable hazards.
  - `POST /api/civic-problems/:id/adoption-proposals`: Submit adoption proposal.
  - `GET /api/organizations/me/adoptions`: List organization's adoptions.
  - `GET /api/adoptions/:id`: Fetch adoption details.
  - `POST /api/adoptions/:id/withdraw`: Withdraw an active adoption.
  - `POST /api/adoptions/:id/milestones`: Add project milestone.
  - `PATCH /api/milestones/:id`: Update milestone status.
- **Evidence & Resolution Claims**:
  - `POST /api/resolution-claims`: File resolution claim for an adopted incident.
  - `GET /api/resolution-claims/:id`: Fetch claim and evidence dossier.
  - `POST /api/resolution-claims/:id/evidence`: Attach photographic evidence.
- **Citizen Verification Voting**:
  - `GET /api/verification-cases/:id`: Get active verification case and stats.
  - `POST /api/verification-cases/:id/votes`: Cast citizen verification vote.
  - `POST /api/verification-cases/:id/finalize`: Finalize verification outcome based on consensus & risk policy.
- **Public Impact & Attribution**:
  - `GET /api/public/impact/summary`: Aggregate platform-wide deduplicated analytics.
  - `GET /api/public/resolutions/:id`: Canonical public resolution dossier.

---

## 34. Security, Tenant Isolation, and Legal Guardrails

1. **Tenant Isolation**: Organizations can only view and edit their own private drafts, team rosters, and unsubmitted claims.
2. **Server-Side Authorization**: Every API route verifies role and ownership on the server; client-provided roles or status flags are strictly rejected.
3. **No Commercial Manipulation**: Impact scores and verification statuses cannot be purchased; paid advertisements are explicitly separated from platform verification metrics.
4. **Legal Compliance Notice**: Platform verification does not constitute statutory government certification under Indian Law. CSR applicability under Section 135 of Companies Act, 2013 remains subject to independent qualified audit.
5. **PII Redaction**: Public resolution pages and organization views redact citizen reporter contact info and raw EXIF coordinates of residential locations.

