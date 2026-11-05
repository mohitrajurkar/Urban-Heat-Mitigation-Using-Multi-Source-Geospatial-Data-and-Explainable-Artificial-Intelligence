import { useState, type FormEvent } from 'react';
import { Database, Play, RefreshCcw, Trash2, Upload } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useRun } from '../hooks/useRun';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api, errorMessage } from '../services/api';
import { Card, ConfirmDialog, DemoBadge, EmptyState, ErrorState, LoadingBlock, Modal, PageHeader, ProgressBar, Select, Spinner } from '../components/ui';
import { fmtBytes, fmtDate, titleCase } from '../utils/format';
import type { Dataset, Run } from '../types';

const ROLES = [
  { key: 'landsat', label: 'Landsat 8/9 (required — thermal band for LST)', required: true },
  { key: 'sentinel2', label: 'Sentinel-2 (optional fusion for indices)' },
  { key: 'lulc', label: 'Land use / land cover' },
  { key: 'meteorological', label: 'Meteorological stations' },
  { key: 'population', label: 'Population' },
  { key: 'roads', label: 'Roads / infrastructure' },
];
const TYPE_HELP: Record<string, string> = {
  landsat: 'GeoTIFF stack with 7 bands in order B2, B3, B4, B5, B6, B7, B10 (Collection 2 L1 DN or L2).',
  sentinel2: 'GeoTIFF with bands B03, B04, B08, B11 (L2A, scaled ×10000).',
  lulc: 'Classified GeoTIFF (8-class scheme or ESA WorldCover codes).',
  population: 'GeoTIFF of persons per pixel, or CSV with latitude, longitude, population.',
  meteorological: 'CSV with station_id, latitude, longitude, date, air_temp_max_c (+ optional humidity, wind).',
  roads: 'GeoJSON LineStrings (e.g. OpenStreetMap export).',
  boundary: 'GeoJSON polygon of the study area.',
};

export default function DatasetsPage() {
  const { canEdit, isAdmin } = useAuth();
  const { notify } = useToast();
  const { runs, activeRun, refresh } = useRun();
  const ds = useApi<Dataset[]>('/datasets');
  const [upload, setUpload] = useState(false);
  const [toDelete, setToDelete] = useState<Dataset | null>(null);
  const [runToDelete, setRunToDelete] = useState<Run | null>(null);
  const [reset, setReset] = useState(false);
  const [busy, setBusy] = useState(false);

  async function deleteDataset() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.delete(`/datasets/${toDelete.id}`);
      notify('success', 'Dataset deleted', toDelete.name);
      ds.reload();
    } catch (e) {
      notify('error', 'Delete failed', errorMessage(e));
    } finally {
      setBusy(false);
      setToDelete(null);
    }
  }
  async function deleteRun() {
    if (!runToDelete) return;
    setBusy(true);
    try {
      await api.delete(`/analysis/runs/${runToDelete.id}`);
      notify('success', `Analysis run #${runToDelete.id} deleted`);
      await refresh();
    } catch (e) {
      notify('error', 'Delete failed', errorMessage(e));
    } finally {
      setBusy(false);
      setRunToDelete(null);
    }
  }
  async function resetDemo() {
    setBusy(true);
    try {
      await api.post('/analysis/reset-demo');
      notify('success', 'Demo data reset', 'All results were removed and the Nagpur demonstration analysis restarted.');
      await refresh();
    } catch (e) {
      notify('error', 'Reset failed', errorMessage(e));
    } finally {
      setBusy(false);
      setReset(false);
    }
  }

  return (
    <>
      <PageHeader icon={<Database className="h-5 w-5" />} title="Datasets & Analysis Runs"
        subtitle="Manage multi-source inputs (Landsat 8/9, Sentinel-2, LULC, meteorology, population, roads), then run the complete pipeline: preprocessing → indicators → ML → SHAP → hotspots → recommendations."
        actions={<>
          {isAdmin && <button className="btn-secondary" onClick={() => setReset(true)} disabled={!!activeRun}><RefreshCcw className="h-4 w-4" />Reset demo data</button>}
          {canEdit && <button className="btn-primary" onClick={() => setUpload(true)}><Upload className="h-4 w-4" />Upload dataset</button>}
        </>} />

      <Card title="Datasets" subtitle="Every dataset carries source, date, coverage and real / demonstration status" bodyClass="p-0">
        {ds.error ? <div className="p-5"><ErrorState message={ds.error} onRetry={ds.reload} /></div> : !ds.data ? <div className="p-5"><LoadingBlock rows={6} /></div> : ds.data.length === 0 ? (
          <EmptyState title="No datasets yet" message="The bundled demo datasets are registered automatically once the AI service is reachable." />
        ) : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Dataset</th><th>Type</th><th>Source</th><th>Collection date</th><th>Coverage</th><th>Format / size</th><th>Status</th><th /></tr></thead>
            <tbody>{ds.data.map((d) => (
              <tr key={d.id}>
                <td><p className="font-medium text-charcoal-900">{d.name}</p><p className="text-xs text-charcoal-400">{d.aiDatasetId}{d.uploadedBy ? ` · by ${d.uploadedBy}` : ''}</p></td>
                <td><span className="chip bg-forest-50 text-forest-800">{titleCase(d.dataType)}</span></td>
                <td className="max-w-xs text-xs text-charcoal-500">{d.source}</td>
                <td className="whitespace-nowrap text-xs">{d.collectionDate ?? '—'}</td>
                <td className="max-w-xs text-xs text-charcoal-500">{d.coverage ?? '—'}</td>
                <td className="whitespace-nowrap text-xs">{d.fileFormat} · {fmtBytes(d.fileSize)}</td>
                <td><DemoBadge demo={d.demo} /></td>
                <td>{canEdit && !d.aiDatasetId.startsWith('demo-') && <button className="btn-ghost btn-sm text-red-600" onClick={() => setToDelete(d)} aria-label={`Delete ${d.name}`}><Trash2 className="h-4 w-4" /></button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.2fr]">
        <RunForm datasets={ds.data ?? []} />
        <Card title="Analysis runs" subtitle="Progress refreshes automatically" bodyClass="p-0">
          {runs.length === 0 ? <EmptyState title="No analysis runs yet" /> : (
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Run</th><th>Status</th><th>Started</th><th>Duration</th><th>Data</th><th /></tr></thead>
              <tbody>{runs.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">#{r.id}<p className="text-[11px] font-normal text-charcoal-400">{r.aiRunId ?? 'queued'}</p></td>
                  <td className="min-w-[220px]">
                    <span className={`chip ${r.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : r.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-800'}`}>{r.status}</span>
                    {(r.status === 'RUNNING' || r.status === 'PENDING') && <div className="mt-2"><ProgressBar value={r.progress} /><p className="mt-1 text-[11px] text-charcoal-500">{r.currentStep} · {r.progress}%</p></div>}
                    {r.status === 'FAILED' && <p className="mt-1 text-[11px] text-red-600">{r.message}</p>}
                  </td>
                  <td className="whitespace-nowrap text-xs">{fmtDate(r.startedAt)}</td>
                  <td className="text-xs">{r.durationSeconds != null ? `${r.durationSeconds} s` : '—'}</td>
                  <td><DemoBadge demo={r.demo} /></td>
                  <td>{isAdmin && r.status !== 'RUNNING' && r.status !== 'PENDING' && <button className="btn-ghost btn-sm text-red-600" onClick={() => setRunToDelete(r)} aria-label={`Delete run ${r.id}`}><Trash2 className="h-4 w-4" /></button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      </div>

      <UploadModal open={upload} onClose={() => setUpload(false)} onDone={() => { setUpload(false); ds.reload(); }} />
      <ConfirmDialog open={!!toDelete} danger title="Delete dataset" confirmLabel="Delete" busy={busy} onCancel={() => setToDelete(null)} onConfirm={deleteDataset}
        message={<>Delete <b>{toDelete?.name}</b>? The file is removed from the AI service. Existing analysis results are not affected.</>} />
      <ConfirmDialog open={!!runToDelete} danger title="Delete analysis run" confirmLabel="Delete run" busy={busy} onCancel={() => setRunToDelete(null)} onConfirm={deleteRun}
        message={<>Delete run <b>#{runToDelete?.id}</b> and all of its stored regions, predictions, hotspots, recommendations and reports?</>} />
      <ConfirmDialog open={reset} danger title="Reset demo data" confirmLabel="Reset and re-run" busy={busy} onCancel={() => setReset(false)} onConfirm={resetDemo}
        message="This deletes every analysis run and report, then re-runs the complete Nagpur demonstration analysis (about one minute). Uploaded datasets are kept." />
    </>
  );
}

function RunForm({ datasets }: { datasets: Dataset[] }) {
  const { canEdit } = useAuth();
  const { activeRun, refresh } = useRun();
  const { notify } = useToast();
  const [sel, setSel] = useState<Record<string, string>>({ landsat: 'demo-landsat9', sentinel2: 'demo-sentinel2', lulc: 'demo-lulc', meteorological: 'demo-meteo', population: 'demo-population', roads: 'demo-roads' });
  const [nEst, setNEst] = useState(200);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const datasetsSel = Object.fromEntries(Object.entries(sel).filter(([, v]) => v));
      const { data } = await api.post<Run>('/analysis/runs', { datasets: datasetsSel, nEstimators: nEst });
      notify('success', `Analysis run #${data.id} started`, 'Progress is shown in the run list and sidebar.');
      void refresh();
    } catch (err) {
      notify('error', 'Could not start analysis', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="Run analysis" subtitle="Study area: Nagpur · choose a dataset for each role (demo datasets pre-selected)">
      <form onSubmit={submit} className="space-y-3">
        {ROLES.map((r) => (
          <div key={r.key}>
            <label className="label">{r.label}</label>
            <Select className="w-full" label={r.label} value={sel[r.key] ?? ''} onChange={(v) => setSel((s) => ({ ...s, [r.key]: v }))}
              options={[...(r.required ? [] : [{ value: '', label: '— not used —' }]), ...datasets.filter((d) => d.dataType === r.key).map((d) => ({ value: d.aiDatasetId, label: `${d.name}${d.demo ? ' (demo)' : ''}` }))]} />
          </div>
        ))}
        <div><label className="label">Trees / boosting rounds</label><input type="number" className="input w-40" min={20} max={1000} value={nEst} onChange={(e) => setNEst(Number(e.target.value))} /></div>
        <button className="btn-primary w-full" disabled={!canEdit || busy || !!activeRun || !sel.landsat}>
          {busy || activeRun ? <Spinner /> : <Play className="h-4 w-4" />}{activeRun ? `Running… ${activeRun.progress}%` : 'Start complete analysis'}
        </button>
        {!canEdit && <p className="text-xs text-charcoal-400">Your role is read-only. Sign in as analyst or admin to run analyses.</p>}
      </form>
    </Card>
  );
}

function UploadModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { notify } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState('meteorological');
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState('');
  const [coverage, setCoverage] = useState('');
  const [real, setReal] = useState(true);
  const [landsatParams, setLandsatParams] = useState('');
  const [lulcMapping, setLulcMapping] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return setErr('Choose a file to upload');
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append('file', file);
    const fields: Record<string, string> = { dataType: type, name, source, collectionDate: date, coverage, realData: String(real), landsatParams, lulcMapping };
    Object.entries(fields).forEach(([k, v]) => v && fd.append(k, v));
    try {
      await api.post('/datasets/upload', fd, { timeout: 600_000 });
      notify('success', 'Dataset uploaded and validated', file.name);
      setFile(null); setName(''); setSource(''); setDate(''); setCoverage('');
      onDone();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Upload dataset"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" form="upload-form" disabled={busy}>{busy && <Spinner />}Upload & validate</button></>}>
      <form id="upload-form" onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Data type</label>
          <Select className="w-full" label="Data type" value={type} onChange={setType} options={Object.keys(TYPE_HELP).map((k) => ({ value: k, label: titleCase(k) }))} />
          <p className="mt-1 text-xs text-charcoal-400">{TYPE_HELP[type]}</p>
        </div>
        <div>
          <label className="label" htmlFor="file">File (GeoTIFF, CSV or GeoJSON)</label>
          <input id="file" type="file" accept=".tif,.tiff,.csv,.geojson,.json" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Landsat 9 2025-05-02" /></div>
          <div><label className="label">Collection date</label><input className="input" value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" /></div>
          <div className="col-span-2"><label className="label">Source</label><input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="USGS EarthExplorer, Copernicus, IMD, WorldPop, OSM..." /></div>
          <div className="col-span-2"><label className="label">Geographic coverage</label><input className="input" value={coverage} onChange={(e) => setCoverage(e.target.value)} placeholder="e.g. Nagpur city, WRS-2 144/045" /></div>
        </div>
        {type === 'landsat' && <div><label className="label">Landsat MTL parameters (JSON, optional)</label><textarea className="input font-mono text-xs" rows={3} value={landsatParams} onChange={(e) => setLandsatParams(e.target.value)} placeholder='{"PRODUCT_LEVEL":"L1","SUN_ELEVATION":64.2,"REFLECTANCE_MULT":2e-5,"REFLECTANCE_ADD":-0.1}' /></div>}
        {type === 'lulc' && <div><label className="label">Class mapping</label><Select className="w-full" label="Class mapping" value={lulcMapping} onChange={setLulcMapping} options={[{ value: '', label: 'Native 8-class scheme' }, { value: 'esa_worldcover', label: 'ESA WorldCover codes' }]} /></div>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald-600" checked={real} onChange={(e) => setReal(e.target.checked)} />This is real observational data (uncheck for synthetic / demonstration data)</label>
        {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err}</p>}
      </form>
    </Modal>
  );
}
