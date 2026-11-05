const CLASSES = ['Low', 'Moderate', 'High', 'Very High'];

export default function ConfusionMatrix({ matrix, title }: { matrix: number[][]; title: string }) {
  const max = Math.max(1, ...matrix.flat());
  const rowTotals = matrix.map((r) => r.reduce((a, b) => a + b, 0));
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="px-2 text-right text-[10px] font-medium text-charcoal-400">Observed ↓ / Predicted →</th>
              {CLASSES.map((c) => <th key={c} className="w-20 px-1 text-center font-medium text-charcoal-500">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <th className="px-2 text-right font-medium text-charcoal-500">{CLASSES[i]}</th>
                {row.map((v, j) => {
                  const t = v / max;
                  const diag = i === j;
                  return (
                    <td key={j} className="h-12 rounded-md text-center font-semibold"
                      style={{ background: diag ? `rgba(5,150,105,${0.12 + 0.8 * t})` : `rgba(220,38,38,${0.05 + 0.7 * t})`, color: t > 0.55 ? '#fff' : '#1f2937' }}
                      title={`${CLASSES[i]} → ${CLASSES[j]}: ${v} (${rowTotals[i] ? ((100 * v) / rowTotals[i]).toFixed(0) : 0}% of row)`}>
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
