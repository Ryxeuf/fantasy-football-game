/**
 * Gestion de l'état du jeu pour Blood Bowl
 * Gère les tours, les mi-temps, les actions des joueurs et les compteurs
 */

import { GameState, PreMatchState, TeamId, ActionType, Player, Position, RNG } from './types';
import { createLogEntry } from '../utils/logging';
import { checkTouchdowns, resolveKickoffBallLanding } from '../mechanics/ball';
import { initializeDugouts } from '../mechanics/dugout';
import { rollKickoffEvent, applyKickoffEvent } from '../mechanics/kickoff-events';
import { applyKickSkillToDeviation } from '../mechanics/kick-skill';
import { calculateMatchWinnings } from '../utils/team-value-calculator';
import { FULL_RULES, getRulesConfig, type RulesConfig, type RulesMode } from './rules-config';
import { expelSecretWeapons } from '../mechanics/secret-weapons';
import { getWeatherModifiers, applyWeatherDriveEffects } from '../mechanics/weather-effects';
import { getWeatherCondition, type WeatherType } from './weather-types';
import { hasSkill } from '../skills/skill-effects';

export type { PreMatchState };

export interface ExtendedGameState extends GameState {
  preMatch: PreMatchState;
}

/**
 * Interface pour les données de joueur depuis la base de données
 */
export interface TeamPlayerData {
  id: string;
  name: string;
  position: string;
  number: number;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: string;
}

/**
 * Configuration initiale du jeu en phase pré-match avec les vraies équipes
 * Les joueurs commencent tous en réserves, pas sur le terrain
 * @param teamAData - Données des joueurs de l'équipe A
 * @param teamBData - Données des joueurs de l'équipe B
 * @param teamAName - Nom de l'équipe A
 * @param teamBName - Nom de l'équipe B
 * @returns État initial du jeu en phase pré-match
 */
export function setupPreMatchWithTeams(
  teamAData: TeamPlayerData[],
  teamBData: TeamPlayerData[],
  teamAName: string,
  teamBName: string,
  options?: {
    teamAApothecary?: boolean;
    teamBApothecary?: boolean;
    /** H.6 — canonical roster slug for team A (e.g. 'skaven'). */
    teamARoster?: string;
    /** H.6 — canonical roster slug for team B (e.g. 'lizardmen'). */
    teamBRoster?: string;
    /**
     * N.2 — Mode de regles (`full` par defaut, ou `simplified` pour debutants).
     * Applique les valeurs de la config choisie aux champs impactes :
     * `turnTimerSeconds`, `teamRerolls`, et attache `rulesConfig` a l'etat.
     */
    rulesMode?: RulesMode;
  }
): ExtendedGameState {
  const rulesConfig: RulesConfig = getRulesConfig(options?.rulesMode ?? 'full');
  const dugouts = initializeDugouts();

  // Créer les joueurs de l'équipe A
  const teamAPlayers: Player[] = teamAData.map((tp, index) => ({
    id: `A${tp.number}`,
    team: 'A' as TeamId,
    pos: { x: -1, y: -1 }, // Position hors terrain
    name: tp.name,
    number: tp.number,
    position: tp.position,
    ma: tp.ma,
    st: tp.st,
    ag: tp.ag,
    pa: tp.pa,
    av: tp.av,
    skills: tp.skills
      ? tp.skills
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : [],
    pm: tp.ma, // PM = MA au début
    hasBall: false,
    state: 'active',
  }));

  // Créer les joueurs de l'équipe B
  const teamBPlayers: Player[] = teamBData.map((tp, index) => ({
    id: `B${tp.number}`,
    team: 'B' as TeamId,
    pos: { x: -1, y: -1 }, // Position hors terrain
    name: tp.name,
    number: tp.number,
    position: tp.position,
    ma: tp.ma,
    st: tp.st,
    ag: tp.ag,
    pa: tp.pa,
    av: tp.av,
    skills: tp.skills
      ? tp.skills
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : [],
    pm: tp.ma, // PM = MA au début
    hasBall: false,
    state: 'active',
  }));

  const allPlayers = [...teamAPlayers, ...teamBPlayers];

  // Mettre tous les joueurs en réserves
  allPlayers.forEach(player => {
    const teamId = player.team;
    const dugout = dugouts[teamId === 'A' ? 'teamA' : 'teamB'];
    dugout.zones.reserves.players.push(player.id);
  });

  const existingState = {
    width: 26,
    height: 15,
    players: allPlayers,
    ball: undefined, // Pas de ballon en phase pré-match
    currentPlayer: 'A',
    turn: 0, // Pas de tour en phase pré-match
    selectedPlayerId: null,
    isTurnover: false,
    dugouts,
    playerActions: {} as Record<string, ActionType>,
    teamBlitzCount: {} as Record<string, number>,
    teamFoulCount: {} as Record<string, number>,
    teamRerolls: {
      teamA: rulesConfig.rerollsPerTeam,
      teamB: rulesConfig.rerollsPerTeam,
    },
    rerollUsedThisTurn: false,
    apothecaryAvailable: {
      teamA: options?.teamAApothecary ?? false,
      teamB: options?.teamBApothecary ?? false,
    },
    // Informations de match
    gamePhase: 'playing' as const,
    half: 0, // Pas de mi-temps en phase pré-match
    score: {
      teamA: 0,
      teamB: 0,
    },
    teamNames: {
      teamA: teamAName,
      teamB: teamBName,
    },
    teamRosters:
      options?.teamARoster || options?.teamBRoster
        ? { teamA: options?.teamARoster, teamB: options?.teamBRoster }
        : undefined,
    matchStats: {},
    casualtyResults: {},
    lastingInjuryDetails: {},
    usedStarPlayerRules: {},
    bribesRemaining: { teamA: 0, teamB: 0 },
    turnTimerSeconds: rulesConfig.turnTimerSeconds,
    rulesConfig,
    // Log du match
    gameLog: [
      createLogEntry(
        'info',
        `Phase pré-match - ${teamAName} vs ${teamBName} - Les joueurs sont en réserves`
      ),
      ...(rulesConfig.mode === 'simplified'
        ? [
            createLogEntry(
              'info',
              `Mode simplifié (débutants) activé : ${rulesConfig.turnsPerHalf} tours par mi-temps, ${rulesConfig.rerollsPerTeam} relances, timer ${rulesConfig.turnTimerSeconds}s. Compétences, météo et événements de kickoff désactivés.`
            ),
          ]
        : []),
    ],
  };

  return {
    ...existingState,
    preMatch: {
      phase: 'idle',
      currentCoach: 'A' as TeamId, // À set par backend après coin toss
      legalSetupPositions: [],
      placedPlayers: [],
      kickingTeam: 'B' as TeamId, // Placeholder, set par backend
      receivingTeam: 'A' as TeamId,
    },
  } as ExtendedGameState;
}

/**
 * Configuration initiale du jeu en phase pré-match (version de test)
 * Les joueurs commencent tous en réserves, pas sur le terrain
 * @param seed - Graine pour la reproductibilité (optionnel)
 * @returns État initial du jeu en phase pré-match
 */
export function setupPreMatch(): GameState {
  const dugouts = initializeDugouts();

  // Créer les joueurs mais les mettre en réserves (pas sur le terrain)
  const players: Player[] = [
    {
      id: 'A1',
      team: 'A' as TeamId,
      pos: { x: -1, y: -1 }, // Position hors terrain
      name: 'Grim Ironjaw',
      number: 1,
      position: 'Blitzer',
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: ['Block', 'Tackle'],
      pm: 7,
      hasBall: false,
      state: 'active',
    },
    {
      id: 'A2',
      team: 'A' as TeamId,
      pos: { x: -1, y: -1 }, // Position hors terrain
      name: 'Thunder Stonefist',
      number: 2,
      position: 'Lineman',
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: [],
      pm: 6,
      hasBall: false,
      state: 'active',
    },
    {
      id: 'B1',
      team: 'B' as TeamId,
      pos: { x: -1, y: -1 }, // Position hors terrain
      name: 'Shadow Swift',
      number: 1,
      position: 'Runner',
      ma: 8,
      st: 2,
      ag: 4,
      pa: 3,
      av: 7,
      skills: ['Dodge', 'Sure Hands'],
      pm: 8,
      hasBall: false,
      state: 'active',
    },
    {
      id: 'B2',
      team: 'B' as TeamId,
      pos: { x: -1, y: -1 }, // Position hors terrain
      name: 'Iron Hide',
      number: 2,
      position: 'Lineman',
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: [],
      pm: 6,
      hasBall: false,
      state: 'active',
    },
  ];

  // Mettre tous les joueurs en réserves
  players.forEach(player => {
    const teamId = player.team;
    const dugout = dugouts[teamId === 'A' ? 'teamA' : 'teamB'];
    dugout.zones.reserves.players.push(player.id);
  });

  return {
    width: 26,
    height: 15,
    players,
    ball: undefined, // Pas de ballon en phase pré-match
    currentPlayer: 'A',
    turn: 0, // Pas de tour en phase pré-match
    selectedPlayerId: null,
    isTurnover: false,
    dugouts,
    playerActions: {} as Record<string, ActionType>,
    teamBlitzCount: {} as Record<string, number>,
    teamFoulCount: {} as Record<string, number>,
    teamRerolls: { teamA: 3, teamB: 3 },
    rerollUsedThisTurn: false,
    apothecaryAvailable: { teamA: false, teamB: false },
    // Informations de match
    gamePhase: 'playing' as const,
    half: 0, // Pas de mi-temps en phase pré-match
    score: {
      teamA: 0,
      teamB: 0,
    },
    teamNames: {
      teamA: 'Orcs de Fer',
      teamB: 'Elfes Sombres',
    },
    matchStats: {},
    casualtyResults: {},
    lastingInjuryDetails: {},
    usedStarPlayerRules: {},
    bribesRemaining: { teamA: 0, teamB: 0 },
    turnTimerSeconds: FULL_RULES.turnTimerSeconds,
    // Log du match
    gameLog: [createLogEntry('info', 'Phase pré-match - Les joueurs sont en réserves')],
  };
}

/**
 * Configuration initiale du jeu (ancienne fonction pour compatibilité)
 * @param seed - Graine pour la reproductibilité (optionnel)
 * @returns État initial du jeu
 */
export function setup(): GameState {
  const dugouts = initializeDugouts();

  return {
    width: 26,
    height: 15,
    players: [
      {
        id: 'A1',
        team: 'A',
        pos: { x: 11, y: 7 },
        name: 'Grim Ironjaw',
        number: 1,
        position: 'Blitzer',
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: ['Block', 'Tackle'],
        pm: 7,
        hasBall: false,
        state: 'active',
      },
      {
        id: 'A2',
        team: 'A',
        pos: { x: 10, y: 7 },
        name: 'Thunder Stonefist',
        number: 2,
        position: 'Lineman',
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: [],
        pm: 6,
        hasBall: false,
        state: 'active',
      },
      {
        id: 'B1',
        team: 'B',
        pos: { x: 15, y: 7 },
        name: 'Shadow Swift',
        number: 1,
        position: 'Runner',
        ma: 8,
        st: 2,
        ag: 4,
        pa: 3,
        av: 7,
        skills: ['Dodge', 'Sure Hands'],
        pm: 8,
        hasBall: false,
        state: 'active',
      },
      {
        id: 'B2',
        team: 'B',
        pos: { x: 16, y: 7 },
        name: 'Iron Hide',
        number: 2,
        position: 'Lineman',
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: [],
        pm: 6,
        hasBall: false,
        state: 'active',
      },
    ],
    ball: { x: 13, y: 7 },
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    dugouts,
    playerActions: {} as Record<string, ActionType>,
    teamBlitzCount: {} as Record<string, number>,
    teamFoulCount: {} as Record<string, number>,
    // Relances d'équipe (3 par défaut pour les matchs de démonstration)
    teamRerolls: { teamA: 3, teamB: 3 },
    rerollUsedThisTurn: false,
    apothecaryAvailable: { teamA: false, teamB: false },
    // Informations de match
    gamePhase: 'playing' as const,
    half: 1,
    score: {
      teamA: 0,
      teamB: 0,
    },
    teamNames: {
      teamA: 'Orcs de Fer',
      teamB: 'Elfes Sombres',
    },
    matchStats: {},
    casualtyResults: {},
    lastingInjuryDetails: {},
    usedStarPlayerRules: {},
    bribesRemaining: { teamA: 0, teamB: 0 },
    turnTimerSeconds: FULL_RULES.turnTimerSeconds,
    // Log du match
    gameLog: [createLogEntry('info', 'Match commencé - Orcs de Fer vs Elfes Sombres')],
  };
}

/**
 * Transforme l'état pré-match en état de match démarré
 * Place les 4 premiers joueurs de chaque dugout sur le terrain aux positions initiales
 * @param state - État pré-match
 * @returns État de match démarré
 */
export function startMatchFromPreMatch(state: GameState): GameState {
  if (state.half !== 0) return state; // Déjà démarré

  // Positions initiales pour équipe A (locale)
  const positionsA = [
    { x: 11, y: 7 },
    { x: 10, y: 7 },
    { x: 6, y: 3 },
    { x: 6, y: 4 },
  ];

  // Positions initiales pour équipe B (visiteuse)
  const positionsB = [
    { x: 15, y: 7 },
    { x: 16, y: 7 },
    { x: 20, y: 3 },
    { x: 20, y: 4 },
  ];

  // Récupérer les IDs des joueurs en réserves
  const teamAReserves = [...state.dugouts.teamA.zones.reserves.players];
  const teamBReserves = [...state.dugouts.teamB.zones.reserves.players];

  // Les 4 premiers joueurs pour chaque équipe
  const teamAFirstIds = teamAReserves.slice(0, 4);
  const teamBFirstIds = teamBReserves.slice(0, 4);

  // Mettre à jour les positions des joueurs sur le terrain
  const newPlayers = state.players.map(player => {
    const newPos = { x: -1, y: -1 }; // Par défaut hors terrain
    if (teamAFirstIds.includes(player.id)) {
      const index = teamAFirstIds.indexOf(player.id);
      newPos.x = positionsA[index].x;
      newPos.y = positionsA[index].y;
    } else if (teamBFirstIds.includes(player.id)) {
      const index = teamBFirstIds.indexOf(player.id);
      newPos.x = positionsB[index].x;
      newPos.y = positionsB[index].y;
    }
    return { ...player, pos: newPos };
  });

  // Mettre à jour les dugouts : enlever les 4 premiers de réserves
  const newDugouts = {
    ...state.dugouts,
    teamA: {
      ...state.dugouts.teamA,
      zones: {
        ...state.dugouts.teamA.zones,
        reserves: {
          ...state.dugouts.teamA.zones.reserves,
          players: teamAReserves.slice(4),
        },
      },
    },
    teamB: {
      ...state.dugouts.teamB,
      zones: {
        ...state.dugouts.teamB.zones,
        reserves: {
          ...state.dugouts.teamB.zones.reserves,
          players: teamBReserves.slice(4),
        },
      },
    },
  };

  // Log de démarrage
  const startLog = createLogEntry(
    'info',
    'Match commencé - Placement initial des joueurs sur le terrain'
  );

  return {
    ...state,
    players: newPlayers,
    dugouts: newDugouts,
    half: 1,
    turn: 1,
    currentPlayer: 'A',
    ball: { x: 13, y: 7 }, // Ballon au centre
    selectedPlayerId: null,
    isTurnover: false,
    playerActions: {} as Record<string, ActionType>,
    teamBlitzCount: {} as Record<string, number>,
    teamFoulCount: {} as Record<string, number>,
    lastDiceResult: undefined,
    gameLog: [...state.gameLog, startLog],
  };
}

/**
 * N.2 — Helpers Rules Config.
 * `getRulesConfigForState` retourne la config attachee a l'etat (ou FULL_RULES par defaut).
 * `getTurnsPerHalf` centralise la lecture de `turnsPerHalf` (8 en full, 6 en simplified).
 * `isSimplifiedMode` permet aux consommateurs (UI, moteur) de brancher des comportements optionnels.
 */
export function getRulesConfigForState(state: Pick<GameState, 'rulesConfig'>): RulesConfig {
  return state.rulesConfig ?? FULL_RULES;
}

export function getTurnsPerHalf(state: Pick<GameState, 'rulesConfig'>): number {
  return getRulesConfigForState(state).turnsPerHalf;
}

export function isSimplifiedMode(state: Pick<GameState, 'rulesConfig'>): boolean {
  return getRulesConfigForState(state).mode === 'simplified';
}

/**
 * N.2 — Detection centralisee de fin de match, remplace `newState.half === 2 && newState.turn > 8 && newState.isTurnover`
 * dans move-processor. Honore `rulesConfig.turnsPerHalf` (6 en mode simplifie).
 */
export function isMatchEnded(state: Pick<GameState, 'rulesConfig' | 'half' | 'turn' | 'isTurnover'>): boolean {
  const turnsPerHalf = getTurnsPerHalf(state);
  return state.half === 2 && state.turn > turnsPerHalf && state.isTurnover === true;
}

/**
 * Gère la fin de tour et de mi-temps.
 * Nombre de tours par mi-temps respecte `rulesConfig.turnsPerHalf` (8 en full, 6 en simplified).
 * @param state - État du jeu
 * @returns Nouvel état du jeu après vérification de la mi-temps
 */
export function advanceHalfIfNeeded(state: GameState, rng: RNG): GameState {
  const turnsPerHalf = getTurnsPerHalf(state);
  // Si on a dépassé le Xe round (selon rulesConfig.turnsPerHalf), on passe à la mi‑temps suivante ou on termine le match
  if (state.turn > turnsPerHalf) {
    if (state.half === 1) {
      const halftimeLog = createLogEntry(
        'info',
        `Mi-temps atteinte (${turnsPerHalf} tours par équipe). Début de la 2e mi-temps`,
        undefined,
        undefined
      );

      // Expulser les joueurs Arme Secrète (fin de drive = mi-temps)
      let newState = expelSecretWeapons(
        { ...state, gameLog: [...state.gameLog, halftimeLog] },
        rng
      );

      // Récupération des joueurs KO (4+ sur D6)
      newState = recoverKOPlayers(newState, rng);

      // L'équipe qui a frappé en 1ère mi-temps reçoit en 2e, et vice versa
      const newKickingTeam: TeamId = state.kickingTeam === 'A' ? 'B' : 'A';
      const receivingTeam: TeamId = newKickingTeam === 'A' ? 'B' : 'A';

      // Reset positions pour la 2e mi-temps (tous les joueurs actifs vont en réserves)
      newState = resetPlayerPositions(newState);

      const halftimeResetLog = createLogEntry(
        'info',
        `2e mi-temps : ${state.teamNames[newKickingTeam === 'A' ? 'teamA' : 'teamB']} frappe au pied. ${state.teamNames[receivingTeam === 'A' ? 'teamA' : 'teamB']} reçoit.`,
        undefined,
        undefined
      );

      // Entrer en phase halftime + setup. Le re-kickoff sera déclenché après le
      // placement des joueurs par les deux coachs (validatePlayerPlacement →
      // startKickoffSequence → placeKickoffBall → calculateKickDeviation →
      // resolveKickoffEvent → startMatchFromKickoff) — même contrat que
      // handlePostTouchdown et que la séquence pré-match initiale.
      const extState = newState as ExtendedGameState;
      const resultState: GameState = {
        ...newState,
        gamePhase: 'halftime' as const,
        half: 2,
        turn: 1,
        currentPlayer: receivingTeam,
        kickingTeam: newKickingTeam,
        isTurnover: false,
        ball: undefined,
        selectedPlayerId: null,
        playerActions: {} as Record<string, ActionType>,
        teamBlitzCount: {} as Record<string, number>,
        teamFoulCount: {} as Record<string, number>,
        rerollUsedThisTurn: false,
        lastDiceResult: undefined,
        gameLog: [...newState.gameLog, halftimeResetLog],
        preMatch: {
          ...(extState.preMatch ?? {
            currentCoach: receivingTeam,
            legalSetupPositions: [],
            placedPlayers: [],
            kickingTeam: newKickingTeam,
            receivingTeam,
          }),
          phase: 'setup' as const,
          currentCoach: receivingTeam,
          kickingTeam: newKickingTeam,
          receivingTeam,
          placedPlayers: [],
          legalSetupPositions: [],
          // Nettoyer tout résidu de kickoff précédent
          kickoffStep: undefined,
          ballPosition: null,
          kickDeviation: null,
          kickoffEvent: null,
          finalBallPosition: undefined,
        },
      };

      return resultState;
    } else {
      const endLog = createLogEntry(
        'info',
        `Fin du match (2e mi-temps terminée). Score final: ${state.teamNames.teamA} ${state.score.teamA} - ${state.score.teamB} ${state.teamNames.teamB}`,
        undefined,
        undefined
      );

      // Expulser les joueurs Arme Secrète (fin de drive = fin de match)
      const stateAfterExpulsion = expelSecretWeapons(
        { ...state, gameLog: [...state.gameLog, endLog] },
        rng
      );

      // Calculer les résultats finaux (SPP + MVP)
      const matchResult = calculateMatchResult(stateAfterExpulsion, rng);

      return {
        ...stateAfterExpulsion,
        gamePhase: 'ended' as const,
        isTurnover: true,
        matchResult,
      };
    }
  }
  return state;
}

/**
 * Calcule les résultats finaux du match : vainqueur, SPP, MVP, gains et dedicated fans
 */
function calculateMatchResult(state: GameState, rng: RNG): {
  winner?: TeamId;
  spp: Record<string, number>;
  winnings?: { teamA: number; teamB: number };
  dedicatedFansChange?: { teamA: number; teamB: number };
} {
  // Déterminer le vainqueur
  let winner: TeamId | undefined;
  if (state.score.teamA > state.score.teamB) winner = 'A';
  else if (state.score.teamB > state.score.teamA) winner = 'B';

  // Calculer les SPP pour chaque joueur
  const spp: Record<string, number> = {};
  const stats = state.matchStats;

  for (const [playerId, playerStats] of Object.entries(stats)) {
    spp[playerId] =
      playerStats.touchdowns * 3 +
      playerStats.casualties * 2 +
      playerStats.completions * 1 +
      playerStats.interceptions * 1;
  }

  // Attribuer le MVP (1 joueur aléatoire par équipe, 4 SPP chacun)
  const activePlayers = state.players.filter(p => p.state !== 'casualty' && p.state !== 'sent_off');
  for (const teamId of ['A', 'B'] as TeamId[]) {
    const teamPlayers = activePlayers.filter(p => p.team === teamId);
    if (teamPlayers.length > 0) {
      // Sélection aléatoire déterministe via le RNG seedé
      const mvpPlayer = teamPlayers[Math.floor(rng() * teamPlayers.length)];
      if (!spp[mvpPlayer.id]) spp[mvpPlayer.id] = 0;
      spp[mvpPlayer.id] += 4;
      if (!stats[mvpPlayer.id]) {
        stats[mvpPlayer.id] = { touchdowns: 0, casualties: 0, completions: 0, interceptions: 0, mvp: false };
      }
      stats[mvpPlayer.id].mvp = true;
    }
  }

  // Calculer les gains (winnings) selon les règles Blood Bowl
  // Gains = (Fan Attendance / 2 + Touchdowns marqués) × 10,000 po
  const fanAttendance = state.fanAttendance ?? 0;
  const winnings = {
    teamA: calculateMatchWinnings(fanAttendance, state.score.teamA),
    teamB: calculateMatchWinnings(fanAttendance, state.score.teamB),
  };

  // Mise à jour des dedicated fans selon les règles BB
  // Gagnant : D6 >= dedicatedFans → +1
  // Perdant : D6 < dedicatedFans → -1 (minimum 1)
  // Match nul : pas de changement
  const dedicatedFansChange = { teamA: 0, teamB: 0 };
  if (winner && state.dedicatedFans) {
    const winnerKey = winner === 'A' ? 'teamA' : 'teamB';
    const loserKey = winner === 'A' ? 'teamB' : 'teamA';

    // Gagnant : D6, si >= dedicatedFans → +1
    const winnerRoll = Math.floor(rng() * 6) + 1;
    if (winnerRoll >= state.dedicatedFans[winnerKey]) {
      dedicatedFansChange[winnerKey] = 1;
    }

    // Perdant : D6, si < dedicatedFans → -1 (mais pas en dessous de 1)
    const loserRoll = Math.floor(rng() * 6) + 1;
    if (loserRoll < state.dedicatedFans[loserKey] && state.dedicatedFans[loserKey] > 1) {
      dedicatedFansChange[loserKey] = -1;
    }
  }

  return { winner, spp, winnings, dedicatedFansChange };
}

/**
 * Récupération des joueurs KO (4+ sur D6)
 */
function recoverKOPlayers(state: GameState, rng: RNG): GameState {
  const newState = { ...state };

  for (const teamId of ['A', 'B'] as TeamId[]) {
    const dugoutKey = teamId === 'A' ? 'teamA' : 'teamB';
    const dugout = newState.dugouts[dugoutKey];
    const koZone = dugout.zones.knockedOut;

    if (koZone.players.length > 0) {
      const recoveredIds: string[] = [];
      const stillKOIds: string[] = [];

      for (const playerId of koZone.players) {
        // Simple 4+ check using seeded RNG
        const roll = Math.floor(rng() * 6) + 1;
        if (roll >= 4) {
          recoveredIds.push(playerId);
        } else {
          stillKOIds.push(playerId);
        }
      }

      if (recoveredIds.length > 0) {
        // Move recovered players back to reserves
        const reservesZone = dugout.zones.reserves;
        newState.dugouts = {
          ...newState.dugouts,
          [dugoutKey]: {
            ...dugout,
            zones: {
              ...dugout.zones,
              knockedOut: { ...koZone, players: stillKOIds },
              reserves: { ...reservesZone, players: [...reservesZone.players, ...recoveredIds] },
            },
          },
        };

        const recoveryLog = createLogEntry(
          'info',
          `${recoveredIds.length} joueur(s) de l'équipe ${teamId} récupèrent du KO`,
          undefined,
          teamId
        );
        newState.gameLog = [...newState.gameLog, recoveryLog];
      }
    }
  }

  return newState;
}

/**
 * Remet les joueurs actifs sur le terrain à des positions par défaut
 */
function resetPlayerPositions(state: GameState): GameState {
  const newPlayers = state.players.map(p => {
    // Joueurs KO, blessés, morts ne sont pas repositionnés
    if (p.state && p.state !== 'active') return p;

    // Remettre tous les joueurs actifs en réserve (hors terrain) pour le re-setup
    return {
      ...p,
      stunned: false,
      pm: p.ma,
      gfiUsed: 0,
      breakTackleUsed: false,
      hasBall: false,
      pos: { x: -1, y: -1 }, // Hors terrain = en réserve
    };
  });

  return { ...state, players: newPlayers };
}

/**
 * Gère le reset après un touchdown : repositionne les joueurs et prépare le kickoff
 */
export function handlePostTouchdown(state: GameState, rng: RNG): GameState {
  // L'équipe qui a marqué frappe (kick)
  const lastScoreLog = state.gameLog.findLast(log => log.type === 'score');
  const scoringTeam = lastScoreLog?.team;

  // L'équipe qui marque frappe au kickoff suivant
  const newKickingTeam: TeamId = scoringTeam === 'A' ? 'A' : 'B';
  const receivingTeam: TeamId = newKickingTeam === 'A' ? 'B' : 'A';

  // Expulser les joueurs Arme Secrète avant le reset (fin de drive)
  let newState = expelSecretWeapons(state, rng);

  // Reset players
  newState = resetPlayerPositions(newState);

  // Récupération des joueurs KO (4+ sur D6) avant le nouveau drive
  newState = recoverKOPlayers(newState, rng);

  const resetLog = createLogEntry(
    'info',
    `Touchdown marqué ! ${state.teamNames[newKickingTeam === 'A' ? 'teamA' : 'teamB']} frappe au pied. ${state.teamNames[receivingTeam === 'A' ? 'teamA' : 'teamB']} reçoit.`,
    undefined,
    undefined
  );

  // Entrer en phase de setup pour le nouveau drive (les joueurs doivent être replacés)
  const extState = newState as ExtendedGameState;
  const resultState = {
    ...newState,
    gamePhase: 'playing' as const,
    kickingTeam: newKickingTeam,
    currentPlayer: receivingTeam,
    isTurnover: false,
    ball: undefined, // Pas de ballon tant que le kickoff n'est pas lancé
    selectedPlayerId: null,
    playerActions: {} as Record<string, ActionType>,
    teamBlitzCount: {} as Record<string, number>,
    teamFoulCount: {} as Record<string, number>,
    rerollUsedThisTurn: false,
    lastDiceResult: undefined,
    gameLog: [...newState.gameLog, resetLog],
    preMatch: {
      ...extState.preMatch,
      phase: 'setup' as const,
      currentCoach: receivingTeam,
      kickingTeam: newKickingTeam,
      receivingTeam: receivingTeam,
      placedPlayers: [],
      // Calculer la moitié receveuse pour le drive suivant. Sans cela,
      // `placePlayerInSetup` rejette toute position et le post-touchdown
      // bloque définitivement le match (ni IA ni humain ne peuvent placer).
      legalSetupPositions: computeLegalSetupPositions(receivingTeam, newState.height),
    },
  };

  return resultState;
}

/**
 * Vérifie si un joueur a déjà agi ce tour
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns True si le joueur a agi
 */
export function hasPlayerActed(state: GameState | ExtendedGameState, playerId: string): boolean {
  if (!state.playerActions) return false;
  return playerId in state.playerActions;
}

/**
 * Vérifie si un joueur peut agir
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns True si le joueur peut agir
 */
export function canPlayerAct(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  // Un joueur ne peut pas agir s'il est étourdi ou n'a plus de PM
  return !player.stunned && player.pm > 0;
}

/**
 * Vérifie si un joueur peut bouger
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns True si le joueur peut bouger
 */
export function canPlayerMove(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  // Un joueur peut bouger s'il n'est pas étourdi, a des PM (ou du GFI disponible),
  // n'a pas encore fait d'action principale, et c'est le tour de son équipe
  const hasMovement = player.pm > 0 || (player.gfiUsed ?? 0) < 2;
  return (
    !player.stunned &&
    hasMovement &&
    !hasPlayerActed(state, playerId) &&
    player.team === state.currentPlayer
  );
}

/**
 * Vérifie si un joueur peut continuer à bouger
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns True si le joueur peut continuer à bouger
 */
export function canPlayerContinueMoving(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  // Un joueur peut continuer à bouger s'il n'est pas étourdi, a des PM (ou du GFI disponible),
  // c'est le tour de son équipe, et soit il n'a pas encore agi, soit il a déjà commencé à bouger ou fait un blitz.
  // Cas particulier : Running Pass autorise le passeur a continuer sa MA apres une Quick Pass
  // (ou un Hand-Off pour la variante S3) sans changer son action principale.
  const playerAction = getPlayerAction(state, playerId);
  const hasMovement = player.pm > 0 || (player.gfiUsed ?? 0) < 2;
  const runningPassActive =
    (state.usedRunningPassThisTurn ?? []).includes(playerId) &&
    (playerAction === 'PASS' || playerAction === 'HANDOFF');
  // Sneaky Git : l'activation ne se termine pas apres une faute.
  const sneakyGitFoulContinues =
    playerAction === 'FOUL' &&
    (hasSkill(player, 'sneaky-git') || hasSkill(player, 'sneaky_git'));
  return (
    !player.stunned &&
    hasMovement &&
    player.team === state.currentPlayer &&
    (!hasPlayerActed(state, playerId) ||
      playerAction === 'MOVE' ||
      playerAction === 'BLITZ' ||
      runningPassActive ||
      sneakyGitFoulContinues)
  );
}

/**
 * Obtient l'action d'un joueur
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns Action du joueur ou undefined
 */
export function getPlayerAction(
  state: GameState | ExtendedGameState,
  playerId: string
): ActionType | undefined {
  if (!state.playerActions) return undefined;
  return state.playerActions[playerId];
}

/**
 * Définit l'action d'un joueur
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @param action - Action à définir
 * @returns Nouvel état du jeu
 */
export function setPlayerAction(state: GameState, playerId: string, action: ActionType): GameState {
  return {
    ...state,
    playerActions: { ...state.playerActions, [playerId]: action },
  };
}

/**
 * Efface toutes les actions des joueurs
 * @param state - État du jeu
 * @returns Nouvel état du jeu
 */
export function clearPlayerActions(state: GameState): GameState {
  return {
    ...state,
    playerActions: {} as Record<string, ActionType>,
  };
}

/**
 * Obtient le nombre de blitz effectués par une équipe
 * @param state - État du jeu
 * @param team - Équipe
 * @returns Nombre de blitz effectués
 */
export function getTeamBlitzCount(state: GameState | ExtendedGameState, team: TeamId): number {
  if (!state.teamBlitzCount) return 0;
  return state.teamBlitzCount[team] || 0;
}

/**
 * Vérifie si une équipe peut effectuer un blitz
 * @param state - État du jeu
 * @param team - Équipe
 * @returns True si l'équipe peut blitzer
 */
export function canTeamBlitz(state: GameState, team: TeamId): boolean {
  return getTeamBlitzCount(state, team) < 1;
}

/**
 * Incrémente le compteur de blitz d'une équipe
 * @param state - État du jeu
 * @param team - Équipe
 * @returns Nouvel état du jeu
 */
export function incrementTeamBlitzCount(state: GameState, team: TeamId): GameState {
  const currentCount = (state.teamBlitzCount && state.teamBlitzCount[team]) || 0;
  return {
    ...state,
    teamBlitzCount: { ...state.teamBlitzCount, [team]: currentCount + 1 },
  };
}

/**
 * Efface tous les compteurs de blitz
 * @param state - État du jeu
 * @returns Nouvel état du jeu
 */
export function clearTeamBlitzCounts(state: GameState): GameState {
  return {
    ...state,
    teamBlitzCount: {} as Record<string, number>,
    teamFoulCount: {} as Record<string, number>,
  };
}

/**
 * Vérifie si le tour d'un joueur doit se terminer
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns True si le tour doit se terminer
 */
export function shouldEndPlayerTurn(state: GameState, playerId: string): boolean {
  // Un joueur finit son tour s'il a effectué une action
  return hasPlayerActed(state, playerId);
}

/**
 * Termine le tour d'un joueur
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns Nouvel état du jeu
 */
export function endPlayerTurn(state: GameState, playerId: string): GameState {
  // Marquer le joueur comme ayant fini son tour
  const newState = setPlayerAction(state, playerId, 'MOVE');

  // Log de fin de tour du joueur
  const player = state.players.find(p => p.id === playerId);
  if (player) {
    const logEntry = createLogEntry(
      'action',
      `Fin du tour de ${player.name}`,
      player.id,
      player.team
    );
    newState.gameLog = [...newState.gameLog, logEntry];
  }

  return checkTouchdowns(newState);
}

/**
 * Vérifie si le tour d'un joueur doit se terminer automatiquement
 * @param state - État du jeu
 * @param playerId - ID du joueur
 * @returns Nouvel état du jeu
 */
export function checkPlayerTurnEnd(state: GameState, playerId: string): GameState {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  // Si le joueur n'a plus de PM et a commencé à bouger, finir son tour
  // Inclut Running Pass : action PASS/HANDOFF + flag usedRunningPassThisTurn => poursuite autorisee
  const action = getPlayerAction(state, playerId);
  const runningPassActive =
    (state.usedRunningPassThisTurn ?? []).includes(playerId) &&
    (action === 'PASS' || action === 'HANDOFF');
  if (
    player.pm <= 0 &&
    hasPlayerActed(state, playerId) &&
    (action === 'MOVE' || action === 'BLITZ' || runningPassActive)
  ) {
    return endPlayerTurn(state, playerId);
  }

  return state;
}

/**
 * Vérifie si le tour doit se terminer automatiquement
 * @param state - État du jeu
 * @returns True si le tour doit se terminer
 */
export function shouldAutoEndTurn(state: GameState): boolean {
  const team = state.currentPlayer;
  
  // Vérifier que state.players existe
  if (!state.players || !Array.isArray(state.players)) {
    return false;
  }
  
  const teamPlayers = state.players.filter(p => p.team === team);

  // Vérifier si tous les joueurs de l'équipe ont agi ou ne peuvent plus agir
  return teamPlayers.every(
    player => hasPlayerActed(state, player.id) || player.stunned || player.pm <= 0
  );
}

/**
 * Gère le changement de joueur sélectionné
 * @param state - État du jeu
 * @param newPlayerId - ID du nouveau joueur sélectionné
 * @returns Nouvel état du jeu
 */
export function handlePlayerSwitch(state: GameState, newPlayerId: string): GameState {
  // Si on change de joueur, finir le tour du joueur précédemment sélectionné
  if (state.selectedPlayerId && state.selectedPlayerId !== newPlayerId) {
    const previousPlayer = state.players.find(p => p.id === state.selectedPlayerId);
    if (previousPlayer && hasPlayerActed(state, previousPlayer.id)) {
      // Le joueur précédent a déjà agi, on ne peut pas le laisser actif
      return {
        ...state,
        selectedPlayerId: newPlayerId,
      };
    }
  }

  return {
    ...state,
    selectedPlayerId: newPlayerId,
  };
}

/**
 * Efface le résultat de dés
 * @param state - État du jeu
 * @returns Nouvel état du jeu
 */
export function clearDiceResult(state: GameState): GameState {
  return {
    ...state,
    lastDiceResult: undefined,
  };
}

/**
 * Compute the legal setup positions for `team` on a board of `height` rows.
 * Team A occupies the left half (x=1..12), team B the right half
 * (x=13..24). Touchdown lines (x=0 and x=width-1) are excluded. All
 * vertical rows (y=0..height-1) are valid; the LOS / wide-zone constraints
 * are enforced later by `placePlayerInSetup`.
 */
export function computeLegalSetupPositions(team: TeamId, height: number): Position[] {
  const xStart = team === 'A' ? 1 : 13;
  const xEnd = team === 'A' ? 12 : 24;
  const positions: Position[] = [];
  for (let x = xStart; x <= xEnd; x += 1) {
    for (let y = 0; y < height; y += 1) {
      positions.push({ x, y });
    }
  }
  return positions;
}

// Fonction pour entrer en phase setup (appelée après accepts et coin toss)
export function enterSetupPhase(
  state: ExtendedGameState,
  receivingTeam: TeamId
): ExtendedGameState {
  if (state.half !== 0 || (state.preMatch.phase !== 'idle' && state.preMatch.phase !== 'setup')) return state;

  const setupPositions = computeLegalSetupPositions(receivingTeam, state.height);

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      phase: 'setup',
      currentCoach: receivingTeam,
      legalSetupPositions: setupPositions,
      placedPlayers: state.preMatch.phase === 'idle' ? [] : state.preMatch.placedPlayers, // Ne pas réinitialiser si on passe d'une équipe à l'autre
    },
  };
}

// Fonction pour placer un joueur en setup (appelée onCellClick si phase='setup')
export function placePlayerInSetup(
  state: ExtendedGameState,
  playerId: string,
  pos: Position
): { success: boolean; state: ExtendedGameState } {
  if (
    state.preMatch.phase !== 'setup' ||
    state.preMatch.currentCoach !== state.players.find(p => p.id === playerId)?.team ||
    !state.preMatch.legalSetupPositions.some(l => l.x === pos.x && l.y === pos.y)
  ) {
    return { success: false, state }; // Invalid move
  }

  const player = state.players.find(p => p.id === playerId);
  if (!player) return { success: false, state };

  // Only active players can take the field. Knocked-out, casualty, dead
  // and sent-off players (e.g. expelled secret weapons) stay in their
  // dugout box and must not be placed during setup.
  if (player.state && player.state !== 'active') {
    return { success: false, state };
  }

  // Permettre le repositionnement : si le joueur est déjà placé, on le retire d'abord
  const isRepositioning = player.pos.x >= 0;
  let currentPlacedPlayers = [...state.preMatch.placedPlayers];

  if (isRepositioning) {
    // Retirer le joueur de la liste des placés
    currentPlacedPlayers = currentPlacedPlayers.filter(id => id !== playerId);
  }

  // Vérifier qu'aucun autre joueur n'occupe déjà cette position
  const existingPlayerAtPos = state.players.find(
    p => p.pos.x === pos.x && p.pos.y === pos.y && p.id !== playerId
  );
  if (existingPlayerAtPos) {
    return { success: false, state }; // Position déjà occupée
  }

  // Simuler la pose pour vérifier les contraintes
  const simulatedPlayers = state.players.map(p => (p.id === playerId ? { ...p, pos } : p));
  const simulatedPlaced = [...currentPlacedPlayers, playerId];

  // Contraintes Blood Bowl (setup)
  const teamId = player.team;
  // Largeurs BB 2020: 3 colonnes de chaque côté sur un terrain 15 colonnes (0..14)
  const isLeftWideZone = (y: number) => y >= 0 && y <= 2;
  const isRightWideZone = (y: number) => y >= 12 && y <= 14;
  const isOnLos = (x: number) => (teamId === 'A' ? x === 12 : x === 13);

  const teamPlayersOnPitch = simulatedPlayers.filter(p => p.team === teamId && p.pos.x >= 0);
  if (teamPlayersOnPitch.length > 11) {
    return { success: false, state }; // max 11 sur le terrain
  }

  const leftWzCount = teamPlayersOnPitch.filter(p => isLeftWideZone(p.pos.y)).length;
  const rightWzCount = teamPlayersOnPitch.filter(p => isRightWideZone(p.pos.y)).length;
  if (leftWzCount > 2 || rightWzCount > 2) {
    return { success: false, state }; // max 2 par wide zone
  }

  // Vérifier à partir de l'avant-dernier joueur (quand il reste 2 joueurs à placer)
  // Si on a placé 9 joueurs ou plus, vérifier qu'on peut encore respecter la contrainte LOS
  if (simulatedPlaced.length >= 9) {
    const losCount = teamPlayersOnPitch.filter(p => isOnLos(p.pos.x)).length;
    const remainingPlayers = 11 - simulatedPlaced.length;
    const minLosRequired = 3;

    // Si on n'a pas assez de joueurs sur la LOS et qu'il ne reste pas assez de joueurs pour atteindre 3
    if (losCount < minLosRequired && losCount + remainingPlayers < minLosRequired) {
      return { success: false, state }; // Impossible d'atteindre 3 joueurs sur la LOS
    }
  }

  const newPlayers = simulatedPlayers;
  const newPlaced = simulatedPlaced;

  const newState = {
    ...state,
    players: newPlayers,
    preMatch: { ...state.preMatch, placedPlayers: newPlaced },
  };

  // Si 11 placés, ne pas passer automatiquement - attendre la validation
  // Le coach doit cliquer sur "Valider le placement" pour continuer

  return { success: true, state: newState };
}

/**
 * Valide le placement des joueurs et passe à la phase suivante
 * @param state - État en phase setup avec 11 joueurs placés
 * @returns État avec phase suivante activée
 */
export function validatePlayerPlacement(state: ExtendedGameState): ExtendedGameState {
  if (state.preMatch.phase !== 'setup') return state;
  
  const currentCoach = state.preMatch.currentCoach;
  const placedPlayers = state.preMatch.placedPlayers;

  // Vérifier que le coach a placé tous les joueurs qu'il pouvait : exactement
  // 11 quand l'équipe en a au moins autant en réserve, sinon le total des
  // joueurs encore actifs (cas post-touchdown : KO, casualty, sent-off ne
  // sont pas plaçables, mais l'équipe doit pouvoir valider quand même).
  const availablePlayers = state.players.filter(
    p => p.team === currentCoach && (!p.state || p.state === 'active')
  ).length;
  const expectedOnField = Math.min(11, availablePlayers);
  const coachPlayersOnField = state.players.filter(
    p => p.team === currentCoach && p.pos.x >= 0
  ).length;

  if (coachPlayersOnField !== expectedOnField) {
    return state; // Pas le bon nombre de joueurs placés
  }

  const logEntry = createLogEntry(
    'action',
    `Placement validé par l'équipe ${state.teamNames[currentCoach === 'A' ? 'teamA' : 'teamB']} - 11 joueurs placés`
  );

  // Déterminer la phase suivante
  const nextCoach = currentCoach === 'A' ? 'B' : 'A';
  
  if (currentCoach === state.preMatch.receivingTeam) {
      // L'équipe receveuse a terminé, passer à l'équipe frappeuse
      const kickingSetupPositions = computeLegalSetupPositions(nextCoach, state.height);
    return {
      ...state,
      preMatch: {
        ...state.preMatch,
        currentCoach: nextCoach,
        placedPlayers: [], // Reset pour l'autre équipe
        legalSetupPositions: kickingSetupPositions,
      },
      gameLog: [...state.gameLog, logEntry],
    };
    } else {
      // L'équipe frappeuse a terminé, les deux équipes ont placé leurs joueurs
    return {
      ...state,
      preMatch: {
        ...state.preMatch,
        phase: 'kickoff',
      },
      gameLog: [...state.gameLog, logEntry],
    };
  }
}

/**
 * Transforme l'état pré-match en état de kickoff avec les étapes manquantes
 * Tous les joueurs sont déjà placés sur le terrain
 * @param state - État pré-match en phase kickoff
 * @returns État de kickoff avec les étapes à suivre
 */
export function startKickoffSequence(state: ExtendedGameState): ExtendedGameState {
  // Supporte à la fois le kickoff initial (half === 0) et le re-kickoff de mi-temps
  // (half >= 1). Le seul invariant est d'être en phase 'kickoff' : cette phase
  // n'est atteinte que via `validatePlayerPlacement` une fois les 11 joueurs de
  // chaque équipe placés (donc inatteignable à mi-tour sans passer par setup).
  if (state.preMatch.phase !== 'kickoff') return state;

  // Créer un log de début de kickoff
  const kickoffLog = createLogEntry(
    'info',
    `Kickoff - ${state.teamNames.teamA} vs ${state.teamNames.teamB} - Début de la séquence de kickoff`
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      phase: 'kickoff-sequence',
      kickoffStep: 'place-ball', // Étapes: place-ball, kick-deviation, kickoff-event
      ballPosition: null, // Position initiale du ballon (à définir par le coach)
      kickDeviation: null, // Déviation du kick (D8 + D6)
      kickoffEvent: null, // Événement de kickoff (2D6)
    },
    gameLog: [...state.gameLog, kickoffLog],
  };
}

/**
 * Transforme l'état de kickoff en état de match démarré / repris après résolution complète.
 * - Appelé en début de match (state.half === 0) : initialise half=1, turn=1, compteurs
 *   de match, bribes depuis inducements, fan attendance, etc.
 * - Appelé au démarrage de la 2e mi-temps (state.half === 2) : conserve matchStats,
 *   casualtyResults, bribesRemaining, fanAttendance, dedicatedFans et la météo déjà
 *   enregistrée dans l'état.
 * @param state - État de kickoff avec toutes les étapes résolues
 * @returns État de match démarré ou repris
 */
export function startMatchFromKickoff(state: ExtendedGameState, rng?: RNG): GameState {
  if (state.preMatch.phase !== 'kickoff-sequence') return state;

  const isInitialStart = state.half === 0;

  const matchStartLog = createLogEntry(
    'info',
    isInitialStart
      ? `Match commencé - ${state.teamNames.teamA} vs ${state.teamNames.teamB} - Le jeu commence !`
      : `Début de la 2e mi-temps - ${state.teamNames.teamA} vs ${state.teamNames.teamB}`
  );

  // Retirer la propriété preMatch pour passer en mode match normal
  const { preMatch, ...matchState } = state;

  // Préserver fan attendance et dedicated fans pour le calcul post-match.
  // Au démarrage initial, on les (ré)initialise depuis fanFactor ; en reprise,
  // on conserve les valeurs déjà présentes dans l'état.
  const fanFactor = preMatch.fanFactor;
  const fanAttendance = isInitialStart
    ? (fanFactor ? fanFactor.teamA.total + fanFactor.teamB.total : undefined)
    : state.fanAttendance;
  const dedicatedFans = isInitialStart
    ? (fanFactor
        ? { teamA: fanFactor.teamA.dedicatedFans, teamB: fanFactor.teamB.dedicatedFans }
        : undefined)
    : state.dedicatedFans;

  // Météo : au démarrage initial, on prend celle du pré-match ; en reprise
  // (mi-temps), on conserve la météo active (elle peut avoir changé via un
  // Changing Weather kickoff event de la 1ère mi-temps).
  const weatherCondition = isInitialStart
    ? (preMatch.weather
        ? { condition: preMatch.weather.condition, description: preMatch.weather.description }
        : undefined)
    : state.weatherCondition;

  const nextHalf = isInitialStart ? 1 : state.half;
  // Sur reprise de mi-temps, `advanceHalfIfNeeded` a déjà forcé turn=1 avant
  // d'entrer dans le flux setup → kickoff-sequence : on conserve donc la valeur
  // courante plutôt que de la sur-écrire (ce qui casserait un éventuel re-kickoff
  // post-touchdown où turn != 1 doit être préservé).
  const nextTurn = isInitialStart ? 1 : state.turn;

  let resultState: GameState = {
    ...matchState,
    gamePhase: 'playing' as const,
    kickingTeam: state.preMatch.kickingTeam,
    half: nextHalf,
    turn: nextTurn,
    currentPlayer: state.preMatch.receivingTeam, // L'équipe qui reçoit commence
    ball: state.preMatch.finalBallPosition || { x: 13, y: 7 }, // Position finale du ballon
    selectedPlayerId: null,
    isTurnover: false,
    playerActions: {} as Record<string, ActionType>,
    teamBlitzCount: {} as Record<string, number>,
    teamFoulCount: {} as Record<string, number>,
    lastDiceResult: undefined,
    matchStats: isInitialStart ? {} : state.matchStats,
    casualtyResults: isInitialStart ? {} : state.casualtyResults,
    lastingInjuryDetails: isInitialStart ? {} : state.lastingInjuryDetails,
    usedStarPlayerRules: state.usedStarPlayerRules ?? {},
    bribesRemaining: isInitialStart
      ? initializeBribesFromInducements(preMatch, state.prayerEffects)
      : state.bribesRemaining,
    fanAttendance,
    dedicatedFans,
    weatherCondition,
    gameLog: [...state.gameLog, matchStartLog],
  };

  // Appliquer les effets météo de début de drive (D3 joueurs en réserves si applicable)
  if (rng && weatherCondition) {
    const weatherMods = getWeatherModifiers(weatherCondition);
    if (weatherMods.playersToReserves > 0) {
      const weatherLog = createLogEntry(
        'info',
        `Météo: ${weatherCondition.condition} — ${weatherCondition.description}`
      );
      resultState = applyWeatherDriveEffects(resultState, weatherMods, rng);
      resultState = { ...resultState, gameLog: [...resultState.gameLog, weatherLog] };
    }
  }

  // Résoudre l'atterrissage du ballon : touchback si hors moitié receveuse,
  // tentative de catch si la balle tombe sur un joueur debout, sinon le
  // ballon reste au sol pour être ramassé manuellement. Sans cette étape,
  // un ballon dévié hors zone laissait le terrain dans un état où aucun
  // joueur ne pouvait être activé tant que personne ne pouvait l'atteindre.
  if (rng) {
    const receivingTeam = preMatch.receivingTeam;
    if (receivingTeam) {
      resultState = resolveKickoffBallLanding(resultState, receivingTeam, rng);
    }
  }

  return resultState;
}

/**
 * Calcule le nombre de bribes disponibles pour chaque équipe
 * à partir des inducements achetés et des prières à Nuffle.
 */
function initializeBribesFromInducements(preMatch: PreMatchState, prayerEffects?: GameState['prayerEffects']): { teamA: number; teamB: number } {
  const bribes = { teamA: 0, teamB: 0 };
  // Inducements achetés
  if (preMatch.inducements) {
    for (const teamKey of ['teamA', 'teamB'] as const) {
      const items = preMatch.inducements[teamKey].items;
      const bribeItem = items.find(i => i.slug === 'bribe');
      if (bribeItem) {
        bribes[teamKey] = bribeItem.quantity;
      }
    }
  }
  // Prières à Nuffle (Prayer 2 & 13 → +1 bribe chacune)
  if (prayerEffects) {
    for (const effect of prayerEffects) {
      if (effect.type === 'bribe') {
        const key = effect.team === 'A' ? 'teamA' : 'teamB';
        bribes[key] += 1;
      }
    }
  }
  return bribes;
}

/**
 * Place le ballon pour le kickoff
 * @param state - État de kickoff
 * @param position - Position où placer le ballon
 * @returns Nouvel état avec ballon placé
 */
export function placeKickoffBall(state: ExtendedGameState, position: Position): ExtendedGameState {
  if (state.preMatch.phase !== 'kickoff-sequence' || state.preMatch.kickoffStep !== 'place-ball') {
    return state;
  }

  // Vérifier que la position est dans la moitié de l'équipe receveuse
  const receivingTeam = state.preMatch.receivingTeam;
  const isValidPosition = receivingTeam === 'A' ? 
    position.x >= 1 && position.x <= 12 : // Équipe A (haut)
    position.x >= 13 && position.x <= 24; // Équipe B (bas)

  if (!isValidPosition) {
    return state; // Position invalide
  }

  const logEntry = createLogEntry(
    'action',
    `Ballon placé en position (${position.x}, ${position.y}) pour le kickoff`,
    undefined,
    state.preMatch.kickingTeam
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      kickoffStep: 'kick-deviation',
      ballPosition: position,
    },
    gameLog: [...state.gameLog, logEntry],
  };
}

/**
 * Calcule la déviation du kickoff
 * @param state - État de kickoff avec ballon placé
 * @param rng - Générateur de nombres aléatoires
 * @returns Nouvel état avec déviation calculée
 */
export function calculateKickDeviation(state: ExtendedGameState, rng: () => number): ExtendedGameState {
  if (state.preMatch.phase !== 'kickoff-sequence' || state.preMatch.kickoffStep !== 'kick-deviation') {
    return state;
  }

  const d8 = Math.floor(rng() * 8) + 1;
  const rawD6 = Math.floor(rng() * 6) + 1;

  // Skill Kick : si l'equipe qui botte a un joueur Kick eligible sur le terrain,
  // le D6 de deviation est divise par deux (arrondi a l'entier inferieur).
  const kickingTeam = state.preMatch.kickingTeam;
  const kickResult = kickingTeam
    ? applyKickSkillToDeviation(state, kickingTeam, rawD6)
    : { d6: rawD6, applied: false };
  const d6 = kickResult.d6;

  // Déterminer la direction basée sur le D8
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const direction = directions[d8 - 1];

  // Calculer la nouvelle position du ballon
  const originalPos = state.preMatch.ballPosition!;
  let newX = originalPos.x;
  let newY = originalPos.y;

  // Appliquer la déviation selon la direction
  switch (direction) {
    case 'N': newY -= d6; break;
    case 'NE': newX += d6; newY -= d6; break;
    case 'E': newX += d6; break;
    case 'SE': newX += d6; newY += d6; break;
    case 'S': newY += d6; break;
    case 'SW': newX -= d6; newY += d6; break;
    case 'W': newX -= d6; break;
    case 'NW': newX -= d6; newY -= d6; break;
  }

  // Vérifier les limites du terrain
  newX = Math.max(0, Math.min(25, newX));
  newY = Math.max(0, Math.min(14, newY));

  const finalPosition = { x: newX, y: newY };

  const kickSuffix = kickResult.applied
    ? ` (skill Kick : D6 ${rawD6} -> ${d6})`
    : '';
  const logEntry = createLogEntry(
    'action',
    `Déviation du kickoff: D8=${d8} (${direction}), D6=${d6} → Ballon en (${finalPosition.x}, ${finalPosition.y})${kickSuffix}`,
    undefined,
    state.preMatch.kickingTeam
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      kickoffStep: 'kickoff-event',
      kickDeviation: { d8, d6, direction },
      finalBallPosition: finalPosition,
    },
    gameLog: [...state.gameLog, logEntry],
  };
}

/**
 * Résout l'événement de kickoff
 * @param state - État de kickoff avec déviation calculée
 * @param rng - Générateur de nombres aléatoires
 * @returns Nouvel état avec événement résolu
 */
export function resolveKickoffEvent(state: ExtendedGameState, rng: () => number): ExtendedGameState {
  if (state.preMatch.phase !== 'kickoff-sequence' || state.preMatch.kickoffStep !== 'kickoff-event') {
    return state;
  }

  const dice1 = Math.floor(rng() * 6) + 1;
  const dice2 = Math.floor(rng() * 6) + 1;
  const total = dice1 + dice2;

  // Table des événements de kickoff (simplifiée)
  const events: { [key: number]: { event: string; description: string } } = {
    2: { event: 'Get the Ref', description: 'Chaque équipe gagne un Bribe gratuit' },
    3: { event: 'Riot', description: 'Les fans envahissent le terrain - tous les joueurs sont repoussés' },
    4: { event: 'Perfect Defense', description: 'L\'équipe qui frappe peut repositionner D3 joueurs' },
    5: { event: 'High Kick', description: 'Le ballon est lancé haut - +1 pour attraper' },
    6: { event: 'Cheering Fans', description: 'Les fans encouragent - +1 Fan Factor pour cette mi-temps' },
    7: { event: 'Changing Weather', description: 'Le temps change - relancer la météo' },
    8: { event: 'Brilliant Coaching', description: 'L\'équipe qui frappe peut utiliser une reroll gratuite' },
    9: { event: 'Quick Snap', description: 'L\'équipe qui reçoit peut activer un joueur supplémentaire' },
    10: { event: 'Blitz', description: 'L\'équipe qui frappe peut activer D3+3 joueurs immédiatement' },
    11: { event: 'Officious Ref', description: 'L\'arbitre est strict - risque d\'exclusion' },
    12: { event: 'Pitch Invasion', description: 'Invasion du terrain - D3 joueurs de chaque équipe sont sonnés' },
  };

  const eventData = events[total] || { event: 'Normal', description: 'Kickoff normal' };

  const logEntry = createLogEntry(
    'action',
    `Événement de kickoff: ${dice1}+${dice2}=${total} - ${eventData.event}: ${eventData.description}`,
    undefined,
    state.preMatch.kickingTeam
  );

  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      kickoffEvent: { dice: total, event: eventData.event, description: eventData.description },
    },
    gameLog: [...state.gameLog, logEntry],
  };
}
