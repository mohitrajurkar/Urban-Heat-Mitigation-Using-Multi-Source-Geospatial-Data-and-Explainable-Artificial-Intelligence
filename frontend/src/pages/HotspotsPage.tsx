import React, { useState } from "react";
import { Flame, Filter, Search, ArrowRight, Thermometer, ShieldAlert } from "lucide-react";
import { WardSummaryItem } from "../services/api";
import { SeverityBadge } from "../components/common/SeverityBadge";

interface Props {
  wards: WardSummaryItem[];
  onSelectWard: (wardId: string) => void;
}

export const HotspotsPage: React.FC<Props> = ({ wards, onSelectWard }) => {
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredWards = wards.filter((w) => {
    const matchesFilter = filterLevel === "all" || w.priorityLevel.toLowerCase() === filterLevel.toLowerCase();
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.zone.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  filteredWards.sort((a, b) => b.priorityScore - a.priorityScore);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header & Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <Flame size={20} color="#dc2626" />
            Urban Heat Hotspot Inventory & Ward Priority Matrix
          </h2>
          <p style={{ fontSize: "0.80rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Prioritized municipal wards ranked by composite environmental severity (40% Temp, 20% Built-up, 20% Veg Deficit) and demographic vulnerability.
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Search Input */}
          <div style={{ position: "relative" }}>
            <Search size={14} color="#64748b" style={{ position: "absolute", left: "10px", top: "9px" }} />
            <input
              type="text"
              placeholder="Search ward or zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "#ffffff",
                border: "1px solid var(--border-dark)",
                borderRadius: "6px",
                padding: "6px 12px 6px 30px",
                color: "var(--text-title)",
                fontSize: "0.82rem",
                outline: "none",
                width: "190px"
              }}
            />
          </div>

          {/* Level Filter */}
          <div style={{ display: "flex", gap: "4px" }}>
            {["all", "Critical", "High", "Moderate", "Low"].map((lvl) => (
              <button
                key={lvl}
                className={`btn btn-sm ${filterLevel.toLowerCase() === lvl.toLowerCase() ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setFilterLevel(lvl.toLowerCase())}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hotspot Table */}
      <div className="glass-card" style={{ padding: "0px", overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>#</th>
              <th>Municipal Ward & Zone</th>
              <th>Surface Temp (LST)</th>
              <th>NDVI</th>
              <th>Built-up %</th>
              <th>Heat Severity</th>
              <th>Vulnerability</th>
              <th>Priority Score</th>
              <th>Primary Recommendation</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredWards.map((w, index) => (
              <tr key={w.id}>
                <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>{index + 1}</td>
                <td>
                  <div style={{ fontWeight: 600, color: "var(--text-title)" }}>{w.name}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{w.zone}</div>
                </td>
                <td>
                  <span style={{ color: w.metrics.surfaceTemperature >= 42 ? "#b91c1c" : "#c2410c", fontWeight: 700 }}>
                    {w.metrics.surfaceTemperature}°C
                  </span>
                </td>
                <td>
                  <span style={{ color: w.metrics.ndvi < 0.18 ? "#b91c1c" : "#15803d", fontWeight: 600 }}>
                    {w.metrics.ndvi}
                  </span>
                </td>
                <td>{w.metrics.builtUpPercentage}%</td>
                <td>
                  <SeverityBadge level={w.heatSeverityLevel} score={w.heatSeverityScore} />
                </td>
                <td>
                  <SeverityBadge level={w.vulnerabilityLevel} score={w.vulnerabilityScore} />
                </td>
                <td>
                  <SeverityBadge level={w.priorityLevel} score={w.priorityScore} />
                </td>
                <td>
                  <span style={{ fontSize: "0.78rem", color: "var(--gov-blue-dark)", fontWeight: 600 }}>
                    ★ {w.primaryMitigation}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onSelectWard(w.id)}
                    style={{ padding: "4px 9px", fontSize: "0.74rem" }}
                  >
                    Analyze <ArrowRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
