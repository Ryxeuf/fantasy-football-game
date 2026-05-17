/**
 * Secret Weapons — expulsion en fin de drive (BB2020/BB3 Season 2)
 *
 * Règle : quand un drive se termine, tout joueur possédant la compétence
 * « Arme Secrète » (secret-weapon) qui a participé à ce drive est expulsé
 * par l'arbitre (Sent-off). Un pot-de-vin (Bribe) peut être utilisé pour
 * tenter d'éviter l'expulsion (jet D6 : 2+ = sauvé, 1 = expulsé quand même).
 */

import type { GameState, TeamId, Player, RNG } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { movePlayerToDugoutZone } from './dugout';
import { createLogEntry } from '../utils/logging';

/**
 * Retourne les joueurs d'une équipe possédant secret-weapon et éligibles
 * à l'expulsion en fin de drive.
 *
 * BB rule : un joueur ayant **participé au drive** est expulsé.
 *  - Joueur encore sur le terrain (`state === 'active'`, `pos.x >= 0`) → participe.
 *  - Joueur KO durant le drive (`state === 'knocked_out'`, `pos === -1`) → participe.
 *  - Joueur en réserves n'ayant jamais joué (`state === 'active'`, `pos === -1`)
 *    → n'a PAS participé, ne doit pas être expulsé. Avant ce fix, un Goblin
 *    Fanatic en réserves toute la mi-temps était quand même expulsé.
 *
 * Exclusions : déjà casualty / sent_off (déjà sorti pour autre raison) et
 * réserves actifs hors-terrain (n'ont jamais joué le drive).
 */
export function getSecretWeaponPlayers(state: GameState, teamId: TeamId): Player[] {
  return state.players.filter(
    p =>
      p.team === teamId &&
      hasSkill(p, 'secret-weapon') &&
      p.state !== 'casualty' &&
      p.state !== 'sent_off' &&
      // Exclure le cas spécifique « actif en réserves, jamais joué » :
      // state='active' AND pos.x<0 → n'a pas participé au drive.
      !((p.state === 'active' || !p.state) && p.pos.x < 0)
  );
}

/**
 * Traite l'expulsion des joueurs Arme Secrète pour les deux équipes.
 * Utilise automatiquement les bribes disponibles (une par joueur, en ordre).
 *
 * Appelé à chaque fin de drive : post-touchdown, mi-temps, fin de match.
 */
export function expelSecretWeapons(state: GameState, rng: RNG): GameState {
  let newState = { ...state, gameLog: [...state.gameLog] };
  // Clone bribes to track consumption
  const bribes = { ...newState.bribesRemaining };

  for (const teamId of ['A', 'B'] as TeamId[]) {
    const secretWeaponPlayers = getSecretWeaponPlayers(newState, teamId);
    const teamKey = teamId === 'A' ? 'teamA' : 'teamB';

    for (const player of secretWeaponPlayers) {
      if (bribes[teamKey] > 0) {
        // Use a bribe: roll D6, 2+ = success
        bribes[teamKey] -= 1;
        const roll = Math.floor(rng() * 6) + 1;

        if (roll >= 2) {
          // Bribe succeeds — player stays
          const log = createLogEntry(
            'action',
            `Arme Secrète : pot-de-vin utilisé pour ${player.name} (jet ${roll}, réussi). Le joueur reste sur le banc.`,
            player.id,
            teamId
          );
          newState = { ...newState, gameLog: [...newState.gameLog, log] };
          continue;
        }

        // Bribe fails — player still expelled
        const failLog = createLogEntry(
          'action',
          `Arme Secrète : pot-de-vin utilisé pour ${player.name} (jet ${roll}, échoué !). Le joueur est quand même expulsé.`,
          player.id,
          teamId
        );
        newState = { ...newState, gameLog: [...newState.gameLog, failLog] };
      }

      // Expel the player
      newState = movePlayerToDugoutZone(newState, player.id, 'sentOff', teamId);
      const expelLog = createLogEntry(
        'action',
        `Arme Secrète : ${player.name} est expulsé par l'arbitre en fin de drive.`,
        player.id,
        teamId
      );
      newState.gameLog = [...newState.gameLog, expelLog];
    }
  }

  newState.bribesRemaining = bribes;
  return newState;
}
