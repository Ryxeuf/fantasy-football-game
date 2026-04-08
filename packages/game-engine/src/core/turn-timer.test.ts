/**
 * Tests for turn timer configuration and game state tracking.
 * B1.10 — Timer de tour configurable avec fin de tour auto.
 */
import { describe, it, expect } from 'vitest';
import { FULL_RULES, SIMPLIFIED_RULES, createCustomRules } from './rules-config';

describe('Rule: Turn Timer Configuration', () => {
  it('FULL_RULES has a default turnTimerSeconds of 120', () => {
    expect(FULL_RULES.turnTimerSeconds).toBe(120);
  });

  it('SIMPLIFIED_RULES has a default turnTimerSeconds of 90', () => {
    expect(SIMPLIFIED_RULES.turnTimerSeconds).toBe(90);
  });

  it('turnTimerSeconds can be overridden via createCustomRules', () => {
    const custom = createCustomRules('full', { turnTimerSeconds: 180 });
    expect(custom.turnTimerSeconds).toBe(180);
  });

  it('turnTimerSeconds of 0 disables the timer', () => {
    const custom = createCustomRules('full', { turnTimerSeconds: 0 });
    expect(custom.turnTimerSeconds).toBe(0);
  });
});
