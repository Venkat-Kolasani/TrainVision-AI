function DelayBars({ title, values }: { title: string; values: number[] }) {
  const maxVal = Math.max(2, ...values);
  const bars = values.slice(0, Math.min(values.length, 12));
  const total = values.reduce((s, v) => s + v, 0);
  const avg = values.length ? total / values.length : 0;

  return (
    <div className="flex-1">
      <div className="mb-1 text-sm text-slate-400">{title}</div>
      <div className="flex h-24 flex-col rounded border border-slate-700 bg-slate-900/40 p-2">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-2xl font-bold text-slate-100">
            {avg.toFixed(1)}
            <span className="ml-1 text-sm font-normal text-slate-400">min avg</span>
          </div>
          <div className="text-xs text-slate-400">Σ {total.toFixed(1)} min</div>
        </div>
        <div className="flex flex-1 items-end gap-1">
          {bars.length === 0 ? (
            <div className="m-auto text-xs text-slate-400">0.0 min</div>
          ) : (
            bars.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded bg-indigo-400/80"
                style={{ height: `${(v / maxVal) * 100}%` }}
                title={`${v.toFixed(1)} min`}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface KpiStripProps {
  delaysBefore: number[];
  delaysAfter: number[];
  total: number;
  onTimePct: number;
  avgDelay: string;
}

export function KpiStrip({ delaysBefore, delaysAfter, total, onTimePct, avgDelay }: KpiStripProps) {
  return (
    <div className="mb-4 flex flex-wrap gap-4 lg:gap-6">
      <DelayBars title="Before optimization (delay min)" values={delaysBefore} />
      <DelayBars title="After optimization (delay min)" values={delaysAfter} />
      <div className="min-w-[80px] flex-1">
        <div className="text-sm text-slate-400">Total trains</div>
        <div className="text-2xl font-bold text-slate-100">{total}</div>
      </div>
      <div className="min-w-[80px] flex-1">
        <div className="text-sm text-slate-400">On-time % (&lt;=2m)</div>
        <div className="text-2xl font-bold text-slate-100">{onTimePct}%</div>
      </div>
      <div className="min-w-[80px] flex-1">
        <div className="text-sm text-slate-400">Avg delay (min)</div>
        <div className="text-2xl font-bold text-slate-100">{avgDelay}</div>
      </div>
    </div>
  );
}
