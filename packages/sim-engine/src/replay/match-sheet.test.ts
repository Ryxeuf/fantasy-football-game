import { describe, expect, it } from 'vitest';

import { buildEngineSimInput } from '../driver/engine-roster-fixture';
import { simulateMatch } from '../simulate-match';
import { PRO_LEAGUE_TEAM_BY_ID } from '../tactics/race-profiles';

import { replayJournal } from './journal';
import { renderMatchSheet } from './match-sheet';

describe('feuille de match papier (lot 2)', () => {
  it('rend une ligne par activation avec chemin, action et dés', () => {
    const home = PRO_LEAGUE_TEAM_BY_ID['pit-smashers'];
    const away = PRO_LEAGUE_TEAM_BY_ID['kc-soaring-hawks'];
    if (!home || !away) throw new Error('profils introuvables');
    const result = simulateMatch(buildEngineSimInput(home, away, 3), { driverKind: 'full' });
    const journal = result.journal;
    if (!journal) throw new Error('journal absent');
    const { states } = replayJournal(journal);
    const sheet = renderMatchSheet(journal, states, { homeName: 'Smashers', awayName: 'Hawks' });

    expect(sheet).toContain('FEUILLE DE MATCH — Smashers (domicile) vs Hawks (extérieur)');
    expect(sheet).toContain('Mi-temps 1 — Tour 1 —');
    expect(sheet).toMatch(/#\d+ .+ : .*→ \(\d+,\d+\)/); // un déplacement case par case
    expect(sheet).toMatch(/bloque #\d+/); // un blocage avec sa cible
    expect(sheet).toMatch(/\[Blocage: /); // les dés du blocage
    expect(sheet).toContain('MI-TEMPS —');
    expect(sheet).toContain('SCORE FINAL');
    // Autant de blocs « Tour » que de tours d'équipe joués (au moins 28).
    expect((sheet.match(/Mi-temps \d — Tour \d+ —/g) ?? []).length).toBeGreaterThanOrEqual(28);
  });
});
