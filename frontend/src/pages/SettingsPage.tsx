import { useEffect, useState, type FormEvent } from 'react';
import { Activity, KeyRound, Settings, SlidersHorizontal, UserPlus, Users } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { useRun } from '../hooks/useRun';
import { useToast } from '../hooks/useToast';
import { api, errorMessage } from '../services/api';
import { Card, ErrorState, KeyValue, LoadingBlock, PageHeader, Select, Spinner } from '../components/ui';
import { COMPONENT_LABELS, fmtDate } from '../utils/format';
import type { Role, User } from '../types';

const KEYS = ['heat_severity', 'population_vulnerability', 'vegetation_deficit', 'implementation_feasibility', 'cooling_benefit'] as const;
const REQ_KEYS: Record<string, string> = { heat_severity: 'heatSeverity', population_vulnerability: 'populationVulnerability', vegetation_deficit: 'vegetationDeficit', implementation_feasibility: 'implementationFeasibility', cooling_benefit: 'coolingBenefit' };

export default function SettingsPage() {
  const { user, isAdmin } = useAuth();
  return (
    <>
      <PageHeader icon={<Settings className="h-5 w-5" />} title="Settings" subtitle="Priority weights, system status, account and user management." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <WeightsCard />
        <HealthCard />
        <AccountCard />
        {isAdmin ? <UsersCard /> : <Card title="User management"><p className="text-sm text-charcoal-400">Only administrators can manage users. You are signed in as <b>{user?.role}</b>.</p></Card>}
      </div>
    </>
  );
}

function WeightsCard() {
  const { canEdit } = useAuth();
  const { selectedRun, setSelectedRunId, selectedRunId } = useRun();
  const { notify } = useToast();
  const s = useApi<{ priorityWeights: Record<string, number>; defaultPriorityWeights: Record<string, number> }>('/settings');
  const [w, setW] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (s.data) setW(s.data.priorityWeights); }, [s.data]);
  const sum = KEYS.reduce((a, k) => a + (w[k] ?? 0), 0);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = Object.fromEntries(KEYS.map((k) => [REQ_KEYS[k], w[k] ?? 0]));
      const { data } = await api.post<{ rankedHotspots: number; levels: Record<string, number> }>('/priorities/recalculate', body, { params: selectedRun ? { runId: selectedRun.id } : {} });
      notify('success', 'Priorities recalculated', `${data.rankedHotspots} hotspots re-ranked: ${Object.entries(data.levels).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      setSelectedRunId(selectedRunId); // bump data version so other pages refresh
      s.reload();
    } catch (err) {
      notify('error', 'Could not recalculate', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title={<span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Hotspot priority weights</span>}
      subtitle="Score = 100 × Σ wᵢ × componentᵢ. Weights are normalised to sum to 1. Saving re-ranks the current run and applies to future runs.">
      {s.error ? <ErrorState message={s.error} onRetry={s.reload} /> : !s.data ? <LoadingBlock /> : (
        <form onSubmit={save} className="space-y-4">
          {KEYS.map((k) => (
            <div key={k}>
              <div className="mb-1 flex justify-between text-sm"><label htmlFor={k} className="font-medium">{COMPONENT_LABELS[k]}</label><span className="tabular-nums text-charcoal-500">{(w[k] ?? 0).toFixed(2)} → {sum > 0 ? (((w[k] ?? 0) / sum) * 100).toFixed(0) : 0}%</span></div>
              <input id={k} type="range" min={0} max={1} step={0.05} value={w[k] ?? 0} disabled={!canEdit} onChange={(e) => setW((x) => ({ ...x, [k]: Number(e.target.value) }))} className="w-full accent-emerald-600" />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!canEdit || busy || sum <= 0}>{busy && <Spinner />}Save & recalculate</button>
            <button type="button" className="btn-secondary" disabled={!canEdit} onClick={() => setW(s.data!.defaultPriorityWeights)}>Restore defaults</button>
          </div>
        </form>
      )}
    </Card>
  );
}

interface Health { backend: { status: string; version: string }; database: { status: string; postgres?: string; postgis?: string; error?: string }; aiService: { status: string; version?: string; python?: string; runs?: number; error?: string } }

function HealthCard() {
  const h = useApi<Health>('/system/health');
  const dot = (s?: string) => <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${s === 'UP' ? 'bg-emerald-500' : 'bg-red-500'}`} />;
  return (
    <Card title={<span className="flex items-center gap-2"><Activity className="h-4 w-4" />System status</span>} actions={<button className="btn-secondary btn-sm" onClick={h.reload}>Refresh</button>}>
      {h.error ? <ErrorState message={h.error} onRetry={h.reload} /> : !h.data ? <LoadingBlock /> : (
        <KeyValue items={[
          ['Spring Boot backend', <span key="b">{dot(h.data.backend.status)}{h.data.backend.status} · v{h.data.backend.version}</span>],
          ['PostgreSQL', <span key="d">{dot(h.data.database.status)}{h.data.database.postgres ?? h.data.database.error}</span>],
          ['PostGIS', h.data.database.postgis ?? '—'],
          ['Python AI service', <span key="a">{dot(h.data.aiService.status)}{h.data.aiService.status}{h.data.aiService.version ? ` · v${h.data.aiService.version}` : ''}</span>],
          ['AI runtime', h.data.aiService.python ? `Python ${h.data.aiService.python}` : h.data.aiService.error ?? '—'],
          ['AI analysis runs on disk', h.data.aiService.runs ?? '—'],
        ]} />
      )}
    </Card>
  );
}

function AccountCard() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  async function change(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: cur, newPassword: next });
      notify('success', 'Password changed');
      setCur(''); setNext('');
    } catch (err) {
      notify('error', 'Password not changed', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" />My account</span>}>
      <KeyValue items={[['Name', user?.fullName], ['Username', user?.username], ['Email', user?.email], ['Role', user?.role]]} />
      <form onSubmit={change} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div><label className="label" htmlFor="cur">Current password</label><input id="cur" type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
        <div><label className="label" htmlFor="new">New password (min 8)</label><input id="new" type="password" className="input" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required /></div>
        <button className="btn-secondary" disabled={busy}>{busy && <Spinner />}Change</button>
      </form>
    </Card>
  );
}

function UsersCard() {
  const { notify } = useToast();
  const { user: me } = useAuth();
  const list = useApi<User[]>('/users');
  const [form, setForm] = useState({ username: '', email: '', fullName: '', password: '', role: 'VIEWER' as Role });
  const [busy, setBusy] = useState(false);
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/users', form);
      notify('success', 'User created', form.username);
      setForm({ username: '', email: '', fullName: '', password: '', role: 'VIEWER' });
      list.reload();
    } catch (err) {
      notify('error', 'Could not create user', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function update(u: User, patch: Partial<Pick<User, 'role' | 'enabled'>>) {
    try { await api.patch(`/users/${u.id}`, patch); notify('success', 'User updated', u.username); list.reload(); } catch (err) { notify('error', 'Update failed', errorMessage(err)); }
  }
  return (
    <Card title={<span className="flex items-center gap-2"><Users className="h-4 w-4" />User management</span>} className="xl:col-span-2" bodyClass="p-0">
      {list.error ? <div className="p-5"><ErrorState message={list.error} onRetry={list.reload} /></div> : !list.data ? <div className="p-5"><LoadingBlock /></div> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th></tr></thead>
          <tbody>{list.data.map((u) => (
            <tr key={u.id}>
              <td><p className="font-medium">{u.fullName}</p><p className="text-xs text-charcoal-400">{u.username}</p></td>
              <td className="text-xs">{u.email}</td>
              <td><Select label="Role" value={u.role} onChange={(v) => update(u, { role: v as Role })} options={['ADMIN', 'ANALYST', 'VIEWER'].map((r) => ({ value: r, label: r }))} className="py-1 text-xs" /></td>
              <td><button className={`chip ${u.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`} disabled={u.username === me?.username} onClick={() => update(u, { enabled: !u.enabled })}>{u.enabled ? 'Active' : 'Disabled'}</button></td>
              <td className="text-xs">{fmtDate(u.lastLoginAt)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <form onSubmit={create} className="grid grid-cols-1 gap-3 border-t border-gray-100 p-5 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
        <div><label className="label">Username</label><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required minLength={3} /></div>
        <div><label className="label">Full name</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
        <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        <div><label className="label">Password</label><input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></div>
        <div><label className="label">Role</label><Select className="w-full" label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v as Role })} options={['VIEWER', 'ANALYST', 'ADMIN'].map((r) => ({ value: r, label: r }))} /></div>
        <button className="btn-primary" disabled={busy}>{busy ? <Spinner /> : <UserPlus className="h-4 w-4" />}Add user</button>
      </form>
    </Card>
  );
}
