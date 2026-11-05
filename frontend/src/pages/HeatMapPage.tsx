import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, GeoJSON, ImageOverlay, LayersControl, MapContainer, Popup, Rectangle, ScaleControl, TileLayer, ZoomControl } from 'react-leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import type { Layer, PathOptions } from 'leaflet';
import { Map as MapIcon } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useRunParams } from '../hooks/useRun';
import { fetchObjectUrl } from '../services/api';
import RunGate from '../components/RunGate';
import { Card, ErrorState, LoadingBlock, PageHeader, Select } from '../components/ui';
import RegionDetailPanel from '../maps/RegionDetailPanel';
import { PRIORITY_COLORS, RAMPS, rampColor, SEVERITY_COLORS, SEVERITY_ORDER, STRATEGY_COLORS, STRATEGY_NAMES } from '../utils/colors';
import { fmt, fmtInr, fmtTemp } from '../utils/format';
import type { InterventionMarker, LayerMeta, RegionFeature } from '../types';

type Indicator = 'lst' | 'predictedLst' | 'severity' | 'ndvi' | 'ndbi' | 'ndwi' | 'albedo' | 'lulc' | 'priorityScore' | 'populationDensity';
const INDICATORS: { value: Indicator; label: string; raster?: string }[] = [
  { value: 'lst', label: 'Land Surface Temperature (°C)', raster: 'lst' },
  { value: 'severity', label: 'Heat severity class' },
  { value: 'predictedLst', label: 'AI-predicted LST (°C)' },
  { value: 'priorityScore', label: 'Hotspot priority score' },
  { value: 'ndvi', label: 'NDVI (vegetation)', raster: 'ndvi' },
  { value: 'ndbi', label: 'NDBI (built-up)', raster: 'ndbi' },
  { value: 'ndwi', label: 'NDWI (water)', raster: 'ndwi' },
  { value: 'albedo', label: 'Surface albedo', raster: 'albedo' },
  { value: 'lulc', label: 'Land use / land cover', raster: 'lulc' },
  { value: 'populationDensity', label: 'Population density' },
];
const LULC_COLORS: Record<number, string> = { 1: '#2b7bba', 2: '#1b5e20', 3: '#66bb6a', 4: '#d4c26a', 5: '#c8a27a', 6: '#e57373', 7: '#b71c1c', 8: '#6d4c41' };
const CENTER: [number, number] = [21.14, 79.08];

export default function HeatMapPage() {
  return <RunGate><HeatMap /></RunGate>;
}

function HeatMap() {
  const params = useRunParams();
  const regions = useApi<FeatureCollection>('/map/regions', params);
  const layers = useApi<{ layers: Record<string, LayerMeta> }>('/map/layers', params);
  const markers = useApi<InterventionMarker[]>('/map/interventions', params);

  const [indicator, setIndicator] = useState<Indicator>('lst');
  const [mode, setMode] = useState<'regions' | 'raster'>('regions');
  const [opacity, setOpacity] = useState(0.75);
  const [showHotspots, setShowHotspots] = useState(false);
  const [onlySignificant, setOnlySignificant] = useState(false);
  const [showInterventions, setShowInterventions] = useState(false);
  const [strategy, setStrategy] = useState('all');
  const [selected, setSelected] = useState<number | null>(null);
  const [rasterUrl, setRasterUrl] = useState<string | null>(null);

  const rasterKey = INDICATORS.find((i) => i.value === indicator)?.raster;
  const effectiveMode = rasterKey ? mode : 'regions';

  useEffect(() => {
    let url: string | null = null;
    setRasterUrl(null);
    if (effectiveMode === 'raster' && rasterKey) {
      fetchObjectUrl(`/map/layers/${rasterKey}.png`, params).then((u) => { url = u; setRasterUrl(u); }).catch(() => setRasterUrl(null));
    }
    return () => { if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMode, rasterKey, params._v, params.runId]);

  const features = (regions.data?.features ?? []) as unknown as RegionFeature[];
  const range = useMemo(() => {
    const vals = features.map((f) => f.properties[indicator as keyof RegionFeature['properties']] as number).filter((v) => typeof v === 'number').sort((a, b) => a - b);
    if (!vals.length) return [0, 1];
    return [vals[Math.floor(vals.length * 0.02)], vals[Math.floor(vals.length * 0.98)]];
  }, [features, indicator]);

  const colorFor = (p: RegionFeature['properties']): string => {
    if (indicator === 'severity') return p.severity ? SEVERITY_COLORS[p.severity] : '#cbd5e1';
    if (indicator === 'lulc') return p.lulc ? LULC_COLORS[p.lulc] : '#cbd5e1';
    const v = p[indicator as keyof typeof p] as number | null | undefined;
    if (v == null) return indicator === 'priorityScore' ? 'transparent' : '#cbd5e1';
    return rampColor(RAMPS[indicator] ?? RAMPS.lst, (v - range[0]) / (range[1] - range[0] || 1));
  };

  const style = (f?: Feature): PathOptions => {
    const p = (f as unknown as RegionFeature).properties;
    const sel = p.regionId === selected;
    const fillOpacity = effectiveMode === 'raster' ? 0 : indicator === 'priorityScore' && p.priorityScore == null ? 0.05 : opacity;
    return { fillColor: colorFor(p), fillOpacity, color: sel ? '#111827' : effectiveMode === 'raster' ? '#ffffff55' : '#ffffff', weight: sel ? 2.5 : 0.3 };
  };

  const onEach = (f: Feature, layer: Layer) => {
    const p = (f as unknown as RegionFeature).properties;
    layer.bindTooltip(`<b>${p.name}</b><br/>LST ${fmt(p.lst, 1)} °C · ${p.severity ?? ''}${p.priorityLevel ? ` · ${p.priorityLevel} priority` : ''}`, { sticky: true });
    layer.on('click', () => setSelected(p.regionId));
  };

  const hotspotPoints = features.filter((f) => f.properties.isHotspot && (!onlySignificant || f.properties.giStarSignificant));
  const interventionPoints = (markers.data ?? []).filter((m) => strategy === 'all' || m.type === strategy);
  const meta = layers.data?.layers?.[rasterKey ?? ''];
  const bounds = layers.data?.layers?.lst?.bounds;

  if (regions.error) return <ErrorState message={regions.error} onRetry={regions.reload} />;

  return (
    <>
      <PageHeader icon={<MapIcon className="h-5 w-5" />} title="GIS Heat Map" subtitle="Interactive map of Nagpur. Choose an indicator, switch between 500 m regions and 100 m pixel rasters, and click any region for its full profile." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card title="Layers">
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="ind">Indicator</label>
                <Select className="w-full" label="Indicator" value={indicator} onChange={(v) => setIndicator(v as Indicator)} options={INDICATORS.map((i) => ({ value: i.value, label: i.label }))} />
              </div>
              <div>
                <span className="label">Display</span>
                <div className="grid grid-cols-2 gap-2">
                  <button className={effectiveMode === 'regions' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setMode('regions')}>Regions (500 m)</button>
                  <button className={effectiveMode === 'raster' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} disabled={!rasterKey} onClick={() => setMode('raster')}
                    title={rasterKey ? '' : 'Pixel raster not available for this indicator'}>Pixels (100 m)</button>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="op">Opacity {Math.round(opacity * 100)}%</label>
                <input id="op" type="range" min={0.2} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-emerald-600" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald-600" checked={showHotspots} onChange={(e) => setShowHotspots(e.target.checked)} />Hotspot markers ({hotspotPoints.length})</label>
              <label className="ml-6 flex items-center gap-2 text-xs text-charcoal-500"><input type="checkbox" className="accent-emerald-600" checked={onlySignificant} onChange={(e) => setOnlySignificant(e.target.checked)} />Only Gi* significant clusters</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald-600" checked={showInterventions} onChange={(e) => setShowInterventions(e.target.checked)} />Recommended interventions</label>
              {showInterventions && (
                <Select className="w-full" label="Strategy filter" value={strategy} onChange={setStrategy}
                  options={[{ value: 'all', label: `All strategies (${markers.data?.length ?? 0})` }, ...Object.entries(STRATEGY_NAMES).map(([k, v]) => ({ value: k, label: v }))]} />
              )}
            </div>
          </Card>
          <Card title="Legend">
            <Legend indicator={indicator} range={range} meta={effectiveMode === 'raster' ? meta : undefined} />
            {showHotspots && (
              <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-charcoal-500">
                <p className="mb-1 font-medium">Hotspot markers</p>
                {(['High', 'Very High'] as const).map((s) => <p key={s} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-white" style={{ background: SEVERITY_COLORS[s], boxShadow: '0 0 0 1px #0002' }} />{s}</p>)}
              </div>
            )}
            {showInterventions && (
              <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-charcoal-500">
                {Object.entries(STRATEGY_NAMES).map(([k, v]) => <p key={k} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rotate-45" style={{ background: STRATEGY_COLORS[k] }} />{v}</p>)}
              </div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className={`card relative overflow-hidden ${selected ? '' : 'lg:col-span-2'}`} style={{ height: 'calc(100vh - 190px)', minHeight: 520 }}>
            {regions.loading && <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70"><LoadingBlock rows={3} className="w-60" /></div>}
            <MapContainer center={CENTER} zoom={12} minZoom={10} maxZoom={17} zoomControl={false} preferCanvas className="h-full w-full">
              <ZoomControl position="topright" />
              <ScaleControl position="bottomleft" />
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="OpenStreetMap">
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satellite (Esri)">
                  <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="No basemap (offline)">
                  <TileLayer url="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" />
                </LayersControl.BaseLayer>
              </LayersControl>
              {bounds && <Rectangle bounds={[[bounds[1], bounds[0]], [bounds[3], bounds[2]]]} pathOptions={{ color: '#14532d', weight: 2, fill: false, dashArray: '6 4' }} />}
              {effectiveMode === 'raster' && rasterUrl && meta && (
                <ImageOverlay url={rasterUrl} bounds={[[meta.bounds[1], meta.bounds[0]], [meta.bounds[3], meta.bounds[2]]]} opacity={opacity} />
              )}
              {regions.data && (
                <GeoJSON key={`${indicator}-${effectiveMode}-${opacity}-${selected}-${regions.data.features.length}`} data={regions.data} style={style} onEachFeature={onEach} />
              )}
              {showHotspots && hotspotPoints.map((f) => (
                <CircleMarker key={f.properties.regionId} center={centroid(f)} radius={f.properties.severity === 'Very High' ? 5 : 3.5}
                  pathOptions={{ color: '#fff', weight: 1, fillColor: SEVERITY_COLORS[f.properties.severity ?? 'High'], fillOpacity: 0.95 }}
                  eventHandlers={{ click: () => setSelected(f.properties.regionId) }}>
                  <Popup>
                    <p className="font-semibold">{f.properties.name}</p>
                    <p>{f.properties.severity} heat · LST {fmtTemp(f.properties.lst)}</p>
                    <p>Priority: <b style={{ color: f.properties.priorityLevel ? PRIORITY_COLORS[f.properties.priorityLevel] : undefined }}>{f.properties.priorityLevel ?? '—'}</b> (score {fmt(f.properties.priorityScore, 1)}, rank #{f.properties.rank ?? '—'})</p>
                    <p>Gi* z = {fmt(f.properties.giStarZ, 2)}{f.properties.giStarSignificant ? ' (significant)' : ''}</p>
                  </Popup>
                </CircleMarker>
              ))}
              {showInterventions && interventionPoints.map((m) => (
                <CircleMarker key={m.id} center={[m.lat, m.lon]} radius={4} pathOptions={{ color: '#fff', weight: 1, fillColor: STRATEGY_COLORS[m.type], fillOpacity: 1 }}>
                  <Popup>
                    <p className="font-semibold">{m.name}</p>
                    <p>{m.regionName}</p>
                    <p>Expected cooling −{fmt(m.coolingC, 2)} °C · {fmtInr(m.costInr)}</p>
                    <p>Priority: {m.priorityLevel}</p>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          {selected && <div style={{ height: 'calc(100vh - 190px)', minHeight: 520 }}><RegionDetailPanel regionId={selected} onClose={() => setSelected(null)} /></div>}
        </div>
      </div>
    </>
  );
}

function centroid(f: RegionFeature): [number, number] {
  const ring = f.geometry.coordinates[0];
  const n = ring.length - 1;
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
  return [y / n, x / n];
}

function Legend({ indicator, range, meta }: { indicator: Indicator; range: number[]; meta?: LayerMeta }) {
  if (indicator === 'severity') {
    return <div className="space-y-1 text-xs">{SEVERITY_ORDER.map((s) => <p key={s} className="flex items-center gap-2"><span className="h-3 w-5 rounded" style={{ background: SEVERITY_COLORS[s] }} />{s}</p>)}</div>;
  }
  if (indicator === 'lulc') {
    const names = ['', 'Water', 'Forest', 'Urban green', 'Agriculture', 'Barren', 'Residential', 'Commercial', 'Industrial'];
    return <div className="grid grid-cols-2 gap-1 text-xs">{Object.entries(LULC_COLORS).map(([k, c]) => <p key={k} className="flex items-center gap-2"><span className="h-3 w-4 rounded" style={{ background: c }} />{names[Number(k)]}</p>)}</div>;
  }
  const lo = meta?.vmin ?? range[0];
  const hi = meta?.vmax ?? range[1];
  const ramp = meta?.stops?.map((s) => s.color) ?? RAMPS[indicator] ?? RAMPS.lst;
  const digits = ['lst', 'predictedLst', 'priorityScore'].includes(indicator) ? 1 : indicator === 'populationDensity' ? 0 : 2;
  return (
    <div>
      <div className="h-3 w-full rounded" style={{ background: `linear-gradient(90deg, ${ramp.join(',')})` }} />
      <div className="mt-1 flex justify-between text-xs text-charcoal-500"><span>{fmt(lo, digits)}</span><span>{fmt((lo + hi) / 2, digits)}</span><span>{fmt(hi, digits)}</span></div>
      <p className="mt-1 text-[11px] text-charcoal-400">2nd–98th percentile stretch{meta ? ' · 100 m pixels' : ' · 500 m regions'}</p>
    </div>
  );
}
