import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Database, FlaskConical, Loader2 } from 'lucide-react';
import { useRun } from '../hooks/useRun';
import { EmptyState, ProgressBar } from './ui';

/** Renders children only once a completed analysis exists; otherwise shows progress or guidance. */
export default function RunGate({ children }: { children: ReactNode }) {
  const { completed, activeRun, runs } = useRun();
  if (completed.length > 0) return <>{children}</>;
  if (activeRun) {
    return (
      <div className="card mx-auto mt-10 max-w-xl p-8 text-center">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-600" />
        <h2 className="text-lg font-semibold">Preparing the Nagpur demonstration analysis</h2>
        <p className="mt-1 text-sm text-charcoal-400">
          The system is processing the bundled demo datasets end-to-end. This takes about a minute on first launch.
        </p>
        <div className="mt-6 text-left">
          <div className="mb-1 flex justify-between text-xs text-charcoal-500"><span>{activeRun.currentStep}</span><span>{activeRun.progress}%</span></div>
          <ProgressBar value={activeRun.progress} />
        </div>
      </div>
    );
  }
  const failed = runs.find((r) => r.status === 'FAILED');
  return (
    <div className="card mt-6">
      <EmptyState
        icon={failed ? <FlaskConical className="h-6 w-6" /> : <Database className="h-6 w-6" />}
        title={failed ? 'The last analysis failed' : 'No analysis results yet'}
        message={failed?.message ?? 'Start an analysis from Dataset Management using the bundled Nagpur demo data or your own uploads.'}
        action={<Link to="/datasets" className="btn-primary">Go to Dataset Management</Link>}
      />
    </div>
  );
}
