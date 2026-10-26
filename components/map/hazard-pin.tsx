import type { HazardSeverity } from "@/lib/types/hazard";

interface HazardPinProps {
  severity: HazardSeverity;
  label?: string;
  isSelected?: boolean;
  status?: string;
  publicOpinionStatus?: string;
}

export function HazardPin({
  severity,
  isSelected = false,
  status,
  publicOpinionStatus,
}: HazardPinProps) {
  const isResolved = publicOpinionStatus === "community_resolved" || status === "resolved";
  const isUnderRepair =
    publicOpinionStatus === "under_repair" ||
    status === "under_review" ||
    status === "under-review";
  const isDisputed =
    publicOpinionStatus === "reopened_by_community" || publicOpinionStatus === "public_disputed";

  const colorMap: Record<
    HazardSeverity,
    { fill: string; border: string; ring: string; text: string }
  > = {
    critical: {
      fill: "#e4876f",
      border: "#8c2e1b",
      ring: "rgba(228, 135, 111, 0.4)",
      text: "#fff",
    },
    high: {
      fill: "#e4876f",
      border: "#8c2e1b",
      ring: "rgba(228, 135, 111, 0.4)",
      text: "#fff",
    },
    moderate: {
      fill: "#e7b64f",
      border: "#7a540b",
      ring: "rgba(231, 182, 79, 0.35)",
      text: "#17382f",
    },
    medium: {
      fill: "#e7b64f",
      border: "#7a540b",
      ring: "rgba(231, 182, 79, 0.35)",
      text: "#17382f",
    },
    minor: {
      fill: "#78a37d",
      border: "#234a29",
      ring: "rgba(120, 163, 125, 0.3)",
      text: "#fff",
    },
    low: {
      fill: "#78a37d",
      border: "#234a29",
      ring: "rgba(120, 163, 125, 0.3)",
      text: "#fff",
    },
  };

  const current = colorMap[severity] || colorMap.moderate;

  // Pin styling based on citizen consensus status
  const pinFill = isResolved
    ? "#327748"
    : isUnderRepair
      ? "#2b6cb0"
      : isDisputed
        ? "#c53030"
        : current.fill;

  const pinBorder = isResolved
    ? "#1c4a2b"
    : isUnderRepair
      ? "#1a365d"
      : isDisputed
        ? "#742a2a"
        : current.border;

  const pulseRingColor = isDisputed
    ? "rgba(197, 48, 48, 0.45)"
    : isUnderRepair
      ? "rgba(43, 108, 176, 0.35)"
      : current.ring;

  return (
    <div
      style={{
        position: "relative",
        width: "32px",
        height: "36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transform: isSelected ? "scale(1.2)" : "scale(1)",
        transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Pulse ring for critical hazards or active community disputes */}
      {(severity === "critical" || isDisputed) && (
        <div
          style={{
            position: "absolute",
            width: "38px",
            height: "38px",
            borderRadius: "50%",
            backgroundColor: pulseRingColor,
            animation: "pin-pulse 2s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* SVG Teardrop Pin */}
      <svg
        width="32"
        height="36"
        viewBox="0 0 32 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: "drop-shadow(0 4px 6px rgba(14, 43, 36, 0.25))",
        }}
      >
        <path
          d="M16 36C16 36 28 22.4 28 14C28 6.26801 22.6274 0 16 0C9.37258 0 4 6.26801 4 14C4 22.4 16 36 16 36Z"
          fill={pinFill}
          stroke={pinBorder}
          strokeWidth="1.5"
        />
        <circle cx="16" cy="14" r="7" fill="#ffffff" />

        {isResolved ? (
          /* Checkmark Glyph for Community Resolved */
          <path
            d="M13 14L15.2 16.5L19 11.5"
            stroke="#234a29"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : isUnderRepair ? (
          /* Tool/Wrench Dot for Under Repair */
          <circle cx="16" cy="14" r="4" fill="#2b6cb0" />
        ) : isDisputed ? (
          /* Exclamation Mark for Community Dispute */
          <>
            <path d="M16 10.5V13.8" stroke="#c53030" strokeWidth="2" strokeLinecap="round" />
            <circle cx="16" cy="16.5" r="1" fill="#c53030" />
          </>
        ) : (
          /* Standard Severity Dot */
          <circle cx="16" cy="14" r="4.5" fill={current.fill} />
        )}
      </svg>
    </div>
  );
}
