import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BrainCircuit, Flame, Leaf, Lock, MapPinned, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { errorMessage } from '../services/api';
import { Spinner } from '../components/ui';

const DEMO = [
  { u: 'admin', p: 'Admin@123', role: 'Administrator' },
  { u: 'analyst', p: 'Analyst@123', role: 'GIS Analyst' },
  { u: 'viewer', p: 'Viewer@123', role: 'Project guide (read-only)' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get('expired') ? 'Your session expired. Please sign in again.' : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      nav('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-forest-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40"><Leaf className="h-6 w-6 text-emerald-300" /></div>
          <div>
            <p className="text-lg font-semibold">UrbanHeat AI</p>
            <p className="text-xs text-emerald-200/70">Urban Heat Mitigation Decision Support System</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <h1 className="text-4xl font-semibold leading-tight text-white">Find the hottest neighbourhoods. Explain why. Plan how to cool them.</h1>
          <p className="mt-4 text-emerald-100/80">
            Multi-source geospatial data, Random Forest &amp; XGBoost models and SHAP explainability for Urban Heat Island mitigation in Nagpur.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { icon: MapPinned, t: 'GIS analysis', d: 'LST, NDVI, NDBI, NDWI, albedo, LULC' },
              { icon: BrainCircuit, t: 'Explainable AI', d: 'RF, XGBoost and SHAP' },
              { icon: Flame, t: 'Action plans', d: 'Costed, prioritised strategies' },
            ].map(({ icon: I, t, d }) => (
              <div key={t} className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                <I className="mb-2 h-5 w-5 text-emerald-300" />
                <p className="text-sm font-semibold">{t}</p>
                <p className="mt-1 text-xs text-emerald-100/60">{d}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-emerald-200/50">Final Year B.Tech CSE Project · Study area: Nagpur, Maharashtra</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2 text-forest-800"><Leaf className="h-6 w-6" /><span className="text-lg font-semibold">UrbanHeat AI</span></div>
          </div>
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-charcoal-400">Use one of the demo accounts below.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="username">Username</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input id="username" className="input pl-9" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input id="password" type="password" className="input pl-9" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </div>
            </div>
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
            <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>{busy && <Spinner />}Sign in</button>
          </form>
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Demo accounts</p>
            <div className="space-y-1.5">
              {DEMO.map((d) => (
                <button key={d.u} type="button" onClick={() => { setUsername(d.u); setPassword(d.p); }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-emerald-50">
                  <span><span className="font-medium">{d.u}</span> <span className="text-charcoal-400">/ {d.p}</span></span>
                  <span className="text-xs text-charcoal-400">{d.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
