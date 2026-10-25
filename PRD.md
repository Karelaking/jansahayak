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
- **Municipal civic report dossier generation and automatic email dispatch to the local municipality**.
- Automatic retries, transactional outbox pattern, failure handling, and operational monitoring.
- Audit logs, citizen notifications, and automated integration tests.

### Excluded from this module

- Authority performance scoring and SLA penalties.
- Citizen resolution voting.
- Final physical repair verification by field contractors.
- Proprietary closed-source municipal ERP integrations (the open standard email dossier is the primary dispatch channel).

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
