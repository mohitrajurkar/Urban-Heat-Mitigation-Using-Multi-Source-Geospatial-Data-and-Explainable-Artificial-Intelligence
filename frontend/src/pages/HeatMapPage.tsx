import React, { useState } from "react";
import { Layers, MapPin, Eye, ArrowRight, ShieldCheck, Thermometer } from "lucide-react";
import { WardSummaryItem } from "../services/api";
import { UrbanHeatMap } from "../components/map/UrbanHeatMap";
import { GRID_CELLS } from "../data/gridCells";
import { SeverityBadge } from "../components/common/SeverityBadge";

interface Props {
  wards: WardSummaryItem[];
  onSelectWard: (wardId: string) => void;
}

export const HeatMapPage: React.FC<Props> = ({ wards, onSelectWard }) => {
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>(wards[0]?.id || "");

  const activeWard = wards.find((w) => w.id === selectedPreviewId) || wards[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={20} color="var(--gov-blue)" />
            Urban Geospatial Heat & Vulnerability Map
          </h2>
          <p style={{ fontSize: "0.80rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Multi-criteria GIS spatial visualization on a 1 km × 1 km analysis resolution. Toggle thematic overlays to observe Land Surface Temperature anomalies, vegetation deficit, and population exposure. Click an area to view details.
          </p>
        </div>

        {/* Quick Ward Selector Dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "0.80rem", color: "var(--text-secondary)", fontWeight: 500 }}>Select Ward:</span>
          <select
            value={selectedPreviewId}
            onChange={(e) => setSelectedPreviewId(e.target.value)}
            style={{
              background: "#ffffff",
              border: "1px solid var(--border-dark)",
              color: "var(--text-title)",
              padding: "7px 12px",
              borderRadius: "6px",
              fontSize: "0.82rem",
              outline: "none"
            }}
          >
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.priorityLevel} - {w.priorityScore})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2.3fr 1fr", gap: "20px" }}>
        {/* Full Interactive Leaflet Map with 1 km x 1 km Grid */}
        <div className="glass-card" style={{ padding: "14px" }}>
          <UrbanHeatMap
            gridCells={GRID_CELLS}
            wards={wards}
            selectedWardId={selectedPreviewId}
            onSelectWard={(id: string) => {
              setSelectedPreviewId(id);
            }}
            height="620px"
          />
        </div>

        {/* Ward Inspector Sidebar */}
        <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {activeWard && (
            <>
              <div>
                <div style={{ fontSize: "0.70rem", color: "var(--gov-blue)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
                  Selected Administrative Ward
                </div>
                <h3 style={{ fontSize: "1.15rem", marginTop: "2px" }}>
                  {activeWard.name}
                </h3>
                <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  {activeWard.zone} • Prabhag #{activeWard.prabhagNo}
                </div>
              </div>

              {/* Priority & Severity Badges */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "3px" }}>PRIORITY</div>
                  <SeverityBadge level={activeWard.priorityLevel} score={activeWard.priorityScore} />
                </div>
                <div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "3px" }}>SEVERITY</div>
                  <SeverityBadge level={activeWard.heatSeverityLevel} score={activeWard.heatSeverityScore} />
                </div>
                <div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "3px" }}>VULNERABILITY</div>
                  <SeverityBadge level={activeWard.vulnerabilityLevel} score={activeWard.vulnerabilityScore} />
                </div>
              </div>

              {/* Telemetry Metrics */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border-main)",
                  borderRadius: "6px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.80rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Surface Temp (LST):</span>
                  <strong style={{ color: "#b91c1c" }}>{activeWard.metrics.surfaceTemperature}°C</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.80rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Canopy Index (NDVI):</span>
                  <strong style={{ color: "#15803d" }}>{activeWard.metrics.ndvi}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.80rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Built-up Coverage:</span>
                  <strong>{activeWard.metrics.builtUpPercentage}%</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.80rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Surface Albedo:</span>
                  <strong>{activeWard.metrics.albedo}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.80rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Population Density:</span>
                  <strong>{activeWard.populationDensity.toLocaleString()} / km²</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.80rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Total Ward Inhabitants:</span>
                  <strong>{activeWard.population.toLocaleString()}</strong>
                </div>
              </div>

              {/* Recommended Top Intervention Callout */}
              <div
                style={{
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  borderRadius: "6px",
                  padding: "11px",
                  fontSize: "0.78rem"
                }}
              >
                <div style={{ color: "var(--gov-blue-dark)", fontWeight: 600, marginBottom: "3px" }}>
                  ★ Recommended Mitigation Intervention:
                </div>
                <div style={{ color: "var(--text-title)", fontWeight: 700, fontSize: "0.88rem" }}>
                  {activeWard.primaryMitigation}
                </div>
              </div>

              {/* Action Button */}
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "auto" }}
                onClick={() => onSelectWard(activeWard.id)}
              >
                View Full Decision Analysis <ArrowRight size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
