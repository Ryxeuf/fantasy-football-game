import { describe, it, expect } from 'vitest';
import { shouldPersistMatchOutcome } from './resurrection';

describe('shouldPersistMatchOutcome', () => {
  it('persiste un match normal complet', () => {
    expect(
      shouldPersistMatchOutcome({
        resurrectionMode: false,
        hasGameState: true,
        hasBothTeams: true,
      }),
    ).toBe(true);
  });

  it('NE persiste PAS en mode résurrection (même avec gameState complet)', () => {
    expect(
      shouldPersistMatchOutcome({
        resurrectionMode: true,
        hasGameState: true,
        hasBothTeams: true,
      }),
    ).toBe(false);
  });

  it('ne persiste pas sans gameState ou sans les deux équipes', () => {
    expect(
      shouldPersistMatchOutcome({
        resurrectionMode: false,
        hasGameState: false,
        hasBothTeams: true,
      }),
    ).toBe(false);
    expect(
      shouldPersistMatchOutcome({
        resurrectionMode: false,
        hasGameState: true,
        hasBothTeams: false,
      }),
    ).toBe(false);
  });
});
