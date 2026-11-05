import axios, { AxiosError } from 'axios';

export const TOKEN_KEY = 'uhm.token';
export const USER_KEY = 'uhm.user';

/** All calls go to /api, proxied to Spring Boot by Vite (dev) or nginx (Docker). */
export const api = axios.create({ baseURL: '/api', timeout: 120_000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login?expired=1');
    }
    return Promise.reject(error);
  },
);

/** Human-readable message from an API error (backend returns {message, details}). */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; details?: { field: string; message: string }[] } | undefined;
    if (data?.details?.length) return `${data.message ?? 'Validation failed'}: ${data.details.map((d) => `${d.field} ${d.message}`).join(', ')}`;
    if (data?.message) return data.message;
    if (err.code === 'ECONNABORTED') return 'The request timed out. The server may be busy - please retry.';
    if (!err.response) return 'Cannot reach the backend server. Is it running on http://localhost:8080?';
    return `Request failed (HTTP ${err.response.status})`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** Fetch a binary resource (PNG/PDF) with the auth header and return an object URL. */
export async function fetchObjectUrl(path: string, params?: Record<string, unknown>): Promise<string> {
  const r = await api.get(path, { params, responseType: 'blob' });
  return URL.createObjectURL(r.data as Blob);
}

export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const r = await api.get(path, { responseType: 'blob' });
  const disposition = (r.headers['content-disposition'] as string | undefined) ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const url = URL.createObjectURL(r.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
