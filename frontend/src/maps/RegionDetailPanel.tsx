import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { ErrorState, KeyValue, LoadingBlock, PriorityBadge, SeverityBadge } from '../components/ui';
import { fmt, fmtInr, fmtInt, fmtPct, fmtTemp, modelLabel } from '../utils/format';
import type { HotspotRow, IndicatorRow, LocalExplanation, PriorityInfo, Recommendation } from '../types';
import ShapWaterfall from '../charts/ShapWaterfall';

export interface RegionDetail {
  region: { id: number; code: string; name: string; locality: string; areaKm2: number; centroid: [number, number] };
  indicators: IndicatorRow | null;
  hotspot: HotspotRow | null;
  priority: PriorityInfo | null;
  predictions: { model: string; predictedClass: string; predictedLst: number; bestModel: boolean; observedClass: string | null }[];
  explanation: LocalExplanation | null;
  recommendations: Recommendation[];
}

export default function RegionDetailPanel({ regionId, onClose }: { regionId: number; onClose: () => void }) {
  const { data, loading, error, reload } = useApi<RegionDetail>(`/regions/${regionId}`);
  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <p className="text-xs text-charcoal-400">{data?.region.code ?? 'Region'}</p>
          <h3 className="font-semibold">{data?.region.name ?? 'Loading…'}</h3>
        </div>
        <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close details"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {loading && <LoadingBlock rows={8} />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {data && (
          <>
            <div className="flex flex-wrap gap-2">
              <SeverityBadge severity={data.hotspot?.severity} />
              {data.priority && <PriorityBadge level={data.priority.level} />}
              {data.hotspot?.giStarSignificant && <span className="chip border border-red-200 bg-red-50 text-red-700">Gi* significant</span>}
            </div>
            <KeyValue items={[
              ['Observed LST', fmtTemp(data.indicators?.lstMean)],
              ['LST anomaly', `${fmt(data.hotspot?.lstAnomaly, 2)} °C`],
              ['NDVI', fmt(data.indicators?.ndvi, 3)],
              ['NDBI', fmt(data.indicators?.ndbi, 3)],
              ['NDWI', fmt(data.indicators?.ndwi, 3)],
              ['Albedo', fmt(data.indicators?.albedo, 3)],
              ['Dominant LULC', data.indicators?.lulcName ?? '—'],
              ['Built-up', fmtPct(data.indicators?.builtFraction, 0)],
              ['Green cover', fmtPct(data.indicators?.vegetationFraction, 0)],
              ['Population', fmtInt(data.indicators?.population)],
              ['Max air temp.', fmtTemp(data.indicators?.airTempMax)],
              ['Priority score', data.priority ? `${fmt(data.priority.score, 1)} (#${data.priority.rank})` : '—'],
            ]} />
            {data.predictions.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-charcoal-400">AI predictions</p>
                <div className="grid grid-cols-2 gap-2">
                  {data.predictions.map((p) => (
                    <div key={p.model} className="rounded-lg border border-gray-200 p-2.5">
                      <p className="text-xs text-charcoal-400">{modelLabel(p.model)}{p.bestModel && ' · best'}</p>
                      <p className="font-semibold">{p.predictedClass}</p>
                      <p className="text-xs">{fmtTemp(p.predictedLst)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.explanation && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Why is it hot? (SHAP)</p>
                <p className="mb-2 rounded-lg bg-forest-50 p-3 text-[13px] leading-relaxed text-forest-900">{data.explanation.explanation}</p>
                <ShapWaterfall explanation={data.explanation} compact />
              </div>
            )}
            {data.recommendations.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Recommended interventions</p>
                <ul className="space-y-2">
                  {data.recommendations.map((r) => (
                    <li key={r.id} className="rounded-lg border border-gray-200 p-2.5">
                      <div className="flex items-center justify-between"><span className="font-medium">{r.name}</span><span className="text-xs text-emerald-700">−{fmt(r.coolingC, 2)} °C</span></div>
                      <p className="mt-0.5 text-xs text-charcoal-400">{fmtInr(r.cost?.estimated)} · {r.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.hotspot?.hotspot && <Link to={`/hotspots?focus=${data.hotspot.hotspotId}`} className="btn-secondary w-full">Open full hotspot analysis</Link>}
          </>
        )}
      </div>
    </div>
  );
}
