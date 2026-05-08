/**
 * Full driver — roster-aware GameState builder (Lot 3.A.2.c).
 *
 * Convertit un `SimRosterPlayer[]` (snapshot de roster Pro League)
 * en `Player[]` placé sur le terrain BB, prêt à être consommé par
 * le full driver IA-vs-IA.
 *
 * Pourquoi
 * --------
 * Le MVP (Lot 3.A.2.a) utilisait `setup()` du game-engine : 6 joueurs
 * synthétiques avec des ids `A1`/`B1` et des noms hardcodés. Les
 * events MatchEvent[] qui en sortaient portaient des `playerId`
 * non-narratifs ("A1 plaque B2") au lieu de "Bob le Blitzer plaque
 * Carla la Thrower". Ce module mappe les vrais joueurs.
 *
 * Scope
 * -----
 * - Mapping pur SimRosterPlayer → game-engine Player
 * - Placement basique en formation 3-3-2-3 (LOS / wings / backfield)
 *   sur la moitié défensive du terrain. Le hybrid driver ne fait pas
 *   mieux ; le full driver gagne juste l'identité narrative.
 * - L'équipe receveuse (away par convention) a le ballon.
 *
 * Hors scope
 * ----------
 * - Kickoff scatter / weather / fan factor : skip pour MVP, le
 *   match commence directement en `gamePhase='playing'`.
 * - Setup phase interactive : le full driver est headless ; on
 *   place de force.
 * - Animosité, special rules de roster : tracées dans roster.skills
 *   et lues plus tard quand le scoring AI les exploitera.
 */

import type { Player, TeamId, GameState } from '@bb/game-engine';
import { setup } from '@bb/game-engine';

import type { SimRosterPlayer } from '../types';

/** Nombre max de joueurs placés par équipe. BB = 11 sur le terrain. */
const MAX_PLAYERS_ON_FIELD = 11;

/**
 * Positions LOS (line of scrimmage) + backfield pour 11 joueurs.
 * Coordonnées x/y sur un terrain 26×15 :
 *   - team A defensive line à x=12 (LOS adverse)
 *   - team B defensive line à x=13
 *   - center y=7, wings y=4 et y=10
 */
const TEAM_A_FORMATION: ReadonlyArray<{ x: number; y: number }> = Object.freeze([
  // 3 LOS centrals
  { x: 11, y: 6 },
  { x: 11, y: 7 },
  { x: 11, y: 8 },
  // 2 wings
  { x: 10, y: 4 },
  { x: 10, y: 10 },
  // 3 mid
  { x: 8, y: 5 },
  { x: 8, y: 7 },
  { x: 8, y: 9 },
  // 3 backfield
  { x: 4, y: 4 },
  { x: 4, y: 7 },
  { x: 4, y: 10 },
]);

const TEAM_B_FORMATION: ReadonlyArray<{ x: number; y: number }> = Object.freeze([
  // 3 LOS centrals
  { x: 14, y: 6 },
  { x: 14, y: 7 },
  { x: 14, y: 8 },
  // 2 wings
  { x: 15, y: 4 },
  { x: 15, y: 10 },
  // 3 mid
  { x: 17, y: 5 },
  { x: 17, y: 7 },
  { x: 17, y: 9 },
  // 3 backfield (le porteur initial dans la stack — index 9 par convention)
  { x: 21, y: 4 },
  { x: 21, y: 7 }, // ball carrier (receiving team = away = B)
  { x: 21, y: 10 },
]);

/**
 * Mappe un joueur du roster vers un `Player` game-engine. Le `team`
 * est imposé par la fonction parente (le roster ne porte pas le
 * teamId — il est rattaché à une équipe par contexte).
 */
function rosterPlayerToGameEnginePlayer(
  roster: SimRosterPlayer,
  team: TeamId,
  pos: { x: number; y: number },
  hasBall: boolean
): Player {
  return {
    id: roster.id,
    team,
    pos: { x: pos.x, y: pos.y },
    name: roster.name,
    number: roster.number,
    position: roster.position,
    ma: roster.ma,
    st: roster.st,
    ag: roster.ag,
    pa: roster.pa,
    av: roster.av,
    skills: roster.skills ? [...roster.skills] : [],
    pm: roster.ma,
    state: 'active',
    hasBall,
  };
}

/**
 * Construit un GameState complet à partir des deux rosters. L'équipe
 * `receivingTeam` reçoit le coup d'envoi (et donc la balle).
 *
 * On part de `setup()` pour réutiliser la structure complète (dugouts,
 * apothecaryAvailable, gamePhase, etc.) puis on remplace les
 * `players` + `ball` par notre composition roster-based.
 */
export function buildGameStateFromRosters(input: {
  homeRoster: readonly SimRosterPlayer[];
  awayRoster: readonly SimRosterPlayer[];
  homeName?: string;
  awayName?: string;
  receivingTeam: TeamId;
}): GameState {
  const baseline = setup();
  const teamAPlayers = input.homeRoster
    .slice(0, MAX_PLAYERS_ON_FIELD)
    .map((roster, idx) => {
      const pos = TEAM_A_FORMATION[idx];
      const hasBall = input.receivingTeam === 'A' && idx === 9;
      return rosterPlayerToGameEnginePlayer(roster, 'A', pos, hasBall);
    });
  const teamBPlayers = input.awayRoster
    .slice(0, MAX_PLAYERS_ON_FIELD)
    .map((roster, idx) => {
      const pos = TEAM_B_FORMATION[idx];
      const hasBall = input.receivingTeam === 'B' && idx === 9;
      return rosterPlayerToGameEnginePlayer(roster, 'B', pos, hasBall);
    });

  const carrier =
    input.receivingTeam === 'A'
      ? teamAPlayers[9]
      : teamBPlayers[9];
  const ball = carrier ? { x: carrier.pos.x, y: carrier.pos.y } : undefined;

  return {
    ...baseline,
    players: [...teamAPlayers, ...teamBPlayers],
    ball,
    currentPlayer: input.receivingTeam,
  };
}
