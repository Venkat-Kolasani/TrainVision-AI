export interface FormattedAuditEntry {
  title: string;
  status: 'success' | 'warning' | 'error' | 'info';
  details: string;
  impact?: string;
}

const EMOJI_PATTERN = /[\u{1F300}-\u{1F9FF}\u2600-\u27BF]/gu;

export function stripEmoji(text: string): string {
  return text.replace(EMOJI_PATTERN, '').replace(/\s+/g, ' ').trim();
}

export function formatAuditDetails(raw: string): FormattedAuditEntry {
  const details = stripEmoji(raw);

  if (/delay.*min/i.test(details) && /train/i.test(details)) {
    const trainMatch = details.match(/Train (\w+)/i);
    const delayMatch = details.match(/(\d+)\s*min/i);
    const stationMatch = details.match(/(?:→|at)\s*(\w+)/i);
    const platformMatch = details.match(/P(\d+)/i);
    return {
      title: 'Conflict resolved',
      status: 'warning',
      details: trainMatch
        ? `Train ${trainMatch[1]} delayed${delayMatch ? ` by ${delayMatch[1]} min` : ''}${stationMatch ? ` at ${stationMatch[1]}` : ''}.`
        : details,
      impact: platformMatch
        ? `Assigned to platform ${platformMatch[1]} to avoid overlap with higher-priority traffic.`
        : 'Optimizer resolved overlapping arrival windows.',
    };
  }

  if (/override.*success|successfully assigned|override applied/i.test(details)) {
    return {
      title: 'Override applied',
      status: 'success',
      details,
      impact: 'Schedule re-optimized to accommodate the manual platform assignment.',
    };
  }

  if (/override.*reject|rejected/i.test(details)) {
    return {
      title: 'Override rejected',
      status: 'error',
      details,
      impact: 'Requested platform would create an unresolvable conflict. Try another platform or time slot.',
    };
  }

  if (/platform.*occupied|platform conflict/i.test(details)) {
    return {
      title: 'Platform conflict',
      status: 'warning',
      details,
      impact: 'System will delay lower-priority trains or assign alternative platforms.',
    };
  }

  if (/assigned.*on-?time|optimal assignment/i.test(details)) {
    return {
      title: 'Optimal assignment',
      status: 'success',
      details,
      impact: 'No conflicts detected for this movement.',
    };
  }

  if (/failed|rejected|error/i.test(details)) {
    return { title: 'System event', status: 'error', details };
  }

  if (/conflict/i.test(details)) {
    return { title: 'Conflict event', status: 'warning', details };
  }

  return { title: 'System event', status: 'info', details };
}
