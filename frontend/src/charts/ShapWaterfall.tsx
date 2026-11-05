import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LocalExplanation } from '../types';

/** Horizontal SHAP contribution chart: red bars increase predicted LST, green bars decrease it. */
export default function ShapWaterfall({ explanation, compact, max = 10 }: { explanation: LocalExplanation; compact?: boolean; max?: number }) {
  const rows = explanation.contributions.slice(0, compact ? 7 : max).map((c) => ({
    name: c.label.replace(/ \(.*\)$/, ''),
    shap: c.shap,
    value: c.value,
  })).reverse();
  return (
    <div>
      <ResponsiveContainer width="100%" height={rows.length * (compact ? 26 : 32) + 40}>
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0ee" />
          <XAxis type="number" tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`} tickLine={false} />
          <YAxis type="category" dataKey="name" width={compact ? 120 : 170} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <ReferenceLine x={0} stroke="#9ca3af" />
          <Tooltip formatter={(v: number) => [`${v > 0 ? '+' : ''}${v.toFixed(3)} °C`, 'SHAP contribution']}
            labelFormatter={(l, p) => `${l} = ${(p?.[0]?.payload?.value as number | undefined)?.toFixed?.(3) ?? ''}`} />
          <Bar isAnimationActive={false} dataKey="shap" radius={3}>
            {rows.map((r, i) => <Cell key={i} fill={r.shap >= 0 ? '#dc2626' : '#059669'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[11px] text-charcoal-400">
        Baseline {explanation.baseValue.toFixed(2)} °C + contributions = predicted {explanation.predictedValue.toFixed(2)} °C ({explanation.model === 'xgboost' ? 'XGBoost' : 'Random Forest'} TreeSHAP)
      </p>
    </div>
  );
}
