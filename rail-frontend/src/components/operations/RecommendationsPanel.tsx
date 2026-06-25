import { useMemo } from 'react';
import { Lightbulb, X } from 'lucide-react';
import type { Recommendation } from '../../types/railway';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface RecommendationsPanelProps {
  open: boolean;
  recommendations: Recommendation[];
  onClose: () => void;
  onApply: (id: string) => void;
  applyingId?: string | null;
}

export function RecommendationsPanel({
  open,
  recommendations,
  onClose,
  onApply,
  applyingId,
}: RecommendationsPanelProps) {
  const sorted = useMemo(
    () => [...recommendations].sort((a, b) => b.cost_benefit.cost_score - a.cost_benefit.cost_score),
    [recommendations]
  );

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:bg-black/20"
        onClick={onClose}
        aria-label="Close recommendations panel"
      />
      <aside className="fixed right-0 top-[7.25rem] z-50 flex h-[calc(100vh-7.25rem)] w-full max-w-md flex-col border-l border-slate-600 bg-surface-2 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <Lightbulb className="h-5 w-5 text-info" />
            Recommendations
            <Badge variant="info">{sorted.length}</Badge>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="Close recommendations"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {sorted.map((rec) => (
            <article key={rec.id} className="rounded-lg border border-slate-600/60 bg-surface-3 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium leading-snug text-white">{rec.description}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {rec.train_id} · {rec.action_type.replace(/_/g, ' ')}
                    {rec.station_id && ` · ${rec.station_id}`}
                    {rec.new_platform != null && ` · P${rec.new_platform}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold text-success">
                    {(rec.cost_benefit.cost_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-slate-400">score</div>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-slate-800/80 p-2">
                  <div className="text-xs text-slate-400">Impact</div>
                  <div className="text-slate-200">
                    {rec.impact.affected_trains.length} trains ·
                    {rec.impact.total_delay_change > 0 ? '+' : ''}
                    {rec.impact.total_delay_change.toFixed(1)} min
                  </div>
                </div>
                <div className="rounded-md bg-slate-800/80 p-2">
                  <div className="text-xs text-slate-400">Resolves</div>
                  <div className="text-slate-200">
                    {rec.cost_benefit.conflicts_resolved} conflicts ·
                    {rec.cost_benefit.delay_reduction.toFixed(1)} min saved
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => onApply(rec.id)}
                disabled={applyingId === rec.id}
              >
                {applyingId === rec.id ? 'Applying…' : 'Apply recommendation'}
              </Button>
            </article>
          ))}

          {sorted.length === 0 && (
            <div className="py-16 text-center text-slate-400">
              <Lightbulb className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p className="font-medium text-slate-300">No recommendations</p>
              <p className="mt-1 text-sm">Suggestions appear when conflicts are detected.</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
