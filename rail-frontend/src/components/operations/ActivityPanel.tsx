import { formatAuditDetails } from '../../lib/auditFormat';

export interface ActivityLogEntry {
  timestamp: string;
  action: string;
  details: string;
}

interface ActivityPanelProps {
  logs: ActivityLogEntry[];
}

const statusBorder = {
  success: 'border-l-success',
  warning: 'border-l-warning',
  error: 'border-l-danger',
  info: 'border-l-slate-500',
} as const;

export function ActivityPanel({ logs }: ActivityPanelProps) {
  if (logs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No activity recorded yet. System events and overrides will appear here.
      </p>
    );
  }

  return (
    <div className="max-h-[480px] space-y-2 overflow-y-auto">
      {logs.map((log, idx) => {
        const formatted = formatAuditDetails(log.details);
        return (
          <article
            key={`${log.timestamp}-${idx}`}
            className={`rounded border border-slate-700/60 border-l-4 bg-surface-3/30 p-3 ${statusBorder[formatted.status]}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-medium text-white">{formatted.title}</h4>
              <time className="font-mono text-xs text-slate-500 tabular-nums">
                {new Date(log.timestamp).toLocaleString()}
              </time>
            </div>
            <p className="mt-1 text-sm text-slate-300">{formatted.details}</p>
            {formatted.impact && (
              <p className="mt-1 text-xs text-slate-400">{formatted.impact}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
