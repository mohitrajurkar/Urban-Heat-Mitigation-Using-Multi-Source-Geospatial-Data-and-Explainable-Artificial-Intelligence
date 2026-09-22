import React from "react";
import { Search, Sun, MapPin, Database, Server } from "lucide-react";
import { DataSourceMode } from "../../services/api";

interface Props {
  dataSource: DataSourceMode;
  selectedCity?: string;
  onSelectCity?: (cityId: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const Header: React.FC<Props> = ({
  dataSource,
  selectedCity = "nagpur",
  onSelectCity,
  searchQuery = "",
  onSearchChange
}) => {
  return (
    <header
      style={{
        padding: "16px 28px",
        background: "#ffffff",
        borderBottom: "1px solid var(--border-main)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 40,
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        flexWrap: "wrap",
        gap: "16px"
      }}
    >
      {/* Title & Subtitle */}
      <div>
        <h1 style={{ fontSize: "1.28rem", fontWeight: 700, color: "var(--text-title)", letterSpacing: "-0.015em" }}>
          Urban Heat Mitigation Decision Support System
        </h1>
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
          Geospatial Analysis • Heat Risk Assessment • Mitigation Planning
        </p>
      </div>

      {/* Right Controls: Search, City Selector, Weather, Profile Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Search Bar */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center"
          }}
        >
          <Search size={15} color="var(--text-muted)" style={{ position: "absolute", left: "11px" }} />
          <input
            type="text"
            placeholder="Search ward, area or location..."
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            style={{
              padding: "7px 12px 7px 32px",
              borderRadius: "6px",
              border: "1px solid var(--border-main)",
              background: "#f8fafc",
              fontSize: "0.82rem",
              color: "var(--text-main)",
              width: "230px",
              outline: "none"
            }}
          />
        </div>

        {/* Generic Location City Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "#f8fafc", border: "1px solid var(--border-main)", padding: "5px 10px", borderRadius: "6px" }}>
          <MapPin size={14} color="var(--gov-blue)" />
          <select
            value={selectedCity}
            onChange={(e) => onSelectCity && onSelectCity(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "0.80rem",
              fontWeight: 600,
              color: "var(--text-title)",
              cursor: "pointer",
              outline: "none"
            }}
          >
            <option value="nagpur">Nagpur (Prototype)</option>
            <option value="mumbai">Mumbai (Future)</option>
            <option value="pune">Pune (Future)</option>
            <option value="delhi">Delhi (Future)</option>
            <option value="bengaluru">Bengaluru (Future)</option>
            <option value="hyderabad">Hyderabad (Future)</option>
            <option value="ahmedabad">Ahmedabad (Future)</option>
          </select>
        </div>

        {/* Weather Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "#fffbeb",
            border: "1px solid #fef3c7",
            padding: "5px 10px",
            borderRadius: "6px",
            fontSize: "0.78rem",
            color: "#92400e",
            fontWeight: 600
          }}
        >
          <Sun size={15} color="#eab308" />
          <span>32°C Clear Sky</span>
        </div>

        {/* User Profile Avatar */}
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "#0f2942",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "0.82rem"
          }}
          title="Town Planning Officer"
        >
          M
        </div>
      </div>
    </header>
  );
};
