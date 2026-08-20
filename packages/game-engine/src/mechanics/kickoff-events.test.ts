import { describe, it, expect } from 'vitest';
import {
  KICKOFF_EVENTS,
  INTERACTIVE_KICKOFF_EVENT_IDS,
  LEGACY_KICKOFF_EVENT_IDS,
  rollKickoffEvent,
  applyKickoffEvent,
  restoreDriveStatModifiers,
} from './kickoff-events';
import { setup } from '../core/game-state';
import { makeRNG } from '../utils/rng';
import type { GameState } from '../core/types';

/**
 * Table des événements de coup d'envoi — saison 2025.
 * Source : `docs/regles-bb-2025/page-01.md` (transcription du livre) et
 * chapitre `coup-d-envoi` du compendium publié.
 */
describe('Kickoff Events', () => {
  describe('KICKOFF_EVENTS table', () => {
    it('has events for all 2D6 results (2-12)', () => {
      for (let i = 2; i <= 12; i++) {
        expect(KICKOFF_EVENTS[i]).toBeDefined();
        expect(KICKOFF_EVENTS[i].id).toBeTruthy();
        expect(KICKOFF_EVENTS[i].nameFr).toBeTruthy();
        expect(KICKOFF_EVENTS[i].description).toBeTruthy();
      }
    });

    it('has 11 unique events', () => {
      const uniqueIds = new Set(Object.values(KICKOFF_EVENTS).map(e => e.id));
      expect(uniqueIds.size).toBe(11);
    });

    /**
     * Non-regression : la table reprenait l'édition précédente (Émeute,
     * Défense parfaite, Coup de pied en hauteur, Arbitre zélé…), ce qui
     * remontait jusqu'à la liste déroulante de saisie des feuilles de
     * match de ligue.
     */
    it('reprend les 11 résultats de la table 2025, dans l\'ordre du livre', () => {
      expect(
        Object.fromEntries(
          Object.entries(KICKOFF_EVENTS).map(([roll, ev]) => [roll, ev.nameFr])
        )
      ).toEqual({
        2: 'À mort l\'arbitre !',
        3: 'Temps mort !',
        4: 'Solide défense !',
        5: 'Chandelle !',
        6: 'Fans en folie !',
        7: 'Coaching brillant !',
        8: 'Météo capricieuse !',
        9: 'Surprise !',
        10: 'Charge !',
        11: 'En-cas suspect !',
        12: 'Invasion du terrain !',
      });
    });

    it('n\'expose plus les événements disparus de la table 2025', () => {
      const ids = Object.values(KICKOFF_EVENTS).map(e => e.id as string);
      expect(ids).not.toContain('riot');
      expect(ids).not.toContain('perfect-defence');
      expect(ids).not.toContain('officious-ref');
    });

    it('mappe les anciens identifiants vers la table 2025', () => {
      for (const [legacy, current] of Object.entries(LEGACY_KICKOFF_EVENT_IDS)) {
        expect(Object.values(KICKOFF_EVENTS).some(e => e.id === current)).toBe(true);
        expect(Object.values(KICKOFF_EVENTS).some(e => (e.id as string) === legacy)).toBe(false);
      }
    });

    it('liste comme interactifs les 4 événements à décision de coach', () => {
      expect([...INTERACTIVE_KICKOFF_EVENT_IDS].sort()).toEqual([
        'blitz',
        'high-kick',
        'quick-snap',
        'solid-defence',
      ]);
    });
  });

  describe('rollKickoffEvent', () => {
    it('returns a valid event and total', () => {
      const rng = makeRNG('test-kickoff');
      const { total, event } = rollKickoffEvent(rng);
      expect(total).toBeGreaterThanOrEqual(2);
      expect(total).toBeLessThanOrEqual(12);
      expect(event).toBeDefined();
      expect(event.id).toBeTruthy();
    });
  });

  describe('applyKickoffEvent', () => {
    it('2 — À mort l\'arbitre ! : +1 Pot-de-vin pour chaque équipe', () => {
      const state = setup();
      const result = applyKickoffEvent(state, KICKOFF_EVENTS[2], makeRNG('test'), 'A');
      expect(result.bribesRemaining.teamA).toBe(state.bribesRemaining.teamA + 1);
      expect(result.bribesRemaining.teamB).toBe(state.bribesRemaining.teamB + 1);
      // Rerolls inchangees
      expect(result.teamRerolls.teamA).toBe(state.teamRerolls.teamA);
      expect(result.teamRerolls.teamB).toBe(state.teamRerolls.teamB);
    });

    describe('3 — Temps mort !', () => {
      /**
       * L'édition précédente (« Émeute ») tirait un D6 pour choisir le
       * sens. La table 2025 est déterministe : 6/7/8 → recul, sinon
       * avance, pour les deux équipes.
       */
      it('avance le Marqueur de Tour avant le 6e tour', () => {
        const state = { ...setup(), turn: 3 };
        const result = applyKickoffEvent(state, KICKOFF_EVENTS[3], makeRNG('t'), 'A');
        expect(result.turn).toBe(4);
      });

      it('recule le Marqueur de Tour sur 6, 7 ou 8', () => {
        for (const turn of [6, 7, 8]) {
          const state = { ...setup(), turn };
          const result = applyKickoffEvent(state, KICKOFF_EVENTS[3], makeRNG('t'), 'A');
          expect(result.turn).toBe(turn - 1);
        }
      });

      it('ne descend jamais sous le tour 1', () => {
        const state = { ...setup(), turn: 1 };
        const result = applyKickoffEvent(state, KICKOFF_EVENTS[3], makeRNG('t'), 'A');
        expect(result.turn).toBeGreaterThanOrEqual(1);
      });
    });

    describe('4 / 9 / 10 — événements à décision de coach', () => {
      it.each([
        [4, 'solid-defence', 'A'],
        [9, 'quick-snap', 'B'],
        [10, 'blitz', 'A'],
      ] as const)('%s pose un pendingKickoffEvent plafonné à D3+3', (roll, id, team) => {
        const state = setup();
        const result = applyKickoffEvent(state, KICKOFF_EVENTS[roll], makeRNG(`k${roll}`), 'A');
        expect(result.pendingKickoffEvent?.type).toBe(id);
        expect(result.pendingKickoffEvent?.team).toBe(team);
        expect(result.pendingKickoffEvent?.maxPlayers).toBeGreaterThanOrEqual(4);
        expect(result.pendingKickoffEvent?.maxPlayers).toBeLessThanOrEqual(6);
        expect(result.pendingKickoffEvent?.eligiblePlayerIds).toBeDefined();
      });

      it('5 — Chandelle ! ne concerne qu\'un seul joueur de l\'équipe qui réceptionne', () => {
        const state = setup();
        const result = applyKickoffEvent(state, KICKOFF_EVENTS[5], makeRNG('k5'), 'A');
        expect(result.pendingKickoffEvent?.type).toBe('high-kick');
        expect(result.pendingKickoffEvent?.team).toBe('B');
        expect(result.pendingKickoffEvent?.maxPlayers).toBe(1);
      });
    });

    describe('6 — Fans en folie ! (Soutien Offensif, plus une relance)', () => {
      const cheeringFansEvent = KICKOFF_EVENTS[6];

      it('additionne les Cheerleaders au D6 et récompense le plus haut total', () => {
        // teamA : D6 (1-6) + 8 = 9-14 ; teamB : D6 + 1 = 2-7 → A gagne toujours.
        const state: GameState = { ...setup(), cheerleaders: { teamA: 8, teamB: 1 } };
        for (let i = 0; i < 20; i++) {
          const result = applyKickoffEvent(state, cheeringFansEvent, makeRNG(`cf-${i}`), 'A');
          expect(result.cheeringFansAssist?.teamA).toBe(true);
          expect(result.cheeringFansAssist?.teamB).toBe(false);
        }
      });

      it('ne donne PAS de relance d\'équipe', () => {
        const state: GameState = { ...setup(), cheerleaders: { teamA: 8, teamB: 1 } };
        const result = applyKickoffEvent(state, cheeringFansEvent, makeRNG('cf-reroll'), 'A');
        expect(result.teamRerolls.teamA).toBe(state.teamRerolls.teamA);
        expect(result.teamRerolls.teamB).toBe(state.teamRerolls.teamB);
      });

      it('récompense les deux équipes en cas d\'égalité', () => {
        // Meme D6 pour les deux + meme nombre de cheerleaders → egalite.
        const state: GameState = { ...setup(), cheerleaders: { teamA: 2, teamB: 2 } };
        const rng = () => 0.5; // D6 identique pour les deux coachs
        const result = applyKickoffEvent(state, cheeringFansEvent, rng, 'A');
        expect(result.cheeringFansAssist).toEqual({ teamA: true, teamB: true });
      });

      it('fonctionne sans cheerleaders renseignés (défaut 0)', () => {
        const state = setup();
        const result = applyKickoffEvent(state, cheeringFansEvent, makeRNG('cf-none'), 'A');
        expect(result.gameLog.length).toBeGreaterThan(state.gameLog.length);
      });

      it('mentionne les cheerleaders dans le log', () => {
        const state: GameState = { ...setup(), cheerleaders: { teamA: 3, teamB: 1 } };
        const result = applyKickoffEvent(state, cheeringFansEvent, makeRNG('cf-log'), 'A');
        const actionLog = result.gameLog
          .slice(state.gameLog.length)
          .find(l => l.type === 'action');
        expect(actionLog!.message).toMatch(/D6.*\+.*cheerleaders/i);
      });
    });

    describe('7 — Coaching brillant ! (D6 + Coachs Assistants)', () => {
      const brilliantCoachingEvent = KICKOFF_EVENTS[7];

      it('additionne les Coachs Assistants au D6', () => {
        // teamA : D6 + 8 = 9-14 ; teamB : D6 + 1 = 2-7 → A gagne toujours.
        const state = { ...setup(), assistantCoaches: { teamA: 8, teamB: 1 } };
        for (let i = 0; i < 20; i++) {
          const result = applyKickoffEvent(state, brilliantCoachingEvent, makeRNG(`bc-${i}`), 'A');
          expect(result.teamRerolls.teamA).toBe(state.teamRerolls.teamA + 1);
          expect(result.teamRerolls.teamB).toBe(state.teamRerolls.teamB);
        }
      });

      it('donne la relance aux DEUX équipes en cas d\'égalité', () => {
        const state = { ...setup(), assistantCoaches: { teamA: 2, teamB: 2 } };
        const rng = () => 0.5;
        const result = applyKickoffEvent(state, brilliantCoachingEvent, rng, 'A');
        expect(result.teamRerolls.teamA).toBe(state.teamRerolls.teamA + 1);
        expect(result.teamRerolls.teamB).toBe(state.teamRerolls.teamB + 1);
      });

      it('fonctionne sans assistantCoaches renseignés (défaut 0)', () => {
        const state = setup();
        const result = applyKickoffEvent(state, brilliantCoachingEvent, makeRNG('bc-none'), 'A');
        expect(result.gameLog.length).toBeGreaterThan(state.gameLog.length);
      });

      it('jette bien 1D6 (et non 1D3) — le log le mentionne', () => {
        const state = { ...setup(), assistantCoaches: { teamA: 3, teamB: 1 } };
        const result = applyKickoffEvent(state, brilliantCoachingEvent, makeRNG('bc-log'), 'A');
        const actionLog = result.gameLog
          .slice(state.gameLog.length)
          .find(l => l.type === 'action');
        expect(actionLog!.message).toMatch(/D6.*\+.*coach/i);
      });
    });

    describe('8 — Météo capricieuse !', () => {
      const changingWeatherEvent = KICKOFF_EVENTS[8];

      it('re-roll un 2D6 et met a jour state.weatherCondition', () => {
        const state = {
          ...setup(),
          weatherCondition: { condition: 'Nice', description: 'temps clement' },
          preMatch: { weatherType: 'classique' } as never,
        };
        // rng = 0.99 → dés 6+6 = 12
        const result = applyKickoffEvent(state, changingWeatherEvent, () => 0.99, 'A');
        expect(result.weatherCondition?.condition).not.toBe('Nice');
        expect(result.weatherCondition?.condition).toBeTruthy();
      });

      /**
       * Saison 2025 : le nouveau jet REMPLACE toujours la météo. Sur
       * Conditions Idéales, le ballon Valdingue (3) avant d'atterrir —
       * l'édition précédente laissait au contraire la météo inchangée
       * et ne faisait pas dévier le ballon.
       */
      it('remplace la météo et fait Valdinguer (3) le ballon sur Conditions Idéales', () => {
        const state = {
          ...setup(),
          ball: { x: 12, y: 7 },
          weatherCondition: { condition: 'Rain', description: 'Pluie' },
          preMatch: { weatherType: 'classique' } as never,
        };
        // 0.34 → D6=3, 0.5 → D6=4 ⇒ 2D6 = 7 = conditions parfaites
        const rngVals = [0.34, 0.5];
        let i = 0;
        const result = applyKickoffEvent(state, changingWeatherEvent, () => rngVals[i++ % 2], 'A');

        expect(result.weatherCondition?.condition).not.toBe('Rain');
        expect(result.gameLog.some(l => l.message.includes('Valdingue'))).toBe(true);
      });
    });

    describe('11 — En-cas suspect ! (remplace « Arbitre zélé »)', () => {
      const dodgySnackEvent = KICKOFF_EVENTS[11];

      it('applique -1 MO et -1 AR à un joueur, restaurés en fin de Phase', () => {
        const state = setup();
        const result = applyKickoffEvent(state, dodgySnackEvent, makeRNG('snack-malus'), 'A');

        const modifiers = result.driveStatModifiers ?? [];
        const wentToLatrines = result.players.some(
          p => p.pos.x < 0 && !state.players.find(o => o.id === p.id && o.pos.x < 0)
        );
        // Selon le D6, la victime prend le malus OU file aux latrines.
        expect(modifiers.length > 0 || wentToLatrines).toBe(true);

        for (const mod of modifiers) {
          const before = state.players.find(p => p.id === mod.playerId)!;
          const after = result.players.find(p => p.id === mod.playerId)!;
          expect(after.ma).toBe(before.ma - 1);
          expect(after.av).toBe(before.av - 1);
        }

        // Fin de Phase : les caractéristiques d'origine reviennent.
        const restored = restoreDriveStatModifiers(result);
        for (const mod of modifiers) {
          const before = state.players.find(p => p.id === mod.playerId)!;
          const after = restored.players.find(p => p.id === mod.playerId)!;
          expect(after.ma).toBe(before.ma);
          expect(after.av).toBe(before.av);
        }
        expect(restored.driveStatModifiers).toEqual([]);
      });

      it('ne pose plus le drapeau « Arbitre zélé » du drive', () => {
        const state = setup();
        const result = applyKickoffEvent(state, dodgySnackEvent, makeRNG('snack-ref'), 'A');
        expect(result.officiousRefForDrive).toBeFalsy();
      });
    });

    describe('12 — Invasion du terrain !', () => {
      const pitchInvasionEvent = KICKOFF_EVENTS[12];

      it('sonne D3 joueurs du coach au plus BAS total (D6 + Facteur de Popularité)', () => {
        // teamB : D6 + 10 → toujours au-dessus de teamA (D6 + 0).
        const state: GameState = { ...setup(), dedicatedFans: { teamA: 0, teamB: 10 } };
        for (let i = 0; i < 10; i++) {
          const result = applyKickoffEvent(state, pitchInvasionEvent, makeRNG(`pi-${i}`), 'A');
          const stunnedA = result.players.filter(p => p.team === 'A' && p.stunned).length;
          const stunnedB = result.players.filter(p => p.team === 'B' && p.stunned).length;
          expect(stunnedA).toBeGreaterThanOrEqual(1);
          expect(stunnedA).toBeLessThanOrEqual(3);
          expect(stunnedB).toBe(0);
        }
      });

      it('touche les deux équipes en cas d\'égalité', () => {
        const state: GameState = { ...setup(), dedicatedFans: { teamA: 3, teamB: 3 } };
        const rng = () => 0.5; // memes D6 des deux cotes
        const result = applyKickoffEvent(state, pitchInvasionEvent, rng, 'A');
        expect(result.players.filter(p => p.team === 'A' && p.stunned).length).toBeGreaterThan(0);
        expect(result.players.filter(p => p.team === 'B' && p.stunned).length).toBeGreaterThan(0);
      });

      it('utilise le Facteur de Popularité complet (D3 + fans), pas les seuls fans dévoués', () => {
        // Fans dévoués égaux (3/3) mais FP pré-match opposés : sans
        // `fanFactors`, l'issue dépendrait du seul D6 ; avec, teamA
        // (FP 13 vs 3) ne peut jamais perdre le jet.
        const state: GameState = {
          ...setup(),
          dedicatedFans: { teamA: 3, teamB: 3 },
          fanFactors: { teamA: 13, teamB: 3 },
        };
        for (let i = 0; i < 10; i++) {
          const result = applyKickoffEvent(state, pitchInvasionEvent, makeRNG(`pi-ff-${i}`), 'A');
          expect(result.players.filter(p => p.team === 'A' && p.stunned).length).toBe(0);
          expect(result.players.filter(p => p.team === 'B' && p.stunned).length).toBeGreaterThan(0);
        }
      });

      it('replie sur les fans dévoués pour un state sauvegardé sans fanFactors', () => {
        const state: GameState = { ...setup(), dedicatedFans: { teamA: 0, teamB: 10 } };
        const result = applyKickoffEvent(state, pitchInvasionEvent, makeRNG('pi-legacy'), 'A');
        expect(result.players.filter(p => p.team === 'A' && p.stunned).length).toBeGreaterThan(0);
        expect(result.players.filter(p => p.team === 'B' && p.stunned).length).toBe(0);
      });
    });
  });
});
