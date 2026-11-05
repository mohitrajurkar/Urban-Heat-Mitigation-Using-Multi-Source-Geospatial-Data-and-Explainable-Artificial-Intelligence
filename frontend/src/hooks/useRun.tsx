import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import type { Run } from '../types';

interface RunCtx {
  runs: Run[];
  completed: Run[];
  activeRun: Run | null; // currently PENDING / RUNNING
  selectedRunId: number | null; // null = latest completed
  selectedRun: Run | null;
  setSelectedRunId: (id: number | null) => void;
  refresh: () => Promise<void>;
  /** increments whenever a run finishes, so pages can reload their data */
  version: number;
}

const Ctx = createContext<RunCtx | null>(null);
const SEL_KEY = 'uhm.selectedRun';

export function RunProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSel] = useState<number | null>(() => {
    const v = localStorage.getItem(SEL_KEY);
    return v ? Number(v) : null;
  });
  const [version, setVersion] = useState(0);
  const prevActive = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<Run[]>('/analysis/runs');
      setRuns(data);
      const active = data.find((r) => r.status === 'PENDING' || r.status === 'RUNNING') ?? null;
      if (prevActive.current !== null && !active) setVersion((v) => v + 1);
      prevActive.current = active ? active.id : null;
    } catch {
      /* handled by pages */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeRun = runs.find((r) => r.status === 'PENDING' || r.status === 'RUNNING') ?? null;
  useEffect(() => {
    const t = setInterval(() => void refresh(), activeRun ? 2500 : 20000);
    return () => clearInterval(t);
  }, [activeRun, refresh]);

  const completed = useMemo(() => runs.filter((r) => r.status === 'COMPLETED'), [runs]);
  const validSel = selectedRunId != null && completed.some((r) => r.id === selectedRunId) ? selectedRunId : null;
  const selectedRun = validSel != null ? completed.find((r) => r.id === validSel) ?? null : completed[0] ?? null;

  const setSelectedRunId = useCallback((id: number | null) => {
    setSel(id);
    if (id == null) localStorage.removeItem(SEL_KEY);
    else localStorage.setItem(SEL_KEY, String(id));
    setVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({ runs, completed, activeRun, selectedRunId: validSel, selectedRun, setSelectedRunId, refresh, version }),
    [runs, completed, activeRun, validSel, selectedRun, setSelectedRunId, refresh, version],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRun(): RunCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRun must be used inside RunProvider');
  return c;
}

/** Query params for run-scoped endpoints (+ a version key so data reloads after a run completes). */
export function useRunParams(extra?: Record<string, unknown>): Record<string, unknown> {
  const { selectedRunId, version } = useRun();
  return { ...(selectedRunId != null ? { runId: selectedRunId } : {}), _v: version, ...extra };
}
