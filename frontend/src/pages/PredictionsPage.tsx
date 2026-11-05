import { useEffect, useState, type FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { BrainCircuit, Play, RotateCcw, ShieldCheck, Wand2 } from 'lucide-react';
import { useApi, useDebounced } from '../hooks/useApi';
import { useRun, useRunParams } from '../hooks/useRun';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api, errorMessage } from '../services/api';
import RunGate from '../components/RunGate';
import { Card, ChartSkeleton, ConfirmDialog, ErrorState, KeyValue, LoadingBlock, PageHeader, Pagination, SearchInput, Select, SeverityBadge, Spinner, Tabs } from '../components/ui';
import ConfusionMatrix from '../charts/ConfusionMatrix';
import ShapWaterfall from '../charts/ShapWaterfall';
import { CHART } from '../utils/colors';
import { fmt, fmtTemp, modelLabel } from '../utils/format';
import type { Contribution, Evaluation, LocalExplanation, Page, PredictionRow, Severity } from '../types';

interface EvalResponse {
  runId: number;
  summary: { features: string[]; feature_labels: Record<string, string>; severity_thresholds: Record<string, number | string>; class_distribution: Record<string, number>;
    leakage_controls: string[]; split: { method: string; test_size: number }; n_labelled_regions: number; train_samples: number; test_samples: number; best_model: Record<string, string> };
  models: Evaluation[];
}

const FEATURE_INPUTS: { key: string; label: string; min: number; max: number; step: number; def: number }[] = [
  { key: 'ndvi_mean', label: 'NDVI', min: -0.5, max: 0.9, step: 0.01, def: 0.12 },
  { key: 'ndbi_mean', label: 'NDBI', min: -0.5, max: 0.5, step: 0.01, def: 0.12 },
  { key: 'ndwi_mean', label: 'NDWI', min: -0.8, max: 0.6, step: 0.01, def: -0.35 },
  { key: 'albedo_mean', label: 'Surface albedo', min: 0, max: 0.6, step: 0.005, def: 0.18 },
  { key: 'built_fraction', label: 'Built-up fraction', min: 0, max: 1, step: 0.01, def: 0.8 },
  { key: 'vegetation_fraction', label: 'Green cover fraction', min: 0, max: 1, step: 0.01, def: 0.05 },
  { key: 'water_fraction', label: 'Water fraction', min: 0, max: 1, step: 0.01, def: 0 },
  { key: 'open_land_fraction', label: 'Open land fraction', min: 0, max: 1, step: 0.01, def: 0.1 },
  { key: 'air_temp_max', label: 'Max air temp (°C)', min: 30, max: 50, step: 0.1, def: 42 },
  { key: 'relative_humidity', label: 'Relative humidity (%)', min: 5, max: 90, step: 1, def: 18 },
  { key: 'wind_speed', label: 'Wind speed (m/s)', min: 0, max: 10, step: 0.1, def: 2.6 },
  { key: 'population_density', label: 'Population density (/km²)', min: 0, max: 60000, step: 100, def: 15000 },
  { key: 'road_density', label: 'Road density (km/km²)', min: 0, max: 30, step: 0.1, def: 6 },
];

export default function PredictionsPage() {
  return <RunGate><Predictions /></RunGate>;
}

function Predictions() {
  const params = useRunParams();
  const ev = useApi<EvalResponse>('/predictions/evaluation', params);
  const [fiModel, setFiModel] = useState<'random_forest' | 'xgboost'>('xgboost');
  const models = ev.data?.models ?? [];
  const get = (m: string, t: string) => models.find((x) => x.modelName === m && x.task === t);

  return (
    <>
      <PageHeader icon={<BrainCircuit className="h-5 w-5" />} title="AI Predictions"
        subtitle="Random Forest and XGBoost models classify heat severity and predict land surface temperature from non-thermal features. Metrics are computed on a spatially separated hold-out set."
        actions={<RetrainButton />} />
      {ev.error && <ErrorState message={ev.error} onRetry={ev.reload} />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(['random_forest', 'xgboost'] as const).map((m) => {
          const c = get(m, 'classification');
          const r = get(m, 'regression');
          return (
            <div key={m} className="card card-pad">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">{modelLabel(m)}</h3>
                <div className="flex gap-1">
                  {c?.best && <span className="chip bg-emerald-100 text-emerald-800">Best classifier</span>}
                  {r?.best && <span className="chip bg-sky-100 text-sky-800">Best regressor</span>}
                </div>
              </div>
              {!c || !r ? <LoadingBlock rows={4} /> : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <Metric label="Accuracy" v={c.accuracy} /><Metric label="Precision (macro)" v={c.precision} /><Metric label="Recall (macro)" v={c.recall} /><Metric label="F1 (macro)" v={c.f1} />
                  <Metric label="R² (LST)" v={r.r2} /><Metric label="RMSE" v={r.rmse} unit="°C" d={2} /><Metric label="MAE" v={r.mae} unit="°C" d={2} />
                  <Metric label="Spatial 5-fold CV F1" v={c.cvMean} sub={`± ${fmt(c.cvStd, 3)}`} />
                </div>
              )}
              {c && <p className="mt-3 text-[11px] text-charcoal-400">Train accuracy {fmt(c.details.train_accuracy as number, 3)} · train R² {fmt(r?.details.train_r2 as number, 3)} · {c.trainSamples} train / {c.testSamples} test regions · fit {fmt(c.trainingSeconds, 2)} s</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Confusion matrices" subtitle="Heat-severity classification on the spatial test set">
          {!models.length ? <ChartSkeleton /> : (
            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
              {(['random_forest', 'xgboost'] as const).map((m) => { const c = get(m, 'classification'); return c?.confusionMatrix && <ConfusionMatrix key={m} title={modelLabel(m)} matrix={c.confusionMatrix} />; })}
            </div>
          )}
        </Card>
        <Card title="Observed vs predicted LST" subtitle="Regression hold-out set (dashed line = perfect prediction)">
          {!models.length ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0ee" />
                <XAxis type="number" dataKey="observed" name="Observed" unit="°C" domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v) => v.toFixed(0)} />
                <YAxis type="number" dataKey="predicted" name="Predicted" unit="°C" domain={['dataMin - 1', 'dataMax + 1']} width={55} tickFormatter={(v) => v.toFixed(0)} />
                <ZAxis range={[16, 16]} />
                <Tooltip formatter={(v: number) => `${v.toFixed(2)} °C`} />
                <Legend verticalAlign="top" height={26} />
                <ReferenceLine segment={[{ x: 28, y: 28 }, { x: 50, y: 50 }]} stroke="#9ca3af" strokeDasharray="5 5" />
                <Scatter isAnimationActive={false} name="Random Forest" data={get('random_forest', 'regression')?.details.scatter ?? []} fill={CHART.forest} fillOpacity={0.6} />
                <Scatter isAnimationActive={false} name="XGBoost" data={get('xgboost', 'regression')?.details.scatter ?? []} fill={CHART.amber} fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Feature importance" subtitle="Impurity (RF) / gain (XGBoost) importance of the LST regression model"
          actions={<Tabs value={fiModel} onChange={setFiModel} tabs={[{ value: 'xgboost', label: 'XGBoost' }, { value: 'random_forest', label: 'Random Forest' }]} />}>
          {!models.length ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={(get(fiModel, 'regression')?.featureImportance ?? []).map((f) => ({ name: f.label, v: f.importance }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0ee" />
                <XAxis type="number" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tickLine={false} />
                <YAxis type="category" dataKey="name" width={180} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, 'Importance']} />
                <Bar isAnimationActive={false} dataKey="v" fill={CHART.emerald} radius={3} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title="Training protocol" subtitle="How data leakage is prevented">
          {!ev.data ? <LoadingBlock /> : (
            <div className="space-y-4 text-sm">
              <KeyValue items={[
                ['Labelled regions', ev.data.summary.n_labelled_regions], ['Train / test', `${ev.data.summary.train_samples} / ${ev.data.summary.test_samples}`],
                ['Split', ev.data.summary.split.method], ['Features', ev.data.summary.features.length],
              ]} />
              <ul className="space-y-1.5">{ev.data.summary.leakage_controls.map((l) => <li key={l} className="flex gap-2 text-[13px] text-charcoal-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{l}</li>)}</ul>
              <div className="rounded-lg bg-gray-50 p-3 text-xs text-charcoal-500">
                <p className="mb-1 font-semibold text-charcoal-700">Severity labelling rule</p>
                {String(ev.data.summary.severity_thresholds.rule)}
                <p className="mt-1">μ = {fmt(ev.data.summary.severity_thresholds.mean as number, 2)} °C, σ = {fmt(ev.data.summary.severity_thresholds.std as number, 2)} °C</p>
                <p className="mt-1">Classes: {Object.entries(ev.data.summary.class_distribution).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <CustomPrediction />
      <PredictionTable />
    </>
  );
}

function Metric({ label, v, unit, d = 3, sub }: { label: string; v: number | null; unit?: string; d?: number; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-charcoal-400">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{fmt(v, d)}{unit && <span className="text-xs font-normal text-charcoal-400"> {unit}</span>}</p>
      {sub && <p className="text-[11px] text-charcoal-400">{sub}</p>}
    </div>
  );
}

function RetrainButton() {
  const { canEdit } = useAuth();
  const { activeRun, refresh } = useRun();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nEst, setNEst] = useState(200);
  const [depth, setDepth] = useState('');
  const [testSize, setTestSize] = useState(0.25);
  if (!canEdit) return null;
  async function run() {
    setBusy(true);
    try {
      await api.post('/analysis/runs', { nEstimators: nEst, maxDepth: depth ? Number(depth) : null, testSize });
      notify('success', 'Model training started', 'A new analysis run is retraining Random Forest and XGBoost. Results appear when it completes.');
      setOpen(false);
      void refresh();
    } catch (e) {
      notify('error', 'Could not start training', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="btn-primary" disabled={!!activeRun} onClick={() => setOpen(true)}>{activeRun ? <><Spinner />Training… {activeRun.progress}%</> : <><RotateCcw className="h-4 w-4" />Retrain models</>}</button>
      <ConfirmDialog open={open} title="Retrain models" confirmLabel="Start training" busy={busy} onCancel={() => setOpen(false)} onConfirm={run}
        message={<div className="space-y-3">
          <p>Runs the full pipeline again with the same datasets and these hyper-parameters (about one minute).</p>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Trees / rounds</label><input type="number" className="input" min={20} max={1000} value={nEst} onChange={(e) => setNEst(Number(e.target.value))} /></div>
            <div><label className="label">Max depth</label><input type="number" className="input" placeholder="auto" min={2} max={30} value={depth} onChange={(e) => setDepth(e.target.value)} /></div>
            <div><label className="label">Test share</label><input type="number" className="input" step={0.05} min={0.1} max={0.5} value={testSize} onChange={(e) => setTestSize(Number(e.target.value))} /></div>
          </div>
        </div>} />
    </>
  );
}

interface CustomResult { results: { predicted_class: Severity; predicted_value: number; base_value: number; explanation: string; contributions: Contribution[]; models: Record<string, { predicted_class: Severity; predicted_lst: number; class_probabilities: Record<string, number> }>; explainer_model: string }[] }

function CustomPrediction() {
  const params = useRunParams();
  const { notify } = useToast();
  const [vals, setVals] = useState<Record<string, number>>(Object.fromEntries(FEATURE_INPUTS.map((f) => [f.key, f.def])));
  const [res, setRes] = useState<CustomResult['results'][0] | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post<CustomResult>('/predictions/custom', { features: [vals] }, { params: params.runId ? { runId: params.runId } : {} });
      setRes(data.results[0]);
    } catch (err) {
      notify('error', 'Prediction failed', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const presets: Record<string, Partial<Record<string, number>>> = {
    'Dense market area': { ndvi_mean: 0.08, ndbi_mean: 0.15, built_fraction: 0.95, vegetation_fraction: 0.02, open_land_fraction: 0.02, albedo_mean: 0.17, population_density: 25000 },
    'Green residential': { ndvi_mean: 0.4, ndbi_mean: -0.1, built_fraction: 0.45, vegetation_fraction: 0.4, open_land_fraction: 0.05, population_density: 9000 },
    'Lake-side park': { ndvi_mean: 0.55, ndbi_mean: -0.25, ndwi_mean: -0.1, built_fraction: 0.05, vegetation_fraction: 0.7, water_fraction: 0.2, open_land_fraction: 0.05, population_density: 500 },
  };

  return (
    <Card className="mt-6" title="Run a custom prediction" subtitle="Enter feature values for any location; both models predict, and SHAP explains the XGBoost prediction."
      actions={<div className="flex flex-wrap gap-1">{Object.entries(presets).map(([n, p]) => <button key={n} className="btn-secondary btn-sm" onClick={() => setVals((v) => ({ ...v, ...p } as Record<string, number>))}>{n}</button>)}</div>}>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <form onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FEATURE_INPUTS.map((f) => (
              <div key={f.key}>
                <label className="label" htmlFor={f.key}>{f.label}</label>
                <input id={f.key} type="number" className="input" min={f.min} max={f.max} step={f.step} value={vals[f.key]} required
                  onChange={(e) => setVals((v) => ({ ...v, [f.key]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
          <button className="btn-emerald mt-4" disabled={busy}>{busy ? <Spinner /> : <Wand2 className="h-4 w-4" />}Predict & explain</button>
        </form>
        <div>
          {!res ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 text-center text-sm text-charcoal-400">
              <Play className="mb-2 h-6 w-6" />Results and the SHAP explanation will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(res.models).map(([m, r]) => (
                  <div key={m} className="rounded-xl border border-gray-200 p-3">
                    <p className="text-xs text-charcoal-400">{modelLabel(m)}</p>
                    <div className="mt-1 flex items-center justify-between"><SeverityBadge severity={r.predicted_class} /><span className="font-semibold">{fmtTemp(r.predicted_lst)}</span></div>
                    <p className="mt-1 text-[11px] text-charcoal-400">P(class) {Object.entries(r.class_probabilities).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' · ')}</p>
                  </div>
                ))}
              </div>
              <p className="rounded-lg bg-forest-50 p-3 text-[13px] leading-relaxed text-forest-900">{res.explanation}</p>
              <ShapWaterfall explanation={{ baseValue: res.base_value, predictedValue: res.predicted_value, contributions: res.contributions, model: res.explainer_model } as LocalExplanation} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function PredictionTable() {
  const [search, setSearch] = useState('');
  const [cls, setCls] = useState('');
  const [dis, setDis] = useState(false);
  const [page, setPage] = useState(0);
  const q = useDebounced(search);
  useEffect(() => setPage(0), [q, cls, dis]);
  const { data, loading, error, reload } = useApi<Page<PredictionRow>>('/predictions', useRunParams({ search: q || undefined, predictedClass: cls || undefined, disagreementsOnly: dis, page, size: 15 }));
  return (
    <Card className="mt-6" title="Prediction results" subtitle="All regions · observed class from LST thresholds vs model predictions" bodyClass="p-0"
      actions={<div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search region..." />
        <Select label="Predicted class" value={cls} onChange={setCls} options={[{ value: '', label: 'All predicted classes' }, ...['Very High', 'High', 'Moderate', 'Low'].map((c) => ({ value: c, label: c }))]} />
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="accent-emerald-600" checked={dis} onChange={(e) => setDis(e.target.checked)} />Misclassified only</label>
      </div>}>
      {error ? <div className="p-5"><ErrorState message={error} onRetry={reload} /></div> : !data ? <div className="p-5"><LoadingBlock rows={8} /></div> : (
        <>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Region</th><th>Observed LST</th><th>Observed class</th><th>RF class</th><th>RF LST</th><th>XGB class</th><th>XGB LST</th><th>XGB P(Very High)</th></tr></thead>
            <tbody className={loading ? 'opacity-60' : ''}>{data.content.map((p) => {
              const rf = p.models.random_forest, xg = p.models.xgboost;
              return (
                <tr key={p.regionId}>
                  <td><p className="font-medium">{p.name}</p><p className="text-xs text-charcoal-400">{p.regionCode}</p></td>
                  <td>{p.observedLst != null ? fmtTemp(p.observedLst) : <span className="text-xs text-amber-600">data gap</span>}</td>
                  <td><SeverityBadge severity={p.observedClass} /></td>
                  <td><SeverityBadge severity={rf?.predictedClass} /></td><td>{fmtTemp(rf?.predictedLst)}</td>
                  <td><SeverityBadge severity={xg?.predictedClass} /></td><td>{fmtTemp(xg?.predictedLst)}</td>
                  <td>{xg ? `${((xg.probabilities?.['Very High'] ?? 0) * 100).toFixed(0)}%` : '—'}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.totalElements} onPage={setPage} />
        </>
      )}
    </Card>
  );
}
