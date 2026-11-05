import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Flame } from 'lucide-react';
import { useApi, useDebounced } from '../hooks/useApi';
import { useRunParams } from '../hooks/useRun';
import RunGate from '../components/RunGate';
import { Card, EmptyState, ErrorState, KeyValue, LoadingBlock, Modal, PageHeader, Pagination, PriorityBadge, SearchInput, Select, SeverityBadge } from '../components/ui';
import ShapWaterfall from '../charts/ShapWaterfall';
import { ScoreBar } from './DashboardPage';
import type { RegionDetail } from '../maps/RegionDetailPanel';
import { COMPONENT_LABELS, fmt, fmtArea, fmtInr, fmtInt, fmtPct, fmtTemp, modelLabel } from '../utils/format';
import { STRATEGY_COLORS } from '../utils/colors';
import type { HotspotRow, Page } from '../types';

export default function HotspotsPage() {
  return <RunGate><Hotspots /></RunGate>;
}

function Hotspots() {
  const [sp, setSp] = useSearchParams();
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [level, setLevel] = useState('');
  const [significant, setSignificant] = useState(false);
  const [includeAll, setIncludeAll] = useState(false);
  const [sort, setSort] = useState('priority,desc');
  const [page, setPage] = useState(0);
  const q = useDebounced(search);
  useEffect(() => setPage(0), [q, severity, level, significant, includeAll, sort]);

  const params = useRunParams({ search: q || undefined, severity: severity || undefined, priorityLevel: level || undefined, significantOnly: significant, includeAll, sort, page, size: 20 });
  const { data, loading, error, reload } = useApi<Page<HotspotRow>>('/hotspots', params);
  const focus = sp.get('focus');

  return (
    <>
      <PageHeader icon={<Flame className="h-5 w-5" />} title="Hotspot Analysis & Prioritisation"
        subtitle="Heat-severity classes use documented μ/σ thresholds on cell-mean LST; spatial clustering is tested with Getis-Ord Gi*. Priority scores combine five transparent, weighted components." />
      <Card bodyClass="p-0">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Search region or code..." />
          <div className="flex flex-wrap items-center gap-2">
            <Select label="Severity" value={severity} onChange={setSeverity} options={[{ value: '', label: 'All severities' }, { value: 'Very High', label: 'Very High' }, { value: 'High', label: 'High' }, ...(includeAll ? [{ value: 'Moderate', label: 'Moderate' }, { value: 'Low', label: 'Low' }] : [])]} />
            <Select label="Priority level" value={level} onChange={setLevel} options={[{ value: '', label: 'All priority levels' }, ...['Critical', 'High', 'Medium', 'Low'].map((l) => ({ value: l, label: l }))]} />
            <Select label="Sort" value={sort} onChange={setSort} options={[
              { value: 'priority,desc', label: 'Priority score ↓' }, { value: 'lst,desc', label: 'LST ↓' }, { value: 'gi,desc', label: 'Gi* z-score ↓' },
              { value: 'population,desc', label: 'Population density ↓' }, { value: 'name,asc', label: 'Name A–Z' }]} />
            <label className="flex items-center gap-1.5 text-xs text-charcoal-600"><input type="checkbox" className="accent-emerald-600" checked={significant} onChange={(e) => setSignificant(e.target.checked)} />Gi* significant</label>
            <label className="flex items-center gap-1.5 text-xs text-charcoal-600"><input type="checkbox" className="accent-emerald-600" checked={includeAll} onChange={(e) => setIncludeAll(e.target.checked)} />Include non-hotspots</label>
          </div>
        </div>
        {error ? <div className="p-5"><ErrorState message={error} onRetry={reload} /></div> : loading && !data ? <div className="p-5"><LoadingBlock rows={10} /></div> : data && data.content.length === 0 ? (
          <EmptyState title="No regions match these filters" message="Try clearing the search or selecting a different severity." />
        ) : data && (
          <>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Rank</th><th>Region</th><th>Severity</th><th>LST</th><th>Anomaly</th><th>Gi* z</th><th>NDVI</th><th>Built-up</th><th>Pop. density</th><th>Priority</th><th /></tr></thead>
                <tbody className={loading ? 'opacity-60' : ''}>
                  {data.content.map((h) => (
                    <tr key={h.hotspotId} className="cursor-pointer" onClick={() => setSp({ focus: String(h.hotspotId) })}>
                      <td className="font-semibold text-forest-800">{h.priority ? `#${h.priority.rank}` : '—'}</td>
                      <td><p className="font-medium text-charcoal-900">{h.name}</p><p className="text-xs text-charcoal-400">{h.regionCode} · {h.lat.toFixed(4)}, {h.lon.toFixed(4)}</p></td>
                      <td><SeverityBadge severity={h.severity} />{!h.observedSeverity && <p className="mt-0.5 text-[10px] text-charcoal-400">model-predicted</p>}</td>
                      <td className="font-medium">{fmtTemp(h.lst)}</td>
                      <td className={(h.lstAnomaly ?? 0) > 0 ? 'text-red-600' : 'text-emerald-700'}>{(h.lstAnomaly ?? 0) > 0 ? '+' : ''}{fmt(h.lstAnomaly, 1)} °C</td>
                      <td>{fmt(h.giStarZ, 2)}{h.giStarSignificant && <span className="ml-1 text-red-600">●</span>}</td>
                      <td>{fmt(h.ndvi, 3)}</td>
                      <td>{fmtPct(h.builtFraction, 0)}</td>
                      <td>{fmtInt(h.populationDensity)}</td>
                      <td>{h.priority ? <div className="space-y-1"><ScoreBar score={h.priority.score} /><PriorityBadge level={h.priority.level} /></div> : '—'}</td>
                      <td><button className="btn-secondary btn-sm">Inspect</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.totalElements} onPage={setPage} />
          </>
        )}
      </Card>
      {focus && <HotspotModal hotspotId={Number(focus)} onClose={() => setSp({})} />}
    </>
  );
}

function HotspotModal({ hotspotId, onClose }: { hotspotId: number; onClose: () => void }) {
  const { data, loading, error, reload } = useApi<RegionDetail>(`/hotspots/${hotspotId}`);
  const p = data?.priority;
  const comp = p ? Object.entries(p.contributions).map(([k, v]) => ({ name: COMPONENT_LABELS[k], points: v, raw: p.components[k], weight: p.weights[k] })) : [];
  return (
    <Modal open onClose={onClose} wide title={data ? <span className="flex items-center gap-2">{data.region.name} <SeverityBadge severity={data.hotspot?.severity} /></span> : 'Hotspot'}>
      {loading && <LoadingBlock rows={10} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <h4 className="mb-2 text-sm font-semibold">Environmental profile</h4>
              <KeyValue items={[
                ['Observed LST', fmtTemp(data.indicators?.lstMean)], ['LST range', `${fmt(data.indicators?.lstMin, 1)}–${fmt(data.indicators?.lstMax, 1)} °C`],
                ['NDVI', fmt(data.indicators?.ndvi, 3)], ['NDBI', fmt(data.indicators?.ndbi, 3)], ['NDWI', fmt(data.indicators?.ndwi, 3)],
                ['Albedo', fmt(data.indicators?.albedo, 3)], ['Dominant LULC', data.indicators?.lulcName ?? '—'], ['Built-up', fmtPct(data.indicators?.builtFraction, 0)],
                ['Population', fmtInt(data.indicators?.population)], ['Gi* z-score', fmt(data.hotspot?.giStarZ, 2)],
                ['Severity source', data.hotspot?.severitySource ?? '—'], ['Valid pixels', `${fmt(data.indicators?.validPixelPct, 0)}%`],
              ]} />
            </div>
            {p && (
              <div>
                <h4 className="text-sm font-semibold">Priority score breakdown · {fmt(p.score, 1)} / 100 <PriorityBadge level={p.level} /></h4>
                <p className="mb-2 text-xs text-charcoal-400">Score = 100 × Σ weight × normalised component. Rank #{p.rank}.</p>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={comp} layout="vertical" margin={{ left: 8, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0ee" />
                    <XAxis type="number" domain={[0, 40]} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={160} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number, _n, item) => [`${v.toFixed(1)} pts (component ${(item.payload.raw as number).toFixed(2)} × weight ${(item.payload.weight as number).toFixed(2)})`, 'Contribution']} />
                    <Bar isAnimationActive={false} dataKey="points" fill="#059669" radius={3} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div>
              <h4 className="mb-2 text-sm font-semibold">Model predictions</h4>
              <div className="grid grid-cols-2 gap-2">
                {data.predictions.map((x) => (
                  <div key={x.model} className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-charcoal-400">{modelLabel(x.model)}{x.bestModel ? ' · best classifier' : ''}</p>
                    <p className="font-semibold">{x.predictedClass}</p><p className="text-xs">LST {fmtTemp(x.predictedLst)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-5">
            {data.explanation && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Explainable AI — why this region is hot</h4>
                <p className="mb-3 rounded-lg bg-forest-50 p-3 text-[13px] leading-relaxed text-forest-900">{data.explanation.explanation}</p>
                <ShapWaterfall explanation={data.explanation} />
              </div>
            )}
            <div>
              <h4 className="mb-2 text-sm font-semibold">Recommended interventions ({data.recommendations.length})</h4>
              {data.recommendations.length === 0 ? <p className="text-sm text-charcoal-400">No intervention meets the applicability rules for this region.</p> : (
                <ul className="space-y-2">
                  {data.recommendations.map((r) => (
                    <li key={r.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STRATEGY_COLORS[r.type] }} />{r.name}</span>
                        <span className="text-xs font-semibold text-emerald-700">−{fmt(r.coolingC, 2)} °C</span>
                      </div>
                      <p className="mt-1 text-xs text-charcoal-500">{r.reason}</p>
                      <p className="mt-1 text-xs text-charcoal-400">{fmtArea(r.areaM2)} · {fmtInr(r.cost?.estimated)} (≈ {fmtInr(r.cost?.low)}–{fmtInr(r.cost?.high)}) · {r.locationDescription}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
