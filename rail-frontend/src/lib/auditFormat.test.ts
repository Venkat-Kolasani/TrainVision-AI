import { describe, it, expect } from 'vitest';
import { formatAuditDetails, stripEmoji } from './auditFormat';

describe('auditFormat', () => {
  it('strips emoji from audit text', () => {
    const raw = 'Override APPLIED: T1 forced to P2';
    expect(stripEmoji(`🔧 ${raw} ✅`)).toBe(raw);
  });

  it('formats without emoji in output', () => {
    const entry = formatAuditDetails('🚨 DELAY INJECTED: T101 - signal delay of 15 minutes');
    expect(entry.details).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
    expect(entry.title.length).toBeGreaterThan(0);
  });
});
