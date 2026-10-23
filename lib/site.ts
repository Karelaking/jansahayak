export const siteConfig = {
  name: "JanSahayak",
  productName: "JanSahayak SafeStreets",
  description:
    "Document road-safety hazards, discover existing reports, and follow recorded civic updates in Greater Noida.",
  pilotArea: "Greater Noida, Uttar Pradesh",
  navigation: [
    { label: "Explore map", href: "#map" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Community impact", href: "#community" },
  ],
} as const;

export const hazardCategories = [
  { label: "Broken footpaths", context: "Walkability", icon: "path", tone: "coral" },
  { label: "Unsafe crossings", context: "Pedestrian safety", icon: "crossing", tone: "amber" },
  { label: "Poorly lit streets", context: "Visibility", icon: "light", tone: "sage" },
] as const;

export type HazardCategory = (typeof hazardCategories)[number];
export type HazardIconName = HazardCategory["icon"];
export type HazardTone = HazardCategory["tone"];
