# React Frontend Application (`frontend/`)

## 1. Module Responsibility
The `client` module is the user interface and interactive decision dashboard for the Urban Heat Mitigation Decision Support System (Nagpur Prototype).

Key capabilities:
- Interactive Leaflet geospatial map with smooth heatmap rendering for surface temperature and heat island zones.
- Multi-ward heat vulnerability and priority ranking tables.
- Ward detail views with microclimate indicators (LST, NDVI, NDBI, canopy cover, built-up %).
- What-if scenario analysis simulator: visualize cooling impact of interventions (cool roofs, green roofs, tree plantations, urban pocket parks).
- Mitigation strategy comparison tool and municipal reports view.

---

## 2. Directory Structure

```text
client/
├── src/
│   ├── components/       # Reusable UI components (header, sidebar, cards, layout)
│   │   └── map/          # Leaflet heatmap & grid cell map components
│   ├── data/             # Geospatial baseline datasets & mitigation strategies
│   ├── pages/            # View pages (Dashboard, HeatMap, WardDetail, ScenarioAnalysis)
│   ├── services/         # API integration layer (api.ts) & fallback calculation engine
│   ├── types/            # TypeScript data contracts & models
│   ├── App.tsx           # Application root & tab routing
│   ├── main.tsx          # React entry point
│   └── index.css         # Global styling & design system
├── .env.example          # Sample environment variables
├── package.json          # Frontend dependencies & scripts
├── vite.config.ts        # Vite build & bundler configuration
└── README.md             # This documentation
```

---

## 3. How to Run Independently

### Prerequisites
- Node.js 18+ and npm

### Step 1: Install Dependencies
```bash
cd client
npm install
```

### Step 2: Start Vite Dev Server
```bash
npm run dev
```

The frontend will start at `http://localhost:5173`.

### Step 3: Production Build
```bash
npm run build
```

---

## 4. Backend Connectivity & Mock Fallback

The client automatically probes backends in priority order:
1. **Spring Boot Java Backend** (`http://localhost:8080/api`)
2. **Node.js Express Backend** (`http://localhost:5000/api`)
3. **In-Browser Fallback Engine**: If no backend server is currently running, the client seamlessly falls back to its built-in TypeScript calculation engine.

> **Frontend Developer Productivity**:
> A frontend developer can work on UI layouts, interactive map layers, and dashboards without running any backend servers! The current data source mode is always displayed in the header badge.
