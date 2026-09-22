import React, { useEffect, useState } from "react";
import {
  Sliders,
  DollarSign,
  Thermometer,
  Users,
  TrendingDown,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Info
} from "lucide-react";
import { ScenarioResult, Ward } from "../types";
import { runScenarioAnalysis, WardSummaryItem } from "../services/api";

interface Props {
  wards: WardSummaryItem[];
  initialWardId?: string;
  initialStrategyId?: string;
}

export const ScenarioAnalysisPage: React.FC<Props> = ({
  wards,
  initialWardId,
  initialStrategyId
}) => {
  const [selectedWardId, setSelectedWardId] = useState<string>(initialWardId || wards[0]?.id || "ward-gandhibagh");
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(initialStrategyId || "combined");
  const [coveragePercentage, setCoveragePercentage] = useState<number>(50);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const activeWard = wards.find((w) => w.id === selectedWardId) || wards[0];

  // Re-run simulation reactively whenever ward, strategy, or coverage changes
  useEffect(() => {
    if (!selectedWardId) return;

    let isMounted = true;
    setIsSimulating(true);

    runScenarioAnalysis({
      wardId: selectedWardId,
      strategyId: selectedStrategyId,
      coveragePercentage
    }).then((res: ScenarioResult | null) => {
      if (!isMounted) return;
      setResult(res);
      setIsSimulating(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedWardId, selectedStrategyId, coveragePercentage]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: "1.3rem", color: "var(--text-title)", display: "flex", alignItems: "center", gap: "10px" }}>
          <Sliders size={22} color="var(--gov-blue)" />
          What-If Scenario Simulation & Policy Impact Analysis
        </h2>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px" }}>
          Model thermodynamic cooling drop, municipal capital expenditure, beneficiary reach, and priority relief across varying target implementation coverages.
        </p>
      </div>

      {/* Control Configuration Panel */}
      <div className="glass-card">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.6fr", gap: "24px", alignItems: "center" }}>
          {/* Target Ward Selector */}
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              1. SELECT TARGET MUNICIPAL WARD
            </label>
            <select
              value={selectedWardId}
              onChange={(e) => setSelectedWardId(e.target.value)}
              style={{
                width: "100%",
                background: "#ffffff",
                border: "1px solid var(--border-dark)",
                borderRadius: "6px",
                padding: "10px 14px",
                color: "var(--text-title)",
                fontSize: "0.88rem",
                outline: "none"
              }}
            >
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} (LST: {w.metrics.surfaceTemperature}°C • {w.priorityLevel})
                </option>
              ))}
            </select>
          </div>

          {/* Strategy Selector */}
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              2. SELECT MITIGATION INTERVENTION
            </label>
            <select
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(e.target.value)}
              style={{
                width: "100%",
                background: "#ffffff",
                border: "1px solid var(--border-dark)",
                borderRadius: "6px",
                padding: "10px 14px",
                color: "var(--text-title)",
                fontSize: "0.88rem",
                outline: "none"
              }}
            >
              <option value="combined">Combined Multi-Intervention (Cool Roofs + Trees)</option>
              <option value="cool-roofs">Cool Roofs (Reflective Coating)</option>
              <option value="urban-tree-plantation">Urban Tree Plantation & Avenue Shading</option>
              <option value="green-roofs">Extensive Vegetated Green Roofs</option>
              <option value="urban-parks">Urban Pocket Parks & Micro-Forests</option>
              <option value="permeable-pavements">Permeable Pavements & Walkways</option>
              <option value="blue-infrastructure">Urban Water Retention & Mist Basins</option>
              <option value="reflective-roads">Reflective Road Coatings</option>
            </select>
          </div>

          {/* Coverage Slider */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                3. IMPLEMENTATION COVERAGE LEVEL
              </label>
              <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--gov-blue-dark)" }}>
                {coveragePercentage}% Coverage
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={coveragePercentage}
              onChange={(e) => setCoveragePercentage(Number(e.target.value))}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.70rem", color: "var(--text-muted)", marginTop: "4px" }}>
              <span>10% (Pilot)</span>
              <span>25%</span>
              <span>50% (Standard)</span>
              <span>75%</span>
              <span>100% (Full)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reactive Projected Outcomes KPI Cards */}
      {result && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "18px" }}>
          <div className="glass-card" style={{ borderLeft: "4px solid var(--sev-mod-bar)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--sev-mod-text)" }}>
              <DollarSign size={20} />
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>ESTIMATED CAPITAL COST</span>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-title)", marginTop: "8px" }}>
              {result.estimatedCostFormatted}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Prototype estimate based on {coveragePercentage}% target footprint
            </div>
          </div>

          <div className="glass-card" style={{ borderLeft: "4px solid var(--gov-blue)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--gov-blue)" }}>
              <Thermometer size={20} />
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>PROJECTED COOLING DROP</span>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--gov-blue-dark)", marginTop: "8px" }}>
              -{result.expectedCoolingCelsius}°C
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Ambient & surface microclimate reduction
            </div>
          </div>

          <div className="glass-card" style={{ borderLeft: "4px solid var(--sev-low-bar)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--sev-low-bar)" }}>
              <Users size={20} />
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>POPULATION BENEFITED</span>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-title)", marginTop: "8px" }}>
              {result.affectedPopulationBenefited.toLocaleString()}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Citizens within direct microclimate cooling radius
            </div>
          </div>

          <div className="glass-card" style={{ borderLeft: "4px solid var(--gov-teal)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--gov-teal)" }}>
              <TrendingDown size={20} />
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>PRIORITY REDUCTION</span>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--gov-teal)", marginTop: "8px" }}>
              -{result.priorityReductionPoints} pts
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
              {result.baselinePriorityScore} → {result.projectedPriorityScore} / 100
            </div>
          </div>
        </div>
      )}

      {/* Priority Score Shift Visualization & Co-benefits */}
      {result && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>
          {/* Priority Score Shift Bar Chart */}
          <div className="glass-card">
            <h3 style={{ fontSize: "1.02rem", color: "var(--text-title)", marginBottom: "16px" }}>
              Decision Priority Score Reduction (Before vs After)
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Baseline Priority (Current Status):</span>
                  <strong style={{ color: "var(--sev-critical-text)" }}>{result.baselinePriorityScore} / 100 (Critical)</strong>
                </div>
                <div className="metric-bar-bg" style={{ height: "12px" }}>
                  <div
                    className="metric-bar-fill"
                    style={{
                      width: `${result.baselinePriorityScore}%`,
                      background: "var(--sev-critical-bar)"
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Projected Priority ({coveragePercentage}% Intervention):</span>
                  <strong style={{ color: "var(--sev-low-text)" }}>{result.projectedPriorityScore} / 100 (Relieved)</strong>
                </div>
                <div className="metric-bar-bg" style={{ height: "12px" }}>
                  <div
                    className="metric-bar-fill"
                    style={{
                      width: `${result.projectedPriorityScore}%`,
                      background: "var(--sev-low-bar)"
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "20px",
                background: "var(--gov-blue-light)",
                border: "1px solid #bae6fd",
                borderRadius: "6px",
                padding: "12px 14px",
                fontSize: "0.82rem",
                color: "var(--text-main)",
                lineHeight: 1.5
              }}
            >
              Simulating <strong>{coveragePercentage}%</strong> deployment of <strong>{result.strategyName}</strong> across {activeWard.name} projects an ambient surface drop of <strong>{result.expectedCoolingCelsius}°C</strong>, reducing urgent heat hazard vulnerability for <strong>{result.affectedPopulationBenefited.toLocaleString()}</strong> residents.
            </div>
          </div>

          {/* Co-Benefits List */}
          <div className="glass-card">
            <h3 style={{ fontSize: "1.02rem", color: "var(--text-title)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={18} color="var(--gov-blue)" />
              Expected Environmental & Civic Co-Benefits
            </h3>

            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
              {result.coBenefits.map((benefit: string, idx: number) => (
                <li
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    fontSize: "0.85rem",
                    color: "var(--text-main)",
                    background: "#ffffff",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-main)"
                  }}
                >
                  <CheckCircle2 size={16} color="var(--sev-low-bar)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <div style={{ marginTop: "18px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
              Note: Simulative models utilize non-linear diminishing returns and thermal mass response curves. Real-world validation to follow in Phase 2.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
