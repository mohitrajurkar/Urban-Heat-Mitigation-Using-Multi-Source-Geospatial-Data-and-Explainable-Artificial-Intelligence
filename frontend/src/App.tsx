import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { RunProvider } from './hooks/useRun';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import { LoadingBlock } from './components/ui';

const Dashboard = lazy(() => import('./pages/DashboardPage'));
const HeatMap = lazy(() => import('./pages/HeatMapPage'));
const Hotspots = lazy(() => import('./pages/HotspotsPage'));
const Indicators = lazy(() => import('./pages/IndicatorsPage'));
const Predictions = lazy(() => import('./pages/PredictionsPage'));
const Explain = lazy(() => import('./pages/ExplainabilityPage'));
const Recommendations = lazy(() => import('./pages/RecommendationsPage'));
const Costs = lazy(() => import('./pages/CostAnalysisPage'));
const Datasets = lazy(() => import('./pages/DatasetsPage'));
const Reports = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function Protected() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <RunProvider>
      <AppLayout />
    </RunProvider>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <Suspense fallback={<div className="p-10"><LoadingBlock rows={6} /></div>}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route element={<Protected />}>
          <Route index element={<Dashboard />} />
          <Route path="map" element={<HeatMap />} />
          <Route path="hotspots" element={<Hotspots />} />
          <Route path="indicators" element={<Indicators />} />
          <Route path="predictions" element={<Predictions />} />
          <Route path="explainability" element={<Explain />} />
          <Route path="recommendations" element={<Recommendations />} />
          <Route path="costs" element={<Costs />} />
          <Route path="datasets" element={<Datasets />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
