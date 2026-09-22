import React from "react";
import {
  LayoutDashboard,
  Map as MapIcon,
  Flame,
  ShieldCheck,
  Sliders,
  FileText,
  Building2,
  Landmark
} from "lucide-react";

export type NavTab = "dashboard" | "heatmap" | "hotspots" | "mitigation" | "scenario" | "reports" | "ward-detail";

interface Props {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  criticalCount: number;
}

export const Sidebar: React.FC<Props> = ({ activeTab, setActiveTab, criticalCount }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ fontSize: "1.12rem", fontWeight: 800, color: "var(--text-title)", letterSpacing: "-0.02em" }}>
            Urban Heat DSS
          </div>
          <div style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--gov-blue-dark)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            TOWARDS A COOLER AND HEALTHIER CITIES
          </div>
        </div>
      </div>

      <ul className="nav-links">
        <li>
          <button
            className={`nav-item-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <LayoutDashboard size={17} />
            <span>Dashboard</span>
          </button>
        </li>
        <li>
          <button
            className={`nav-item-btn ${activeTab === "heatmap" ? "active" : ""}`}
            onClick={() => setActiveTab("heatmap")}
          >
            <MapIcon size={17} />
            <span>Heat Map</span>
          </button>
        </li>
        <li>
          <button
            className={`nav-item-btn ${activeTab === "hotspots" ? "active" : ""}`}
            onClick={() => setActiveTab("hotspots")}
          >
            <Flame size={17} />
            <span>Hotspots</span>
            {criticalCount > 0 && <span className="nav-badge-count">{criticalCount}</span>}
          </button>
        </li>
        <li>
          <button
            className={`nav-item-btn ${activeTab === "mitigation" ? "active" : ""}`}
            onClick={() => setActiveTab("mitigation")}
          >
            <ShieldCheck size={17} />
            <span>Mitigation</span>
          </button>
        </li>
        <li>
          <button
            className={`nav-item-btn ${activeTab === "scenario" ? "active" : ""}`}
            onClick={() => setActiveTab("scenario")}
          >
            <Sliders size={17} />
            <span>Scenario Analysis</span>
          </button>
        </li>
        <li>
          <button
            className={`nav-item-btn ${activeTab === "reports" ? "active" : ""}`}
            onClick={() => setActiveTab("reports")}
          >
            <FileText size={17} />
            <span>Reports</span>
          </button>
        </li>
      </ul>

      <div className="sidebar-footer">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "6px 10px", borderRadius: "6px", color: "#166534", fontSize: "0.78rem", fontWeight: 600 }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          <span>Prototype Mode</span>
        </div>
      </div>
    </aside>
  );
};
