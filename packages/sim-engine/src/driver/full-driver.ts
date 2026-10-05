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
  setup,
  type GameState,
  type Move,
  type RNG,
  type TeamId,
} from '@bb/game-engine';

import {
  ENGINE_VER,
  type Casualty,
  type MatchOutcome,
  type MatchScore,
  type MatchSummary,
  type SimInput,
  type SimResult,
} from '../types';

import { createCoach, type CoachTrace } from '../coach/coach';
import { PRO_LEAGUE_TEAM_BY_ID } from '../tactics/race-profiles';
import {
  DEFAULT_TACTICAL_PROFILE,
  type TacticalProfile,
} from '../tactics/tactical-profile';
import type { MatchEvent } from '@bb/shared-types';

import {
  MS_PER_ACTION,
  diffStatesToEvents,
  getInitialBallYardline,
} from './full-driver-events';
import { buildGameStateFromRosters } from './full-driver-roster';
import { executeHeadlessKickoff } from './full-driver-kickoff';
import { executeHeadlessDrive } from './full-driver-halftime';
import {
  REPLAY_JOURNAL_VERSION,
  extractDiceRecords,
  journalOpeningRng,
  journalStepRng,
  type ReplayJournalStep,
} from '../replay/journal';

/**
 * Plafond d'actions par match. Sécurité contre une boucle d'IA qui
 * ne progresse pas (deux IAs qui ne s'entendent pas sur un END_TURN).
 * Un match BB normal fait ~150-300 actions au max ; 1500 laisse une
 * marge de 5×.
 */
// Lot 3 « cerveau du coach » : un coach qui active ses onze joueurs chaque
// tour joue ~1 400 coups par match (16 tours × 2 équipes × ~45 coups) —
// la borne de 1 500 coupait des matchs réels en seconde mi-temps.
const MAX_ACTIONS_PER_MATCH = 3000;

/**
 * Si l'IA produit N END_TURN consécutifs sur le même état (no-op),
 * on force la fin du match. Garde-fou contre les états qui auraient
 * `getLegalMoves === [{ END_TURN }]` mais ne progressent pas.
 *
 * BUG fix : avant, la detection s'appuyait sur `turn/half/currentPlayer`
 * — or `currentPlayer` flippe a chaque END_TURN normal, donc `advanced`
 * etait quasi-toujours true et le compteur reset a 0. La detection
 * etait neutralisee. Voir aussi `gamePhase` qui peut rester bloque
 * en `'halftime'` ou `'post-td'` (pas de retour automatique vers
 * `'playing'` sans completer le setup). On compte maintenant les
 * END_TURN consecutifs en `gamePhase !== 'playing'` separement avec
 * un seuil plus aggressif.
 */
const MAX_STALE_END_TURNS = 4;

/**
 * Detection complementaire : si on emet plus de N END_TURN consecutifs
 * pendant que `gamePhase !== 'playing'` (halftime/post-td), on force
 * le break. Pendant ces phases, la boucle ne peut pas progresser
 * sans completer un setup interactif que le full driver ne gere pas.
 */
const MAX_NON_PLAYING_END_TURNS = 3;

/**
 * Lot 1 « match complet » — l'état attend une mise en place : mi-temps, ou
 * terrain vidé par `handlePostTouchdown` (phase `playing`, `preMatch.phase`
 * à `setup`).
 */
function needsHeadlessDrive(state: GameState): boolean {
  const phase = (state as { preMatch?: { phase?: string } }).preMatch?.phase;
  return (
    phase === 'setup' &&
    (state.gamePhase === 'halftime' || state.gamePhase === 'playing')
  );
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

/**
 * Lot 3 « cerveau du coach » — le choix des coups est délégué au coach
 * (`coach/coach.ts`) : plan de drive collant, activations entières scorées
 * en espérance, choix résolus selon le plan, softmax tempéré par le profil,
 * le momentum et le score. Le driver ne fait plus qu'appliquer et
 * journaliser.
 */
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
  // BUG fix : exclure les `sent_off` (expulsion sur foul) du compteur
  // casualty — c'est un etat joueur distinct, pas une blessure.
  const casualties = state.players.filter(
    (p) => p.state === 'casualty'
  ).length;
  return {
    score,
    turnoverCount: 0, // counted by Lot 3.A.2.b once events emission lands
    touchdownCount: state.score.teamA + state.score.teamB,
    casualtyCount: casualties,
  };
}

function buildCasualties(state: GameState): Casualty[] {
  // BUG fix : avant, les joueurs `sent_off` (expulsion sur foul) etaient
  // inclus dans les casualties avec `outcome: 'badly_hurt'` — ce qui
  // polluait les stats de victimes et faussait les SPP/casualty count
  // post-match. Un fouleur expulse n'est PAS une casualty. PR #823
  // (sim-engine `resolveFoul`) avait fixe le state cote resolver, mais
  // ce builder ici re-mergait `sent_off` comme `badly_hurt`. Maintenant
  // on n'inclut QUE les `state === 'casualty'` (vraies blessures).
  // Casualty.outcome n'a pas de variante 'sent_off' (c'est un état joueur,
  // pas une issue casualty). Lot 3.C.1 affinera la classification
  // (lasting injuries, dead, etc.) en lisant les events.
  // BUG fix audit round 5 (HIGH) : avant, TOUS les casualties etaient
  // tagges `outcome: 'badly_hurt'`. Le game-engine stocke pourtant la
  // severite reelle dans `state.casualtyResults[playerId]` (badly_hurt
  // | seriously_hurt | serious_injury | lasting_injury | dead). Le pro-
  // league wiring (lasting-injury accumulation, retire/dead transitions,
  // apothecary stats) perdait ce signal. Fix : lire `casualtyResults`
  // pour chaque casualty, fallback `'badly_hurt'` si absent.
  return state.players
    .filter((p) => p.state === 'casualty')
    .map<Casualty>((p) => ({
      playerId: p.id,
      team: p.team as TeamId,
      outcome: (state.casualtyResults?.[p.id] as Casualty['outcome'] | undefined) ?? 'badly_hurt',
    }));
}

/**
 * Boucle principale : exécute des coups jusqu'à `gamePhase === 'ended'`,
 * `MAX_ACTIONS_PER_MATCH` ou stagnation détectée.
 *
 * Idempotent : ne mute pas l'input. RNG seedé donc deterministe pour
 * une même entrée.
 */
export interface FullDriverOptions {
  /** Diagnostic (scripts, tests) : trace de chaque activation choisie par le coach. */
  readonly trace?: (t: CoachTrace) => void;
}

export function runFullDriver(input: SimInput, options: FullDriverOptions = {}): SimResult {
  const homeCtx = resolveContext('A', input.home);
  const awayCtx = resolveContext('B', input.away);
  const coach = createCoach({
    seed: input.seed,
    home: { profile: homeCtx.profile },
    away: { profile: awayCtx.profile },
    trace: options.trace,
  });

  // Lot 2 « journal rejouable » — plus de flux unique : le pré-match, puis
  // chaque coup, reçoivent leur propre flux `makeRNG(`${seed}:…`)`, ce qui
  // rend chaque pas rejouable isolément (`replayJournal`).
  const tossRng = journalOpeningRng(input.seed, 'toss');
  const kickoffRng = journalOpeningRng(input.seed, 'kickoff');

  // Lot 3.A.2.c — quand des rosters complets sont fournis dans
  // SimInput, on construit le GameState depuis eux pour que les
  // events portent les vrais playerId / playerName. Sinon on
  // retombe sur `setup()` minimal (legacy MVP).
  const homeRoster = input.home.roster;
  const awayRoster = input.away.roster;

  // BB 2025 — Pré-match coin toss :
  //  - Un coach gagne le toss (50/50 sur RNG seedé → déterministe).
  //  - Le gagnant choisit kick ou receive. Heuristique IA : reçoit
  //    (avantage d'avoir 2 chances de scorer au premier drive). Si
  //    plus tard on modélise des coachs préférant kick (defensive
  //    style), ce sera surchargeable via `input.coinTossStrategy`.
  const tossWinner: TeamId = tossRng() < 0.5 ? 'A' : 'B';
  const receivingTeam: TeamId = tossWinner; // gagnant reçoit (heuristique)
  const kickingTeam: TeamId = receivingTeam === 'A' ? 'B' : 'A';

  const builtStateRaw: GameState =
    homeRoster && homeRoster.length > 0 && awayRoster && awayRoster.length > 0
      ? buildGameStateFromRosters({
          homeRoster,
          awayRoster,
          homeName: input.home.name,
          awayName: input.away.name,
          receivingTeam,
        })
      : setup();
  // Lot 1 « match complet » — `kickingTeam` doit être posé dès l'état
  // initial : `handleEndTurn` s'en sert pour incrémenter le numéro de tour
  // (sans lui, une équipe jouait 7 tours au lieu de 8) et
  // `advanceHalfIfNeeded` pour désigner le botteur de 2e mi-temps.
  const builtState: GameState = { ...builtStateRaw, kickingTeam, halfKickingTeam: kickingTeam };

  // BB 2025 : exécute la vraie séquence kickoff (placement balle +
  // scatter D8/D6 + kickoff event 2D6 + landing pickup/bounce/touchback)
  // pour produire un état de jeu réaliste au démarrage. Sans cette
  // séquence, l'ancien comportement attribuait la balle directement à
  // un joueur receveur (idx=9 hardcodé) — court-circuitant tout le
  // mécanisme officiel.
  const initialState: GameState =
    builtState.players.length > 0
      ? executeHeadlessKickoff(builtState, kickingTeam, kickoffRng)
      : builtState;
  let state: GameState = initialState;

  // Lot 3.D.1 — capture (moves, states) à chaque itération pour permettre
  // au client de rendre le terrain Pixi pas-à-pas (Lots 3.D.3 → 3.D.4).
  // On persiste les states (vs les recalculer client-side) pour
  // contourner l'asynchronicité RNG : `applyMove` consomme du RNG pour
  // résoudre les dés, et le RNG du sim-engine est déjà entamé par
  // `selectMoveForActiveTeam` (IA). Stocker `states[]` directement
  // évite d'avoir à mocker le RNG côté browser.
  const appliedMoves: Move[] = [];
  const journalSteps: ReplayJournalStep[] = [];
  const postStates: GameState[] = [];

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
        receivingTeam: receivingTeam === 'A' ? 'home' : 'away',
        kickingTeam: kickingTeam === 'A' ? 'home' : 'away',
        tossWinner: tossWinner === 'A' ? 'home' : 'away',
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
        // BUG fix H2 audit round 3 : avant, hardcode 4. Si le roster
        // place le ball carrier ailleurs (post-fix C3 ball idx variable),
        // le narrator affichait un placement initial incorrect.
        ballYardline: getInitialBallYardline(state),
      },
    },
  ];

  let actionsApplied = 0;
  let staleEndTurns = 0;
  // BUG fix : compteur dedie aux END_TURN pendant `gamePhase !== 'playing'`.
  // Le full driver n'a pas de chemin pour completer un kickoff setup ;
  // pendant halftime/post-td, la boucle ne peut que spinning sur END_TURN.
  let nonPlayingEndTurns = 0;

  while (state.gamePhase !== 'ended' && actionsApplied < MAX_ACTIONS_PER_MATCH) {
    // Lot 1 « match complet » — après un touchdown (`post-td`), le seul coup
    // qui fait avancer est END_TURN (il déclenche `handlePostTouchdown`).
    const move: Move | null =
      state.gamePhase === 'post-td'
        ? { type: 'END_TURN' }
        : coach.nextMove(state);
    if (!move) break;

    const prev = state;
    let next: GameState;
    let appliedMove: Move = move;
    // Lot 2 — le flux de dés de CE pas. Un coup refusé ou illégal est
    // rejoué par son repli avec un flux NEUF de la même clé : c'est ce que
    // `replayJournal` fera aussi, le journal reste donc exact.
    const stepIndex = appliedMoves.length;
    const stepKey = (): RNG => journalStepRng(input.seed, 'move', stepIndex);
    try {
      next = applyMove(state, move, stepKey());
      // Lot 1 « match complet » — un coup REFUSÉ par le moteur (même
      // référence rendue, sans exception) ne doit pas être rejoué à
      // l'infini : on clôt l'activation du joueur, sinon le tour.
      if (next === state && move.type !== 'END_TURN') {
        const pid = 'playerId' in move ? move.playerId : undefined;
        const endActivation: Move | null =
          pid && state.playerActions?.[pid] ? { type: 'END_PLAYER_TURN', playerId: pid } : null;
        const fallback: Move = endActivation ?? { type: 'END_TURN' };
        const retried = applyMove(state, fallback, stepKey());
        if (retried !== state) {
          next = retried;
          appliedMove = fallback;
        } else {
          next = applyMove(state, { type: 'END_TURN' }, stepKey());
          appliedMove = { type: 'END_TURN' };
        }
      }
    } catch {
      // Le coup retourné par l'IA s'avère illégal. On force END_TURN
      // pour avancer.
      try {
        next = applyMove(state, { type: 'END_TURN' }, stepKey());
        appliedMove = { type: 'END_TURN' };
      } catch {
        break;
      }
    }
    appliedMoves.push(appliedMove);
    postStates.push(next);
    coach.onApplied(prev, appliedMove, next);
    journalSteps.push({ move: appliedMove, dice: extractDiceRecords(prev, next) });

    // Stale-detection : si N END_TURN consécutifs n'ont *vraiment* rien
    // changé (turn + half + currentPlayer identiques entre prev et next),
    // on considère que le moteur est coincé et on force end. Note : en BB
    // un END_TURN sur deux fait alterner currentPlayer sans incrémenter
    // turn (cycle A turn N → B turn N → A turn N+1) — c'est NORMAL ;
    // seuls les END_TURN qui ne font *rien* avancer sont stale. On teste
    // `appliedMove` (le coup réellement passé à `applyMove`) plutôt que
    // `move` : si l'IA retourne un coup illégal et qu'on retombe sur
    // END_TURN via le catch, c'est ce END_TURN qui peut stagner — pas
    // le coup IA initial.
    if (appliedMove.type === 'END_TURN') {
      // BUG fix : on detecte le « vraiment rien ne change » via un
      // critere plus strict que `turn/half/currentPlayer` (qui flippe a
      // chaque END_TURN normal). On regarde la phase et le tour.
      const advancedPhase =
        next.gamePhase !== prev.gamePhase ||
        next.turn !== prev.turn ||
        next.half !== prev.half;
      const flippedTeam = next.currentPlayer !== prev.currentPlayer;
      if (advancedPhase || flippedTeam) {
        staleEndTurns = 0;
      } else {
        staleEndTurns += 1;
        if (staleEndTurns > MAX_STALE_END_TURNS) break;
      }

      // BUG fix C1 : detecter les END_TURN pendant `gamePhase !== 'playing'`.
      // Pour halftime spécifiquement, on tente une reprise headless plus bas
      // après l'émission des events de transition ; cette détection couvre
      // les autres phases (post-td en attente de setup interactif).
      if (next.gamePhase !== 'playing' && next.gamePhase !== 'ended' && next.gamePhase !== 'halftime') {
        nonPlayingEndTurns += 1;
        if (nonPlayingEndTurns > MAX_NON_PLAYING_END_TURNS) break;
      } else {
        nonPlayingEndTurns = 0;
      }
    }

    // Lot 3.A.2.b — diff prev → next pour émettre les events
    // narratifs (BLOCK/PASS/DODGE/TD/CASUALTY/KO/TURNOVER/HALFTIME/
    // END/TURN_START). Timestamps incrémentaux 1s/action.
    //
    // On passe `appliedMove` (le coup effectivement appliqué) au lieu de
    // `move` (le coup retourné par l'IA). Sans cette correction, lorsqu'un
    // coup IA était illégal et qu'on retombait sur END_TURN, on émettait
    // faussement les events Move-specific (BLITZ_DECLARED, BLOCK, PASS,
    // DODGE, FOUL) correspondant au coup initial qui n'a jamais été
    // appliqué — corruption sémantique du timeline narratif.
    const displayAtMs = (actionsApplied + 1) * MS_PER_ACTION;
    const newEvents = diffStatesToEvents(prev, next, {
      displayAtMs,
      move: appliedMove,
    });
    events.push(...newEvents);

    state = next;
    actionsApplied += 1;

    // Lot 1 « match complet » — remise en jeu headless (mi-temps ET après
    // un touchdown) : auto-placement des deux équipes + coup d'envoi. Sans
    // ça, la fin de mi-temps après un TD n'était qu'une suite d'END_TURN sur
    // un terrain vide (plafond de fait à 1 TD par mi-temps).
    if (needsHeadlessDrive(state)) {
      const driveIndex = appliedMoves.length;
      const resumed = executeHeadlessDrive(
        state,
        journalStepRng(input.seed, 'drive', driveIndex),
      );
      if (resumed !== state && resumed.gamePhase === 'playing') {
        appliedMoves.push({ type: 'END_TURN' });
        postStates.push(resumed);
        journalSteps.push({
          move: { type: 'END_TURN' },
          drive: true,
          dice: extractDiceRecords(state, resumed),
        });
        const htDisplayAtMs = (actionsApplied + 1) * MS_PER_ACTION;
        events.push({
          type: 'KICKOFF',
          displayAtMs: htDisplayAtMs,
          engineVer: ENGINE_VER,
          meta: {
            half: resumed.half,
            kickingTeam: resumed.kickingTeam === 'A' ? 'home' : 'away',
            receivingTeam: resumed.currentPlayer === 'A' ? 'home' : 'away',
          },
        });
        events.push({
          type: 'TURN_START',
          displayAtMs: htDisplayAtMs,
          engineVer: ENGINE_VER,
          meta: {
            half: resumed.half,
            turn: resumed.turn,
            drivingTeam: resumed.currentPlayer === 'A' ? 'home' : 'away',
            score: { home: resumed.score.teamA, away: resumed.score.teamB },
            ballYardline: getInitialBallYardline(resumed),
          },
        });
        state = resumed;
        actionsApplied += 1;
      }
    }
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
  // durationMs : `displayAtMs` du dernier event (END synthétique ou natif) —
  // les events sont émis avec un timestamp incrémental 1s/action, donc la
  // borne supérieure reflète bien la durée logique du match. `events` est
  // garanti non-vide ici (KICKOFF + TURN_START initial sont push avant la
  // boucle), donc on peut lire `events.at(-1)` sans guard.
  const lastEvent = events[events.length - 1];
  const durationMs = lastEvent ? lastEvent.displayAtMs : 0;
  const summary: MatchSummary = {
    score: stats.score,
    outcome,
    durationMs,
    touchdownCount: stats.touchdownCount,
    turnoverCount,
    nuffleCount: 0,
    underdogBoostCount: 0,
    momentum: coach.momentumSnapshot(),
  };

  return {
    result: outcome,
    engineVer: ENGINE_VER,
    events,
    casualties,
    summary,
    fullReplay: {
      initialState,
      moves: appliedMoves,
      states: postStates,
    },
    journal: {
      v: REPLAY_JOURNAL_VERSION,
      seed: input.seed,
      initialState,
      steps: journalSteps,
    },
  };
}
