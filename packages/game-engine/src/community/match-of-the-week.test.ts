import { describe, it, expect } from 'vitest';
import {
  pickMatchOfTheWeek,
  scoreMatchEngagement,
  type MatchSummary,
} from './match-of-the-week';

const baseMatch = (overrides: Partial<MatchSummary> = {}): MatchSummary => ({
  matchId: 'm1',
  status: 'completed',
  finishedAt: new Date('2026-04-25T10:00:00Z'),
  teamAName: 'Skaven FC',
  teamBName: 'Dwarves United',
  teamARoster: 'skaven',
  teamBRoster: 'dwarf',
  scoreA: 2,
  scoreB: 1,
  totalTurns: 16,
  totalCasualties: 4,
  hasComeback: false,
  ...overrides,
});

describe('Regle: match-of-the-week (O.9 community)', () => {
  describe('scoreMatchEngagement()', () => {
    it('retourne un score numerique fini', () => {
      const score = scoreMatchEngagement(baseMatch());
      expect(typeof score).toBe('number');
      expect(Number.isFinite(score)).toBe(true);
    });

    it('plus de touchdowns -> score plus eleve', () => {
      const low = scoreMatchEngagement(baseMatch({ scoreA: 0, scoreB: 0 }));
      const high = scoreMatchEngagement(baseMatch({ scoreA: 4, scoreB: 3 }));
      expect(high).toBeGreaterThan(low);
    });

    it('plus de casualties -> score plus eleve', () => {
      const low = scoreMatchEngagement(baseMatch({ totalCasualties: 0 }));
      const high = scoreMatchEngagement(baseMatch({ totalCasualties: 10 }));
      expect(high).toBeGreaterThan(low);
    });

    it('un comeback bonifie le score', () => {
      const noCb = scoreMatchEngagement(baseMatch({ hasComeback: false }));
      const cb = scoreMatchEngagement(baseMatch({ hasComeback: true }));
      expect(cb).toBeGreaterThan(noCb);
    });

    it('un score serre est plus engageant qu un blowout (a TD totaux egaux)', () => {
      // 3-3 (close) vs 6-0 (blowout) : meme nb de TD, mais 3-3 plus equilibre.
      const close = scoreMatchEngagement(baseMatch({ scoreA: 3, scoreB: 3 }));
      const blowout = scoreMatchEngagement(baseMatch({ scoreA: 6, scoreB: 0 }));
      expect(close).toBeGreaterThanOrEqual(blowout);
    });

    it('un match non termine recoit un score 0', () => {
      const notDone = scoreMatchEngagement(baseMatch({ status: 'in_progress' }));
      expect(notDone).toBe(0);
    });

    it('reste deterministe : meme entree -> meme sortie', () => {
      const m = baseMatch();
      expect(scoreMatchEngagement(m)).toBe(scoreMatchEngagement(m));
    });
  });

  describe('pickMatchOfTheWeek()', () => {
    it('retourne null si la liste est vide', () => {
      expect(pickMatchOfTheWeek([], { now: new Date('2026-04-26T00:00:00Z') })).toBeNull();
    });

    it('retourne null si tous les matches sont en dehors de la fenetre 7 jours', () => {
      const old = baseMatch({
        matchId: 'old',
        finishedAt: new Date('2026-04-01T00:00:00Z'),
      });
      const result = pickMatchOfTheWeek([old], {
        now: new Date('2026-04-26T00:00:00Z'),
      });
      expect(result).toBeNull();
    });

    it('selectionne le match avec le plus haut score d engagement dans la fenetre', () => {
      const dull = baseMatch({
        matchId: 'dull',
        scoreA: 0,
        scoreB: 0,
        totalCasualties: 0,
        finishedAt: new Date('2026-04-25T10:00:00Z'),
      });
      const epic = baseMatch({
        matchId: 'epic',
        scoreA: 4,
        scoreB: 3,
        totalCasualties: 8,
        hasComeback: true,
        finishedAt: new Date('2026-04-24T10:00:00Z'),
      });
      const result = pickMatchOfTheWeek([dull, epic], {
        now: new Date('2026-04-26T00:00:00Z'),
      });
      expect(result?.match.matchId).toBe('epic');
      expect(result?.score).toBeGreaterThan(0);
    });

    it('exclut les matches non termines', () => {
      const inProgress = baseMatch({
        matchId: 'live',
        status: 'in_progress',
        scoreA: 9,
        scoreB: 9,
        totalCasualties: 99,
      });
      const completed = baseMatch({
        matchId: 'done',
        scoreA: 1,
        scoreB: 0,
      });
      const result = pickMatchOfTheWeek([inProgress, completed], {
        now: new Date('2026-04-26T00:00:00Z'),
      });
      expect(result?.match.matchId).toBe('done');
    });

    it('utilise la fenetre par defaut de 7 jours quand aucune option n est fournie', () => {
      const recent = baseMatch({
        matchId: 'recent',
        finishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      });
      const result = pickMatchOfTheWeek([recent]);
      expect(result?.match.matchId).toBe('recent');
    });

    it('inclut les details du score pour transparence', () => {
      const result = pickMatchOfTheWeek([baseMatch()], {
        now: new Date('2026-04-26T00:00:00Z'),
      });
      expect(result).not.toBeNull();
      if (!result) return;
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThan(0);
    });

    it('en cas d egalite parfaite, prefere le plus recent', () => {
      const older = baseMatch({
        matchId: 'older',
        finishedAt: new Date('2026-04-20T10:00:00Z'),
      });
      const newer = baseMatch({
        matchId: 'newer',
        finishedAt: new Date('2026-04-25T10:00:00Z'),
      });
      const result = pickMatchOfTheWeek([older, newer], {
        now: new Date('2026-04-26T00:00:00Z'),
      });
      expect(result?.match.matchId).toBe('newer');
    });

    it('respecte la fenetre custom passee en option (windowDays)', () => {
      const day14 = baseMatch({
        matchId: 'd14',
        finishedAt: new Date('2026-04-12T00:00:00Z'),
      });
      const now = new Date('2026-04-26T00:00:00Z');
      // window 7 jours -> exclu
      expect(pickMatchOfTheWeek([day14], { now, windowDays: 7 })).toBeNull();
      // window 30 jours -> inclus
      expect(pickMatchOfTheWeek([day14], { now, windowDays: 30 })?.match.matchId).toBe(
        'd14',
      );
    });
  });
});
