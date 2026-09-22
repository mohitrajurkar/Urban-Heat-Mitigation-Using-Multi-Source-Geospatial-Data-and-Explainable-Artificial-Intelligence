import React, { useEffect, useState } from "react";
import { Sidebar, NavTab } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { DashboardPage } from "./pages/DashboardPage";
import { HeatMapPage } from "./pages/HeatMapPage";
import { HotspotsPage } from "./pages/HotspotsPage";
import { WardDetailPage } from "./pages/WardDetailPage";
import { MitigationComparisonPage } from "./pages/MitigationComparisonPage";
import { ScenarioAnalysisPage } from "./pages/ScenarioAnalysisPage";
import { ReportsPage } from "./pages/ReportsPage";
import { fetchWards, getDataSource, WardSummaryItem, DataSourceMode } from "./services/api";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [wards, setWards] = useState<WardSummaryItem[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<string>("ward-gandhibagh");
  const [scenarioStrategyId, setScenarioStrategyId] = useState<string>("combined");
  const [dataSource, setDataSource] = useState<DataSourceMode>("In-Browser Fallback Engine");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchWards().then((data) => {
      setWards(data);
      setDataSource(getDataSource());
      if (data.length > 0) {
        setSelectedWardId(data[0].id);
      }
      setLoading(false);
    });
  }, []);

  const handleSelectWard = (wardId: string) => {
    setSelectedWardId(wardId);
    setActiveTab("ward-detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenScenario = (wardId: string, strategyId: string) => {
    setSelectedWardId(wardId);
    setScenarioStrategyId(strategyId);
    setActiveTab("scenario");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectStrategyForScenario = (strategyId: string) => {
    setScenarioStrategyId(strategyId);
    setActiveTab("scenario");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [selectedCity, setSelectedCity] = useState<string>("nagpur");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleSelectCity = (cityId: string) => {
    setSelectedCity(cityId);
    if (cityId !== "nagpur") {
      alert(`City profile for ${cityId.toUpperCase()} selected. Note: Current Prototype Mode uses the validated high-density urban dataset for demonstration. Multi-city PostGIS raster ingestion will be enabled in Phase 2.`);
    }
  };

  const criticalCount = wards.filter((w) => w.priorityLevel === "Critical").length;

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        criticalCount={criticalCount}
      />

      <div className="main-wrapper">
        <Header
          dataSource={dataSource}
          selectedCity={selectedCity}
          onSelectCity={handleSelectCity}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="content-body">
          {loading ? (
            <div style={{ padding: "80px 0", textAlign: "center" }}>
              <span className="pulse-dot" style={{ width: 16, height: 16, backgroundColor: "var(--gov-blue)" }} />
              <div style={{ marginTop: "16px", color: "var(--text-muted)", fontSize: "0.95rem" }}>
                Initializing Urban Heat Decision Support System...
              </div>
            </div>
          ) : (
            <>
              {activeTab === "dashboard" && (
                <DashboardPage
                  wards={wards}
                  onSelectWard={handleSelectWard}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === "heatmap" && (
                <HeatMapPage
                  wards={wards}
                  onSelectWard={handleSelectWard}
                />
              )}

              {activeTab === "hotspots" && (
                <HotspotsPage
                  wards={wards}
                  onSelectWard={handleSelectWard}
                />
              )}

              {activeTab === "ward-detail" && (
                <WardDetailPage
                  wardId={selectedWardId}
                  onBack={() => setActiveTab("hotspots")}
                  onOpenScenario={handleOpenScenario}
                  onOpenComparison={() => setActiveTab("mitigation")}
                />
              )}

              {activeTab === "mitigation" && (
                <MitigationComparisonPage
                  onSelectStrategyForScenario={handleSelectStrategyForScenario}
                />
              )}

              {activeTab === "scenario" && (
                <ScenarioAnalysisPage
                  wards={wards}
                  initialWardId={selectedWardId}
                  initialStrategyId={scenarioStrategyId}
                />
              )}

              {activeTab === "reports" && (
                <ReportsPage wards={wards} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
