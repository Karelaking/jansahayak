/**
 * Role Definitions & Permissions for JanSahayak
 */

export const USER_ROLES = ["citizen", "moderator", "admin", "field_official"] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * The identifier recorded for reports filed without a Clerk session. It is a
 * non-personal sentinel, never a fabricated citizen account.
 */
export const ANONYMOUS_USER_ID = "anonymous";

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/**
 * Returns a validated role, or undefined when the value is absent/invalid.
 * Useful when a role comes from external metadata that may be malformed.
 */
export function parseUserRole(value: unknown): UserRole | undefined {
  return isUserRole(value) ? value : undefined;
}

export function normalizeUserRole(value: unknown, fallback: UserRole = "citizen"): UserRole {
  return parseUserRole(value) ?? fallback;
}

export interface UserSession {
  userId: string;
  email: string;
  fullName?: string;
  role: UserRole;
  avatarUrl?: string;
  isAuthenticated: boolean;
}

export const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    canSubmitReport: boolean;
    canViewPublicMap: boolean;
    canVoteOnIncident: boolean;
    canSubscribeToUpdates: boolean;
    canViewModerationQueue: boolean;
    canApproveRejectIncident: boolean;
    canMergeIncidents: boolean;
    canPublishMapPin: boolean;
    canViewCivicAnalytics: boolean;
    canManageUsers: boolean;
    canUpdateRepairStatus: boolean;
  }
> = {
  citizen: {
    canSubmitReport: true,
    canViewPublicMap: true,
    canVoteOnIncident: true,
    canSubscribeToUpdates: true,
    canViewModerationQueue: false,
    canApproveRejectIncident: false,
    canMergeIncidents: false,
    canPublishMapPin: false,
    canViewCivicAnalytics: false,
    canManageUsers: false,
    canUpdateRepairStatus: false,
  },
  moderator: {
    canSubmitReport: true,
    canViewPublicMap: true,
    canVoteOnIncident: true,
    canSubscribeToUpdates: true,
    canViewModerationQueue: true,
    canApproveRejectIncident: true,
    canMergeIncidents: true,
    canPublishMapPin: true,
    canViewCivicAnalytics: true,
    canManageUsers: false,
    canUpdateRepairStatus: false,
  },
  admin: {
    canSubmitReport: true,
    canViewPublicMap: true,
    canVoteOnIncident: true,
    canSubscribeToUpdates: true,
    canViewModerationQueue: true,
    canApproveRejectIncident: true,
    canMergeIncidents: true,
    canPublishMapPin: true,
    canViewCivicAnalytics: true,
    canManageUsers: true,
    canUpdateRepairStatus: true,
  },
  field_official: {
    canSubmitReport: true,
    canViewPublicMap: true,
    canVoteOnIncident: true,
    canSubscribeToUpdates: true,
    canViewModerationQueue: true,
    canApproveRejectIncident: false,
    canMergeIncidents: false,
    canPublishMapPin: false,
    canViewCivicAnalytics: true,
    canManageUsers: false,
    canUpdateRepairStatus: true,
  },
};

export function hasPermission(
  role: UserRole,
  permission: keyof (typeof ROLE_PERMISSIONS)["citizen"],
): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

/**
 * Role Appointment & Delegation Matrix
 * PRD §2, §14B, & Civic Governance:
 * - Public users can only self-register as "citizen".
 * - Administrators can appoint moderators and administrators.
 * - Administrators and Moderators can appoint moderators (and demote to citizen).
 * - Moderators CANNOT appoint administrators (strictly restricted to administrators).
 */
export function canAppointRole(
  requesterRole: UserRole,
  targetRole: UserRole,
): { allowed: boolean; reason?: string } {
  if (requesterRole !== "admin" && requesterRole !== "moderator") {
    return {
      allowed: false,
      reason: "Forbidden: Only designated moderators or administrators can manage user roles.",
    };
  }

  if (targetRole === "admin" && requesterRole !== "admin") {
    return {
      allowed: false,
      reason: "Moderators cannot appoint administrators. Administrator privileges required.",
    };
  }

  if (targetRole !== "citizen" && targetRole !== "moderator" && targetRole !== "admin") {
    return {
      allowed: false,
      reason: `Invalid target role '${targetRole}'. Must be citizen, moderator, or admin.`,
    };
  }

  return { allowed: true };
}
