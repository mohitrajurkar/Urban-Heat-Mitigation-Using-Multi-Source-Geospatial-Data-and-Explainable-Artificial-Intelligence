import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  BarChart3, BrainCircuit, Calculator, Database, FileText, Flame, Gauge, Leaf, LogOut, Map as MapIcon, Menu, Settings,
  Sparkles, Sprout, X, Layers,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useRun } from '../hooks/useRun';
import { ProgressBar } from '../components/ui';
import { fmtDate } from '../utils/format';

const NAV = [
  { to: '/', label: 'Dashboard', icon: Gauge, end: true },
  { to: '/map', label: 'GIS Heat Map', icon: MapIcon },
  { to: '/hotspots', label: 'Hotspot Analysis', icon: Flame },
  { to: '/indicators', label: 'Environmental Indicators', icon: Layers },
  { to: '/predictions', label: 'AI Predictions', icon: BrainCircuit },
  { to: '/explainability', label: 'Explainable AI', icon: Sparkles },
  { to: '/recommendations', label: 'Mitigation Strategies', icon: Sprout },
  { to: '/costs', label: 'Cost Analysis', icon: Calculator },
  { to: '/datasets', label: 'Datasets & Analysis', icon: Database },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { completed, selectedRun, selectedRunId, setSelectedRunId, activeRun } = useRun();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const current = NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));

  const sidebar = (
    <div className="flex h-full flex-col bg-gradient-to-b from-forest-900 via-forest-900 to-forest-950 text-white">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40">
          <Leaf className="h-5 w-5 text-emerald-300" />
        </div>
        <div>
          <p className="text-[15px] font-semibold leading-tight">UrbanHeat AI</p>
          <p className="text-[11px] text-emerald-200/70">Heat Mitigation DSS</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Main navigation">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => clsx('nav-item', isActive && 'nav-item-active')}>
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      {activeRun && (
        <div className="mx-3 mb-3 rounded-xl bg-white/10 p-3 text-xs">
          <p className="mb-1 font-semibold text-emerald-200">Analysis running · {activeRun.progress}%</p>
          <p className="mb-2 line-clamp-2 text-white/70">{activeRun.currentStep}</p>
          <ProgressBar value={activeRun.progress} className="bg-white/20" />
        </div>
      )}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/25 text-sm font-semibold text-emerald-100">
            {user?.fullName?.[0] ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.fullName}</p>
            <p className="text-[11px] text-emerald-200/70">{user?.role}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-2xl">
            {sidebar}
            <button className="absolute right-3 top-5 rounded-lg p-1.5 text-white/80 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/85 px-4 backdrop-blur sm:px-6">
          <button className="btn-ghost -ml-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-charcoal-400">Nagpur, Maharashtra · Study area</p>
            <p className="truncate text-sm font-semibold text-charcoal-900">{current?.label ?? 'UrbanHeat AI'}</p>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="hidden h-4 w-4 text-charcoal-400 sm:block" />
            <select
              className="input w-auto max-w-[230px] py-1.5 text-xs"
              aria-label="Analysis run"
              value={selectedRunId ?? ''}
              onChange={(e) => setSelectedRunId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Latest analysis{selectedRun && selectedRunId == null ? ` (#${selectedRun.id})` : ''}</option>
              {completed.map((r) => (
                <option key={r.id} value={r.id}>Run #{r.id} · {fmtDate(r.completedAt)}{r.demo ? ' · demo' : ''}</option>
              ))}
            </select>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
