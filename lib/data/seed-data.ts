import type {
  HazardReport,
  ModerationQueueItem,
  EscalationDocket,
  CivicAnalytics,
} from "@/lib/types/hazard";

/**
 * =============================================================================
 * CENTRALIZED SAMPLE & SEED DATA LAYER
 * =============================================================================
 * ALL mock and sample records across JanSahayak SafeStreets are centralized in
 * this single file. No hard-coded records or dummy arrays should be scattered
 * across individual routes, components, or modules.
 *
 * In the future, replacing this data layer with a database client (e.g. Prisma,
 * Drizzle, Supabase, or REST API fetch) can be done entirely by updating this file
 * or swapping its exports.
 * =============================================================================
 */

export const SAMPLE_HAZARDS: HazardReport[] = [
  {
    id: "R-2041",
    title: "Broken footpath near Alpha II roundabout",
    category: "footpath",
    categoryLabel: "Broken Footpath",
    location: "Alpha II, Greater Noida",
    landmark: "Alpha II Commercial Belt, near Pillar 14",
    longitude: 77.504,
    latitude: 28.4744,
    reportedAt: "2 hours ago",
    time: "2h ago",
    hoursAgo: 2,
    severity: "high",
    status: "open",
    statusLabel: "Reported / Open",
    votes: 14,
    verificationsCount: 14,
    coordinates: "28.4744° N, 77.5040° E",
    authority: "GNIDA Maintenance Division III",
    officialRouting: "GNIDA Civil Maintenance Division",
    description:
      "Deep collapse of concrete slabs on the pedestrian pathway forcing morning school walkers and seniors onto the busy vehicular carriageway.",
  },
  {
    id: "R-2040",
    title: "Pothole on Gaur City road causing near-misses",
    category: "road-surface",
    categoryLabel: "Road Surface",
    location: "Gaur City 1, Noida Ext.",
    landmark: "Pari Chowk Roundabout, near Metro Pillar 14",
    longitude: 77.5036,
    latitude: 28.4732,
    reportedAt: "3 hours ago",
    time: "3h ago",
    hoursAgo: 3,
    severity: "high",
    status: "in-progress",
    statusLabel: "Work Assigned",
    votes: 22,
    verificationsCount: 22,
    coordinates: "28.5933° N, 77.4278° E",
    authority: "GNIDA PWD Roads Wing",
    officialRouting: "GNIDA PWD Roads Wing",
    description:
      "Craters measuring roughly 1.5m diameter and 12cm depth directly after the roundabout. Two-wheelers frequently swerve into oncoming traffic.",
  },
  {
    id: "R-2039",
    title: "Street light out — 6 consecutive poles",
    category: "lighting",
    categoryLabel: "Lighting & Signals",
    location: "Knowledge Park III",
    landmark: "Knowledge Park III corridor, opp. Sharda University Gate 3",
    longitude: 77.4891,
    latitude: 28.4612,
    reportedAt: "5 hours ago",
    time: "5h ago",
    hoursAgo: 5,
    severity: "medium",
    status: "open",
    statusLabel: "Authority Notified",
    votes: 9,
    verificationsCount: 28,
    coordinates: "28.4619° N, 77.4952° E",
    authority: "Electrical Engineering Dept, GNIDA",
    officialRouting: "GNIDA Electrical & Lighting Wing",
    description:
      "All overhead sodium fixtures non-functional for 250m; high pedestrian footfall from student hostels facing unsafe dark conditions.",
  },
  {
    id: "R-2038",
    title: "Unsafe pedestrian crossing at metro exit",
    category: "crossing",
    categoryLabel: "Unsafe Crossing",
    location: "Pari Chowk Metro",
    landmark: "Sector Alpha II Commercial Belt intersection",
    longitude: 77.5185,
    latitude: 28.4795,
    reportedAt: "7 hours ago",
    time: "7h ago",
    hoursAgo: 7,
    severity: "high",
    status: "escalated",
    statusLabel: "Formal Grievance Filed",
    votes: 31,
    verificationsCount: 19,
    coordinates: "28.4674° N, 77.5140° E",
    authority: "Traffic Police Directorate & GNIDA",
    officialRouting: "Noida-Greater Noida Traffic Police",
    description:
      "Vehicles speed through the pelican light phase while commuters exit Gate 2. Lack of speed breaker or active traffic marshal.",
  },
  {
    id: "R-2037",
    title: "Overgrown median obstructing right-turn visibility",
    category: "road-surface",
    categoryLabel: "Visibility Hazard",
    location: "Beta I Sector Road",
    landmark: "Opposite Sector Beta I Community Center",
    longitude: 77.5098,
    latitude: 28.4712,
    reportedAt: "12 hours ago",
    time: "12h ago",
    hoursAgo: 12,
    severity: "low",
    status: "in-progress",
    statusLabel: "In Progress",
    votes: 7,
    verificationsCount: 7,
    coordinates: "28.4712° N, 77.5098° E",
    authority: "GNIDA Horticulture Division",
    officialRouting: "GNIDA Horticulture Division",
    description:
      "Shrub branches extend into fast lane, blocking line-of-sight for turning cars at un-signaled gap.",
  },
  {
    id: "R-2036",
    title: "Missing storm drain grate near school gate",
    category: "drainage",
    categoryLabel: "Drainage Hazard",
    location: "Delta I, Near Primary School",
    landmark: "Surajpur-Kasna Link Road, near Delta I Fuel Station",
    longitude: 77.526,
    latitude: 28.4905,
    reportedAt: "1 day ago",
    time: "1d ago",
    hoursAgo: 24,
    severity: "high",
    status: "resolved",
    statusLabel: "Action Logged & Fixed",
    votes: 43,
    verificationsCount: 18,
    coordinates: "28.4905° N, 77.5260° E",
    authority: "Greater Noida Water & Drainage Dept",
    officialRouting: "GNIDA Water & Drainage Maintenance",
    description:
      "Cast iron cover removed; immediate danger for children during afternoon dispersal. Municipal team positioned steel grate and concrete collar.",
  },
];

export const SAMPLE_MODERATION_QUEUE: ModerationQueueItem[] = [
  {
    id: "R-2041",
    title: "Broken footpath near Alpha II roundabout",
    type: "duplicate",
    flagLabel: "Potential Duplicate",
    detail:
      "Matches report R-2029 filed 3 weeks ago with 92% GPS proximity and similar photo vector.",
    reporter: "Citizen (Commuter)",
    time: "2 hours ago",
    badgeVariant: "secondary",
    iconName: "copy",
    status: "pending",
  },
  {
    id: "R-2039",
    title: "Street light out — 6 consecutive poles",
    type: "location",
    flagLabel: "Unclear Location",
    detail:
      "GPS coordinates place the pin within a private commercial tech-park boundary rather than public roadway.",
    reporter: "Student (Hostel Resident)",
    time: "5 hours ago",
    badgeVariant: "destructive",
    iconName: "map-off",
    status: "pending",
  },
  {
    id: "R-2037",
    title: "Overgrown median obstructing right-turn visibility",
    type: "duplicate",
    flagLabel: "Potential Duplicate",
    detail:
      "Report R-2031 is currently marked In-Progress with GNIDA Horticulture Division for this sector.",
    reporter: "Delivery Partner",
    time: "12 hours ago",
    badgeVariant: "secondary",
    iconName: "copy",
    status: "pending",
  },
  {
    id: "R-2035",
    title: "Open manhole cover near government primary school",
    type: "duplicate",
    flagLabel: "High Urgency & Duplicate Check",
    detail:
      "Critical severity report matching existing open ticket R-2020. Needs immediate escalation consolidation.",
    reporter: "School Teacher",
    time: "1 day ago",
    badgeVariant: "destructive",
    iconName: "alert",
    status: "pending",
  },
  {
    id: "R-2034",
    title: "Encroached walkway forcing pedestrians into traffic",
    type: "location",
    flagLabel: "Missing Geotag",
    detail:
      "Manual address submitted without precise GPS coordinates. Curator verification needed on satellite layer.",
    reporter: "Local Resident",
    time: "2 days ago",
    badgeVariant: "secondary",
    iconName: "map-off",
    status: "pending",
  },
];

export const SAMPLE_ESCALATIONS: EscalationDocket[] = [
  {
    id: "E-019",
    title: "Pari Chowk crossing — repeated pedestrian near-miss incidents",
    summary:
      "Multiple citizens recorded vehicles running the red phase at the Pari Chowk Metro pedestrian exit. Formal representation submitted to GNIDA Traffic Management cell.",
    authority: "GNIDA Traffic Dept.",
    officer: "Er. V. Sharma (Executive Engineer)",
    status: "awaiting-response",
    statusLabel: "Awaiting Formal Response",
    statusVariant: "destructive",
    daysOpen: 12,
    linkedReports: 8,
    lastUpdate: "Oct 19, 2026 — Grievance ID #GNIDA-2026-9041 registered",
    originReportId: "R-2038",
  },
  {
    id: "E-018",
    title: "Alpha I commercial market — long-standing pothole cluster",
    summary:
      "Cluster of 4 structural asphalt craters near Gate #2 of Alpha I market reported across 3 months without contractor remediation. Escalated to PWD.",
    authority: "GNIDA Public Works Dept (PWD)",
    officer: "Er. K. Singh (Superintendent Engineer)",
    status: "acknowledged",
    statusLabel: "Work Order Pending",
    statusVariant: "secondary",
    daysOpen: 21,
    linkedReports: 11,
    lastUpdate: "Oct 15, 2026 — PWD inspection team visited site for measurement",
    originReportId: "R-2015",
  },
  {
    id: "E-017",
    title: "Broken storm drain slab — monsoon foot-traffic collapse risk",
    summary:
      "Cracked concrete drain cover over 8-foot open stormwater culvert outside Senior Secondary School. Escalated following citizen safety hazard petition.",
    authority: "Greater Noida Municipality Drainage Cell",
    officer: "Municipal Sanitary Inspector",
    status: "in-progress",
    statusLabel: "Inspection Scheduled",
    statusVariant: "default",
    daysOpen: 8,
    linkedReports: 4,
    lastUpdate: "Oct 21, 2026 — Barricading deployed by emergency civic crew",
    originReportId: "R-2033",
  },
];

export const SAMPLE_CIVIC_ANALYTICS: CivicAnalytics = {
  kpis: {
    totalReports: 178,
    resolvedCount: 89,
    resolvedRate: 50.0,
    meanResolutionDays: 4.2,
    activeReporters: 312,
  },
  monthlyTrends: [
    { month: "May", filed: 18, resolved: 12 },
    { month: "Jun", filed: 24, resolved: 17 },
    { month: "Jul", filed: 31, resolved: 19 },
    { month: "Aug", filed: 28, resolved: 22 },
    { month: "Sep", filed: 35, resolved: 26 },
    { month: "Oct", filed: 42, resolved: 29 },
  ],
  categoryDistribution: [
    { label: "Road Damage & Potholes", count: 47, pct: 33 },
    { label: "Broken Footpaths & Pavements", count: 31, pct: 22 },
    { label: "Street Lighting & Darkness Hazards", count: 27, pct: 19 },
    { label: "Pedestrian Crossings & Signals", count: 22, pct: 15 },
    { label: "Drainage, Barricades & Other", count: 15, pct: 11 },
  ],
  sectorDistribution: [
    { sector: "Alpha I & II Sectors", count: 34, pct: 19 },
    { sector: "Knowledge Park (I, II, III)", count: 28, pct: 16 },
    { sector: "Greater Noida West Corridor", count: 24, pct: 13 },
    { sector: "Sector Beta (I & II)", count: 19, pct: 11 },
    { sector: "Sector Gamma", count: 14, pct: 8 },
    { sector: "Pari Chowk Junction Zone", count: 11, pct: 6 },
    { sector: "Delta & Surajpur Industrial", count: 8, pct: 5 },
  ],
};

// Aliases for backward-compatibility with earlier imports:
export const RECENT_HAZARDS = SAMPLE_HAZARDS;
