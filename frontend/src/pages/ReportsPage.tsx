import { useState, type FormEvent } from 'react';
import { Download, FileText, Trash2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useRun } from '../hooks/useRun';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api, downloadFile, errorMessage } from '../services/api';
import RunGate from '../components/RunGate';
import { Card, ConfirmDialog, EmptyState, ErrorState, LoadingBlock, PageHeader, Spinner } from '../components/ui';
import { fmtBytes, fmtDate } from '../utils/format';
import type { ReportSummary } from '../types';

const SECTIONS = ['Project information', 'Study area details', 'Dataset sources', 'Environmental indicator results', 'Hotspot analysis', 'AI model performance',
  'Prediction results', 'SHAP explanations', 'Mitigation recommendations', 'Estimated implementation costs', 'Expected cooling benefits', 'Final observations'];

export default function ReportsPage() {
  return <RunGate><Reports /></RunGate>;
}

function Reports() {
  const { canEdit } = useAuth();
  const { selectedRun } = useRun();
  const { notify } = useToast();
  const list = useApi<ReportSummary[]>('/reports');
  const [title, setTitle] = useState('Urban Heat Island Assessment – Nagpur');
  const [busy, setBusy] = useState(false);
  const [dl, setDl] = useState<number | null>(null);
  const [del, setDel] = useState<ReportSummary | null>(null);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post<{ id: number; fileName: string }>('/reports', { runId: selectedRun?.id, title });
      notify('success', 'Report generated', data.fileName);
      list.reload();
      await downloadFile(`/reports/${data.id}/download`, data.fileName);
    } catch (err) {
      notify('error', 'Report generation failed', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function download(r: ReportSummary) {
    setDl(r.id);
    try { await downloadFile(`/reports/${r.id}/download`, r.fileName); } catch (err) { notify('error', 'Download failed', errorMessage(err)); } finally { setDl(null); }
  }
  async function remove() {
    if (!del) return;
    try { await api.delete(`/reports/${del.id}`); notify('success', 'Report deleted'); list.reload(); } catch (err) { notify('error', 'Delete failed', errorMessage(err)); } finally { setDel(null); }
  }

  return (
    <>
      <PageHeader icon={<FileText className="h-5 w-5" />} title="Reports" subtitle="Generate a downloadable analytical PDF report from the results stored in PostgreSQL/PostGIS." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card title="Generate PDF report" subtitle={selectedRun ? `Analysis run #${selectedRun.id}${selectedRun.demo ? ' (demonstration data)' : ''}` : ''}>
          <form onSubmit={generate} className="space-y-4">
            <div><label className="label" htmlFor="title">Report title</label><input id="title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} required /></div>
            <div>
              <p className="label">Included sections</p>
              <ol className="grid grid-cols-1 gap-1 text-sm text-charcoal-600 sm:grid-cols-2">{SECTIONS.map((s, i) => <li key={s} className="flex gap-2"><span className="w-5 text-right text-charcoal-400">{i + 1}.</span>{s}</li>)}</ol>
            </div>
            <button className="btn-primary w-full" disabled={!canEdit || busy}>{busy ? <Spinner /> : <FileText className="h-4 w-4" />}{busy ? 'Generating…' : 'Generate & download PDF'}</button>
            {!canEdit && <p className="text-xs text-charcoal-400">Viewers can download existing reports; analysts and admins can generate new ones.</p>}
          </form>
        </Card>
        <Card title="Generated reports" bodyClass="p-0">
          {list.error ? <div className="p-5"><ErrorState message={list.error} onRetry={list.reload} /></div> : !list.data ? <div className="p-5"><LoadingBlock /></div> : list.data.length === 0 ? (
            <EmptyState title="No reports yet" message="Generate the first report with the form." icon={<FileText className="h-6 w-6" />} />
          ) : (
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Report</th><th>Run</th><th>Created</th><th>Size</th><th /></tr></thead>
              <tbody>{list.data.map((r) => (
                <tr key={r.id}>
                  <td><p className="font-medium">{r.title}</p><p className="text-xs text-charcoal-400">{r.fileName} · by {r.generatedBy}</p></td>
                  <td>#{r.runId}</td><td className="whitespace-nowrap text-xs">{fmtDate(r.createdAt)}</td><td className="text-xs">{fmtBytes(r.fileSize)}</td>
                  <td className="whitespace-nowrap">
                    <button className="btn-secondary btn-sm" onClick={() => download(r)} disabled={dl === r.id}>{dl === r.id ? <Spinner /> : <Download className="h-3.5 w-3.5" />}PDF</button>
                    {canEdit && <button className="btn-ghost btn-sm ml-1 text-red-600" onClick={() => setDel(r)} aria-label="Delete report"><Trash2 className="h-4 w-4" /></button>}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      </div>
      <ConfirmDialog open={!!del} danger title="Delete report" confirmLabel="Delete" onCancel={() => setDel(null)} onConfirm={remove} message={<>Delete <b>{del?.title}</b> ({del?.fileName})?</>} />
    </>
  );
}
