import { useState, type FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { Calculator, PiggyBank } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useRunParams } from '../hooks/useRun';
import { useToast } from '../hooks/useToast';
import { api, errorMessage } from '../services/api';
import RunGate from '../components/RunGate';
import { Card, ChartSkeleton, ErrorState, LoadingBlock, PageHeader, PriorityBadge, Spinner, StatCard } from '../components/ui';
import { STRATEGY_COLORS, STRATEGY_NAMES } from '../utils/colors';
import { fmt, fmtArea, fmtInr, fmtInt } from '../utils/format';
import type { Recommendation } from '../types';

interface TypeCost { type: string; name: string; count: number; totalCost: number; costLow: number; costHigh: number; totalAreaM2: number; meanCoolingC: number; maxCoolingC: number; meanCostPerDegree: number | null; unitCost: number | null; unit: string | null; unitCostBasis?: string }
interface CostSummary { totalCost: number; totalCostLow: number; totalCostHigh: number; count: number; byType: TypeCost[]; scatter: { type: string; cost: number; cooling: number; region: string }[]; note: string }
interface Plan { budget: number; allocated: number; remaining: number; interventions: number; regionsCovered: number; meanLocalCoolingC: number; sumOfLocalCoolingC: number; byType: Record<string, number>; method: string; selected: Recommendation[] }
interface Assumptions { strategies: Record<string, Record<string, number | string>>; cost_uncertainty: number }

export default function CostAnalysisPage() {
  return <RunGate><Costs /></RunGate>;
}

function Costs() {
  const params = useRunParams();
  const { data, loading, error, reload } = useApi<CostSummary>('/costs/summary', params);
  const ass = useApi<Assumptions>('/recommendations/assumptions', params);
  const types = (data?.byType ?? []).map((t) => ({ ...t, label: STRATEGY_NAMES[t.type] ?? t.name, cr: t.totalCost / 1e7, err: [(t.totalCost - t.costLow) / 1e7, (t.costHigh - t.totalCost) / 1e7], perDeg: (t.meanCostPerDegree ?? 0) / 1e5 }));

  return (
    <>
      <PageHeader icon={<Calculator className="h-5 w-5" />} title="Cost Analysis" subtitle="Compare implementation cost, area and expected cooling of the five mitigation strategies, and allocate a budget to the most cost-effective interventions." />
      {error && <ErrorState message={error} onRetry={reload} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={loading} label="Total estimated cost" value={fmtInr(data?.totalCost)} sub={`${fmtInr(data?.totalCostLow)} – ${fmtInr(data?.totalCostHigh)}`} icon={<Calculator className="h-5 w-5" />} accent="blue" />
        <StatCard loading={loading} label="Interventions" value={fmtInt(data?.count)} sub="Across all hotspot regions" icon={<PiggyBank className="h-5 w-5" />} accent="emerald" />
        <StatCard loading={loading} label="Most cost-effective" value={types.filter((t) => t.count).sort((a, b) => a.perDeg - b.perDeg)[0]?.label ?? '—'} sub="Lowest mean ₹ per °C" icon={<PiggyBank className="h-5 w-5" />} accent="forest" />
        <StatCard loading={loading} label="Total treated area" value={fmtArea(types.reduce((s, t) => s + t.totalAreaM2, 0))} sub="Roofs, pavements, planting, forest, ponds" icon={<PiggyBank className="h-5 w-5" />} accent="slate" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Total cost by strategy" subtitle="₹ crore, error bars = ±25% uncertainty">
          {loading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={types}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0ee" />
                <XAxis dataKey="label" tickLine={false} /><YAxis tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `₹${v.toFixed(0)}`} />
                <Tooltip formatter={(v: number) => [`₹ ${v.toFixed(2)} Cr`, 'Total cost']} />
                <Bar isAnimationActive={false} dataKey="cr" radius={[4, 4, 0, 0]}>{types.map((t) => <Cell key={t.type} fill={STRATEGY_COLORS[t.type]} />)}<ErrorBar dataKey="err" width={6} stroke="#374151" /></Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title="Cost-effectiveness" subtitle="Mean cost per °C of local LST reduction (₹ lakh) — lower is better">
          {loading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={types} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0ee" />
                <XAxis type="number" tickLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}L`} /><YAxis type="category" dataKey="label" width={110} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [`₹ ${v.toFixed(1)} lakh per °C`, 'Mean cost / °C']} />
                <Bar isAnimationActive={false} dataKey="perDeg" radius={3}>{types.map((t) => <Cell key={t.type} fill={STRATEGY_COLORS[t.type]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title="Expected cooling by strategy" subtitle="Mean and maximum local LST reduction (°C)">
          {loading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={types}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0ee" />
                <XAxis dataKey="label" tickLine={false} /><YAxis tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v: number, n: string) => [`${v.toFixed(2)} °C`, n]} /><Legend verticalAlign="top" height={26} />
                <Bar isAnimationActive={false} dataKey="meanCoolingC" name="Mean" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="maxCoolingC" name="Maximum" fill="#14532d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title="Cost vs cooling" subtitle="Individual recommendations (log cost axis)">
          {loading || !data ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0ee" />
                <XAxis type="number" dataKey="cost" scale="log" domain={['auto', 'auto']} tickFormatter={(v) => fmtInr(v)} name="Cost" tickLine={false} />
                <YAxis type="number" dataKey="cooling" name="Cooling" unit="°C" width={50} tickLine={false} />
                <ZAxis range={[18, 18]} />
                <Tooltip formatter={(v: number, n: string) => (n === 'Cost' ? fmtInr(v) : `${v.toFixed(2)} °C`)} />
                {Object.keys(STRATEGY_NAMES).map((k) => <Scatter isAnimationActive={false} key={k} name={STRATEGY_NAMES[k]} data={data.scatter.filter((s) => s.type === k)} fill={STRATEGY_COLORS[k]} fillOpacity={0.7} />)}
                <Legend verticalAlign="top" height={26} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="mt-6" title="Strategy comparison & assumptions" bodyClass="p-0">
        {!data || !ass.data ? <div className="p-5"><LoadingBlock /></div> : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Strategy</th><th>Count</th><th>Total cost</th><th>Area</th><th>Mean cooling</th><th>Unit cost</th><th>Cooling model</th><th>Cost basis</th></tr></thead>
            <tbody>{data.byType.map((t) => {
              const a = ass.data!.strategies[t.type] ?? {};
              return (
                <tr key={t.type}>
                  <td className="font-medium"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: STRATEGY_COLORS[t.type] }} />{STRATEGY_NAMES[t.type]}</td>
                  <td>{t.count}</td><td>{fmtInr(t.totalCost)}</td><td>{fmtArea(t.totalAreaM2)}</td><td>−{fmt(t.meanCoolingC, 2)} °C</td>
                  <td>{fmtInr(Number(a.unit_cost_inr), false)} / {String(a.unit ?? '')}</td>
                  <td className="text-xs">{String(a.cooling_coefficient_c)} °C × coverage, max {String(a.max_cooling_c)} °C</td>
                  <td className="max-w-sm text-xs text-charcoal-500">{String(a.unit_cost_basis ?? '')}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Card>
      <BudgetPlanner />
    </>
  );
}

function BudgetPlanner() {
  const params = useRunParams();
  const { notify } = useToast();
  const [budgetCr, setBudgetCr] = useState(10);
  const [strategies, setStrategies] = useState<string[]>(Object.keys(STRATEGY_NAMES));
  const [onePer, setOnePer] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!strategies.length) return notify('error', 'Select at least one strategy');
    setBusy(true);
    try {
      const { data } = await api.post<Plan>('/costs/budget-plan', { runId: params.runId, budgetInr: budgetCr * 1e7, strategies, onePerRegion: onePer });
      setPlan(data);
    } catch (err) {
      notify('error', 'Budget plan failed', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mt-6" title="Budget planner" subtitle="Greedy allocation in ascending cost per °C — what can a given budget achieve?">
      <form onSubmit={submit} className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div><label className="label" htmlFor="budget">Budget (₹ crore)</label><input id="budget" type="number" min={0.1} step={0.5} className="input w-40" value={budgetCr} onChange={(e) => setBudgetCr(Number(e.target.value))} required /></div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(STRATEGY_NAMES).map(([k, v]) => (
            <label key={k} className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="accent-emerald-600" checked={strategies.includes(k)} onChange={(e) => setStrategies((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))} />{v}</label>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="accent-emerald-600" checked={onePer} onChange={(e) => setOnePer(e.target.checked)} />One per region</label>
        <button className="btn-primary" disabled={busy}>{busy && <Spinner />}Allocate budget</button>
      </form>
      {plan && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[['Allocated', fmtInr(plan.allocated)], ['Remaining', fmtInr(plan.remaining)], ['Interventions', fmtInt(plan.interventions)], ['Regions covered', fmtInt(plan.regionsCovered)], ['Mean local cooling', `−${fmt(plan.meanLocalCoolingC, 2)} °C`]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-forest-50 p-3"><p className="text-xs text-forest-700">{k}</p><p className="text-lg font-semibold text-forest-900">{v}</p></div>
            ))}
          </div>
          <p className="text-xs text-charcoal-400">{plan.method}. Mix: {Object.entries(plan.byType).map(([k, v]) => `${STRATEGY_NAMES[k]} ${v}`).join(' · ') || 'none'}</p>
          <div className="table-wrap max-h-80 overflow-y-auto rounded-lg border border-gray-100"><table className="tbl">
            <thead><tr><th>#</th><th>Intervention</th><th>Region</th><th>Cost</th><th>Cooling</th><th>₹ per °C</th><th>Priority</th></tr></thead>
            <tbody>{plan.selected.map((r, i) => (
              <tr key={r.id}><td>{i + 1}</td><td>{r.name}</td><td>{r.regionName}</td><td>{fmtInr(r.cost.estimated)}</td><td>−{fmt(r.coolingC, 2)} °C</td><td>{fmtInr(r.cost.costPerDegree)}</td><td><PriorityBadge level={r.priorityLevel} /></td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </Card>
  );
}
