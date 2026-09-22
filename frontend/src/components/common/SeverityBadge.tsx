import React from "react";
import { SeverityLevel } from "../../types";

interface Props {
  level: SeverityLevel | string;
  score?: number;
}

export const SeverityBadge: React.FC<Props> = ({ level, score }) => {
  const normalizedLevel = level.toLowerCase();
  let badgeClass = "badge-low";

  if (normalizedLevel === "critical") {
    badgeClass = "badge-critical";
  } else if (normalizedLevel === "high") {
    badgeClass = "badge-high";
  } else if (normalizedLevel === "moderate") {
    badgeClass = "badge-moderate";
  }

  return (
    <span className={`badge ${badgeClass}`}>
      <span className="pulse-dot" />
      {level} {score !== undefined ? `(${score})` : ""}
    </span>
  );
};
