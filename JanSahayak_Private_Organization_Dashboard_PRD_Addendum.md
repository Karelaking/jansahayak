# JanSahayak PRD Addendum
## Private Organization Dashboard, Civic Problem Adoption, Citizen Verification, and Public Impact Reporting

**Document type:** Incremental product requirements document (PRD addendum)  
**Product:** JanSahayak  
**Version:** 1.0  
**Status:** Ready for agent review and implementation planning  
**Primary objective:** Extend the existing JanSahayak product without replacing or contradicting its previous PRD.

---

# 0. Instructions to the Coding Agent

Treat this document as an **addendum to the existing JanSahayak PRD**, not a standalone replacement.

Before changing code or documentation:

1. Read the existing PRD, project objective documents, architecture documents, repository instructions, and current implementation.
2. Identify existing entities, routes, authentication, authorization, report statuses, authority workflows, UI conventions, and database schema.
3. Map every requirement in this addendum to the existing system.
4. Reuse and extend existing components, models, services, and workflows wherever reasonable.
5. Do not create duplicate citizen, report, authority, notification, or verification systems if equivalent capabilities already exist.
6. Update the previous PRD with the new requirements, decisions, state transitions, data model changes, and acceptance criteria. Preserve all valid existing requirements.
7. If requirements conflict, preserve the original product's core purpose—transparent citizen reporting and accountable resolution—while implementing this addendum's private-sector participation. Document the conflict and proposed resolution before making destructive changes.
8. Do not rewrite the entire application or introduce microservices solely for this feature. Follow the existing stack and architectural conventions.
9. Inspect the actual repository before selecting libraries or inventing APIs. Use the installed versions and existing abstractions where practical.
10. Produce an implementation plan, then implement in small, testable stages. Run relevant tests, type checks, linting, and builds where available.
11. Do not claim legal compliance merely because a form or workflow exists. Treat CSR eligibility, public-infrastructure permissions, charitable fundraising, privacy, and applicable Indian legal requirements as review items requiring qualified assessment.
12. Never allow an organization to purchase a better verification outcome, suppress legitimate criticism, or improve its impact score through paid advertising.

Before implementation, report:
- Existing architecture and relevant files discovered.
- Reusable functionality.
- Required schema and migration changes.
- Routes and UI surfaces to add or modify.
- Conflicts or unresolved assumptions.
- A phased implementation plan.

Then proceed with implementation unless a genuinely blocking ambiguity or destructive decision requires user input.

---

# 1. Executive Summary

JanSahayak currently centers on citizens reporting civic problems and routing them to relevant government authorities. This addendum introduces a **Private Organization Civic Impact Dashboard**.

Verified private organizations, eligible companies, NGOs, charitable organizations, and other approved entities will be able to register on JanSahayak, discover eligible verified civic problems, propose or adopt an intervention, implement the approved solution, submit evidence, and receive public recognition after the resolution claim passes the platform's verification process.

The public will be able to see:
- The original civic problem.
- Whether government authorities, private organizations, or both contributed to its resolution.
- Which private organizations materially contributed.
- The evidence and verification status.
- Aggregate performance reports comparing government-led, private-led, and joint resolutions.

Citizen voting is a part of verification, but **a simple majority vote must not be treated as conclusive proof for every type of problem**. Evidence review, eligibility rules, anti-manipulation safeguards, and risk-based independent or official verification are required.

## Product principle

**Reward verified public benefit, not merely claims, spending, adoption, or publicity.**

---

# 2. Goals

## 2.1 Primary goals

1. Add a registration, onboarding, and verification flow for private organizations.
2. Provide a dedicated, role-protected organization dashboard.
3. Make appropriate verified civic problems discoverable to approved organizations.
4. Allow organizations to express interest in, propose solutions for, and adopt eligible problems.
5. Track permissions, commitments, implementation, and deadlines.
6. Allow organizations to submit resolution claims and supporting evidence.
7. Enable eligible citizens to review evidence and vote on resolution claims.
8. Provide a clear decision process that combines evidence, citizen feedback, and risk-based verification.
9. Attribute the roles of government authorities, funders, implementers, NGOs, contractors, and other contributors accurately.
10. Publish public organization profiles and problem-level resolution pages.
11. Publish periodic aggregate performance reports for government-led, private-led, and joint resolutions.
12. Maintain an auditable history of status changes, evidence, votes, decisions, and attribution.
13. Encourage repeat participation through earned recognition and transparent impact metrics.
14. Preserve the existing citizen reporting and government escalation workflows.

## 2.2 Non-goals for the first release

Unless already supported by the existing product, the first release does not require:
- A new payment gateway or custody of funds.
- Escrow or automatic disbursement.
- A full CSR compliance platform.
- Automatic legal certification of CSR eligibility.
- Blockchain.
- A microservice architecture.
- AI making final verification decisions.
- Unrestricted private repair of public infrastructure.
- Paid access to citizen reports or public safety information.
- Paid influence over ranking, verification, or resolution decisions.

These can be considered separately after the pilot and legal/operational review.

---

# 3. Users and Roles

## 3.1 Citizen

Can:
- Submit and track civic reports using existing functionality.
- View public problem details and organization participation.
- Review eligible resolution claims.
- Vote `RESOLVED`, `NOT_RESOLVED`, or `CANNOT_VERIFY`.
- Submit factual feedback or supporting evidence.
- Report suspicious evidence or manipulation.
- View public impact reports.

Cannot:
- Change official report status directly.
- Vote more than once per verification case.
- Access restricted organizational or reporter data.
- View private evidence unless explicitly designated public.

## 3.2 Organization owner/administrator

Can:
- Register an organization and submit verification details.
- Manage authorized members.
- Maintain organization profile and preferences.
- Browse eligible problems.
- Submit adoption proposals.
- Manage the organization's accepted projects.
- Submit evidence and resolution claims.
- View organization analytics and earned recognition.

Cannot:
- Approve its own verification as a platform administrator.
- Cast privileged organization actions as citizen votes on its own claim.
- Alter final verification results.
- Delete audit records.
- Change impact scores directly.
- Mark an outcome verified without the verification workflow.

## 3.3 Organization member

Permissions depend on assigned role. Suggested roles:
- `ORG_ADMIN`
- `PROJECT_MANAGER`
- `EVIDENCE_SUBMITTER`
- `ORG_VIEWER`

Enforce permissions on the server, not just in the UI.

## 3.4 Government authority user

Reuse the existing authority workflow and role system where possible. Authorized authority users can:
- View cases within their jurisdiction.
- Record official actions and evidence.
- Review private proposals when relevant.
- Record permissions or coordination decisions.
- Participate in joint resolution workflows.
- Submit official completion information.

## 3.5 Platform verifier/moderator

Can:
- Review organization verification submissions.
- Review evidence and flagged claims.
- Decide cases requiring human review.
- Resolve disputes within assigned permissions.
- Record reasons and evidence for decisions.
- Suspend suspicious claims or organizations according to policy.

No verifier should be able to silently rewrite the audit history.

## 3.6 Platform administrator

Can manage platform configuration, access controls, categories, thresholds, moderation, and system operations. Administrative actions must be audited.

---

# 4. Core User Journeys

## 4.1 Organization registration and verification

1. User selects `Register as an Organization`.
2. User authenticates through the existing authentication system.
3. User creates an organization profile.
4. User provides legal name, organization type, contact details, operating locations, focus areas, and authorized representative details.
5. User submits required verification documents.
6. Organization status becomes `PENDING_VERIFICATION`.
7. An authorized platform reviewer assesses the submission.
8. Status changes to `VERIFIED`, `REJECTED`, or `NEEDS_MORE_INFORMATION`.
9. Only approved organizations can adopt problems or submit official resolution claims.
10. Reverification, suspension, and appeals must be supported.

Identity verification and CSR eligibility are distinct. A verified organization is not automatically an eligible CSR implementing agency.

## 4.2 Discover a civic problem

1. Verified organization opens `Discover Problems`.
2. It searches and filters eligible verified reports.
3. It opens a report detail page containing public-safe evidence, location, severity, date, authority status, restrictions, and current participation.
4. The organization reviews required permissions and the type of intervention allowed.
5. It submits an expression of interest or adoption proposal.
6. The system validates eligibility, conflicts, current status, and any required approval.
7. Authorized reviewers or the responsible authority approve, reject, or request changes where required.
8. Approved adoption is recorded with scope, responsibility, milestones, deadline, and attribution role.

Browsing must not expose reporter PII or private evidence.

## 4.3 Multiple organizations want to solve the same problem

- Allow multiple organizations to express interest.
- Do not allow conflicting interventions to proceed without coordination.
- Use a proposal/selection workflow when one lead implementer is needed.
- Allow approved co-funding or joint implementation where appropriate.
- Do not give permanent ownership to the first adopter.
- If an organization misses a deadline or withdraws, the problem may be reopened after review.
- Preserve every proposal and decision in the audit history.
- A problem must remain unresolved until its underlying condition is verified as resolved.

## 4.4 Implement the solution

The organization updates project milestones and submits progress information. The system records status changes, timestamps, responsible actors, and supporting evidence.

For public infrastructure, safety-critical work, or other regulated interventions, the workflow must require applicable authority approval and qualified implementation as appropriate. Adoption alone is not permission to perform work.

## 4.5 Submit resolution evidence

1. Organization opens an eligible adopted problem.
2. It submits a resolution claim and evidence.
3. Evidence is linked to the original report and intervention.
4. The system validates file types, size, access permissions, and required fields.
5. Claim status becomes `EVIDENCE_SUBMITTED` or `UNDER_INITIAL_REVIEW`.
6. Initial review checks completeness, location relevance, timestamps where available, and required permissions.
7. If accepted for public verification, a verification case opens.
8. If evidence is incomplete, the organization can be asked to resubmit.
9. If evidence appears fraudulent, the claim is flagged and escalated for human review.

Evidence can include:
- Before/after images or video.
- Completion date.
- Location and context.
- Description of the intervention.
- Supporting approvals or completion documents where required.
- Evidence of the organization's actual role.
- Qualified inspection records for relevant high-risk work.

Uploaded media is not automatically proof. The system must not claim that image metadata or AI alone proves authenticity.

## 4.6 Citizen verification

1. An eligible verification case becomes publicly reviewable.
2. The public page presents the original problem, claimed intervention, evidence permitted for publication, and organization attribution.
3. Eligible authenticated citizens may submit one vote per verification case:
   - `RESOLVED`
   - `NOT_RESOLVED`
   - `CANNOT_VERIFY`
4. Citizens can provide an optional explanation or supporting evidence.
5. The system prevents duplicate voting and applies abuse controls.
6. At the end of the verification window, it calculates and displays the result.
7. Low participation, conflicting evidence, suspicious voting, or high-risk project type triggers `INCONCLUSIVE` or human/independent review.
8. A final decision is recorded with reasons, evidence references, vote totals, and decision-maker where applicable.
9. Organizations and citizens can request review under a documented dispute process.

Citizen voting is one signal in the decision process. It must not override legal approval requirements, qualified inspection, or authoritative verification required for high-risk work.

---

# 5. Organization Dashboard Requirements

Add a protected organization dashboard consistent with the existing design system.

## 5.1 Navigation

Suggested navigation:
- Overview
- Discover Problems
- My Adopted Problems
- Proposals
- Evidence & Verification
- Impact & Recognition
- Organization Profile
- Team & Permissions
- Notifications
- Settings

Reuse existing navigation and UI primitives where possible.

## 5.2 Overview

Show:
- Organization verification status.
- Available eligible problems.
- Active adoption proposals.
- Approved adopted problems.
- In-progress projects.
- Claims awaiting review.
- Verified resolutions.
- Overdue commitments.
- Disputed claims.
- Earned badges.
- Recent activity.

All metrics must be computed from persisted backend records. Do not hard-code sample values in production.

Empty, loading, error, and permission-denied states are required.

## 5.3 Discover Problems

Features:
- Search by title and description.
- Filter by location, category, severity, date, status, and eligibility.
- Map/list views if supported by the existing product.
- Show whether private participation is allowed, restricted, or pending approval.
- Show responsible authority when known.
- Show whether another organization is already leading the intervention.
- Open a detailed public-safe problem page.
- Express interest or submit an adoption proposal.

Do not expose sensitive coordinates or reporter identity when doing so creates privacy or safety risks.

## 5.4 My Adopted Problems

Show:
- Original report.
- Organization's role.
- Adoption approval status.
- Agreed scope.
- Responsible team.
- Required permissions.
- Milestones.
- Target date.
- Current status.
- Evidence submissions.
- Verification result.
- Dispute or overdue status.

Provide permitted actions according to status and role. Do not show buttons that imply unauthorized work is allowed.

## 5.5 Evidence & Verification

Show:
- Claims in draft.
- Claims submitted.
- Claims under initial review.
- Open citizen verification cases.
- Final outcomes.
- Requests for additional evidence.
- Disputes and appeals.

The organization may respond to feedback or provide additional evidence but cannot delete votes or directly change verification results.

## 5.6 Impact & Recognition

Show:
- Verified resolutions.
- Resolution rate with a clearly defined denominator.
- Median time to verified resolution.
- On-time milestone completion.
- Evidence acceptance/rejection counts.
- Citizen verification participation.
- Category and geographic breakdowns.
- Disputed or overturned outcomes.
- Earned badges and criteria.
- Attribution as funder, implementer, coordinator, or joint partner.

Do not create a misleading composite score without publishing its calculation method. Do not count unverified claims as completed resolutions.

## 5.7 Public organization profile

Each verified organization can have a public profile with:
- Verified organization name and public-safe details.
- Verification badge.
- Supported projects.
- Verified resolution pages.
- Role-specific contribution attribution.
- Publicly reportable impact metrics.
- Earned recognition.
- Disputed or corrected public claims where relevant.

Do not publish private documents, personal phone numbers, internal member data, or confidential financial information.

---

# 6. Problem Adoption and Resolution State Machines

Reuse the existing report status model. Introduce separate adoption and verification states rather than overloading one report status.

## 6.1 Adoption status

Suggested values:
- `INTEREST_SUBMITTED`
- `PROPOSAL_SUBMITTED`
- `UNDER_REVIEW`
- `NEEDS_CHANGES`
- `APPROVED`
- `REJECTED`
- `WITHDRAWN`
- `ON_HOLD`
- `EXPIRED`
- `COMPLETED`

## 6.2 Implementation status

Suggested values:
- `NOT_STARTED`
- `PERMISSION_PENDING`
- `IN_PROGRESS`
- `BLOCKED`
- `WORK_COMPLETED`
- `CANCELLED`

## 6.3 Resolution claim status

Suggested values:
- `DRAFT`
- `SUBMITTED`
- `INITIAL_REVIEW`
- `NEEDS_MORE_EVIDENCE`
- `READY_FOR_VERIFICATION`
- `UNDER_VERIFICATION`
- `INCONCLUSIVE`
- `VERIFIED_RESOLVED`
- `NOT_VERIFIED`
- `DISPUTED`
- `REVOKED`

Only a final authorized decision can set `VERIFIED_RESOLVED`. A citizen vote alone cannot directly mutate the original report to resolved.

## 6.4 Government and private workflows must remain distinguishable

A single civic report can have:
- An existing government case.
- One or more private proposals.
- An approved private intervention.
- Multiple evidence submissions.
- A final report-level resolution.
- One or more contributing organizations.

The report should not be marked resolved because a company adopted it, pledged funding, started work, or submitted a claim. It is resolved only after the appropriate verification decision.

---

# 7. Attribution Model

Accurately identify who did what. Do not award the entire outcome to whichever participant submits the first claim.

Support role-based attribution such as:
- `GOVERNMENT_AUTHORITY`
- `FUNDER`
- `IMPLEMENTER`
- `IMPLEMENTATION_PARTNER`
- `TECHNICAL_PARTNER`
- `COMMUNITY_PARTNER`
- `COORDINATOR`
- `OTHER`

Each attribution record should include:
- Civic report and/or project.
- Organization or authority.
- Contribution role.
- Description of contribution.
- Evidence supporting the attribution.
- Review status.
- Attribution decision and timestamp.

Publish a resolution classification:
1. `GOVERNMENT_LED`
2. `PRIVATE_LED`
3. `JOINT`
4. `COMMUNITY_OR_OTHER`
5. `UNCLASSIFIED` when attribution cannot yet be determined

Classification must follow a documented policy. Do not classify by the identity of the first person to upload evidence.

Funding is not the same as implementation. The public page must use accurate labels such as “Funded by,” “Implemented by,” or “Jointly delivered by.”

---

# 8. Citizen Verification and Vote Rules

## 8.1 Vote model

Each vote records:
- Verification case.
- Eligible user identifier.
- Vote choice.
- Optional explanation.
- Optional evidence reference.
- Created timestamp.
- Eligibility and abuse-review state.

Enforce one active vote per eligible user per verification case using database constraints and server-side authorization. If vote changes are permitted, preserve a history or audit event.

## 8.2 Proposed initial policy

Use configurable verification settings rather than hard-coded thresholds. A pilot configuration may include:
- A minimum number of eligible votes.
- A minimum proportion of decisive votes supporting resolution.
- A defined voting window, initially considered at 72 hours.
- A route to human review for suspicious, conflicting, or insufficient evidence.

A suggested pilot threshold is 75% of decisive votes supporting resolution, but this is a product hypothesis that must be tested and may be adjusted. `CANNOT_VERIFY` must not be counted as a positive or negative vote.

Display:
- Total eligible votes.
- Resolved votes.
- Not-resolved votes.
- Cannot-verify votes.
- Verification window.
- Decision status.
- Independent/official verification status when relevant.

Do not present a vote percentage as the probability that the problem is solved.

## 8.3 Risk-based verification

For low-risk, readily observable issues, citizen voting can contribute substantially to the decision.

For high-risk infrastructure, serious public safety issues, work requiring permits, or disputed technical work:
- Require applicable official approval and/or qualified inspection.
- Do not let public voting override safety requirements.
- Allow human review and a reasoned final decision.

## 8.4 Anti-manipulation controls

- Authentication required to vote.
- One vote per eligible user per case.
- Rate limiting and abuse detection.
- Detect suspicious bursts and repeated patterns.
- Prevent organizations from using organization privileges to vote on their own claims.
- Flag likely conflicts of interest where feasible and proportionate.
- Avoid showing live vote totals if they are likely to encourage coordinated manipulation.
- Keep audit records of suspicious activity and moderation actions.
- Provide an appeal route for affected users and organizations.
- Do not reveal sensitive anti-abuse signals to public viewers.

---

# 9. Public Resolution Page

Every publicly shareable resolved problem should have a canonical page.

Include:
- Problem title and category.
- Public-safe location.
- Original report date.
- Verification status of the original report.
- Before/after evidence when approved for publication.
- Responsible government authority where known.
- Project and intervention details.
- Organization names and role-specific attribution.
- Resolution claim submission date.
- Citizen verification summary.
- Independent or official verification status where applicable.
- Final decision date.
- Evidence summary and decision rationale.
- Dispute/correction status.
- Link to the relevant organization profiles.

Clearly distinguish:
- `Reported`
- `Verified problem`
- `Adopted`
- `Work in progress`
- `Claim submitted`
- `Under verification`
- `Resolved and verified`
- `Disputed` or `Verification inconclusive`

Do not display a green resolved marker until the final decision is approved. Public pages must not disclose reporter PII or sensitive evidence.

---

# 10. Public Impact Reports and Government-vs-Private Comparison

Publish aggregate reports on a monthly and quarterly basis. The reports must be generated from verified platform records, not manually typed totals.

## 10.1 Overall civic status

Report:
- Total submitted reports.
- Reports verified.
- Reports assigned to authorities.
- Problems adopted by private organizations.
- Work in progress.
- Claims awaiting verification.
- Verified resolutions.
- Not-verified claims.
- Disputed or reopened cases.
- Unresolved cases.
- Median time to verified resolution.

Clearly define the date range and denominator for every rate.

## 10.2 Government performance

By authority, where data quality and permissions permit, show:
- Reports received/assigned.
- Responses recorded.
- Work started.
- Resolution claims submitted.
- Verified resolutions.
- Overdue cases.
- Median time to verified resolution.
- Reopened or disputed cases.

Do not treat an authority as responsible for a case unless it was actually assigned or within its recorded jurisdiction. Distinguish missing platform updates from proven inactivity.

## 10.3 Private-sector impact

By organization, show:
- Problems adopted.
- Interventions approved.
- Work started.
- Claims submitted.
- Verified resolutions.
- Claims not verified.
- Disputed or overturned outcomes.
- Median time to verified resolution.
- Role-specific contribution.
- Category and geographic breakdown.
- Public recognition earned.

## 10.4 Joint outcomes

Show joint resolutions separately. Do not count one jointly resolved report as two distinct resolved problems in the platform-wide total.

Organization-level contribution metrics may credit multiple contributors, but aggregate unique problem counts must deduplicate by civic report/resolution identifier.

## 10.5 Fair comparison requirements

Government and private organizations may handle different problem types, scales, and legal responsibilities. Therefore:
- Do not compare raw totals without context.
- Display problem volume and category mix.
- Separate reported, adopted, claimed, and verified states.
- Include unresolved cases and failed claims.
- Publish definitions and methodology.
- Explain missing data.
- Allow corrections and appeals.
- Avoid presenting correlation as proof of superior performance.
- Use comparable categories and time windows when making direct comparisons.

A public leaderboard must never imply that an organization has legal responsibility for problems outside its jurisdiction or authority.

---

# 11. Impact Score and Recognition

Introduce earned recognition only after a claim is verified.

Possible metrics:
- Verified resolutions.
- Complexity/severity of addressed problems.
- On-time completion against agreed timelines.
- Evidence quality.
- Citizen feedback.
- Sustained outcomes when measurable.
- Correct attribution and compliance with project requirements.

A configurable initial score model may be evaluated during the pilot:
- Verified outcomes: 35%
- Public-safety impact: 20%
- Timeliness: 15%
- Evidence quality: 15%
- Citizen feedback: 10%
- Sustained outcomes: 5%

These are proposed initial weights, not scientifically validated measures. Keep the scoring method versioned and publish its definitions. Do not calculate a score for an organization with insufficient data without indicating that the score is provisional or unavailable.

Recognition categories may include:
- `CIVIC_CONTRIBUTOR`
- `VERIFIED_IMPACT_PARTNER`
- `COMMUNITY_SAFETY_CHAMPION`
- `OUTSTANDING_CIVIC_PARTNER`

Award criteria must be explicit and auditable. Paid advertising must not change scores or awards. Organizations must be able to dispute incorrect attribution or metrics.

---

# 12. Notifications

Use the existing notification system if available.

Notify relevant users about:
- Organization verification decisions.
- Adoption proposal status changes.
- Required permissions or missing documentation.
- Milestone deadlines.
- Evidence submission outcomes.
- Verification window opening and closing.
- Final resolution decisions.
- New disputes or appeals.
- Badge awards.
- Organization suspension or reinstatement.

Notifications should not reveal private reporter data or sensitive moderation details.

---

# 13. Data Model Requirements

Inspect and reuse existing models before adding new ones. Names below are conceptual; adapt them to the repository's naming conventions.

Potential entities:

## `Organization`
- `id`
- `legalName`
- `displayName`
- `organizationType`
- `verificationStatus`
- `publicProfileSlug`
- `publicDescription`
- `websiteUrl` (validated)
- `operatingLocations`
- `focusAreas`
- `createdAt`
- `updatedAt`
- `verifiedAt` (nullable)
- `suspendedAt` (nullable)

## `OrganizationMember`
- `id`
- `organizationId`
- `userId`
- `role`
- `status`
- `createdAt`

Enforce unique membership constraints appropriate to the existing authentication model.

## `OrganizationVerification`
- `id`
- `organizationId`
- `status`
- `submittedAt`
- `reviewedAt`
- `reviewerId` (nullable)
- `decisionReason`
- secure document references

Do not store uploaded document bytes directly in database columns unless the existing architecture specifically requires it. Use secure object storage and controlled access.

## `ProblemAdoption`
- `id`
- `civicReportId`
- `organizationId`
- `proposedRole`
- `proposalDescription`
- `scope`
- `estimatedCost` (nullable)
- `currency`
- `proposedDeadline`
- `status`
- `approvedBy` (nullable)
- `approvedAt` (nullable)
- `createdAt`
- `updatedAt`

Support multiple proposals per report while enforcing the approved lead/joint implementation rules.

## `ProjectMilestone`
- `id`
- `problemAdoptionId`
- `title`
- `description`
- `dueAt`
- `status`
- `completedAt` (nullable)
- `evidenceReferences`

## `ResolutionClaim`
- `id`
- `civicReportId`
- `problemAdoptionId` (nullable if applicable)
- `submittedByUserId`
- `status`
- `claimDescription`
- `submittedAt`
- `finalizedAt` (nullable)
- `finalDecisionId` (nullable)

A claim must reference the exact report and intervention it addresses.

## `ResolutionEvidence`
- `id`
- `resolutionClaimId`
- `evidenceType`
- `secureObjectReference`
- `description`
- `capturedAt` (nullable)
- `locationReference` (nullable and privacy-controlled)
- `visibility`
- `reviewStatus`
- `createdAt`

## `VerificationCase`
- `id`
- `resolutionClaimId`
- `status`
- `openedAt`
- `closesAt`
- `minimumParticipation`
- `policyVersion`
- `finalizedAt` (nullable)

Thresholds should be controlled through reviewed configuration, not user-editable values.

## `CitizenVerificationVote`
- `id`
- `verificationCaseId`
- `userId`
- `choice`
- `explanation` (nullable)
- `createdAt`
- `eligibilityStatus`

Add a database-level unique constraint for one active vote per eligible user and verification case. If changing a vote is allowed, model and audit that behavior explicitly.

## `ResolutionDecision`
- `id`
- `resolutionClaimId`
- `outcome`
- `decisionReason`
- `decidedBy` (nullable for documented automated procedural decisions)
- `policyVersion`
- `evidenceSummary`
- `decidedAt`

## `ImpactAttribution`
- `id`
- `civicReportId`
- `organizationId` or authority reference
- `role`
- `contributionDescription`
- `supportingEvidenceReferences`
- `status`
- `reviewedBy`
- `createdAt`

## `AuditLog`
- `id`
- `actorUserId` (nullable for system actions)
- `actorOrganizationId` (nullable)
- `entityType`
- `entityId`
- `action`
- `beforeSummary`
- `afterSummary`
- `reason`
- `createdAt`
- request/correlation identifier where appropriate

Audit records must be append-only through application permissions and should not expose unnecessary PII.

Add indexes for common filters, foreign keys, status/date queries, organization dashboards, report lookup, and analytics. Use database constraints and transactions to protect state transitions and attribution integrity.

---

# 14. API Requirements

Adapt route style to the existing application. These are conceptual endpoints, not a mandate to introduce a new routing convention.

## Organizations
- `POST /api/organizations`
- `GET /api/organizations/me`
- `PATCH /api/organizations/me`
- `POST /api/organizations/me/verification`
- `GET /api/organizations/:slug`
- `GET /api/organizations/:id/impact`

## Problem discovery and adoption
- `GET /api/civic-problems/discover`
- `GET /api/civic-problems/:id`
- `POST /api/civic-problems/:id/adoption-proposals`
- `GET /api/organizations/me/adoptions`
- `GET /api/adoptions/:id`
- `PATCH /api/adoptions/:id` for allowed draft/status actions only
- `POST /api/adoptions/:id/withdraw`

## Milestones and evidence
- `POST /api/adoptions/:id/milestones`
- `PATCH /api/milestones/:id`
- `POST /api/resolution-claims`
- `POST /api/resolution-claims/:id/evidence`
- `GET /api/resolution-claims/:id`

## Citizen verification
- `GET /api/verification-cases/:id`
- `POST /api/verification-cases/:id/votes`
- `POST /api/verification-cases/:id/flags`
- `POST /api/resolution-claims/:id/appeals`

## Public reports
- `GET /api/public/impact/summary`
- `GET /api/public/impact/government`
- `GET /api/public/impact/private`
- `GET /api/public/impact/joint`
- `GET /api/public/impact/reports`
- `GET /api/public/resolutions/:id`

All endpoints must:
- Validate input using existing validation conventions.
- Enforce authentication and server-side authorization.
- Apply rate limits to sensitive/public write operations.
- Use safe pagination and sorting.
- Avoid leaking private documents or internal moderation data.
- Return consistent errors.
- Prevent insecure direct object references.
- Use transactions for multi-step state changes.
- Avoid trusting client-supplied roles, organization IDs, scores, or verification outcomes.

Do not implement every listed route if equivalent existing routes already serve the requirement. Update or extend existing endpoints instead.

---

# 15. Security, Privacy, and Abuse Prevention

Implement and test:
1. Tenant isolation between organizations.
2. Server-side role and resource authorization.
3. Secure organization verification document access.
4. Upload validation, file-size limits, MIME/signature checks, malware scanning where supported, and safe file delivery.
5. Rate limiting for voting, evidence upload, adoption requests, and appeals.
6. Anti-duplicate voting constraints.
7. Audit logging for all material decisions and attribution changes.
8. Protection against IDOR and unauthorized cross-organization access.
9. Input validation and output encoding.
10. Protection against mass assignment and client-controlled status updates.
11. CSRF protection where applicable to the authentication/session architecture.
12. Secure handling of secrets and webhook signatures if integrations are introduced.
13. Public-safe redaction of reporter PII and sensitive locations.
14. Abuse reporting and moderator workflows.
15. Backups, migration safety, and rollback planning.
16. Logging that avoids sensitive evidence contents and personal data.
17. No deletion or rewriting of final decision history without a documented correction event.
18. No paid advertising or commercial relationship affecting verification decisions.
19. Rate-limited and monitored public analytics endpoints.
20. Accessibility and secure handling of public-facing media.

Use the project's existing security controls and do not introduce redundant security frameworks without a concrete need.

---

# 16. Legal and Operational Guardrails

This PRD does not constitute legal advice. Before launch, obtain qualified review of the operating model.

1. Private organizations must not be allowed to perform work on public infrastructure without required authorization.
2. Adoption does not transfer statutory responsibility from the relevant authority.
3. CSR eligibility must be assessed separately; not every civic repair, donation, volunteer activity, or advertising expense qualifies as CSR.
4. Do not advertise JanSahayak verification as government certification unless formally authorized.
5. If donations or payments are introduced, review entity structure, payment flow, accounting, tax, and applicable regulatory obligations.
6. Public organization claims must be truthful and evidence-based.
7. Provide a dispute and correction mechanism.
8. Do not publish personal data or sensitive location details unnecessarily.
9. Do not make public rankings that imply unsupported conclusions about legal responsibility or overall performance.
10. Establish a policy for defamation risks, malicious reports, false evidence, harassment, and organization appeals.
11. Clearly label sponsorship and advertising. Paid placements must not affect problem eligibility, verification, or impact scores.
12. Keep government, private-sector, and joint contributions distinct in reports.

---

# 17. UX and Accessibility Requirements

- Match the existing JanSahayak visual design and design system.
- Build responsive layouts for desktop, tablet, and mobile.
- Support keyboard navigation and visible focus states.
- Provide accessible labels and semantic controls.
- Use clear text labels in addition to colors for statuses.
- Display status definitions and explanations.
- Show loading, empty, error, and retry states.
- Confirm consequential actions such as adoption withdrawal or final evidence submission.
- Make verification criteria understandable to non-technical citizens.
- Make public impact pages shareable.
- Do not overload dashboards with vanity metrics.
- Ensure public reports explain methodology and data limitations.
- Never expose sensitive reporter details on organization dashboards.

---

# 18. Analytics Definitions

All analytics must have stable, documented definitions.

Suggested definitions:
- **Verified report:** A report that passed the existing report-verification process.
- **Adopted problem:** A problem with an approved adoption/intervention, not merely an expression of interest.
- **Resolution claim:** A submitted assertion that the problem has been addressed.
- **Verified resolution:** A final accepted resolution decision under the applicable verification policy.
- **Private-led resolution:** A verified outcome classified as private-led under the documented attribution policy.
- **Government-led resolution:** A verified outcome classified as government-led under the documented attribution policy.
- **Joint resolution:** A unique verified outcome with material government and private-sector participation.
- **Resolution rate:** Verified resolutions divided by a clearly stated eligible denominator and time window.
- **Median resolution time:** Median elapsed time between the chosen start event and final verified resolution. The report must state whether timing begins at report submission, verification, adoption, or work commencement.
- **Verification rejection rate:** Claims not verified divided by finalized claims within the stated cohort/time window.
- **Overdue adoption:** Approved adoption whose agreed deadline has passed without completion or an approved extension.

Never count the same civic report twice in the platform-wide unique-resolution total. Contributor-level impact may be attributed to multiple organizations but must be clearly distinguished from unique problem counts.

---

# 19. Acceptance Criteria

The feature is not complete until all applicable criteria below pass.

## Registration and organization access
- [ ] A user can submit an organization registration.
- [ ] Verification status is visible and enforced.
- [ ] Unverified organizations cannot adopt problems or submit official resolution claims.
- [ ] Organization members can only access authorized organization resources.
- [ ] Cross-organization access attempts are rejected and tested.

## Problem discovery and adoption
- [ ] Verified organizations can browse eligible public-safe problems.
- [ ] Filters and pagination work correctly.
- [ ] Each problem indicates whether private participation is permitted or requires approval.
- [ ] Adoption proposals record scope, role, deadlines, and status.
- [ ] Multiple proposals can be managed without conflicting interventions.
- [ ] An organization cannot claim exclusive ownership merely by expressing interest.
- [ ] Expired, withdrawn, or failed adoption workflows can be handled.
- [ ] Adoption does not automatically resolve the underlying report.

## Evidence and verification
- [ ] Authorized organization members can submit evidence.
- [ ] Invalid files and unauthorized uploads are rejected.
- [ ] Evidence is associated with the correct claim and report.
- [ ] Initial review and requests for more evidence work.
- [ ] Eligible citizens can vote once per verification case.
- [ ] Duplicate votes are rejected at the database/application level.
- [ ] `CANNOT_VERIFY` is not counted as a positive or negative vote.
- [ ] Insufficient participation produces an inconclusive result or configured review path.
- [ ] High-risk cases require the configured official/qualified verification.
- [ ] Final decisions record a reason and audit trail.
- [ ] Disputes and appeals preserve previous decisions and evidence history.

## Attribution and recognition
- [ ] Government, private, joint, and other outcomes are distinguishable.
- [ ] Funding and implementation are attributed separately.
- [ ] Unverified claims do not count as verified resolutions.
- [ ] Impact scores cannot be set by client input.
- [ ] Paid advertising cannot improve scores or change verification outcomes.
- [ ] Public profiles show only approved public information.

## Public reporting
- [ ] Public resolution pages show the original problem, outcome, evidence summary, and contributor roles.
- [ ] Public pages do not expose reporter PII or private evidence.
- [ ] Aggregate totals deduplicate unique civic reports.
- [ ] Government, private, and joint statistics are reported separately.
- [ ] Denominators, time windows, and metric definitions are displayed.
- [ ] Disputed and reopened cases are represented accurately.
- [ ] Reports can be filtered by the supported date range and category.
- [ ] Analytics are generated from backend data, not hard-coded mock values.

## Engineering quality
- [ ] Database migrations are safe and reviewed.
- [ ] Authorization and tenant-isolation tests pass.
- [ ] State-transition tests pass.
- [ ] Voting and duplicate-submission tests pass.
- [ ] Evidence-upload security tests pass.
- [ ] Analytics deduplication tests pass.
- [ ] Existing citizen reporting and government workflows still work.
- [ ] Type checks, linting, and production build pass where available.
- [ ] Documentation and the previous PRD are updated.

---

# 20. Test Scenarios

At minimum, test these end-to-end cases:

1. Unverified organization tries to adopt a problem: denied.
2. Verified organization submits an adoption proposal: proposal is recorded.
3. Two organizations propose work on the same problem: no conflicting execution without coordination.
4. Organization adopts a problem but never starts work: problem remains unresolved and can be reopened according to policy.
5. Organization uploads evidence for the wrong report: rejected or flagged.
6. Organization submits a valid claim: verification case opens.
7. Citizen submits two votes for the same case: duplicate is rejected.
8. Citizen selects `CANNOT_VERIFY`: vote is excluded from decisive vote percentages.
9. Verification receives too few votes: no false verified-resolution status.
10. High-risk repair has no required approval: final resolution cannot be accepted.
11. Citizen evidence contradicts a company's claim: case becomes disputed or is reviewed.
12. Claim is rejected: organization can see the reason and use the appeal path.
13. Verified claim is later credibly challenged: review can reopen the case without erasing history.
14. Government and private partners jointly solve one report: report is counted once in unique-resolution totals.
15. One organization funds and another implements: public attribution distinguishes their roles.
16. Organization tries to access another organization's private evidence: denied.
17. Public analytics are requested with malicious filters or excessive pagination: input is validated and rate limits apply.
18. Paid advertising is purchased: impact score and verification remain unchanged.
19. Reporter personal information exists in the original report: public organization and resolution pages redact it.
20. Existing government escalation and citizen report workflows remain operational after migration.

---

# 21. Phased Implementation Plan

## Phase 0 — Repository and PRD reconciliation
- Read the existing PRD and source code.
- Identify reusable models, routes, permissions, UI components, and tests.
- Update the previous PRD with this addendum.
- Document schema and route changes.
- Identify legal/operational blockers.

## Phase 1 — Organization onboarding and dashboard foundation
- Organization registration.
- Organization membership and roles.
- Verification workflow.
- Protected dashboard shell.
- Discover Problems list/detail views.

## Phase 2 — Adoption and implementation tracking
- Adoption proposals.
- Approval/coordination workflow.
- Milestones and deadlines.
- Organization project dashboard.
- Status transitions and audit events.

## Phase 3 — Evidence and verification
- Evidence upload and storage permissions.
- Resolution claims.
- Initial evidence review.
- Citizen verification cases and votes.
- Final decisions, disputes, and appeals.

## Phase 4 — Public impact and attribution
- Organization public profiles.
- Public resolution pages.
- Contributor attribution.
- Earned badges and impact metrics.
- Government/private/joint classifications.

## Phase 5 — Analytics, hardening, and pilot
- Monthly/quarterly public reports.
- Deduplicated analytics.
- Abuse detection and moderation.
- Security and accessibility tests.
- Pilot configuration and documentation.
- Production build and regression testing.

Do not start Phase 5 before the underlying resolution and attribution data is reliable.

---

# 22. Definition of Done

The feature is complete when:
1. The previous PRD has been updated, not replaced.
2. The organization registration and verification workflow works.
3. Verified organizations can discover eligible problems and submit adoption proposals.
4. Implementation and permission requirements are tracked.
5. Organizations can submit resolution evidence.
6. Citizens can participate in a protected verification workflow.
7. Final outcomes use evidence and risk-based checks, not votes alone.
8. Public pages identify the actual roles of contributors.
9. Government-led, private-led, and joint resolutions are reported fairly.
10. Organization dashboards and public reports use real persisted data.
11. Security, tenant isolation, state transitions, voting, and attribution are covered by tests.
12. Existing citizen and government workflows continue to work.
13. Relevant documentation, setup instructions, and the original PRD are updated.
14. Remaining legal or operational review items are explicitly documented rather than falsely marked complete.

**End of PRD addendum.**
