/**
 * Full driver MVP — Sprint Pro League Lot 3.A.2.a.
 *
 * Orchestrateur headless IA-vs-IA basé sur la machinery game-engine
 * complète (`getLegalMoves` / `applyMove` / `pickBestMove2Ply`). Là
 * où le hybrid driver (lot 0.A.2) abstrait les drives en yards
 * probabilistes, le full driver joue chaque coup comme une partie
 * BB normale, ce qui produit :
 *
 *  - Un GameState final avec positions, casualties, ball, etc.
 *  - Un score réel calculé par les TD events de game-engine
 *  - La signature racée préservée via les Lots 3.A.0.a / .b / .c
 *    (weights from profile, 2-ply on END_TURN, opening book)
 *
 * Scope du MVP (Lot 3.A.2.a)
 * --------------------------
 * - Initialise via `setup()` — 2 joueurs minimaux par équipe (pas
 *   de roster réel ; ça arrive en Lot 3.A.2.c)
 * - Boucle `pickBestMove2Ply → applyMove` jusqu'à `gamePhase ==='ended'`
 * - Garde-fous : timeout (`MAX_ACTIONS_PER_MATCH`), no-progress
 *   detection (`stale_move` consécutifs)
 * - Retourne un `SimResult` minimal (pas encore d'events MatchEvent
 *   — ça arrive en Lot 3.A.2.b)
 *
 * Hors scope MVP
 * --------------
 * - Wire MatchEvent[] (Lot 3.A.2.b)
 * - Vrais rosters Pro League (Lot 3.A.2.c)
 * - Casualties application (Lot 3.C.1)
 * - SPP / progression (Lot 3.C.2)
 *
 * Interface
 * ---------
 * `runFullDriver(input)` accepte le même `SimInput` que
 * `runHybridDriver` pour permettre un toggle drop-in côté
 * sim-runner (Lot 3.B.1 introduit `season.driverKind`).
 */

import {
  applyMove,
  getLegalMoves,
  pickBestMove2Ply,
  setup,
  type GameState,
  type Move,
  type RNG,
  type TeamId,
} from '@bb/game-engine';

import { createRng } from '../rng/seeded';
import {
  ENGINE_VER,
  type Casualty,
  type MatchOutcome,
  type MatchScore,
  type MatchSummary,
  type SimInput,
  type SimResult,
} from '../types';

import { weightsFromProfile } from '../tactics/ai-weights';
import { openingBookBonusForRace } from '../tactics/opening-book';
import { PRO_LEAGUE_TEAM_BY_ID } from '../tactics/race-profiles';
import {
  DEFAULT_TACTICAL_PROFILE,
  type TacticalProfile,
} from '../tactics/tactical-profile';
import type { MatchEvent } from '@bb/shared-types';

import { MS_PER_ACTION, diffStatesToEvents } from './full-driver-events';
import { buildGameStateFromRosters } from './full-driver-roster';

/**
 * Plafond d'actions par match. Sécurité contre une boucle d'IA qui
 * ne progresse pas (deux IAs qui ne s'entendent pas sur un END_TURN).
 * Un match BB normal fait ~150-300 actions au max ; 1500 laisse une
 * marge de 5×.
 */
const MAX_ACTIONS_PER_MATCH = 1500;

/**
 * Si l'IA produit N END_TURN consécutifs sur le même état (no-op),
 * on force la fin du match. Garde-fou contre les états qui auraient
 * `getLegalMoves === [{ END_TURN }]` mais ne progressent pas.
 */
const MAX_STALE_END_TURNS = 4;

/** Adapte un seed numérique au type RNG `() => number` du game-engine. */
function adaptRng(rng: ReturnType<typeof createRng>): RNG {
  return () => rng.next();
}

interface TeamRuntimeContext {
  readonly id: TeamId;
  readonly profile: TacticalProfile;
  readonly race: string;
}

function resolveContext(
  side: TeamId,
  input: SimInput['home'] | SimInput['away']
): TeamRuntimeContext {
  const profile = input.tactics ?? DEFAULT_TACTICAL_PROFILE;
  // race lookup : prioritize the explicit pro-league profile if id matches.
  const proProfile = PRO_LEAGUE_TEAM_BY_ID[input.id as never];
  const race = proProfile?.race ?? 'unknown';
  return { id: side, profile, race };
}

interface PickContext {
  readonly home: TeamRuntimeContext;
  readonly away: TeamRuntimeContext;
}

/**
 * Choisit le meilleur coup pour l'équipe active en composant :
 *  - 2-ply minimax (`pickBestMove2Ply`) avec les weights dérivés du
 *    profil tactique (Lot 3.A.0.a / .b)
 *  - Bonus opening book per-race (Lot 3.A.0.c) appliqué après coup
 *    sur les top candidats — ici on ré-évalue les coups légaux et
 *    on rerank si l'opening book change l'ordre.
 */
function selectMoveForActiveTeam(
  state: GameState,
  ctx: PickContext
): Move | null {
  const team = state.currentPlayer;
  const teamCtx = team === 'A' ? ctx.home : ctx.away;
  const weights = weightsFromProfile(teamCtx.profile);

  // 1-ply candidate from 2-ply scoring (lots 3.A.0.a + 0.b).
  const baselineMove = pickBestMove2Ply(state, team, weights);
  if (!baselineMove) return null;

  // Apply opening book : ré-évalue tous les coups légaux avec le
  // bonus per-race et garde le meilleur. Si l'opening book ne change
  // rien, on garde le baseline.
  const legal = getLegalMoves(state);
  if (legal.length === 0) return null;

  let bestMove = baselineMove;
  let bestComposite = openingBookBonusForRace(
    teamCtx.race,
    state.turn,
    baselineMove.type
  );
  // On compare les top-K coups en évaluant chacun avec le bonus opening.
  // Comme `pickBestMove2Ply` ne retourne que le top-1, on doit refaire
  // une petite recherche locale ici.
  for (const candidate of legal) {
    if (candidate === baselineMove) continue;
    // Score relatif à baseline : on additionne juste le bonus opening
    // book pour les comparer. Si le candidat n'est pas baselineMove,
    // il a un score baseline inférieur ; on n'override que si le
    // bonus opening dépasse l'écart de scoring.
    const candidateBonus = openingBookBonusForRace(
      teamCtx.race,
      state.turn,
      candidate.type
    );
    if (candidateBonus > bestComposite + 10) {
      // Heuristique simple : on n'override le top-1 que si le candidat
      // a un bonus opening significativement plus grand. Évite de
      // rerank toute la liste, garde le 2-ply utile.
      bestMove = candidate;
      bestComposite = candidateBonus;
    }
  }

  return bestMove;
}

function deriveOutcome(score: MatchScore): MatchOutcome {
  if (score.home > score.away) return 'home';
  if (score.away > score.home) return 'away';
  return 'draw';
}

interface DriverStats {
  readonly score: MatchScore;
  readonly turnoverCount: number;
  readonly touchdownCount: number;
  readonly casualtyCount: number;
}

function deriveStats(state: GameState): DriverStats {
  const score: MatchScore = {
    home: state.score.teamA,
    away: state.score.teamB,
  };
  const casualties = state.players.filter(
    (p) => p.state === 'casualty' || p.state === 'sent_off'
  ).length;
  return {
    score,
    turnoverCount: 0, // counted by Lot 3.A.2.b once events emission lands
    touchdownCount: state.score.teamA + state.score.teamB,
    casualtyCount: casualties,
  };
}

function buildCasualties(state: GameState): Casualty[] {
  // Casualty.outcome n'a pas de variante 'sent_off' (c'est un état joueur,
  // pas une issue casualty). Pour le MVP on rapporte les sorties de jeu
  // comme `badly_hurt` ; Lot 3.C.1 affinera la classification (lasting
  // injuries, dead, etc.) en lisant les events qui auront leur place
  // dans les MatchEvent[] de Lot 3.A.2.b.
  return state.players
    .filter((p) => p.state === 'casualty' || p.state === 'sent_off')
    .map<Casualty>((p) => ({
      playerId: p.id,
      team: p.team as TeamId,
      outcome: 'badly_hurt',
    }));
}

/**
 * Boucle principale : exécute des coups jusqu'à `gamePhase === 'ended'`,
 * `MAX_ACTIONS_PER_MATCH` ou stagnation détectée.
 *
 * Idempotent : ne mute pas l'input. RNG seedé donc deterministe pour
 * une même entrée.
 */
export function runFullDriver(input: SimInput): SimResult {
  const homeCtx = resolveContext('A', input.home);
  const awayCtx = resolveContext('B', input.away);
  const ctx: PickContext = { home: homeCtx, away: awayCtx };

  const rng = createRng(input.seed);
  const engineRng = adaptRng(rng);

  // Lot 3.A.2.c — quand des rosters complets sont fournis dans
  // SimInput, on construit le GameState depuis eux pour que les
  // events portent les vrais playerId / playerName. Sinon on
  // retombe sur `setup()` minimal (legacy MVP).
  const homeRoster = input.home.roster;
  const awayRoster = input.away.roster;
  let state =
    homeRoster && homeRoster.length > 0 && awayRoster && awayRoster.length > 0
      ? buildGameStateFromRosters({
          homeRoster,
          awayRoster,
          homeName: input.home.name,
          awayName: input.away.name,
          receivingTeam: 'B', // away receives par convention sim-engine
        })
      : setup();

  // Lot 3.A.2.b — collect MatchEvent[] via state diff après chaque
  // applyMove. Le KICKOFF event est émis avant la boucle et l'END
  // est inféré du diff (gamePhase 'ended').
  const events: MatchEvent[] = [
    {
      type: 'KICKOFF',
      displayAtMs: 0,
      engineVer: ENGINE_VER,
      meta: {
        home: input.home.id,
        away: input.away.id,
        weather: input.weather ?? 'nice',
        receivingTeam: 'away',
      },
    },
    // TURN_START initial pour le premier tour — sans cet event,
    // le narrator commence sans header de tour.
    {
      type: 'TURN_START',
      displayAtMs: 0,
      engineVer: ENGINE_VER,
      meta: {
        half: state.half,
        turn: state.turn,
        drivingTeam: state.currentPlayer === 'A' ? 'home' : 'away',
        score: { home: state.score.teamA, away: state.score.teamB },
        ballYardline: 4,
      },
    },
  ];

  let actionsApplied = 0;
  let staleEndTurns = 0;
  let lastTurn = state.turn;
  let lastHalf = state.half;

  while (state.gamePhase !== 'ended' && actionsApplied < MAX_ACTIONS_PER_MATCH) {
    const move = selectMoveForActiveTeam(state, ctx);
    if (!move) break;

    // Stale-detection : si N END_TURN consécutifs n'ont rien changé
    // (turn + half), on considère qu'on est coincé et on force end.
    if (move.type === 'END_TURN') {
      if (state.turn === lastTurn && state.half === lastHalf) {
        staleEndTurns += 1;
      } else {
        staleEndTurns = 0;
      }
      if (staleEndTurns > MAX_STALE_END_TURNS) break;
    }

    const prev = state;
    let next: GameState;
    try {
      next = applyMove(state, move, engineRng);
    } catch {
      // Le coup retourné par l'IA s'avère illégal. On force END_TURN
      // pour avancer.
      try {
        next = applyMove(state, { type: 'END_TURN' }, engineRng);
      } catch {
        break;
      }
    }

    // Lot 3.A.2.b — diff prev → next pour émettre les events
    // narratifs (BLOCK/PASS/DODGE/TD/CASUALTY/KO/TURNOVER/HALFTIME/
    // END/TURN_START). Timestamps incrémentaux 1s/action.
    const displayAtMs = (actionsApplied + 1) * MS_PER_ACTION;
    const newEvents = diffStatesToEvents(prev, next, {
      displayAtMs,
      move,
    });
    events.push(...newEvents);

    state = next;
    lastTurn = state.turn;
    lastHalf = state.half;
    actionsApplied += 1;
  }

  // Si le match s'est terminé via timeout / break, on émet un END
  // synthétique pour que le narrator + broadcaster aient leur clôture.
  if (!events.some((e) => e.type === 'END')) {
    events.push({
      type: 'END',
      displayAtMs: (actionsApplied + 1) * MS_PER_ACTION,
      engineVer: ENGINE_VER,
      meta: {
        score: { home: state.score.teamA, away: state.score.teamB },
        outcome:
          state.score.teamA > state.score.teamB
            ? 'home'
            : state.score.teamB > state.score.teamA
              ? 'away'
              : 'draw',
      },
    });
  }

  const stats = deriveStats(state);
  const casualties = buildCasualties(state);
  const outcome = deriveOutcome(stats.score);

  // Lot 3.A.2.b — `events` a été collecté tour par tour via
  // diffStatesToEvents au-dessus. On compte les turnovers réels en
  // post-process pour cohérence avec le hybrid driver summary.
  const turnoverCount = events.filter((e) => e.type === 'TURNOVER').length;
  const summary: MatchSummary = {
    score: stats.score,
    outcome,
    durationMs: 0,
    touchdownCount: stats.touchdownCount,
    turnoverCount,
    nuffleCount: 0,
    underdogBoostCount: 0,
    momentum: [],
  };

  return {
    result: outcome,
    engineVer: ENGINE_VER,
    events,
    casualties,
    summary,
  };
}
