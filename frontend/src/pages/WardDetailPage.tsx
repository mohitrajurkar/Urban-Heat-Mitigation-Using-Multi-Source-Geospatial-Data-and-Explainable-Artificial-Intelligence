import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Thermometer,
  ShieldCheck,
  TreeDeciduous,
  Building,
  Users,
  Sun,
  Clock,
  Wrench,
  Sliders,
  CheckCircle2,
  FileText
} from "lucide-react";
import { DecisionResult, Recommendation, Ward } from "../types";
import { fetchWardAnalysis, fetchWardById } from "../services/api";
import { SeverityBadge } from "../components/common/SeverityBadge";

interface Props {
  wardId: string;
  onBack: () => void;
  onOpenScenario: (wardId: string, strategyId: string) => void;
  onOpenComparison: () => void;
}

export const WardDetailPage: React.FC<Props> = ({
  wardId,
  onBack,
  onOpenScenario,
  onOpenComparison
}) => {
  const [analysis, setAnalysis] = useState<DecisionResult | null>(null);
  const [ward, setWard] = useState<Ward | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([fetchWardById(wardId), fetchWardAnalysis(wardId)]).then(
      ([wardData, analysisData]) => {
        if (!isMounted) return;
        setWard(wardData);
        setAnalysis(analysisData);
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
    };
  }, [wardId]);

  if (loading) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <span className="pulse-dot" style={{ width: 12, height: 12, backgroundColor: "var(--gov-blue)" }} />
        <div style={{ marginTop: "14px", color: "var(--text-muted)", fontSize: "0.88rem" }}>
          Loading municipal ward telemetry and computing recommendation scores...
        </div>
      </div>
    );
  }

  if (!analysis || !ward) {
    return (
      <div className="glass-card" style={{ textAlign: "center", padding: "40px" }}>
        <h3>Ward records not found.</h3>
        <button className="btn btn-primary" style={{ marginTop: "16px" }} onClick={onBack}>
          ← Return to Inventory
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Ward List
        </button>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-secondary btn-sm" onClick={onOpenComparison}>
            Compare Catalog
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onOpenScenario(ward.id, analysis.recommendations[0]?.strategy.id || "cool-roofs")}
          >
            <Sliders size={13} /> Run What-If Scenario
          </button>
        </div>
      </div>

      {/* Ward Header Card */}
      <div className="glass-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--gov-blue)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Municipal Ward Environmental Dossier
            </div>
            <h1 style={{ fontSize: "1.5rem", marginTop: "2px" }}>
              {ward.name}
            </h1>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "3px" }}>
              {ward.zone} • Prabhag #{ward.prabhagNo} • Area: {ward.areaKm2} km² • Total Population: {ward.population.toLocaleString()}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ background: "#f8fafc", padding: "8px 14px", borderRadius: "6px", border: "1px solid var(--border-main)", textAlign: "center" }}>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "3px" }}>HEAT SEVERITY</div>
              <SeverityBadge level={analysis.heatSeverity.level} score={analysis.heatSeverity.score} />
            </div>

            <div style={{ background: "#f8fafc", padding: "8px 14px", borderRadius: "6px", border: "1px solid var(--border-main)", textAlign: "center" }}>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "3px" }}>VULNERABILITY</div>
              <SeverityBadge level={analysis.vulnerability.level} score={analysis.vulnerability.score} />
            </div>

            <div style={{ background: "#f8fafc", padding: "8px 14px", borderRadius: "6px", border: "1px solid var(--border-main)", textAlign: "center" }}>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "3px" }}>PRIORITY SCORE</div>
              <SeverityBadge level={analysis.priority.level} score={analysis.priority.score} />
            </div>
          </div>
        </div>
      </div>

      {/* Environmental & Spatial Telemetry Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px" }}>
        <div className="glass-card" style={{ padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#b91c1c" }}>
            <Thermometer size={16} />
            <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)" }}>Surface Temp (LST)</span>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--text-title)", marginTop: "6px" }}>
            {ward.metrics.surfaceTemperature}°C
          </div>
          <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Thermal baseline</div>
        </div>

        <div className="glass-card" style={{ padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#15803d" }}>
            <TreeDeciduous size={16} />
            <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)" }}>Vegetation (NDVI)</span>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--text-title)", marginTop: "6px" }}>
            {ward.metrics.ndvi}
          </div>
          <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Canopy density index</div>
        </div>

        <div className="glass-card" style={{ padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#c2410c" }}>
            <Building size={16} />
            <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)" }}>Built-up Coverage</span>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--text-title)", marginTop: "6px" }}>
            {ward.metrics.builtUpPercentage}%
          </div>
          <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Impervious surface</div>
        </div>

        <div className="glass-card" style={{ padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#a16207" }}>
            <Sun size={16} />
            <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)" }}>Surface Albedo</span>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--text-title)", marginTop: "6px" }}>
            {ward.metrics.albedo}
          </div>
          <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Solar reflectance</div>
        </div>

        <div className="glass-card" style={{ padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--gov-blue)" }}>
            <Users size={16} />
            <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)" }}>Population Density</span>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--text-title)", marginTop: "6px" }}>
            {ward.populationDensity.toLocaleString()}
          </div>
          <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Per sq. kilometer</div>
        </div>
      </div>

      {/* Dynamic XAI Section: "Why is this ward high priority?" */}
      <div
        className="glass-card"
        style={{
          borderLeft: "4px solid var(--gov-blue)",
          background: "#ffffff"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <FileText size={18} color="var(--gov-blue)" />
          <h3 style={{ fontSize: "1.05rem" }}>
            Explainable Decision Factors (Multi-Criteria Attribution)
          </h3>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "0.80rem", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 500 }}>
              Primary contributing environmental and demographic drivers:
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "7px" }}>
              {analysis.explainableFactors.whyHighPriority.map((point: string, idx: number) => (
                <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "0.84rem", color: "var(--text-main)" }}>
                  <CheckCircle2 size={15} color="#0f766e" style={{ flexShrink: 0, marginTop: "3px" }} />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            style={{
              background: "#f8fafc",
              borderRadius: "6px",
              padding: "14px",
              border: "1px solid var(--border-main)",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}
          >
            <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--gov-blue-dark)", textTransform: "uppercase" }}>
              Synthesis Decision Rationale:
            </div>
            <div style={{ fontSize: "0.84rem", color: "var(--text-main)", fontStyle: "italic", lineHeight: 1.5 }}>
              "{analysis.priority.reason}"
            </div>
            <div style={{ fontSize: "0.78rem", color: "#0369a1", marginTop: "4px", background: "#f0f9ff", padding: "6px 8px", borderRadius: "4px" }}>
              <strong>Mitigation Alignment:</strong> {analysis.explainableFactors.whyStrategyRecommended}
            </div>
            <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", marginTop: "auto", borderTop: "1px solid var(--border-main)", paddingTop: "6px" }}>
              ℹ️ {analysis.explainableFactors.shapPlaceholderNote}
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Mitigation Strategies Section */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "12px" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <ShieldCheck size={18} color="var(--gov-blue)" />
              Recommended Mitigation Measures (Top 3 Interventions)
            </h3>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
              Ranked via multi-criteria suitability: Cooling Benefit (35%) + Urgency (30%) + Feasibility (25%) - Cost Factor (10%).
            </p>
          </div>
          <span style={{ fontSize: "0.72rem", color: "#92400e", background: "#fef9c3", padding: "3px 8px", borderRadius: "4px", border: "1px solid #fde047" }}>
            Prototype estimates — based on normative municipal schedules.
          </span>
        </div>

        <div className="rec-cards-grid">
          {analysis.recommendations.map((rec: Recommendation, index: number) => (
            <div key={rec.strategy.id} className="rec-card">
              <div className="rec-card-rank">#{index + 1}</div>

              <div>
                <span
                  style={{
                    fontSize: "0.70rem",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    background: "#f0f9ff",
                    color: "var(--gov-blue-dark)",
                    border: "1px solid #bae6fd",
                    fontWeight: 600
                  }}
                >
                  {rec.strategy.category}
                </span>
                <h4 style={{ fontSize: "1.05rem", marginTop: "6px" }}>
                  {rec.strategy.name}
                </h4>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4 }}>
                  {rec.strategy.description}
                </p>
              </div>

              {/* Suitability Meter */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", marginBottom: "3px" }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Suitability Index:</span>
                  <strong style={{ color: "var(--gov-blue-dark)" }}>{rec.suitabilityScore} / 100</strong>
                </div>
                <div className="metric-bar-bg">
                  <div
                    className="metric-bar-fill"
                    style={{
                      width: `${rec.suitabilityScore}%`,
                      background: "#0284c7"
                    }}
                  />
                </div>
              </div>

              {/* Key Estimates Grid */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border-main)",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  fontSize: "0.78rem"
                }}
              >
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>ESTIMATED COST</div>
                  <strong style={{ color: "var(--text-title)", fontSize: "0.95rem" }}>{rec.estimatedCostFormatted}</strong>
                  <div style={{ fontSize: "0.66rem", color: "var(--text-dim)" }}>Prototype estimate</div>
                </div>

                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>COOLING POTENTIAL</div>
                  <strong style={{ color: "#0369a1", fontSize: "0.95rem" }}>-{rec.expectedCoolingDrop}°C</strong>
                  <div style={{ fontSize: "0.66rem", color: "var(--text-dim)" }}>Ambient drop</div>
                </div>

                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>TIMEFRAME</div>
                  <strong style={{ color: "var(--text-main)" }}>{rec.implementationTime}</strong>
                </div>

                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>MAINTENANCE</div>
                  <strong style={{ color: "var(--text-main)" }}>{rec.maintenanceLevel}</strong>
                </div>
              </div>

              {/* Recommendation Reason */}
              <div style={{ fontSize: "0.78rem", color: "var(--text-main)", background: "#f8fafc", padding: "8px 10px", borderRadius: "5px", border: "1px solid var(--border-main)" }}>
                <strong style={{ color: "var(--gov-blue-dark)" }}>Suitability Basis: </strong>
                {rec.reason}
              </div>

              <div style={{ marginTop: "auto" }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: "100%" }}
                  onClick={() => onOpenScenario(ward.id, rec.strategy.id)}
                >
                  <Sliders size={13} /> Simulate in Scenario Analysis
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
