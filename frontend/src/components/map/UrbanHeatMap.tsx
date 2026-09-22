import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { GridCell } from "../../types/index";
import { WardSummaryItem } from "../../services/api";
import { SmoothHeatLayer, MetricLayerType } from "./SmoothHeatLayer";
import {
  Layers,
  Thermometer,
  ShieldAlert,
  Trees,
  Building,
  Info,
  X,
  ArrowRight
} from "lucide-react";

interface Props {
  gridCells: GridCell[];
  wards?: WardSummaryItem[];
  selectedCellId?: string;
  selectedWardId?: string;
  onSelectCell?: (cell: GridCell) => void;
  onSelectWard?: (wardId: string) => void;
  height?: string;
}

export const UrbanHeatMap: React.FC<Props> = ({
  gridCells,
  wards = [],
  selectedCellId,
  selectedWardId,
  onSelectCell,
  onSelectWard,
  height = "500px"
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<SmoothHeatLayer | null>(null);
  const wardLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const selectionLayerRef = useRef<L.LayerGroup | null>(null);

  const [activeMetric, setActiveMetric] = useState<MetricLayerType>("severity");
  const [showWardsOverlay, setShowWardsOverlay] = useState<boolean>(false);
  const [inspectedCell, setInspectedCell] = useState<GridCell | null>(null);

  // Helper to find the underlying 1 km x 1 km analysis cell at any clicked coordinate
  const findCellAtLatLng = (lat: number, lng: number): GridCell | null => {
    // 1. Strict boundary check
    for (const cell of gridCells) {
      const [[s, w], [n, e]] = cell.bounds;
      if (lat >= s && lat <= n && lng >= w && lng <= e) {
        return cell;
      }
    }
    // 2. Nearest centroid within 1.2 km tolerance
    let closest: GridCell | null = null;
    let minDist = Infinity;
    for (const cell of gridCells) {
      const dist = Math.hypot((cell.latitude - lat) * 111.0, (cell.longitude - lng) * 103.5);
      if (dist < minDist) {
        minDist = dist;
        closest = cell;
      }
    }
    return minDist <= 1.4 ? closest : null;
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center on urban area
    const map = L.map(mapContainerRef.current, {
      center: [21.1458, 79.0882],
      zoom: 12,
      minZoom: 10,
      maxZoom: 16
    });

    // 1. Base map (roads, water bodies, urban blocks without labels)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(map);

    // Metric Scale Bar (bottom-left)
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

    // 2. Smooth Continuous Heat Layer (in overlayPane, max ~42% opacity)
    const smoothHeat = new SmoothHeatLayer(gridCells, { activeMetric });
    smoothHeat.addTo(map);
    heatLayerRef.current = smoothHeat;

    // 3. Crisp Top Labels Layer (pane z-index 650 so place names & roads are never obscured)
    if (!map.getPane("topLabelsPane")) {
      const topPane = map.createPane("topLabelsPane");
      topPane.style.zIndex = "650";
      topPane.style.pointerEvents = "none";
    }
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
      pane: "topLabelsPane",
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(map);

    // Selection layer for clicked cell highlight ring
    const selectionLayer = L.layerGroup().addTo(map);
    selectionLayerRef.current = selectionLayer;

    // Ward boundary overlay layer
    const wardLayer = L.layerGroup().addTo(map);
    wardLayerGroupRef.current = wardLayer;

    // Global map click handler: identifies underlying 1 km x 1 km cell
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const cell = findCellAtLatLng(lat, lng);
      if (cell) {
        setInspectedCell(cell);
        if (onSelectCell) onSelectCell(cell);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Smooth Heat Layer on metric or cells change
  useEffect(() => {
    if (heatLayerRef.current) {
      heatLayerRef.current.setCells(gridCells);
      heatLayerRef.current.setActiveMetric(activeMetric);
    }
  }, [gridCells, activeMetric]);

  // Update Visual Highlight Marker when a cell is selected/clicked
  useEffect(() => {
    if (!selectionLayerRef.current) return;
    const layer = selectionLayerRef.current;
    layer.clearLayers();

    const targetCell = inspectedCell || gridCells.find((c) => c.id === selectedCellId);
    if (targetCell) {
      // Draw subtle target marker and halo at the 1 km centroid
      const halo = L.circle([targetCell.latitude, targetCell.longitude], {
        radius: 480, // ~1 km diameter footprint
        color: "#0284c7",
        weight: 1.5,
        fillColor: "#0284c7",
        fillOpacity: 0.12,
        dashArray: "3, 4"
      });

      const centerDot = L.circleMarker([targetCell.latitude, targetCell.longitude], {
        radius: 4,
        color: "#ffffff",
        weight: 1.5,
        fillColor: "#0284c7",
        fillOpacity: 1.0
      });

      halo.addTo(layer);
      centerDot.addTo(layer);
    }
  }, [inspectedCell, selectedCellId, gridCells]);

  // Render Optional Administrative Ward Boundaries (if toggled)
  useEffect(() => {
    if (!wardLayerGroupRef.current) return;
    const group = wardLayerGroupRef.current;
    group.clearLayers();

    if (!showWardsOverlay || wards.length === 0) return;

    wards.forEach((ward) => {
      const polygon = L.polygon(ward.boundaryCoordinates as [number, number][], {
        stroke: true,
        color: "#475569",
        weight: 1.2,
        fillColor: "transparent",
        fillOpacity: 0.0,
        dashArray: "4, 4"
      });

      polygon.bindTooltip(ward.name, {
        sticky: true,
        direction: "top"
      });

      polygon.on("click", () => {
        if (onSelectWard) onSelectWard(ward.id);
      });

      polygon.addTo(group);
    });
  }, [wards, showWardsOverlay]);

  return (
    <div style={{ position: "relative", width: "100%", height, borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-main)" }}>
      {/* Map Container */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Floating Controls Bar (Top Right) */}
      <div
        style={{
          position: "absolute",
          top: "14px",
          right: "14px",
          zIndex: 1000,
          display: "flex",
          gap: "8px",
          alignItems: "center"
        }}
      >
        {/* Layer Dropdown Selector */}
        <select
          value={activeMetric}
          onChange={(e) => setActiveMetric(e.target.value as MetricLayerType)}
          style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "0.80rem",
            fontWeight: 600,
            color: "#1e293b",
            boxShadow: "var(--shadow-sm)",
            cursor: "pointer",
            outline: "none"
          }}
        >
          <option value="severity">Heat Severity</option>
          <option value="lst">Land Surface Temperature (°C)</option>
          <option value="ndvi">Vegetation Index (NDVI)</option>
          <option value="builtUp">Built-up Surface (%)</option>
          <option value="vulnerability">Demographic Vulnerability</option>
        </select>

        {/* Optional Ward Boundaries Toggle */}
        <button
          onClick={() => setShowWardsOverlay(!showWardsOverlay)}
          title="Toggle Administrative Ward Boundary Lines"
          style={{
            background: showWardsOverlay ? "#e0f2fe" : "#ffffff",
            border: `1px solid ${showWardsOverlay ? "#0284c7" : "#cbd5e1"}`,
            borderRadius: "6px",
            padding: "6px 10px",
            fontSize: "0.80rem",
            fontWeight: 600,
            color: showWardsOverlay ? "#0369a1" : "#1e293b",
            boxShadow: "var(--shadow-sm)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px"
          }}
        >
          <Layers size={14} color={showWardsOverlay ? "#0284c7" : "#64748b"} />
          <span>Wards</span>
        </button>
      </div>

      {/* North Arrow Compass Icon (Top Right below controls) */}
      <div
        style={{
          position: "absolute",
          top: "56px",
          right: "18px",
          zIndex: 999,
          background: "rgba(255, 255, 255, 0.92)",
          border: "1px solid #cbd5e1",
          borderRadius: "50%",
          width: "30px",
          height: "30px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-xs)"
        }}
      >
        <span style={{ fontSize: "8px", fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>N</span>
        <div style={{ width: "2px", height: "8px", background: "#dc2626", marginTop: "1px" }} />
      </div>

      {/* Floating Smooth Heat Severity Legend (Bottom Right - Exactly per Requirement 6) */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          right: "16px",
          zIndex: 1000,
          background: "rgba(255, 255, 255, 0.96)",
          border: "1px solid #cbd5e1",
          borderRadius: "8px",
          padding: "10px 14px",
          boxShadow: "var(--shadow-md)",
          fontFamily: "Inter, sans-serif",
          minWidth: "145px"
        }}
      >
        <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
          Heat Severity (LST)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.72rem", color: "#334155" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "2px", background: "#b91c1c" }} />
            <span>&gt; 45 °C &nbsp;&nbsp;(Critical Red)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "2px", background: "#ef4444" }} />
            <span>42 – 45 °C (Soft Red)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "2px", background: "#f97316" }} />
            <span>38 – 42 °C (Light Orange)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "2px", background: "#facc15" }} />
            <span>34 – 38 °C (Light Yellow)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "2px", background: "#4ade80" }} />
            <span>&lt; 34 °C &nbsp;&nbsp;(Light Green)</span>
          </div>
        </div>
      </div>

      {/* Interactive Detail Card when any area is clicked on the smooth heat surface (Requirement 7) */}
      {inspectedCell && (
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            left: "16px",
            zIndex: 1001,
            width: "340px",
            maxWidth: "calc(100% - 32px)",
            background: "#ffffff",
            border: "1px solid var(--border-main)",
            borderRadius: "8px",
            padding: "16px",
            boxShadow: "var(--shadow-lg)",
            fontFamily: "Inter, sans-serif"
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
            <div>
              <div style={{ fontSize: "0.70rem", color: "var(--gov-blue-dark)", fontWeight: 700, textTransform: "uppercase" }}>
                1 km × 1 km Analysis Resolution
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-title)" }}>
                Grid Cell {inspectedCell.id}
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                Ward: {inspectedCell.wardName}
              </div>
            </div>
            <button
              onClick={() => setInspectedCell(null)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Environmental Metrics Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
            <div style={{ background: "#f8fafc", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-main)" }}>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>HEAT SEVERITY</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: inspectedCell.heatSeverity >= 75 ? "#dc2626" : inspectedCell.heatSeverity >= 55 ? "#ea580c" : "#16a34a" }}>
                {inspectedCell.heatSeverity} / 100 ({inspectedCell.severityLevel})
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-main)" }}>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>LST (SURFACE TEMP)</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#b91c1c" }}>
                {inspectedCell.lst}°C
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-main)" }}>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>VEGETATION (NDVI)</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#15803d" }}>
                {inspectedCell.ndvi}
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-main)" }}>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>BUILT-UP DENSITY</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-title)" }}>
                {inspectedCell.builtUp}%
              </div>
            </div>
          </div>

          {/* Recommended Mitigation Card */}
          {inspectedCell.recommendedMitigation && (
            <div
              style={{
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: "6px",
                padding: "10px 12px",
                marginBottom: "8px"
              }}
            >
              <div style={{ fontSize: "0.70rem", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", marginBottom: "2px" }}>
                RECOMMENDED MITIGATION
              </div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0c4a6e" }}>
                {inspectedCell.recommendedMitigation.strategyName}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", margin: "6px 0", color: "#075985" }}>
                <span>Estimated Cost: <strong>{inspectedCell.recommendedMitigation.estimatedCostFormatted}</strong></span>
                <span>Cooling: <strong>-{inspectedCell.recommendedMitigation.expectedCoolingDrop}°C</strong></span>
              </div>

              <div style={{ fontSize: "0.72rem", color: "#334155", lineHeight: 1.35 }}>
                {inspectedCell.recommendedMitigation.reason}
              </div>
            </div>
          )}

          {/* Action button */}
          <div style={{ textAlign: "right", marginTop: "6px" }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                if (onSelectWard) onSelectWard(inspectedCell.wardId);
              }}
            >
              View Ward Analysis ({inspectedCell.wardName}) <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const NagpurHeatMap = UrbanHeatMap;
