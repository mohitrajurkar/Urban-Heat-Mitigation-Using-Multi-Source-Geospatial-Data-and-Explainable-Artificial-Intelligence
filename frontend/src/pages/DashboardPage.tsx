import React from "react";
import {
  Map,
  Flame,
  Thermometer,
  Users,
  ArrowUpRight,
  TrendingUp
} from "lucide-react";
import { WardSummaryItem } from "../services/api";
import { UrbanHeatMap } from "../components/map/UrbanHeatMap";
import { GRID_CELLS } from "../data/gridCells";
import { GridCell } from "../types/index";

interface Props {
  wards: WardSummaryItem[];
  onSelectWard: (wardId: string) => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardPage: React.FC<Props> = ({
  wards,
  onSelectWard,
  onNavigateTab
}) => {
  // Top hotspot areas matching user's design
  const hotspotsList = [
    { rank: 1, name: "Sitabuldi", wardId: "ward-sitabuldi", lst: 46.2, severity: "Critical" },
    { rank: 2, name: "Dharampeth", wardId: "ward-dharampeth", lst: 44.8, severity: "Critical" },
    { rank: 3, name: "Lakadganj", wardId: "ward-lakadganj", lst: 44.1, severity: "High" },
    { rank: 4, name: "Sadar", wardId: "ward-sadar", lst: 43.9, severity: "High" },
    { rank: 5, name: "Nandanvan", wardId: "ward-nandanvan", lst: 43.6, severity: "High" }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* 4 Executive KPI Cards Grid Matching Mockup */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px"
        }}
      >
        {/* KPI 1: Wards Analyzed */}
        <div
          className="glass-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "18px 20px",
            background: "#ffffff"
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              background: "#e0f2fe",
              color: "#0284c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <Map size={22} />
          </div>
          <div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-title)", lineHeight: 1.1 }}>
              217
            </div>
            <div style={{ fontSize: "0.80rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              Wards Analyzed
            </div>
            <div style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: 600, marginTop: "2px" }}>
              ↑ 100%
            </div>
          </div>
        </div>

        {/* KPI 2: High Risk Zones */}
        <div
          className="glass-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "18px 20px",
            background: "#ffffff"
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              background: "#fee2e2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <Flame size={22} />
          </div>
          <div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-title)", lineHeight: 1.1 }}>
              28
            </div>
            <div style={{ fontSize: "0.80rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              High Risk Zones
            </div>
            <div style={{ fontSize: "0.72rem", color: "#dc2626", fontWeight: 600, marginTop: "2px" }}>
              ↑ 12%
            </div>
          </div>
        </div>

        {/* KPI 3: Average LST */}
        <div
          className="glass-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "18px 20px",
            background: "#ffffff"
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              background: "#ffedd5",
              color: "#ea580c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <Thermometer size={22} />
          </div>
          <div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-title)", lineHeight: 1.1 }}>
              36.8°C
            </div>
            <div style={{ fontSize: "0.80rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              Average LST
            </div>
            <div style={{ fontSize: "0.72rem", color: "#ea580c", fontWeight: 600, marginTop: "2px" }}>
              ↑ 1.4°C
            </div>
          </div>
        </div>

        {/* KPI 4: Population Covered */}
        <div
          className="glass-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "18px 20px",
            background: "#ffffff"
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              background: "#f0f9ff",
              color: "#0369a1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "var(--text-title)", lineHeight: 1.1 }}>
              24.6 L
            </div>
            <div style={{ fontSize: "0.80rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              Population Covered
            </div>
            <div style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: 600, marginTop: "2px" }}>
              ↑ 100%
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Map + Right Panels */}
      <div style={{ display: "grid", gridTemplateColumns: "2.1fr 1fr", gap: "20px", alignItems: "start" }}>
        {/* Central Map Card */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <div style={{ marginBottom: "12px" }}>
            <h2 style={{ fontSize: "1.12rem", fontWeight: 700, color: "var(--text-title)" }}>
              Urban Heat Distribution Map
            </h2>
            <p style={{ fontSize: "0.80rem", color: "var(--text-muted)", marginTop: "2px" }}>
              1 km × 1 km analysis resolution • Click an area to view details
            </p>
          </div>

          {/* 1 km x 1 km Raster Heat Map Component */}
          <UrbanHeatMap
            gridCells={GRID_CELLS}
            wards={wards}
            onSelectWard={onSelectWard}
            height="480px"
          />
        </div>

        {/* Right Column: Top Hotspot Areas + Quick Insights */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Top Hotspot Areas Panel */}
          <div className="glass-card" style={{ padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--text-title)" }}>
                Top Hotspot Areas
              </h3>
              <button
                onClick={() => onNavigateTab("hotspots")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#0284c7",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px"
                }}
              >
                View All <ArrowUpRight size={13} />
              </button>
            </div>

            {/* Table Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "26px 1fr 65px 65px",
                fontSize: "0.70rem",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                paddingBottom: "8px",
                borderBottom: "1px solid var(--border-main)"
              }}
            >
              <span>#</span>
              <span>Area</span>
              <span style={{ textAlign: "right" }}>LST (°C)</span>
              <span style={{ textAlign: "right" }}>Severity</span>
            </div>

            {/* Hotspots List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
              {hotspotsList.map((item) => (
                <div
                  key={item.rank}
                  onClick={() => onSelectWard(item.wardId)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "26px 1fr 65px 65px",
                    alignItems: "center",
                    cursor: "pointer",
                    padding: "4px 0",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: item.rank <= 2 ? "#dc2626" : "#ea580c",
                      color: "#ffffff",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {item.rank}
                  </span>

                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-title)" }}>
                    {item.name}
                  </span>

                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#dc2626", textAlign: "right" }}>
                    {item.lst}
                  </span>

                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "4px",
                        background: item.severity === "Critical" ? "#fee2e2" : "#ffedd5",
                        color: item.severity === "Critical" ? "#b91c1c" : "#c2410c"
                      }}
                    >
                      {item.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Insights Card Matching Mockup */}
          <div className="glass-card" style={{ padding: "18px" }}>
            <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--text-title)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp size={16} color="#0284c7" />
              Quick Insights
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.80rem", color: "var(--text-main)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#dc2626", marginTop: "5px", flexShrink: 0 }} />
                <span>Central city areas show highest heat intensity</span>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ea580c", marginTop: "5px", flexShrink: 0 }} />
                <span>Industrial and high built-up regions are major contributors</span>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a", marginTop: "5px", flexShrink: 0 }} />
                <span>Peripheral areas have relatively lower temperatures</span>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0284c7", marginTop: "5px", flexShrink: 0 }} />
                <span>Prioritize green infrastructure and cool roofs in high-risk zones</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
