import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Layers } from 'lucide-react';
import { useApi, useDebounced } from '../hooks/useApi';
import { useRunParams } from '../hooks/useRun';
import RunGate from '../components/RunGate';
import { Card, ChartSkeleton, ErrorState, KeyValue, LoadingBlock, PageHeader, Pagination, SearchInput, Select, Tabs } from '../components/ui';
import { fmt, fmtInt, fmtPct, fmtTemp } from '../utils/format';
import type { IndicatorRow, Page } from '../types';

type Stat = { mean: number; min: number; max: number; std: number; p10: number; p90: number };
interface Summary {
  summary: { indicators: Record<string, Stat>; lulc_distribution: { class_id: number; label: string; fraction: number; mean_lst: number }[]; quality: Record<string, unknown>; total_population: number };
  preprocessing: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  histograms: Record<string, { from: number; to: number; count: number }[]>;
  correlationWithLst: Record<string, number | null>;
  byLulc: { lulc: string; regions: number; meanLst: number; meanNdvi: number; meanNdbi: number; meanAlbedo: number }[];
}

const IND = [
  { key: 'lst', label: 'LST', unit: '°C', color: '#dc2626', desc: 'Land Surface Temperature retrieved from Landsat Band 10' },
  { key: 'ndvi', label: 'NDVI', unit: '', color: '#16a34a', desc: '(NIR − Red) / (NIR + Red)' },
  { key: 'ndbi', label: 'NDBI', unit: '', color: '#b45309', desc: '(SWIR − NIR) / (SWIR + NIR)' },
  { key: 'ndwi', label: 'NDWI', unit: '', color: '#2563eb', desc: '(Green − NIR) / (Green + NIR)' },
  { key: 'albedo', label: 'Albedo', unit: '', color: '#64748b', desc: 'Liang (2001) broadband albedo' },
] as const;
const LULC_COLORS = ['#2b7bba', '#1b5e20', '#66bb6a', '#d4c26a', '#c8a27a', '#e57373', '#b71c1c', '#6d4c41'];
const CORR_LABELS: Record<string, string> = { ndvi: 'NDVI', ndbi: 'NDBI', ndwi: 'NDWI', albedo: 'Albedo', built_fraction: 'Built-up fraction', vegetation_fraction: 'Green cover' };

export default function IndicatorsPage() {
  return <RunGate><Indicators /></RunGate>;
}

function Indicators() {
  const params = useRunParams();
  const s = useApi<Summary>('/indicators/summary', params);
  const [hist, setHist] = useState<string>('lst');
  const [search, setSearch] = useState('');
  const [lulc, setLulc] = useState('');
  const [sort, setSort] = useState('lst,desc');
  const [page, setPage] = useState(0);
  const q = useDebounced(search);
  useEffect(() => setPage(0), [q, lulc, sort]);
  const rows = useApi<Page<IndicatorRow>>('/indicators', useRunParams({ search: q || undefined, lulc: lulc || undefined, sort, page, size: 15 }));
  const d = s.data;
  const pre = d?.preprocessing;

  return (
    <>
      <PageHeader icon={<Layers className="h-5 w-5" />} title="Environmental Indicators"
        subtitle="Spectral indices, land surface temperature, surface albedo and land use / land cover derived from the preprocessed multi-source stack." />
      {s.error && <ErrorState message={s.error} onRetry={s.reload} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {IND.map((i) => {
          const st = d?.summary.indicators[i.key];
          return (
            <div key={i.key} className="card card-pad">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">{i.label}</p><span className="h-2 w-2 rounded-full" style={{ background: i.color }} /></div>
              {s.loading || !st ? <div className="skeleton mt-2 h-7 w-20" /> : (
                <>
                  <p className="mt-1 text-2xl font-semibold">{fmt(st.mean, i.key === 'lst' ? 1 : 3)}<span className="text-sm font-normal text-charcoal-400"> {i.unit}</span></p>
                  <p className="text-xs text-charcoal-400">range {fmt(st.min, 2)} – {fmt(st.max, 2)} · σ {fmt(st.std, 2)}</p>
                </>
              )}
              <p className="mt-2 text-[11px] text-charcoal-400">{i.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Indicator distribution" subtitle="Histogram of region means" actions={<Tabs value={hist} onChange={setHist} tabs={IND.map((i) => ({ value: i.key, label: i.label }))} />}>
          {s.loading || !d ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={(d.histograms[hist] ?? []).map((b) => ({ x: b.from.toFixed(hist === 'lst' ? 1 : 2), count: b.count }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0ee" />
                <XAxis dataKey="x" tickLine={false} /><YAxis tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v: number) => [`${v} regions`, 'Count']} />
                <Bar isAnimationActive={false} dataKey="count" fill={IND.find((i) => i.key === hist)?.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title="Correlation with LST" subtitle="Pearson r across regions">
          {s.loading || !d ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={Object.entries(d.correlationWithLst).map(([k, v]) => ({ name: CORR_LABELS[k] ?? k, r: v ?? 0 }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0ee" />
                <XAxis type="number" domain={[-1, 1]} tickLine={false} /><YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [v.toFixed(3), 'r']} />
                <Bar isAnimationActive={false} dataKey="r" radius={3}>{Object.values(d.correlationWithLst).map((v, i) => <Cell key={i} fill={(v ?? 0) >= 0 ? '#dc2626' : '#059669'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Land use / land cover" subtitle="Share of study area (pixel level)">
          {s.loading || !d ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={270}>
              <PieChart>
                <Pie isAnimationActive={false} data={d.summary.lulc_distribution} dataKey="fraction" nameKey="label" innerRadius={50} outerRadius={90} paddingAngle={1}>
                  {d.summary.lulc_distribution.map((l) => <Cell key={l.class_id} fill={LULC_COLORS[l.class_id - 1]} />)}
                </Pie>
                <Tooltip formatter={(v: number, n: string) => [fmtPct(v), n]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="xl:col-span-2" title="Indicators by dominant land cover" bodyClass="p-0">
          {s.loading || !d ? <div className="p-5"><LoadingBlock /></div> : (
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Land cover</th><th>Regions</th><th>Mean LST</th><th>Mean NDVI</th><th>Mean NDBI</th><th>Mean albedo</th></tr></thead>
              <tbody>{[...d.byLulc].sort((a, b) => b.meanLst - a.meanLst).map((r) => (
                <tr key={r.lulc}><td className="font-medium">{r.lulc}</td><td>{r.regions}</td><td>{fmtTemp(r.meanLst, 2)}</td><td>{fmt(r.meanNdvi, 3)}</td><td>{fmt(r.meanNdbi, 3)}</td><td>{fmt(r.meanAlbedo, 3)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Preprocessing & data quality" subtitle="CRS conversion, resampling, invalid-pixel and outlier handling">
          {!pre ? <LoadingBlock /> : (
            <KeyValue items={[
              ['Target CRS', pre.crs], ['Pixel size', `${pre.target_resolution_m} m`],
              ['Grid size', `${pre.grid?.width} × ${pre.grid?.height} px`], ['Landsat calibration', pre.landsat?.product_level],
              ['Valid Landsat pixels', `${fmt(pre.landsat?.valid_pixel_pct, 1)}%`], ['Invalid / fill pixels masked', fmtInt(pre.landsat?.invalid_pixels)],
              ['Saturated pixels masked', fmtInt(pre.landsat?.saturated_pixels_masked)], ['Sentinel-2 fused', `${fmt(pre.sentinel2?.coverage_pct, 1)}% of grid`],
              ['Met. stations', fmtInt(pre.meteorological?.stations)], ['Met. duplicates removed', fmtInt(pre.meteorological?.duplicates_removed)],
              ['Met. range violations removed', fmtInt(pre.meteorological?.range_violations_removed)], ['Met. gaps imputed', fmtInt(pre.meteorological?.missing_before_imputation)],
              ['Road network', `${fmt(pre.roads?.total_km, 0)} km`], ['Population in grid', fmtInt(pre.population?.total_population_in_grid)],
            ]} />
          )}
        </Card>
        <Card title="Methodology" subtitle="Formulas implemented in the AI service (app/features/indices.py)">
          <ul className="space-y-2.5 text-[13px] text-charcoal-600">
            <li><b>Calibration:</b> ρ<sub>TOA</sub> = (M<sub>ρ</sub>·Q<sub>cal</sub> + A<sub>ρ</sub>) / sin(θ<sub>SE</sub>); L<sub>λ</sub> = M<sub>L</sub>·Q<sub>cal</sub> + A<sub>L</sub></li>
            <li><b>Brightness temperature:</b> BT = K<sub>2</sub> / ln(K<sub>1</sub>/L<sub>λ</sub> + 1)</li>
            <li><b>Emissivity:</b> NDVI thresholds (Sobrino 2004): water 0.991, soil 0.973, vegetation 0.990, mixed 0.004·P<sub>v</sub> + 0.986, P<sub>v</sub> = ((NDVI−0.2)/0.3)²</li>
            <li><b>LST:</b> BT / (1 + (λ·BT/ρ)·ln ε) − 273.15, λ = 10.895 µm, ρ = 14388 µm·K</li>
            <li><b>Albedo:</b> 0.356ρ<sub>B2</sub> + 0.130ρ<sub>B4</sub> + 0.373ρ<sub>B5</sub> + 0.085ρ<sub>B6</sub> + 0.072ρ<sub>B7</sub> − 0.0018 (Liang 2001)</li>
            <li><b>Indices:</b> division-by-zero and missing pixels return no-data; outliers are winsorised at the 0.2/99.8 percentiles.</li>
          </ul>
        </Card>
      </div>

      <Card className="mt-6" title="Region indicator table" bodyClass="p-0"
        actions={<div className="flex flex-wrap gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search region..." />
          <Select label="Land cover" value={lulc} onChange={setLulc} options={[{ value: '', label: 'All land cover' }, ...(d?.byLulc ?? []).map((b) => ({ value: b.lulc, label: b.lulc }))]} />
          <Select label="Sort" value={sort} onChange={setSort} options={[{ value: 'lst,desc', label: 'LST ↓' }, { value: 'lst,asc', label: 'LST ↑' }, { value: 'ndvi,asc', label: 'NDVI ↑' }, { value: 'ndbi,desc', label: 'NDBI ↓' }, { value: 'albedo,asc', label: 'Albedo ↑' }, { value: 'population,desc', label: 'Population ↓' }]} />
        </div>}>
        {rows.error ? <div className="p-5"><ErrorState message={rows.error} onRetry={rows.reload} /></div> : !rows.data ? <div className="p-5"><LoadingBlock rows={8} /></div> : (
          <>
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Region</th><th>LST</th><th>NDVI</th><th>NDBI</th><th>NDWI</th><th>Albedo</th><th>Land cover</th><th>Built</th><th>Green</th><th>Air temp</th><th>Pop. density</th><th>Valid px</th></tr></thead>
              <tbody className={rows.loading ? 'opacity-60' : ''}>{rows.data.content.map((r) => (
                <tr key={r.regionId}>
                  <td><p className="font-medium">{r.name}</p><p className="text-xs text-charcoal-400">{r.regionCode}</p></td>
                  <td>{fmtTemp(r.lstMean)}</td><td>{fmt(r.ndvi, 3)}</td><td>{fmt(r.ndbi, 3)}</td><td>{fmt(r.ndwi, 3)}</td><td>{fmt(r.albedo, 3)}</td>
                  <td className="whitespace-nowrap">{r.lulcName}</td><td>{fmtPct(r.builtFraction, 0)}</td><td>{fmtPct(r.vegetationFraction, 0)}</td>
                  <td>{fmtTemp(r.airTempMax)}</td><td>{fmtInt(r.populationDensity)}</td>
                  <td className={r.labelQualityOk ? '' : 'text-amber-600'}>{fmt(r.validPixelPct, 0)}%</td>
                </tr>
              ))}</tbody>
            </table></div>
            <Pagination page={rows.data.page} totalPages={rows.data.totalPages} total={rows.data.totalElements} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
