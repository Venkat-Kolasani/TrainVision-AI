import { describe, it, expect } from 'vitest';
import { notify } from '../lib/notify';

describe('notify', () => {
  it('exposes toast helper methods', () => {
    expect(typeof notify.success).toBe('function');
    expect(typeof notify.error).toBe('function');
    expect(typeof notify.warning).toBe('function');
    expect(typeof notify.info).toBe('function');
  });
});
