import React from "react";
import { FileText, Download, Printer, ShieldAlert, CheckCircle, Flame, Building } from "lucide-react";
import { WardSummaryItem } from "../services/api";
import { SeverityBadge } from "../components/common/SeverityBadge";

interface Props {
  wards: WardSummaryItem[];
}

export const ReportsPage: React.FC<Props> = ({ wards }) => {
  const criticalCount = wards.filter((w) => w.priorityLevel === "Critical").length;
  const highCount = wards.filter((w) => w.priorityLevel === "High").length;
  const totalPop = wards.reduce((acc, w) => acc + w.population, 0);

  // Intervention frequency counter
  const interventionCounts: Record<string, number> = {};
  wards.forEach((w) => {
    interventionCounts[w.primaryMitigation] = (interventionCounts[w.primaryMitigation] || 0) + 1;
  });

  const sortedInterventions = Object.entries(interventionCounts).sort((a, b) => b[1] - a[1]);

  const handleExportJSON = () => {
    const reportData = {
      project: "Urban Heat Mitigation Decision Support System",
      stage: "B.Tech Project-II Prototype",
      location: "Nagpur, Maharashtra, India",
      generatedAt: new Date().toISOString(),
      summary: {
        totalWardsAnalyzed: wards.length,
        criticalHotspotsCount: criticalCount,
        highPriorityCount: highCount,
        totalPopulationCovered: totalPop
      },
      topInterventionTypes: sortedInterventions.map(([name, count]) => ({ name, wardsAssigned: count })),
      wardAnalysis: wards.map((w) => ({
        id: w.id,
        name: w.name,
        zone: w.zone,
        prabhagNo: w.prabhagNo,
        surfaceTemperatureCelsius: w.metrics.surfaceTemperature,
        ndvi: w.metrics.ndvi,
        builtUpPercentage: w.metrics.builtUpPercentage,
        populationDensity: w.populationDensity,
        heatSeverityScore: w.heatSeverityScore,
        vulnerabilityScore: w.vulnerabilityScore,
        priorityScore: w.priorityScore,
        priorityLevel: w.priorityLevel,
        primaryRecommendedIntervention: w.primaryMitigation
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Nagpur_Urban_Heat_Mitigation_Report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = [
      "Ward ID",
      "Ward Name",
      "Zone",
      "Prabhag No",
      "LST (°C)",
      "NDVI",
      "Built-up %",
      "Population Density (/km²)",
      "Severity Score",
      "Vulnerability Score",
      "Priority Score",
      "Priority Level",
      "Primary Mitigation"
    ];

    const rows = wards.map((w) => [
      `"${w.id}"`,
      `"${w.name}"`,
      `"${w.zone}"`,
      w.prabhagNo,
      w.metrics.surfaceTemperature,
      w.metrics.ndvi,
      w.metrics.builtUpPercentage,
      w.populationDensity,
      w.heatSeverityScore,
      w.vulnerabilityScore,
      w.priorityScore,
      `"${w.priorityLevel}"`,
      `"${w.primaryMitigation}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Nagpur_Heat_Wards_Priorities_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header & Export CTAs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", color: "var(--text-title)", display: "flex", alignItems: "center", gap: "10px" }}>
            <FileText size={22} color="var(--gov-blue)" />
            Urban Heat Mitigation Decision-Support Executive Report
          </h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Comprehensive decision synthesis for municipal town planning, disaster mitigation authorities, and climate resilience officers.
          </p>
        </div>

        <div className="no-print" style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
            <Download size={14} /> Export CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportJSON}>
            <Download size={14} /> Export JSON
          </button>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            <Printer size={14} /> Print Report
          </button>
        </div>
      </div>

      {/* Executive Summary Card */}
      <div className="glass-card" style={{ borderTop: "4px solid var(--gov-blue)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>STUDY GEOGRAPHY</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-title)", marginTop: "2px" }}>Nagpur Municipal Area</div>
            <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>Maharashtra, India</div>
          </div>

          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>ANALYSIS ENGINE</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--gov-blue-dark)", marginTop: "2px" }}>Prototype Multi-Criteria DSS</div>
            <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>12 Wards Evaluated</div>
          </div>

          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>CRITICAL HEAT ISLANDS</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--sev-critical-text)", marginTop: "2px" }}>{criticalCount} Wards</div>
            <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>Immediate action recommended</div>
          </div>

          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>POPULATION AT RISK</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--sev-mod-text)", marginTop: "2px" }}>{totalPop.toLocaleString()}</div>
            <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>Cumulative municipal inhabitants</div>
          </div>
        </div>
      </div>

      {/* Top Intervention Allocation Breakdown */}
      <div className="glass-card">
        <h3 style={{ fontSize: "1.02rem", color: "var(--text-title)", marginBottom: "14px" }}>
          City-Wide Strategic Intervention Allocation
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {sortedInterventions.map(([name, count]) => (
            <div
              key={name}
              style={{
                background: "#ffffff",
                border: "1px solid var(--border-main)",
                borderRadius: "8px",
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "var(--text-title)" }}>{name}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Primary allocation</div>
              </div>
              <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--gov-blue-dark)" }}>
                {count} {count === 1 ? "ward" : "wards"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ward Decisions Breakdown Table */}
      <div className="glass-card" style={{ padding: "0px", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-main)" }}>
          <h3 style={{ fontSize: "1.02rem", color: "var(--text-title)" }}>Nagpur Ward Decision Support Action Schedule</h3>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Priority-ordered municipal wards with proxy thermal parameters and recommended engineering/nature-based mitigation.
          </p>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Ward Name</th>
              <th>Zone</th>
              <th>LST (°C)</th>
              <th>NDVI</th>
              <th>Built-up %</th>
              <th>Pop. Density</th>
              <th>Heat Severity</th>
              <th>Priority Score</th>
              <th>Primary Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {[...wards].sort((a, b) => b.priorityScore - a.priorityScore).map((w) => (
              <tr key={w.id}>
                <td>
                  <strong style={{ color: "var(--text-title)" }}>{w.name}</strong>
                </td>
                <td style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{w.zone}</td>
                <td>
                  <strong style={{ color: w.metrics.surfaceTemperature >= 42 ? "var(--sev-critical-text)" : "var(--sev-high-text)" }}>
                    {w.metrics.surfaceTemperature}°C
                  </strong>
                </td>
                <td>{w.metrics.ndvi}</td>
                <td>{w.metrics.builtUpPercentage}%</td>
                <td>{w.populationDensity.toLocaleString()}</td>
                <td>
                  <SeverityBadge level={w.heatSeverityLevel} score={w.heatSeverityScore} />
                </td>
                <td>
                  <SeverityBadge level={w.priorityLevel} score={w.priorityScore} />
                </td>
                <td>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--gov-blue-dark)",
                      fontWeight: 600,
                      background: "var(--gov-blue-light)",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      display: "inline-block"
                    }}
                  >
                    ★ {w.primaryMitigation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Official Prototype Attribution Note */}
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          textAlign: "center",
          padding: "16px",
          borderTop: "1px solid var(--border-main)"
        }}
      >
        Urban Heat Mitigation Decision Support System (Nagpur Prototype) • B.Tech Project-II • Data presented for algorithmic and conceptual demonstration. Operational Phase 2 will interface with ESA Sentinel-2, Landsat 9 TIRS, NASA ECOSTRESS, and Nagpur Smart City PostGIS servers.
      </div>
    </div>
  );
};
