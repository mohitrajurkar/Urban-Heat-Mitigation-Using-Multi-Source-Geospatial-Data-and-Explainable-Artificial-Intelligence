import { useEffect, type ReactNode } from 'react';
import clsx from 'clsx';
import { AlertTriangle, ChevronLeft, ChevronRight, FlaskConical, Inbox, Loader2, RefreshCw, Search, X } from 'lucide-react';
import type { PriorityLevel, Severity } from '../types';
import { PRIORITY_COLORS, SEVERITY_COLORS } from '../utils/colors';

export function PageHeader({ title, subtitle, icon, actions }: { title: string; subtitle?: string; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-800 text-emerald-300 shadow-sm">{icon}</div>}
        <div>
          <h1 className="text-[22px] font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-charcoal-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className, bodyClass }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={clsx('card', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={clsx('p-5', bodyClass)}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, sub, icon, accent = 'emerald', loading }: {
  label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; accent?: 'emerald' | 'red' | 'amber' | 'blue' | 'forest' | 'slate'; loading?: boolean;
}) {
  const tone = {
    emerald: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-sky-50 text-sky-700', forest: 'bg-forest-100 text-forest-800', slate: 'bg-slate-100 text-slate-700',
  }[accent];
  return (
    <div className="card card-pad flex items-start gap-4 transition-shadow hover:shadow-lift">
      <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tone)}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal-400">{label}</p>
        {loading ? <div className="skeleton mt-2 h-7 w-24" /> : <p className="mt-1 truncate text-2xl font-semibold text-charcoal-900">{value}</p>}
        {sub && !loading && <p className="mt-0.5 text-xs text-charcoal-400">{sub}</p>}
      </div>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity?: Severity | null }) {
  if (!severity) return <span className="text-xs text-gray-400">—</span>;
  const c = SEVERITY_COLORS[severity];
  return <span className="chip" style={{ background: `${c}1a`, color: c, border: `1px solid ${c}40` }}>{severity}</span>;
}

export function PriorityBadge({ level }: { level?: PriorityLevel | null }) {
  if (!level) return <span className="text-xs text-gray-400">—</span>;
  const c = PRIORITY_COLORS[level];
  return (
    <span className="chip" style={{ background: `${c}14`, color: c, border: `1px solid ${c}40` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {level}
    </span>
  );
}

export function DemoBadge({ demo }: { demo: boolean }) {
  return demo ? (
    <span className="chip border border-amber-300 bg-amber-50 text-amber-700"><FlaskConical className="h-3 w-3" />Synthetic demo</span>
  ) : (
    <span className="chip border border-emerald-300 bg-emerald-50 text-emerald-700">Real data</span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

export function LoadingBlock({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={clsx('space-y-3', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className={clsx('h-4', i % 3 === 2 ? 'w-2/3' : 'w-full')} />)}
    </div>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="flex items-end gap-2 px-2" style={{ height }} aria-busy="true">
      {[40, 65, 50, 85, 70, 95, 60, 45, 75, 55].map((h, i) => <div key={i} className="skeleton flex-1" style={{ height: `${h}%` }} />)}
    </div>
  );
}

export function EmptyState({ title, message, action, icon }: { title: string; message?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest-50 text-forest-700">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="font-semibold text-charcoal-800">{title}</p>
      {message && <p className="mt-1 max-w-md text-sm text-charcoal-400">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/60 px-6 py-10 text-center" role="alert">
      <AlertTriangle className="mb-2 h-7 w-7 text-red-500" />
      <p className="font-semibold text-red-800">Something went wrong</p>
      <p className="mt-1 max-w-lg text-sm text-red-700/80">{message}</p>
      {onRetry && <button className="btn-secondary mt-4" onClick={onRetry}><RefreshCw className="h-4 w-4" />Retry</button>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-4 w-4 animate-spin', className)} />;
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-gray-200', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-forest-700 transition-all duration-500" style={{ width: `${Math.max(2, value)}%` }} />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'Search...'} aria-label={placeholder ?? 'Search'} />
    </div>
  );
}

export function Select({ value, onChange, options, label, className }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label?: string; className?: string;
}) {
  return (
    <select className={clsx('input w-auto pr-8', className)} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return <p className="px-4 py-3 text-xs text-charcoal-400">{total.toLocaleString('en-IN')} records</p>;
  return (
    <div className="flex items-center justify-between px-4 py-3 text-xs text-charcoal-500">
      <span>{total.toLocaleString('en-IN')} records · page {page + 1} of {totalPages}</span>
      <div className="flex gap-1">
        <button className="btn-secondary btn-sm" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        <button className="btn-secondary btn-sm" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1500] flex items-start justify-center overflow-y-auto bg-charcoal-900/50 p-4 backdrop-blur-[2px] sm:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={clsx('card animate-slide-in my-8 w-full', wide ? 'max-w-4xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}
      footer={<>
        <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>{busy && <Spinner />}{confirmLabel}</button>
      </>}>
      <div className="flex gap-3">
        <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', danger ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700')}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="text-sm text-charcoal-600">{message}</div>
      </div>
    </Modal>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={t.value === value} onClick={() => onChange(t.value)}
          className={clsx('rounded-md px-3 py-1.5 text-xs font-medium transition-colors', t.value === value ? 'bg-white text-forest-800 shadow-sm' : 'text-charcoal-500 hover:text-charcoal-800')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-dashed border-gray-100 pb-1.5">
          <dt className="text-xs text-charcoal-400">{k}</dt>
          <dd className="text-right text-sm font-medium text-charcoal-800">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
