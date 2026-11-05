const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const fmt = (v: number | null | undefined, digits = 2): string => (isNum(v) ? v.toFixed(digits) : '—');
export const fmtInt = (v: number | null | undefined): string => (isNum(v) ? Math.round(v).toLocaleString('en-IN') : '—');
export const fmtPct = (v: number | null | undefined, digits = 1): string => (isNum(v) ? `${(v * 100).toFixed(digits)}%` : '—');
export const fmtTemp = (v: number | null | undefined, digits = 1): string => (isNum(v) ? `${v.toFixed(digits)} °C` : '—');

/** Indian number formatting: ₹ 12.4 Cr / ₹ 3.2 L / ₹ 45,000 */
export function fmtInr(v: number | null | undefined, compact = true): string {
  if (!isNum(v)) return '—';
  if (!compact) return `₹ ${Math.round(v).toLocaleString('en-IN')}`;
  const a = Math.abs(v);
  if (a >= 1e7) return `₹ ${(v / 1e7).toFixed(a >= 1e9 ? 0 : 2)} Cr`;
  if (a >= 1e5) return `₹ ${(v / 1e5).toFixed(1)} L`;
  return `₹ ${Math.round(v).toLocaleString('en-IN')}`;
}

export function fmtArea(m2: number | null | undefined): string {
  if (!isNum(m2)) return '—';
  return m2 >= 10_000 ? `${(m2 / 10_000).toFixed(2)} ha` : `${Math.round(m2).toLocaleString('en-IN')} m²`;
}

export function fmtBytes(b: number | null | undefined): string {
  if (!isNum(b)) return '—';
  if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  if (b > 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

export function fmtDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
}

export const titleCase = (s: string): string => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const modelLabel = (m: string): string => (m === 'xgboost' ? 'XGBoost' : m === 'random_forest' ? 'Random Forest' : titleCase(m));

export const COMPONENT_LABELS: Record<string, string> = {
  heat_severity: 'Heat severity',
  population_vulnerability: 'Population vulnerability',
  vegetation_deficit: 'Vegetation deficit',
  implementation_feasibility: 'Implementation feasibility',
  cooling_benefit: 'Expected cooling benefit',
};
