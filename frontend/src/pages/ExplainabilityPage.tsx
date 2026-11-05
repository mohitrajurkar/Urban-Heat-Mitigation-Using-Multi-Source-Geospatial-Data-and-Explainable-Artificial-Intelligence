import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ReferenceLine } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { useApi, useDebounced } from '../hooks/useApi';
import { useRunParams } from '../hooks/useRun';
import { fetchObjectUrl } from '../services/api';
import RunGate from '../components/RunGate';
import { Card, ChartSkeleton, ErrorState, LoadingBlock, PageHeader, SearchInput, SeverityBadge, Tabs } from '../components/ui';
import ShapWaterfall from '../charts/ShapWaterfall';
import { rampColor } from '../utils/colors';
import { fmt, fmtTemp, modelLabel } from '../utils/format';
import type { HotspotRow, LocalExplanation, Page, ShapGlobal } from '../types';

type Model = 'xgboost' | 'random_forest';
type Task = 'regression' | 'classification';

export default function ExplainabilityPage() {
  return <RunGate><Explain /></RunGate>;
}

function Explain() {
  const params = useRunParams();
  const g = useApi<ShapGlobal>('/explanations/global', params);
  const [model, setModel] = useState<Model>('xgboost');
  const [task, setTask] = useState<Task>('regression');
  const [plotUrl, setPlotUrl] = useState<string | null>(null);
  const [plotErr, setPlotErr] = useState(false);
  const tg = g.data?.shap?.global?.[model]?.[task];

  useEffect(() => {
    let url: string | null = null;
    setPlotUrl(null);
    setPlotErr(false);
    fetchObjectUrl(`/explanations/plots/${model}/${task}.png`, params).then((u) => { url = u; setPlotUrl(u); }).catch(() => setPlotErr(true));
    return () => { if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, task, params._v, params.runId]);

  const swarm = useMemo(() => {
    if (!tg) return [];
    const feats = tg.beeswarm.slice(0, 10);
    return feats.flatMap((f, i) => f.points.map((p, j) => ({ x: p.shap, y: feats.length - i + (((j * 7919) % 100) / 100 - 0.5) * 0.55, value: p.value, label: f.label })));
  }, [tg]);
  const swarmLabels = tg?.beeswarm.slice(0, 10).map((f) => f.label) ?? [];

  return (
    <>
      <PageHeader icon={<Sparkles className="h-5 w-5" />} title="Explainable AI (SHAP)"
        subtitle="TreeSHAP decomposes every prediction into additive feature contributions: base value + Σ contributions = model output. Explanations below are computed from the trained models, not written by hand."
        actions={<>
          <Tabs value={model} onChange={setModel} tabs={[{ value: 'xgboost', label: 'XGBoost' }, { value: 'random_forest', label: 'Random Forest' }]} />
          <Tabs value={task} onChange={setTask} tabs={[{ value: 'regression', label: 'LST (°C)' }, { value: 'classification', label: 'Severity class' }]} />
        </>} />
      {g.error && <ErrorState message={g.error} onRetry={g.reload} />}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Global feature importance" subtitle={`Mean |SHAP| · ${modelLabel(model)} · ${tg?.unit ?? ''}${tg ? ` · ${tg.n_explained} regions explained` : ''}`}>
          {!tg ? <ChartSkeleton height={340} /> : (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={tg.importance.map((i) => ({ name: i.label, v: i.mean_abs_shap }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0ee" />
                <XAxis type="number" tickLine={false} tickFormatter={(v) => v.toFixed(2)} />
                <YAxis type="category" dataKey="name" width={180} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v.toFixed(4), 'mean |SHAP|']} />
                <Bar isAnimationActive={false} dataKey="v" radius={3}>{tg.importance.map((_, i) => <Cell key={i} fill={rampColor(['#14532d', '#34d399'], i / Math.max(1, tg.importance.length - 1))} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title="SHAP summary (beeswarm)" subtitle="Each dot is a region · x = contribution · colour = feature value (blue low → red high)">
          {!tg ? <ChartSkeleton height={340} /> : (
            <>
              <ResponsiveContainer width="100%" height={340}>
                <ScatterChart margin={{ left: 10, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0ee" />
                  <XAxis type="number" dataKey="x" tickLine={false} tickFormatter={(v) => v.toFixed(1)} />
                  <YAxis type="number" dataKey="y" domain={[0.4, swarmLabels.length + 0.6]} ticks={swarmLabels.map((_, i) => swarmLabels.length - i)}
                    tickFormatter={(v) => (swarmLabels[swarmLabels.length - v] ?? '').replace(/ \(.*\)$/, '')} width={150} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <ZAxis range={[10, 10]} />
                  <ReferenceLine x={0} stroke="#9ca3af" />
                  <Tooltip formatter={(v: number, n: string) => (n === 'x' ? [v.toFixed(3), 'SHAP'] : [null, null])} labelFormatter={() => ''}
                    content={({ payload }) => payload?.[0] ? <div className="card px-3 py-2 text-xs"><b>{payload[0].payload.label}</b><br />SHAP {payload[0].payload.x.toFixed(3)} · value rank {(payload[0].payload.value * 100).toFixed(0)}%</div> : null} />
                  <Scatter isAnimationActive={false} data={swarm}>{swarm.map((p, i) => <Cell key={i} fill={rampColor(['#1e40af', '#a78bfa', '#dc2626'], p.value)} fillOpacity={0.8} />)}</Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </>
          )}
        </Card>
      </div>
      <Card className="mt-6" title="SHAP summary plot (generated by the SHAP library)" subtitle="Rendered by the Python AI service with shap.summary_plot">
        {plotErr ? <p className="text-sm text-charcoal-400">Plot unavailable.</p> : !plotUrl ? <ChartSkeleton height={300} /> : (
          <img src={plotUrl} alt={`SHAP summary plot for ${modelLabel(model)} ${task}`} className="mx-auto max-h-[520px] rounded-lg border border-gray-100" />
        )}
      </Card>
      <LocalExplorer />
    </>
  );
}

function LocalExplorer() {
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const list = useApi<Page<HotspotRow>>('/hotspots', useRunParams({ search: q || undefined, includeAll: !!q, sort: 'priority,desc', size: 12 }));
  const [regionId, setRegionId] = useState<number | null>(null);
  useEffect(() => {
    if (regionId == null && list.data?.content.length) setRegionId(list.data.content[0].regionId);
  }, [list.data, regionId]);
  const ex = useApi<LocalExplanation>(regionId ? `/explanations/regions/${regionId}` : null);
  const e = ex.data;

  return (
    <Card className="mt-6" title="Individual prediction explanations" subtitle="Pick a region to see which factors push its predicted LST up (red) or down (green)">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
        <div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search any region..." />
          <p className="mb-2 mt-3 text-xs text-charcoal-400">{q ? 'Matching regions' : 'Top-priority hotspots'}</p>
          {list.loading && !list.data ? <LoadingBlock rows={6} /> : (
            <ul className="max-h-[460px] space-y-1 overflow-y-auto pr-1">
              {list.data?.content.map((h) => (
                <li key={h.regionId}>
                  <button onClick={() => setRegionId(h.regionId)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${regionId === h.regionId ? 'bg-forest-800 text-white' : 'hover:bg-emerald-50'}`}>
                    <span className="truncate"><span className="font-medium">{h.name}</span><span className={`block text-[11px] ${regionId === h.regionId ? 'text-emerald-200' : 'text-charcoal-400'}`}>LST {fmt(h.lst, 1)} °C · {h.severity}</span></span>
                    {h.priority && <span className="text-xs font-semibold">#{h.priority.rank}</span>}
                  </button>
                </li>
              ))}
              {list.data?.content.length === 0 && <li className="text-sm text-charcoal-400">No regions found.</li>}
            </ul>
          )}
        </div>
        <div>
          {ex.error && <ErrorState message={ex.error} onRetry={ex.reload} />}
          {ex.loading && <LoadingBlock rows={8} />}
          {e && !ex.loading && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold">{e.name}</h3><SeverityBadge severity={e.predictedClass} />
                <span className="text-sm text-charcoal-500">Predicted {fmtTemp(e.predictedValue)} · observed {fmtTemp(e.observedLst)} · baseline {fmtTemp(e.baseValue)}</span>
              </div>
              <p className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-[14px] leading-relaxed text-forest-900">{e.explanation}</p>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <ShapWaterfall explanation={e} />
                <div className="grid grid-cols-1 gap-3">
                  <FactorList title="Positive contributions (increase heat)" items={e.contributions.filter((c) => c.shap > 0).slice(0, 5)} up />
                  <FactorList title="Negative contributions (reduce heat)" items={e.contributions.filter((c) => c.shap < 0).slice(0, 5)} />
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Contributions toward the predicted class “{e.predictedClass}” (classifier log-odds)</p>
                <div className="flex flex-wrap gap-2">
                  {e.classContributions.map((c) => (
                    <span key={c.feature} className={`chip border ${c.shap >= 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{c.label}: {c.shap >= 0 ? '+' : ''}{c.shap.toFixed(2)}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function FactorList({ title, items, up }: { title: string; items: LocalExplanation['contributions']; up?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-400">{title}</p>
      {items.length === 0 ? <p className="text-sm text-charcoal-400">None</p> : (
        <ul className="space-y-1.5">
          {items.map((c) => (
            <li key={c.feature} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5">{up ? <ArrowUpRight className="h-4 w-4 text-red-600" /> : <ArrowDownRight className="h-4 w-4 text-emerald-600" />}{c.label}</span>
              <span className="tabular-nums text-charcoal-500">{fmt(c.value, 3)} → <b className={up ? 'text-red-600' : 'text-emerald-700'}>{c.shap > 0 ? '+' : ''}{c.shap.toFixed(2)} °C</b></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
