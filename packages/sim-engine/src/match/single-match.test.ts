import { beforeAll, describe, expect, it } from 'vitest';

import {
  DEFAULT_MATCH_AWAY,
  DEFAULT_MATCH_HOME,
  DEFAULT_MATCH_SEED,
  SingleMatchArgError,
  formatSingleMatchJson,
  formatSingleMatchNarration,
  formatSingleMatchSheet,
  formatSingleMatchSummary,
  resolveSingleMatchRequest,
  runSingleMatch,
  type SingleMatchRun,
} from './single-match';

describe('resolveSingleMatchRequest', () => {
  it('applique les défauts : full driver, graine 42, Smashers vs Soaring Hawks', () => {
    const req = resolveSingleMatchRequest({});
    expect(req.home.id).toBe(DEFAULT_MATCH_HOME);
    expect(req.away.id).toBe(DEFAULT_MATCH_AWAY);
    expect(req.seed).toBe(DEFAULT_MATCH_SEED);
    expect(req.driverKind).toBe('full');
  });

  it('lit les équipes, la graine et le driver', () => {
    const req = resolveSingleMatchRequest({
      teamA: 'buf-snow-ogres',
      teamB: 'gb-cheese-halflings',
      seed: '3',
      driver: 'hybrid',
    });
    expect(req.home.id).toBe('buf-snow-ogres');
    expect(req.away.id).toBe('gb-cheese-halflings');
    expect(req.seed).toBe(3);
    expect(req.driverKind).toBe('hybrid');
  });

  it('refuse une équipe inconnue en listant les équipes connues', () => {
    expect(() => resolveSingleMatchRequest({ teamA: 'nope' })).toThrow(SingleMatchArgError);
    expect(() => resolveSingleMatchRequest({ teamA: 'nope' })).toThrow(/pit-smashers/);
  });

  it('refuse une équipe contre elle-même', () => {
    expect(() =>
      resolveSingleMatchRequest({ teamA: 'pit-smashers', teamB: 'pit-smashers' }),
    ).toThrow(/distinctes/);
  });

  it.each(['-1', '1.5', 'abc', ''])('refuse la graine %j', (seed) => {
    expect(() => resolveSingleMatchRequest({ seed })).toThrow(/--seed/);
  });

  it('refuse un driver inconnu', () => {
    expect(() => resolveSingleMatchRequest({ driver: 'turbo' })).toThrow(/--driver/);
  });
});

describe('runSingleMatch — full driver', () => {
  let run: SingleMatchRun;

  beforeAll(() => {
    run = runSingleMatch(resolveSingleMatchRequest({ seed: '42' }));
  }, 60_000);

  it('joue un vrai match à 26 joueurs et produit un journal', () => {
    expect(run.input.home.roster).toHaveLength(13);
    expect(run.input.away.roster).toHaveLength(13);
    expect(run.result.journal?.steps.length ?? 0).toBeGreaterThan(0);
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('résumé : score, moteur, driver et taille du journal', () => {
    const text = formatSingleMatchSummary(run);
    const { score } = run.result.summary;
    expect(text).toContain('Pittsburgh Smashers (Orc) vs Kansas City Soaring Hawks (Wood Elf)');
    expect(text).toContain(`Score ${score.home}-${score.away}`);
    expect(text).toContain(`moteur ${run.result.engineVer}`);
    expect(text).toContain('driver full');
    expect(text).toContain(`${run.result.journal?.steps.length} coups au journal`);
    expect(text).toContain('rosters de 26 joueurs');
  });

  it('feuille : re-dérivée du journal, aux noms des équipes (pas ceux par défaut du moteur)', () => {
    const sheet = formatSingleMatchSheet(run);
    expect(sheet.split('\n')[0]).toBe(
      'FEUILLE DE MATCH — Smashers (domicile) vs Soaring Hawks (extérieur)',
    );
    expect(sheet).not.toContain('Orcs de Fer');
    expect(sheet).toContain('Mi-temps 1 — Tour 1');
  });

  it('narration : titre aux noms des équipes, joueurs résolus par le roster', () => {
    const text = formatSingleMatchNarration(run);
    expect(text.split('\n')[0]).toBe('=== Smashers vs Soaring Hawks ===');
    // Un joueur résolu par le roster s'affiche « Nom (#numéro Poste) ».
    expect(text).toMatch(/\(#\d+ [^)]+\)/);
  });

  it('JSON : events au premier niveau (sim:diff-replays), sans les snapshots fullReplay', () => {
    const parsed = JSON.parse(formatSingleMatchJson(run));
    expect(parsed.seed).toBe(42);
    expect(parsed.driverKind).toBe('full');
    expect(parsed.homeId).toBe('pit-smashers');
    expect(Array.isArray(parsed.events)).toBe(true);
    expect(parsed.events).toHaveLength(run.result.events.length);
    expect(parsed.fullReplay).toBeUndefined();
    expect(parsed.journal).toBeDefined();
  });
});

describe('runSingleMatch — hybrid driver', () => {
  it('se joue sans roster ; la feuille est refusée faute de journal', () => {
    const run = runSingleMatch(resolveSingleMatchRequest({ driver: 'hybrid', seed: '1' }));
    expect(run.result.journal).toBeUndefined();
    expect(formatSingleMatchSummary(run)).toContain('sans roster');
    expect(() => formatSingleMatchSheet(run)).toThrow(/full driver/);
  });
});
