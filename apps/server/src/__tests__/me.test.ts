import { describe, it, expect } from 'vitest';
import { assertNicknameCooldown, NicknameCooldownError } from '../services/me.service.js';

describe('assertNicknameCooldown', () => {
  it('passes when lastChange is null', () => {
    expect(() => assertNicknameCooldown(null)).not.toThrow();
  });
  it('passes when more than 30 days have passed', () => {
    const lastChange = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-02-15T00:00:00Z'); // 45일 후
    expect(() => assertNicknameCooldown(lastChange, now)).not.toThrow();
  });
  it('throws NicknameCooldownError with nextChangeAt when within 30 days', () => {
    const lastChange = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-15T00:00:00Z'); // 14일 후
    try {
      assertNicknameCooldown(lastChange, now);
      expect.fail('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(NicknameCooldownError);
      const e = err as NicknameCooldownError;
      expect(e.code).toBe('NICKNAME_CHANGE_COOLDOWN');
      expect(e.nextChangeAt).toBe('2026-01-31T00:00:00.000Z');
    }
  });
});
