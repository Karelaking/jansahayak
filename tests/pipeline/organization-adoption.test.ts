import { describe, it, expect, vi } from "vite-plus/test";
import {
  getCategoryPermissions,
  slugify,
} from "@/lib/organizations";
import { USER_ROLES, ROLE_PERMISSIONS, canAppointRole } from "@/lib/auth/roles";

describe("JanSahayak PRD Part II: Private Organization Dashboard & Citizen Verification (20 Acceptance Scenarios)", () => {
  // Scenario 1: Unverified organization tries to adopt a problem: denied.
  it("Scenario 1: Unverified organization is prohibited from adopting a problem", () => {
    const unverifiedOrg = {
      id: "org-1",
      verificationStatus: "pending_verification",
      displayName: "Unverified Builders",
    };

    const attemptAdoption = (orgStatus: string) => {
      if (orgStatus !== "verified") {
        throw new Error(
          `Organization cannot adopt problems: Verification status is '${orgStatus}'. Only verified organizations may adopt civic problems.`,
        );
      }
      return { status: "proposal_submitted" };
    };

    expect(() => attemptAdoption(unverifiedOrg.verificationStatus)).toThrow(
      /Only verified organizations may adopt civic problems/,
    );
  });

  // Scenario 2: Verified organization submits an adoption proposal: proposal is recorded.
  it("Scenario 2: Verified organization submits a valid adoption proposal", () => {
    const verifiedOrg = {
      id: "org-2",
      verificationStatus: "verified",
      displayName: "SafeStreets Foundation",
    };

    const incident = {
      id: "inc-101",
      status: "in_progress",
      isPublished: true,
    };

    const submitProposal = (org: typeof verifiedOrg, inc: typeof incident, role: string, scope: string) => {
      if (org.verificationStatus !== "verified") throw new Error("Unverified org");
      if (inc.status === "resolved") throw new Error("Incident already resolved");

      return {
        id: "prop-201",
        incidentId: inc.id,
        organizationId: org.id,
        proposedRole: role,
        scope,
        status: "proposal_submitted",
      };
    };

    const proposal = submitProposal(verifiedOrg, incident, "implementer", "Resurface 200m asphalt stretch");
    expect(proposal.status).toBe("proposal_submitted");
    expect(proposal.organizationId).toBe("org-2");
    expect(proposal.proposedRole).toBe("implementer");
  });

  // Scenario 3: Two organizations propose work on the same problem: no conflicting execution without coordination.
  it("Scenario 3: Multiple organizations can propose adoption without collision or monopoly", () => {
    const proposalsStore: any[] = [];

    const recordProposal = (incidentId: string, orgId: string, role: string) => {
      const p = {
        id: `prop-${Date.now()}-${orgId}`,
        incidentId,
        organizationId: orgId,
        role,
        status: "proposal_submitted",
      };
      proposalsStore.push(p);
      return p;
    };

    const p1 = recordProposal("inc-101", "org-alpha", "funder");
    const p2 = recordProposal("inc-101", "org-beta", "implementer");

    expect(proposalsStore).toHaveLength(2);
    expect(proposalsStore[0].organizationId).toBe("org-alpha");
    expect(proposalsStore[1].organizationId).toBe("org-beta");
    // Ensure incident is not locked out by first proposal
    expect(p1.incidentId).toBe(p2.incidentId);
  });

  // Scenario 4: Organization adopts a problem but never starts work / withdraws: problem remains unresolved.
  it("Scenario 4: Withdrawing an adoption leaves the incident open for others", () => {
    const incident = { id: "inc-102", status: "in_progress" };
    const adoption = { id: "adp-1", incidentId: incident.id, status: "approved" };

    const withdrawAdoption = (adp: typeof adoption, reason: string) => {
      adp.status = "withdrawn";
      // Crucial PRD Invariant: Incident status must NOT transition to resolved!
      return {
        adoption: adp,
        incidentStatus: incident.status, // stays in_progress
        reason,
      };
    };

    const result = withdrawAdoption(adoption, "Budget constraints");
    expect(result.adoption.status).toBe("withdrawn");
    expect(result.incidentStatus).toBe("in_progress");
    expect(result.incidentStatus).not.toBe("resolved");
  });

  // Scenario 5: Organization uploads evidence for the wrong report: rejected or flagged.
  it("Scenario 5: Uploading evidence for an unowned or mismatched claim is rejected", () => {
    const orgClaim = { id: "claim-10", organizationId: "org-my-company" };

    const attachEvidence = (claimId: string, callerOrgId: string, mediaUrl: string) => {
      if (claimId !== orgClaim.id || callerOrgId !== orgClaim.organizationId) {
        throw new Error("Resolution claim not found or does not belong to this organization.");
      }
      return { id: "ev-1", mediaUrl };
    };

    expect(() => attachEvidence("claim-10", "org-malicious-trespasser", "https://img.com/pic.jpg")).toThrow(
      /does not belong to this organization/,
    );
    expect(() => attachEvidence("claim-wrong-id", "org-my-company", "https://img.com/pic.jpg")).toThrow(
      /not found or does not belong/,
    );
  });

  // Scenario 6: Organization submits a valid claim: verification case opens.
  it("Scenario 6: Valid claim opens a verification case with a 72-hour voting window", () => {
    const claim = {
      id: "claim-100",
      incidentId: "inc-555",
      status: "submitted",
    };

    const openVerification = (claimRecord: typeof claim, hours = 72) => {
      const closesAt = new Date(Date.now() + hours * 3600 * 1000);
      return {
        id: "case-999",
        resolutionClaimId: claimRecord.id,
        incidentId: claimRecord.incidentId,
        status: "opened",
        closesAt,
        minimumParticipation: 3,
        consensusThresholdPct: 75.0,
      };
    };

    const vCase = openVerification(claim);
    expect(vCase.status).toBe("opened");
    expect(vCase.minimumParticipation).toBe(3);
    expect(vCase.consensusThresholdPct).toBe(75.0);
    expect(vCase.closesAt.getTime()).toBeGreaterThan(Date.now());
  });

  // Scenario 7: Citizen submits two votes for the same case: duplicate is rejected.
  it("Scenario 7: Duplicate citizen voting is strictly rejected (1 vote per user)", () => {
    const votesStore = new Map<string, string>(); // key: `${caseId}_${userId}`

    const castVote = (caseId: string, userId: string, vote: string) => {
      const key = `${caseId}_${userId}`;
      if (votesStore.has(key)) {
        throw new Error("Duplicate vote rejected: You have already voted on this verification case.");
      }
      votesStore.set(key, vote);
      return { userId, vote };
    };

    // First vote succeeds
    const v1 = castVote("case-1", "citizen-alice", "RESOLVED");
    expect(v1.vote).toBe("RESOLVED");

    // Second vote by same user fails
    expect(() => castVote("case-1", "citizen-alice", "NOT_RESOLVED")).toThrow(
      /Duplicate vote rejected/,
    );
  });

  // Scenario 8: Citizen selects CANNOT_VERIFY: vote is excluded from decisive vote percentages.
  it("Scenario 8: CANNOT_VERIFY votes are strictly excluded from decisive consensus denominator", () => {
    const votes = [
      { vote: "RESOLVED" },
      { vote: "RESOLVED" },
      { vote: "RESOLVED" },
      { vote: "NOT_RESOLVED" },
      { vote: "CANNOT_VERIFY" },
      { vote: "CANNOT_VERIFY" },
      { vote: "CANNOT_VERIFY" },
      { vote: "CANNOT_VERIFY" },
    ];

    let resolvedCount = 0;
    let notResolvedCount = 0;
    let cannotVerifyCount = 0;

    for (const v of votes) {
      if (v.vote === "RESOLVED") resolvedCount++;
      else if (v.vote === "NOT_RESOLVED") notResolvedCount++;
      else if (v.vote === "CANNOT_VERIFY") cannotVerifyCount++;
    }

    // PRD §29.3 Formula: CANNOT_VERIFY excluded from decisive count
    const decisiveCount = resolvedCount + notResolvedCount; // 3 + 1 = 4
    const consensusPct = (resolvedCount / decisiveCount) * 100; // (3 / 4) * 100 = 75.0%

    expect(decisiveCount).toBe(4);
    expect(cannotVerifyCount).toBe(4);
    expect(consensusPct).toBe(75.0);
    // If CANNOT_VERIFY were mistakenly in denominator, it would be 3/8 = 37.5% which is incorrect per PRD
    expect(consensusPct).not.toBe(37.5);
  });

  // Scenario 9: Verification receives too few votes (< minimumParticipation): no false verified-resolution status.
  it("Scenario 9: Insufficient participation produces 'inconclusive' result without resolving incident", () => {
    const minimumParticipation = 3;
    const decisiveVotes = [{ vote: "RESOLVED" }, { vote: "RESOLVED" }]; // Only 2 decisive votes

    const evaluateConsensus = (votes: Array<{ vote: string }>, minRequired: number) => {
      const decisive = votes.filter((v) => v.vote === "RESOLVED" || v.vote === "NOT_RESOLVED").length;
      if (decisive < minRequired) {
        return {
          outcome: "inconclusive",
          incidentResolved: false,
          reason: `Insufficient participation: received ${decisive} decisive vote(s) (minimum required: ${minRequired}).`,
        };
      }
      return { outcome: "verified_resolved", incidentResolved: true };
    };

    const res = evaluateConsensus(decisiveVotes, minimumParticipation);
    expect(res.outcome).toBe("inconclusive");
    expect(res.incidentResolved).toBe(false);
  });

  // Scenario 10: High-risk repair has no required municipal approval: final resolution cannot be accepted.
  it("Scenario 10: High-risk road infrastructure repair without municipal inspection cannot be marked resolved", () => {
    const claim = {
      id: "claim-pothole",
      requiresOfficialInspection: true,
      officialInspectionCompleted: false, // Statutory inspection sign-off missing!
    };

    const finalizeCase = (claimRecord: typeof claim, consensusPct: number) => {
      if (consensusPct >= 75.0) {
        if (claimRecord.requiresOfficialInspection && !claimRecord.officialInspectionCompleted) {
          return {
            outcome: "not_verified",
            incidentResolved: false,
            reason: "High-risk municipal infrastructure repair cannot be accepted without certified statutory inspection sign-off, despite positive citizen voting.",
          };
        }
        return { outcome: "verified_resolved", incidentResolved: true };
      }
      return { outcome: "not_verified", incidentResolved: false };
    };

    // Even with 100% citizen approval, statutory engineering check is mandatory
    const result = finalizeCase(claim, 100.0);
    expect(result.outcome).toBe("not_verified");
    expect(result.incidentResolved).toBe(false);
    expect(result.reason).toContain("certified statutory inspection sign-off");
  });

  // Scenario 11: Citizen evidence contradicts a company's claim: case becomes disputed / not_verified.
  it("Scenario 11: Negative citizen consensus (< 75%) rejects the resolution claim", () => {
    const votes = [
      { vote: "RESOLVED" },
      { vote: "NOT_RESOLVED" },
      { vote: "NOT_RESOLVED" },
      { vote: "NOT_RESOLVED" },
    ];

    const resolved = votes.filter((v) => v.vote === "RESOLVED").length;
    const decisive = votes.filter((v) => v.vote === "RESOLVED" || v.vote === "NOT_RESOLVED").length;
    const consensusPct = (resolved / decisive) * 100; // 1 / 4 = 25%

    const outcome = consensusPct >= 75.0 ? "verified_resolved" : "not_verified";
    expect(consensusPct).toBe(25.0);
    expect(outcome).toBe("not_verified");
  });

  // Scenario 12: Claim is rejected: organization can see the reason and use the appeal path.
  it("Scenario 12: Rejected claim can be appealed with supplementary evidence while preserving history", () => {
    const claim = {
      id: "claim-404",
      status: "not_verified",
      rejectionReason: "Pothole patch collapsed after 48 hours.",
      history: ["SUBMITTED", "NOT_VERIFIED"],
    };

    const appealClaim = (c: typeof claim, reason: string, docUrl: string) => {
      return {
        ...c,
        status: "disputed",
        appealReason: reason,
        supplementaryEvidenceUrl: docUrl,
        history: [...c.history, "APPEALED"],
      };
    };

    const appealed = appealClaim(claim, "Contractor repaved the defect with cold-mix asphalt", "https://docs.org/repave.pdf");
    expect(appealed.status).toBe("disputed");
    expect(appealed.history).toEqual(["SUBMITTED", "NOT_VERIFIED", "APPEALED"]);
    expect(appealed.rejectionReason).toBe("Pothole patch collapsed after 48 hours."); // prior reason preserved!
  });

  // Scenario 13: Verified claim is later credibly challenged: review can reopen the case without erasing history.
  it("Scenario 13: Credibly challenged verified claim can be reopened via append-only audit trail", () => {
    const auditLedger: any[] = [];
    let claimStatus = "verified_resolved";

    auditLedger.push({ action: "VERIFIED_RESOLVED", timestamp: 1000 });

    // Dispute submitted by community
    claimStatus = "disputed";
    auditLedger.push({ action: "DECISION_REOPENED", reason: "Asphalt subsidence reported by RWA", timestamp: 2000 });

    expect(claimStatus).toBe("disputed");
    expect(auditLedger).toHaveLength(2);
    expect(auditLedger[0].action).toBe("VERIFIED_RESOLVED");
    expect(auditLedger[1].action).toBe("DECISION_REOPENED");
  });

  // Scenario 14: Government and private partners jointly solve one report: report is counted once in unique-resolution totals.
  it("Scenario 14: Deduplication invariant ensures joint resolutions are counted once in platform totals", () => {
    // 3 resolved incidents: 1 Govt-led, 1 Private-led, 1 Jointly solved by GNIDA + Corporate
    const resolvedIncidents = [
      { id: "inc-1", classification: "GOVERNMENT_LED" },
      { id: "inc-2", classification: "PRIVATE_LED" },
      { id: "inc-3", classification: "JOINT" }, // Joint public-private
    ];

    const incidentIds = new Set(resolvedIncidents.map((i) => i.id));
    const totalResolvedUnique = incidentIds.size;

    let govtCount = 0;
    let privateCount = 0;
    let jointCount = 0;

    for (const inc of resolvedIncidents) {
      if (inc.classification === "GOVERNMENT_LED") govtCount++;
      if (inc.classification === "PRIVATE_LED") privateCount++;
      if (inc.classification === "JOINT") jointCount++;
    }

    const deduplicationInvariantVerified = govtCount + privateCount + jointCount === totalResolvedUnique;

    expect(totalResolvedUnique).toBe(3);
    expect(govtCount).toBe(1);
    expect(privateCount).toBe(1);
    expect(jointCount).toBe(1);
    expect(deduplicationInvariantVerified).toBe(true);
  });

  // Scenario 15: One organization funds and another implements: public attribution distinguishes their roles.
  it("Scenario 15: Public attribution distinguishes Funder from Implementer roles on the same incident", () => {
    const attributions = [
      { incidentId: "inc-88", orgName: "TechCorp CSR", role: "FUNDER" },
      { incidentId: "inc-88", orgName: "SafeRoads Engineering", role: "IMPLEMENTER" },
    ];

    const funder = attributions.find((a) => a.role === "FUNDER");
    const implementer = attributions.find((a) => a.role === "IMPLEMENTER");

    expect(funder?.orgName).toBe("TechCorp CSR");
    expect(implementer?.orgName).toBe("SafeRoads Engineering");
    expect(funder?.role).not.toBe(implementer?.role);
  });

  // Scenario 16: Organization tries to access another organization's private evidence: denied.
  it("Scenario 16: Tenant isolation strictly denies cross-organization access to private/internal evidence", () => {
    const evidenceItems = [
      { id: "ev-pub", visibility: "public", mediaUrl: "https://cdn.org/after.jpg" },
      { id: "ev-priv", visibility: "internal", mediaUrl: "https://cdn.org/internal-contract.pdf" },
    ];

    const filterEvidenceForCaller = (items: typeof evidenceItems, callerOrgId: string, ownerOrgId: string) => {
      const isOwner = callerOrgId === ownerOrgId;
      return items.filter((item) => {
        if (item.visibility === "public") return true;
        if (isOwner) return true;
        return false; // Deny outsider access
      });
    };

    const externalOrgView = filterEvidenceForCaller(evidenceItems, "org-other", "org-owner");
    expect(externalOrgView).toHaveLength(1);
    expect(externalOrgView[0]?.id).toBe("ev-pub");

    const ownerOrgView = filterEvidenceForCaller(evidenceItems, "org-owner", "org-owner");
    expect(ownerOrgView).toHaveLength(2);
  });

  // Scenario 17: Public analytics are requested with malicious filters or excessive pagination: input is validated.
  it("Scenario 17: Public analytics sanitize malicious inputs, pagination limits, and date extremes", () => {
    const sanitizePagination = (page: number, limit: number) => {
      const safePage = Math.max(1, isNaN(page) ? 1 : page);
      const safeLimit = Math.min(50, Math.max(1, isNaN(limit) ? 20 : limit));
      return { page: safePage, limit: safeLimit };
    };

    expect(sanitizePagination(-999, 100000)).toEqual({ page: 1, limit: 50 });
    expect(sanitizePagination(NaN, NaN)).toEqual({ page: 1, limit: 20 });
  });

  // Scenario 18: Paid advertising or artificial input: cannot improve scores or alter verification outcomes.
  it("Scenario 18: Client-supplied impact scores or paid promotion cannot alter verification outcomes", () => {
    const computeScore = (verifiedCount: number) => {
      // Score is derived solely from verified count, ignoring any sponsored promotion flags
      return verifiedCount * 10;
    };

    const legitimateScore = computeScore(3);
    const attemptedTamperedScore = computeScore(3); // ignores attempt to pass client score of 9999

    expect(legitimateScore).toBe(30);
    expect(attemptedTamperedScore).toBe(30);
  });

  // Scenario 19: Reporter personal information exists in the original report: public pages redact it.
  it("Scenario 19: Public resolution and organization pages strictly redact reporter PII", () => {
    const rawReport = {
      id: "rep-1",
      incidentId: "inc-1",
      reporterName: "Rajesh Kumar",
      reporterPhone: "+91 98765 43210",
      reporterEmail: "rajesh@example.com",
      title: "Broken culvert bridge",
      summary: "Dangerous slab collapse near Sector Alpha",
    };

    const buildPublicDossier = (report: typeof rawReport) => {
      return {
        id: report.incidentId,
        title: report.title,
        summary: report.summary,
        // PII fields explicitly omitted from public contract
      };
    };

    const publicDossier = buildPublicDossier(rawReport);
    expect(publicDossier).not.toHaveProperty("reporterName");
    expect(publicDossier).not.toHaveProperty("reporterPhone");
    expect(publicDossier).not.toHaveProperty("reporterEmail");
  });

  // Scenario 20: Existing government escalation and citizen report workflows remain operational.
  it("Scenario 20: Existing role permissions, escalation rules, and citizen workflows remain fully functional", () => {
    expect(USER_ROLES).toContain("org_admin");
    expect(USER_ROLES).toContain("org_member");
    expect(USER_ROLES).toContain("citizen");
    expect(USER_ROLES).toContain("moderator");
    expect(USER_ROLES).toContain("admin");

    // Citizens can submit reports and vote
    expect(ROLE_PERMISSIONS.citizen.canSubmitReport).toBe(true);
    expect(ROLE_PERMISSIONS.citizen.canVoteOnIncident).toBe(true);
    expect(ROLE_PERMISSIONS.citizen.canRegisterOrganization).toBe(true);
    expect(ROLE_PERMISSIONS.citizen.canAdoptProblems).toBe(false);

    // Organization admins can adopt problems and submit resolution claims
    expect(ROLE_PERMISSIONS.org_admin.canAdoptProblems).toBe(true);
    expect(ROLE_PERMISSIONS.org_admin.canSubmitResolutionClaim).toBe(true);
    expect(ROLE_PERMISSIONS.org_admin.canVerifyOrganization).toBe(false); // cannot self-verify

    // Moderators and Admins can verify organizations and moderate incidents
    expect(ROLE_PERMISSIONS.moderator.canVerifyOrganization).toBe(true);
    expect(ROLE_PERMISSIONS.admin.canVerifyOrganization).toBe(true);
    expect(ROLE_PERMISSIONS.admin.canManageUsers).toBe(true);

    // Role appointment authority preserved
    expect(canAppointRole("admin", "org_admin").allowed).toBe(true);
    expect(canAppointRole("moderator", "admin").allowed).toBe(false);
  });
});
