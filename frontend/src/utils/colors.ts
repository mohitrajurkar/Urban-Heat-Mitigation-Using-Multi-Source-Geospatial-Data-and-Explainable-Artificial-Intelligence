import type { PriorityLevel, Severity } from '../types';

export const SEVERITY_COLORS: Record<Severity, string> = {
  Low: '#2c7bb6',
  Moderate: '#fdae61',
  High: '#e8590c',
  'Very High': '#b91c1c',
};

export const SEVERITY_ORDER: Severity[] = ['Low', 'Moderate', 'High', 'Very High'];

export const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  Critical: '#991b1b',
  High: '#ea580c',
  Medium: '#ca8a04',
  Low: '#15803d',
};

export const STRATEGY_COLORS: Record<string, string> = {
  tree_plantation: '#16a34a',
  urban_forest: '#14532d',
  cool_roofs: '#0ea5e9',
  cool_pavements: '#64748b',
  water_bodies: '#2563eb',
};

export const STRATEGY_NAMES: Record<string, string> = {
  tree_plantation: 'Tree Plantation',
  urban_forest: 'Urban Forest',
  cool_roofs: 'Cool Roofs',
  cool_pavements: 'Cool Pavements',
  water_bodies: 'Water Bodies',
};

export const CHART = { forest: '#14532d', emerald: '#059669', mint: '#34d399', amber: '#f59e0b', red: '#dc2626', slate: '#64748b', blue: '#2563eb' };

/** Linear interpolation over color stops (hex). t in [0,1]. */
export function rampColor(stops: string[], t: number): string {
  if (!Number.isFinite(t)) return '#cbd5e1';
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  const a = hexToRgb(stops[i]);
  const b = hexToRgb(stops[i + 1]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const RAMPS: Record<string, string[]> = {
  lst: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'],
  predictedLst: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'],
  ndvi: ['#a50026', '#f46d43', '#fee08b', '#d9ef8b', '#66bd63', '#1a9850', '#006837'],
  ndbi: ['#ffffe5', '#fee391', '#fec44f', '#ec7014', '#993404'],
  ndwi: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b'],
  albedo: ['#00204c', '#414d6b', '#7c7b78', '#bcaf6f', '#ffe945'],
  priorityScore: ['#fef3c7', '#fdba74', '#f97316', '#c2410c', '#7f1d1d'],
  populationDensity: ['#f7f4f9', '#d4b9da', '#df65b0', '#ce1256', '#67001f'],
};
