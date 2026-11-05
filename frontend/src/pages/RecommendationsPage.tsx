import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, MapPinned, Sprout } from 'lucide-react';
import { useApi, useDebounced } from '../hooks/useApi';
import { useRunParams } from '../hooks/useRun';
import RunGate from '../components/RunGate';
import { Card, EmptyState, ErrorState, KeyValue, LoadingBlock, Modal, PageHeader, Pagination, PriorityBadge, SearchInput, Select } from '../components/ui';
import { STRATEGY_COLORS, STRATEGY_NAMES } from '../utils/colors';
import { fmt, fmtArea, fmtInr, fmtInt } from '../utils/format';
import type { Page, Recommendation } from '../types';

interface Summary { total: number; byPriority: Record<string, number>; summary: { by_type: Record<string, { name: string; count: number; total_cost_inr: number; mean_cooling_c: number; unit_cost_inr: number; unit: string }>; note: string } }

export default function RecommendationsPage() {
  return <RunGate><Recommendations /></RunGate>;
}

function Recommendations() {
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('effectiveness,asc');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Recommendation | null>(null);
  const q = useDebounced(search);
  useEffect(() => setPage(0), [type, priority, q, sort]);
  const sum = useApi<Summary>('/recommendations/summary', useRunParams());
  const { data, loading, error, reload } = useApi<Page<Recommendation>>('/recommendations', useRunParams({ type: type || undefined, priority: priority || undefined, search: q || undefined, sort, page, size: 15 }));
  const byType = sum.data?.summary?.by_type ?? {};

  return (
    <>
      <PageHeader icon={<Sprout className="h-5 w-5" />} title="Mitigation Recommendations"
        subtitle="Strategies are chosen per hotspot from its vegetation, built-up, albedo, water and open-land characteristics. Every recommendation states its reason, location, area, cost and expected cooling."
        actions={<Link to="/map" className="btn-secondary"><MapPinned className="h-4 w-4" />Show on map</Link>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Object.entries(STRATEGY_NAMES).map(([k, name]) => {
          const t = byType[k];
          const active = type === k;
          return (
            <button key={k} onClick={() => setType(active ? '' : k)}
              className={`card card-pad text-left transition-all hover:shadow-lift ${active ? 'ring-2 ring-emerald-500' : ''}`}>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STRATEGY_COLORS[k] }} /><p className="text-sm font-semibold">{name}</p></div>
              {sum.loading ? <div className="skeleton mt-2 h-6 w-16" /> : (
                <>
                  <p className="mt-1 text-2xl font-semibold">{fmtInt(t?.count ?? 0)}</p>
                  <p className="text-xs text-charcoal-400">{fmtInr(t?.total_cost_inr)} · avg −{fmt(t?.mean_cooling_c, 2)} °C</p>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" /><p><b>Approximate estimates.</b> {sum.data?.summary?.note ?? 'Costs and cooling values are planning-level approximations.'}</p>
      </div>
      <Card bodyClass="p-0">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Search region or strategy..." />
          <div className="flex flex-wrap gap-2">
            <Select label="Strategy" value={type} onChange={setType} options={[{ value: '', label: 'All strategies' }, ...Object.entries(STRATEGY_NAMES).map(([v, l]) => ({ value: v, label: l }))]} />
            <Select label="Priority" value={priority} onChange={setPriority} options={[{ value: '', label: 'All priorities' }, ...['Critical', 'High', 'Medium', 'Low'].map((v) => ({ value: v, label: v }))]} />
            <Select label="Sort" value={sort} onChange={setSort} options={[{ value: 'effectiveness,asc', label: 'Most cost-effective' }, { value: 'cooling,desc', label: 'Highest cooling' }, { value: 'cost,desc', label: 'Highest cost' }, { value: 'cost,asc', label: 'Lowest cost' }, { value: 'priority,desc', label: 'Priority level' }, { value: 'area,desc', label: 'Largest area' }]} />
          </div>
        </div>
        {error ? <div className="p-5"><ErrorState message={error} onRetry={reload} /></div> : !data ? <div className="p-5"><LoadingBlock rows={10} /></div> : data.content.length === 0 ? (
          <EmptyState title="No recommendations match" message="Clear the filters to see all recommendations." />
        ) : (
          <>
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Intervention</th><th>Recommended location</th><th>Reason</th><th>Area</th><th>Est. cost</th><th>Cooling</th><th>₹ per °C</th><th>Priority</th></tr></thead>
              <tbody className={loading ? 'opacity-60' : ''}>{data.content.map((r) => (
                <tr key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                  <td><span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STRATEGY_COLORS[r.type] }} />{r.name}</span><p className="text-[11px] text-charcoal-400">#{r.costEffectivenessRank} cost-effectiveness</p></td>
                  <td><p className="font-medium">{r.regionName}</p><p className="text-xs text-charcoal-400">{r.lat.toFixed(4)}° N, {r.lon.toFixed(4)}° E</p></td>
                  <td className="max-w-md text-xs text-charcoal-500">{r.reason}</td>
                  <td className="whitespace-nowrap">{fmtArea(r.areaM2)}{r.unit === 'trees' && <p className="text-xs text-charcoal-400">{fmtInt(r.quantity)} trees</p>}</td>
                  <td className="whitespace-nowrap font-medium">{fmtInr(r.cost?.estimated)}</td>
                  <td className="whitespace-nowrap font-semibold text-emerald-700">−{fmt(r.coolingC, 2)} °C</td>
                  <td className="whitespace-nowrap text-xs">{fmtInr(r.cost?.costPerDegree)}</td>
                  <td><PriorityBadge level={r.priorityLevel} /></td>
                </tr>
              ))}</tbody>
            </table></div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.totalElements} onPage={setPage} />
          </>
        )}
      </Card>
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.name} · ${detail.regionName}` : ''}>
        {detail && (
          <div className="space-y-4 text-sm">
            <p className="text-charcoal-600">{detail.description}</p>
            <p className="rounded-lg bg-forest-50 p-3 text-forest-900"><b>Why here:</b> {detail.reason}</p>
            <KeyValue items={[
              ['Location', detail.locationDescription], ['Area', fmtArea(detail.areaM2)], ['Quantity', `${fmtInt(detail.quantity)} ${detail.unit}`],
              ['Expected cooling', `−${fmt(detail.coolingC, 2)} °C (cell mean LST)`], ['Estimated cost', fmtInr(detail.cost?.estimated, false)],
              ['Cost range (±25%)', `${fmtInr(detail.cost?.low)} – ${fmtInr(detail.cost?.high)}`], ['Unit cost', `${fmtInr(detail.cost?.unitCost, false)} per ${detail.unit === 'trees' ? 'tree' : 'm²'}`],
              ['Cost per °C', fmtInr(detail.cost?.costPerDegree)], ['Suitability', fmt(detail.suitability, 2)], ['Priority', detail.priorityLevel],
            ]} />
            <p className="text-xs text-charcoal-400">Unit-cost basis: {detail.cost?.unitCostBasis}. All values are approximate planning estimates.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
