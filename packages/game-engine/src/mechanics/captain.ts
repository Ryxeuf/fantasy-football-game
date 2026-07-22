/**
 * Règle spéciale d'équipe "Capitaine" (Blood Bowl Saison 3) — helpers purs
 * côté moteur de match.
 *
 * Effets en match couverts ici :
 *  - relance d'équipe gratuite sur un 6 naturel si le capitaine est sur le
 *    terrain (consommé dans `actions/reroll-choose-handler.ts`) ;
 *  - obligation d'aligner le capitaine au placement s'il est disponible
 *    (vérifié dans `core/game-state.validatePlayerPlacement`).
 *
 * La désignation du capitaine (création d'équipe, re-désignation si mort ou
 * licencié, compétence Pro offerte) vit côté serveur
 * (`apps/server/src/services/team-captain.ts`) : le moteur ne voit que le
 * flag `Player.isCaptain` propagé via `TeamPlayerData`.
 *
 * 100 % pur, sans I/O.
 */

import type { GameState, Player, TeamId } from '../core/types';

/**
 * Un joueur est "sur le terrain" s'il occupe une case valide et n'est ni
 * KO, ni blessé, ni expulsé. Les joueurs sonnés (stunned) restent sur le
 * terrain et comptent pour la présence du capitaine.
 */
export function isPlayerOnPitch(player: Player): boolean {
  if (player.pos.x < 0 || player.pos.y < 0) return false;
  const state = player.state;
  return state === undefined || state === 'active' || state === 'stunned';
}

/** Capitaine de l'équipe actuellement sur le terrain, ou `null`. */
export function findCaptainOnPitch(
  state: GameState,
  team: TeamId,
): Player | null {
  return (
    state.players.find(
      (p) => p.team === team && p.isCaptain === true && isPlayerOnPitch(p),
    ) ?? null
  );
}

/**
 * Capitaine de l'équipe disponible pour le placement (état `active`,
 * placé ou non), ou `null`. Sert à la règle "vous devez aligner votre
 * capitaine si possible" : un capitaine KO/blessé/expulsé n'est pas
 * plaçable et ne bloque donc pas la validation du placement.
 */
export function findPlaceableCaptain(
  state: GameState,
  team: TeamId,
): Player | null {
  return (
    state.players.find(
      (p) =>
        p.team === team &&
        p.isCaptain === true &&
        (!p.state || p.state === 'active'),
    ) ?? null
  );
}
