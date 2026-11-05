import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import { ArrowRight, Flame, Gauge, IndianRupee, Leaf, MapPinned, Sprout, Thermometer, TriangleAlert, Users } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useRunParams } from '../hooks/useRun';
import RunGate from '../components/RunGate';
import { Card, ChartSkeleton, DemoBadge, ErrorState, LoadingBlock, PageHeader, PriorityBadge, SeverityBadge, StatCard } from '../components/ui';
import { CHART, SEVERITY_COLORS, STRATEGY_COLORS, STRATEGY_NAMES } from '../utils/colors';
import { fmt, fmtInr, fmtInt, fmtTemp, modelLabel } from '../utils/format';
import type { HotspotRow, Run, Severity } from '../types';

interface DashboardData {
  run: Run;
  demo: boolean;
  kpis: Record<string, number>;
  lstHistogram: { from: number; to: number; count: number }[];
  severityDistribution: { severity: Severity; count: number }[];
  indicatorsByLulc: { lulc: string; regions: number; meanLst: number; meanNdvi: number; meanNdbi: number }[];
  scatter: { lst: number; ndvi: number; ndbi: number; lulc: string }[];
  modelComparison: { model: string; accuracy: number; f1: number; precision: number; recall: number; r2: number; rmse: number }[];
  topHotspots: HotspotRow[];
  recommendationOverview: { type: string; name: string; count: number; totalCost: number; meanCoolingC: number }[];
}

export default function DashboardPage() {
  return <RunGate><Dashboard /></RunGate>;
}

function Dashboard() {
  const { data, loading, error, reload } = useApi<DashboardData>('/dashboard/stats', useRunParams());
  const k = data?.kpis ?? {};

  return (
    <>
      <PageHeader
        icon={<Gauge className="h-5 w-5" />}
        title="Urban Heat Intelligence Dashboard"
        subtitle="City-wide overview of land surface temperature, heat hotspots, AI model performance and recommended mitigation for Nagpur."
        actions={data && <><DemoBadge demo={data.demo} /><Link to="/map" className="btn-primary"><MapPinned className="h-4 w-4" />Open heat map</Link></>}
      />
      {data?.demo && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p><b>Demonstration mode.</b> Results come from the bundled <b>synthetic</b> Nagpur datasets (clearly labelled, not real satellite observations). Upload real Landsat / Sentinel-2 / LULC data in Dataset Management to analyse actual conditions.</p>
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={loading} label="Study regions" value={fmtInt(k.totalRegions)} sub="500 m × 500 m analysis cells" icon={<MapPinned className="h-5 w-5" />} accent="forest" />
        <StatCard loading={loading} label="Heat hotspots" value={fmtInt(k.totalHotspots)} sub={`${fmt((100 * (k.totalHotspots ?? 0)) / (k.totalRegions || 1), 1)}% of regions · High + Very High`} icon={<Flame className="h-5 w-5" />} accent="amber" />
        <StatCard loading={loading} label="Very high severity" value={fmtInt(k.veryHighHotspots)} sub={`${fmtInt(k.criticalPriorityHotspots)} critical priority`} icon={<TriangleAlert className="h-5 w-5" />} accent="red" />
        <StatCard loading={loading} label="Average LST" value={fmtTemp(k.averageLst)} sub={`Maximum ${fmtTemp(k.maxLst)}`} icon={<Thermometer className="h-5 w-5" />} accent="red" />
        <StatCard loading={loading} label="Vegetation coverage" value={`${fmt(k.vegetationCoveragePct, 1)}%`} sub="Forest + urban green share" icon={<Leaf className="h-5 w-5" />} accent="emerald" />
        <StatCard loading={loading} label="Recommended interventions" value={fmtInt(k.recommendedInterventions)} sub={`Avg. expected cooling ${fmt(k.meanExpectedCoolingC, 2)} °C / hotspot`} icon={<Sprout className="h-5 w-5" />} accent="emerald" />
        <StatCard loading={loading} label="Estimated mitigation cost" value={fmtInr(k.estimatedMitigationCost)} sub="Approximate (±25%)" icon={<IndianRupee className="h-5 w-5" />} accent="blue" />
        <StatCard loading={loading} label="Population exposed" value={fmtInt(k.populationExposed)} sub="Residents in hotspot regions" icon={<Users className="h-5 w-5" />} accent="slate" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Land surface temperature distribution" subtitle="Number of regions per LST band (cell mean, °C)">
          {loading || !data ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.lstHistogram.map((b) => ({ label: `${b.from.toFixed(1)}`, mid: (b.from + b.to) / 2, count: b.count }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0ee" />
                <XAxis dataKey="label" tickLine={false} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v: number) => [`${v} regions`, 'Count']} labelFormatter={(l) => `From ${l} °C`} />
                <Bar isAnimationActive={false} dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.lstHistogram.map((b, i) => <Cell key={i} fill={lstColor((b.from + b.to) / 2)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title="Hotspot severity" subtitle="Regions by heat severity class">
          {loading || !data ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie isAnimationActive={false} data={data.severityDistribution} dataKey="count" nameKey="severity" innerRadius={60} outerRadius={95} paddingAngle={2}>
                  {data.severityDistribution.map((s) => <Cell key={s.severity} fill={SEVERITY_COLORS[s.severity]} />)}
                </Pie>
                <Tooltip formatter={(v: number, n: string) => [`${v} regions`, n]} />
                <Legend verticalAlign="bottom" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Environmental indicators by land cover" subtitle="Mean LST (bars) and NDVI (line) per dominant land-cover class">
          {loading || !data ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data.indicatorsByLulc.map((d) => ({ ...d, short: d.lulc.split(' /')[0] }))} margin={{ bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0ee" />
                <XAxis dataKey="short" angle={-25} textAnchor="end" interval={0} height={50} tickLine={false} />
                <YAxis yAxisId="l" domain={['dataMin - 2', 'dataMax + 1']} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => v.toFixed(0)} />
                <YAxis yAxisId="r" orientation="right" domain={[-0.2, 0.8]} tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v: number, n: string) => [n === 'Mean LST' ? `${v.toFixed(2)} °C` : v.toFixed(3), n]} />
                <Legend verticalAlign="top" height={28} />
                <Bar isAnimationActive={false} yAxisId="l" dataKey="meanLst" name="Mean LST" fill={CHART.amber} radius={[4, 4, 0, 0]} />
                <Line isAnimationActive={false} yAxisId="r" dataKey="meanNdvi" name="Mean NDVI" stroke={CHART.emerald} strokeWidth={2.5} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title="Vegetation vs. land surface temperature" subtitle="Each point is a region; greener areas are cooler">
          {loading || !data ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0ee" />
                <XAxis type="number" dataKey="ndvi" name="NDVI" domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(1)} label={{ value: 'NDVI', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                <YAxis type="number" dataKey="lst" name="LST" unit="°C" domain={['auto', 'auto']} width={50} tickFormatter={(v) => v.toFixed(0)} />
                <ZAxis range={[18, 18]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: number, n: string) => [n === 'LST' ? `${v.toFixed(1)} °C` : v.toFixed(3), n]} />
                <Scatter isAnimationActive={false} data={data.scatter}>
                  {data.scatter.map((p, i) => <Cell key={i} fill={lstColor(p.lst)} fillOpacity={0.75} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="AI model comparison" subtitle="Spatial hold-out test set" actions={<Link to="/predictions" className="text-xs font-medium text-emerald-700 hover:underline">Details</Link>}>
          {loading || !data ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={['accuracy', 'precision', 'recall', 'f1', 'r2'].map((m) => ({
                metric: m === 'r2' ? 'R² (LST)' : m === 'f1' ? 'F1' : m[0].toUpperCase() + m.slice(1),
                ...Object.fromEntries(data.modelComparison.map((c) => [modelLabel(c.model), (c as unknown as Record<string, number>)[m]])),
              }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0ee" />
                <XAxis dataKey="metric" tickLine={false} />
                <YAxis domain={[0.5, 1]} tickLine={false} axisLine={false} width={36} />
                <Tooltip formatter={(v: number) => v.toFixed(3)} />
                <Legend verticalAlign="top" height={28} />
                <Bar isAnimationActive={false} dataKey="Random Forest" fill={CHART.forest} radius={[4, 4, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="XGBoost" fill={CHART.mint} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="xl:col-span-2" title="Mitigation recommendation overview" subtitle="Number of recommendations and estimated cost per strategy"
          actions={<Link to="/recommendations" className="text-xs font-medium text-emerald-700 hover:underline">All strategies</Link>}>
          {loading || !data ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data.recommendationOverview.map((r) => ({ ...r, label: STRATEGY_NAMES[r.type] ?? r.name, costCr: r.totalCost / 1e7 }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0ee" />
                <XAxis dataKey="label" tickLine={false} />
                <YAxis yAxisId="l" tickLine={false} axisLine={false} width={40} />
                <YAxis yAxisId="r" orientation="right" tickLine={false} axisLine={false} width={55} tickFormatter={(v) => `₹${v.toFixed(0)}Cr`} />
                <Tooltip formatter={(v: number, n: string) => (n === 'Cost' ? [`₹ ${v.toFixed(2)} Cr`, n] : [v, n])} />
                <Legend verticalAlign="top" height={28} />
                <Bar isAnimationActive={false} yAxisId="l" dataKey="count" name="Recommendations" radius={[4, 4, 0, 0]}>
                  {data.recommendationOverview.map((r) => <Cell key={r.type} fill={STRATEGY_COLORS[r.type]} />)}
                </Bar>
                <Line isAnimationActive={false} yAxisId="r" dataKey="costCr" name="Cost" stroke={CHART.amber} strokeWidth={2.5} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="mt-6" title="Highest-priority hotspots" subtitle="Ranked by the transparent priority score" bodyClass="p-0"
        actions={<Link to="/hotspots" className="btn-secondary btn-sm">View all <ArrowRight className="h-3.5 w-3.5" /></Link>}>
        {loading || !data ? <div className="p-5"><LoadingBlock rows={6} /></div> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Rank</th><th>Region</th><th>Severity</th><th>LST</th><th>NDVI</th><th>Built-up</th><th>Priority score</th><th>Level</th><th>Expected cooling</th></tr></thead>
              <tbody>
                {data.topHotspots.map((h) => (
                  <tr key={h.hotspotId}>
                    <td className="font-semibold text-forest-800">#{h.priority?.rank}</td>
                    <td><Link to={`/hotspots?focus=${h.hotspotId}`} className="font-medium text-charcoal-900 hover:text-emerald-700">{h.name}</Link><p className="text-xs text-charcoal-400">{h.regionCode}</p></td>
                    <td><SeverityBadge severity={h.severity} /></td>
                    <td>{fmtTemp(h.lst)}</td>
                    <td>{fmt(h.ndvi, 3)}</td>
                    <td>{fmt((h.builtFraction ?? 0) * 100, 0)}%</td>
                    <td><ScoreBar score={h.priority?.score ?? 0} /></td>
                    <td><PriorityBadge level={h.priority?.level} /></td>
                    <td>{fmt(h.priority?.expectedCoolingC, 2)} °C</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-600" style={{ width: `${score}%` }} /></div>
      <span className="text-xs font-semibold tabular-nums">{score.toFixed(1)}</span>
    </div>
  );
}

function lstColor(t: number): string {
  const stops = ['#4575b4', '#91bfdb', '#fee090', '#fc8d59', '#d73027', '#a50026'];
  const x = Math.min(1, Math.max(0, (t - 32) / 16)) * (stops.length - 1);
  return stops[Math.round(x)];
}
