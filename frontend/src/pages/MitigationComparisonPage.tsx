import React, { useEffect, useState } from "react";
import { ShieldAlert, BarChart3, Clock, Wrench, Layers, CheckCircle2, ArrowRight } from "lucide-react";
import { MitigationStrategy } from "../types";
import { fetchStrategies } from "../services/api";

interface Props {
  onSelectStrategyForScenario: (strategyId: string) => void;
}

export const MitigationComparisonPage: React.FC<Props> = ({ onSelectStrategyForScenario }) => {
  const [strategies, setStrategies] = useState<MitigationStrategy[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    fetchStrategies().then((data: MitigationStrategy[]) => {
      setStrategies(data);
      setLoading(false);
    });
  }, []);

  const filteredStrategies = strategies.filter((s) => {
    if (categoryFilter === "all") return true;
    return s.category.toLowerCase().includes(categoryFilter.toLowerCase());
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", color: "var(--text-title)", display: "flex", alignItems: "center", gap: "10px" }}>
            <ShieldAlert size={22} color="var(--gov-blue)" />
            Urban Heat Mitigation Strategy Catalog & Multi-Criteria Comparison
          </h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Comparative evaluation of 7 urban cooling measures across capital cost intensity, thermodynamic cooling potential, operational maintenance, and spatial suitability.
          </p>
        </div>

        {/* Filter buttons */}
        <div style={{ display: "flex", gap: "8px" }}>
          {["all", "Nature-Based", "Engineering/Albedo", "Urban Water"].map((cat) => (
            <button
              key={cat}
              className={`btn btn-sm ${categoryFilter.toLowerCase() === cat.toLowerCase() ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setCategoryFilter(cat.toLowerCase())}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Comparison: Cost vs Cooling Potential Grid */}
      <div className="glass-card">
        <h3 style={{ fontSize: "1.02rem", color: "var(--text-title)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <BarChart3 size={18} color="var(--gov-blue)" />
          Cooling Impact vs Unit Capital Cost Trade-off Matrix
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredStrategies.map((strat) => {
            const coolingWidth = (strat.coolingImpactCelsius / 3.5) * 100;
            const costNorm = Math.min(100, (strat.costPerUnitINR / 2500) * 100);

            return (
              <div
                key={strat.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--border-main)",
                  borderRadius: "8px",
                  padding: "14px 18px",
                  display: "grid",
                  gridTemplateColumns: "260px 1fr 1fr 140px",
                  gap: "20px",
                  alignItems: "center"
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "0.70rem",
                      padding: "3px 7px",
                      borderRadius: "4px",
                      background: "var(--gov-blue-light)",
                      color: "var(--gov-blue-dark)",
                      fontWeight: 600
                    }}
                  >
                    {strat.category}
                  </span>
                  <div style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text-title)", marginTop: "4px" }}>
                    {strat.name}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    Space Requirement: {strat.spaceRequirement}
                  </div>
                </div>

                {/* Cooling Impact Bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Cooling Potential:</span>
                    <strong style={{ color: "var(--gov-blue-dark)" }}>-{strat.coolingImpactCelsius}°C</strong>
                  </div>
                  <div className="metric-bar-bg">
                    <div
                      className="metric-bar-fill"
                      style={{ width: `${coolingWidth}%`, background: "var(--gov-blue)" }}
                    />
                  </div>
                </div>

                {/* Capital Cost Schedule */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Unit Cost:</span>
                    <strong style={{ color: "var(--sev-mod-text)" }}>₹{strat.costPerUnitINR.toLocaleString("en-IN")} {strat.costUnit}</strong>
                  </div>
                  <div className="metric-bar-bg">
                    <div
                      className="metric-bar-fill"
                      style={{ width: `${costNorm}%`, background: "var(--sev-mod-bar)" }}
                    />
                  </div>
                </div>

                {/* Action CTA */}
                <div style={{ textAlign: "right" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onSelectStrategyForScenario(strat.id)}
                  >
                    Simulate <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comprehensive Comparison Table */}
      <div className="glass-card" style={{ padding: "0px", overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Intervention Strategy</th>
              <th>Category</th>
              <th>Base Cooling</th>
              <th>Unit Cost (INR)</th>
              <th>Implementation Time</th>
              <th>Maintenance Level</th>
              <th>Space Requirement</th>
              <th>Suitable Typology</th>
            </tr>
          </thead>
          <tbody>
            {filteredStrategies.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong style={{ color: "var(--text-title)" }}>{s.name}</strong>
                </td>
                <td>
                  <span style={{ fontSize: "0.76rem", color: "var(--gov-blue-dark)", fontWeight: 500 }}>{s.category}</span>
                </td>
                <td>
                  <strong style={{ color: "var(--gov-blue-dark)" }}>-{s.coolingImpactCelsius}°C</strong>
                </td>
                <td>
                  <strong style={{ color: "var(--sev-mod-text)" }}>₹{s.costPerUnitINR.toLocaleString("en-IN")}</strong>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}> {s.costUnit}</span>
                </td>
                <td>{s.implementationTime}</td>
                <td>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      background: s.maintenanceLevel === "Low" ? "var(--sev-low-bg)" : s.maintenanceLevel === "High" ? "var(--sev-critical-bg)" : "var(--sev-mod-bg)",
                      color: s.maintenanceLevel === "Low" ? "var(--sev-low-text)" : s.maintenanceLevel === "High" ? "var(--sev-critical-text)" : "var(--sev-mod-text)",
                      border: `1px solid ${s.maintenanceLevel === "Low" ? "var(--sev-low-border)" : s.maintenanceLevel === "High" ? "var(--sev-critical-border)" : "var(--sev-mod-border)"}`
                    }}
                  >
                    {s.maintenanceLevel}
                  </span>
                </td>
                <td>{s.spaceRequirement}</td>
                <td>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {s.suitableFor.map((item: string, idx: number) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: "0.70rem",
                          background: "#f1f5f9",
                          border: "1px solid var(--border-main)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          color: "var(--text-secondary)"
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
