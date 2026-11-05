import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; title: string; message?: string; }
interface ToastCtx { notify: (kind: Kind, title: string, message?: string) => void; }

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const notify = useCallback((kind: Kind, title: string, message?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, title, message }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500);
  }, []);

  const icon = { success: <CheckCircle2 className="h-5 w-5 text-emerald-600" />, error: <AlertTriangle className="h-5 w-5 text-red-600" />, info: <Info className="h-5 w-5 text-sky-600" /> };
  const bar = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-sky-500' };

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[2000] flex w-[min(92vw,380px)] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="card animate-slide-in flex overflow-hidden shadow-lift">
            <div className={`w-1 ${bar[t.kind]}`} />
            <div className="flex flex-1 gap-3 p-3.5">
              {icon[t.kind]}
              <div className="flex-1">
                <p className="text-sm font-semibold text-charcoal-900">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs text-charcoal-500">{t.message}</p>}
              </div>
              <button aria-label="Dismiss notification" className="text-gray-400 hover:text-gray-600" onClick={() => dismiss(t.id)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be used inside ToastProvider');
  return c;
}
