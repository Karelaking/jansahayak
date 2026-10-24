export type HazardSeverity = "critical" | "moderate" | "minor";

export type HazardCategoryKey = "road-surface" | "lighting" | "footpath" | "crossing" | "drainage";

export type HazardStatusKey = "under-review" | "assigned" | "community-verified" | "resolved";

export interface HazardReport {
  id: string;
  title: string;
  category: HazardCategoryKey;
  categoryLabel: string;
  landmark: string;
  longitude: number;
  latitude: number;
  reportedAt: string;
  hoursAgo: number;
  severity: HazardSeverity;
  status: HazardStatusKey;
  statusLabel: string;
  verificationsCount: number;
  officialRouting: string;
  description: string;
}

export type TimeWindowFilter = "12h" | "24h" | "all";
