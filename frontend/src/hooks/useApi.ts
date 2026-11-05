import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../services/api';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status: number | null;
  reload: () => void;
}

/** GET helper with loading / error state; refetches when path or params change. Pass null to skip. */
export function useApi<T>(path: string | null, params?: Record<string, unknown>): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params ?? {});
  const seq = useRef(0);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    api
      .get<T>(path, { params: JSON.parse(key) })
      .then((r) => {
        if (id === seq.current) {
          setData(r.data);
          setStatus(r.status);
        }
      })
      .catch((e) => {
        if (id === seq.current) {
          setError(errorMessage(e));
          setStatus(e?.response?.status ?? null);
        }
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
  }, [path, key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, status, reload };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
