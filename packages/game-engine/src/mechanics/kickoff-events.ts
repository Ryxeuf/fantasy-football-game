/**
 * Table des événements de kickoff pour Blood Bowl
 * Résultat sur 2D6 déterminant un événement spécial au début de chaque drive
 */

import { GameState, Position, RNG, TeamId } from '../core/types';
import { roll2D6, rollD6 } from '../utils/dice';
import { createLogEntry } from '../utils/logging';

/**
 * Événement de kickoff en attente d'une action de l'UI
 */
export interface PendingKickoffEvent {
  eventId: 'perfect-defence' | 'high-kick' | 'quick-snap' | 'blitz';
  team: TeamId; // équipe qui doit agir
}

export interface KickoffEvent {
  id: string;
  name: string;
  nameFr: string;
  description: string;
}

/**
 * Table des événements de kickoff (2D6)
 */
export const KICKOFF_EVENTS: Record<number, KickoffEvent> = {
  2: {
    id: 'get-the-ref',
    name: 'Get the Ref!',
    nameFr: 'Corrompre l\'arbitre !',
    description: 'Chaque équipe reçoit 1 relance d\'équipe supplémentaire gratuite pour ce drive. Elle est perdue si elle n\'est pas utilisée avant la fin du drive.',
  },
  3: {
    id: 'riot',
    name: 'Riot!',
    nameFr: 'Émeute !',
    description: 'Le compteur de tours avance ou recule de 1 (D6: 1-3 recule, 4-6 avance). Si le tour est déjà au 1 ou au 8, l\'effet est inversé.',
  },
  4: {
    id: 'perfect-defence',
    name: 'Perfect Defence',
    nameFr: 'Défense parfaite',
    description: 'L\'équipe qui botte peut réorganiser ses joueurs. Ils doivent toujours respecter les règles de placement (LOS, wide zones).',
  },
  5: {
    id: 'high-kick',
    name: 'High Kick',
    nameFr: 'Coup de pied en hauteur',
    description: 'Un joueur de l\'équipe qui reçoit peut être déplacé sous le ballon pour le récupérer (s\'il n\'est pas marqué par un adversaire).',
  },
  6: {
    id: 'cheering-fans',
    name: 'Cheering Fans',
    nameFr: 'Fans en folie',
    description: 'Chaque coach lance un D3 et ajoute le nombre de Fans Dévoués de son équipe. L\'équipe avec le score le plus élevé gagne 1 relance d\'équipe supplémentaire gratuite.',
  },
  7: {
    id: 'brilliant-coaching',
    name: 'Brilliant Coaching',
    nameFr: 'Coaching brillant',
    description: 'Chaque coach lance un D3 et ajoute le nombre d\'Assistants de son équipe. L\'équipe avec le score le plus élevé gagne 1 relance d\'équipe supplémentaire gratuite.',
  },
  8: {
    id: 'changing-weather',
    name: 'Changing Weather',
    nameFr: 'Changement de météo',
    description: 'La météo change ! Un nouveau jet sur la table météo est effectué. Si le résultat est "Conditions parfaites", la météo reste inchangée.',
  },
  9: {
    id: 'quick-snap',
    name: 'Quick Snap!',
    nameFr: 'Snap rapide !',
    description: 'L\'équipe qui reçoit peut déplacer chacun de ses joueurs d\'une case dans n\'importe quelle direction (sans quitter le terrain).',
  },
  10: {
    id: 'blitz',
    name: 'Blitz!',
    nameFr: 'Blitz !',
    description: 'L\'équipe qui botte peut immédiatement jouer un tour complet avant la résolution du kickoff. Aucune passe ou remise n\'est autorisée pendant ce tour.',
  },
  11: {
    id: 'officious-ref',
    name: 'Officious Ref',
    nameFr: 'Arbitre zélé',
    description: 'L\'arbitre est particulièrement attentif. Toute faute commise ce drive entraîne automatiquement l\'expulsion, même sans double.',
  },
  12: {
    id: 'pitch-invasion',
    name: 'Pitch Invasion!',
    nameFr: 'Invasion de terrain !',
    description: 'Les fans envahissent le terrain. Chaque coach lance un D6 pour chaque joueur adverse sur le terrain : sur 6, le joueur est sonné (stunned).',
  },
};

/**
 * Effectue le jet de kickoff et retourne l'événement
 */
export function rollKickoffEvent(rng: RNG): { total: number; event: KickoffEvent } {
  const total = roll2D6(rng);
  const event = KICKOFF_EVENTS[total];
  return { total, event };
}

/**
 * Applique un événement de kickoff à l'état du jeu
 */
export function applyKickoffEvent(
  state: GameState,
  event: KickoffEvent,
  rng: RNG,
  kickingTeam: TeamId
): GameState {
  const newState = structuredClone(state) as GameState;
  const receivingTeam: TeamId = kickingTeam === 'A' ? 'B' : 'A';

  const eventLog = createLogEntry(
    'info',
    `Événement de kickoff : ${event.nameFr} — ${event.description}`,
    undefined,
    undefined,
    { kickoffEvent: event.id }
  );
  newState.gameLog = [...newState.gameLog, eventLog];

  switch (event.id) {
    case 'get-the-ref': {
      // +1 relance gratuite pour chaque équipe
      newState.teamRerolls = {
        teamA: (newState.teamRerolls?.teamA ?? 0) + 1,
        teamB: (newState.teamRerolls?.teamB ?? 0) + 1,
      };
      const log = createLogEntry('action', 'Chaque équipe reçoit 1 relance supplémentaire');
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'riot': {
      const d6 = rollD6(rng);
      const direction = d6 <= 3 ? -1 : 1;
      let newTurn = newState.turn + direction;
      // Bornes : si déjà 1, on avance ; si déjà 8, on recule
      if (newTurn < 1) newTurn = newState.turn + 1;
      if (newTurn > 8) newTurn = newState.turn - 1;
      newState.turn = Math.max(1, Math.min(8, newTurn));
      const log = createLogEntry('action', `Émeute ! Le compteur de tours passe à ${newState.turn} (D6: ${d6})`);
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'perfect-defence': {
      newState.pendingKickoffEvent = { eventId: 'perfect-defence', team: kickingTeam };
      const log = createLogEntry('action', `Défense parfaite — L'équipe qui botte peut réorganiser ses joueurs`);
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'high-kick': {
      newState.pendingKickoffEvent = { eventId: 'high-kick', team: receivingTeam };
      const log = createLogEntry('action', `Coup en hauteur — L'équipe qui reçoit peut placer un joueur sous le ballon`);
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'cheering-fans': {
      const d3A = Math.floor(rng() * 3) + 1;
      const d3B = Math.floor(rng() * 3) + 1;
      const dfA = newState.dedicatedFans?.teamA ?? 0;
      const dfB = newState.dedicatedFans?.teamB ?? 0;
      const scoreA = d3A + dfA;
      const scoreB = d3B + dfB;
      if (scoreA > scoreB) {
        newState.teamRerolls = { ...newState.teamRerolls, teamA: (newState.teamRerolls?.teamA ?? 0) + 1 };
        const log = createLogEntry('action', `Fans en folie : ${newState.teamNames.teamA} gagne 1 relance (D3:${d3A} + ${dfA} fans = ${scoreA} vs D3:${d3B} + ${dfB} fans = ${scoreB})`);
        newState.gameLog = [...newState.gameLog, log];
      } else if (scoreB > scoreA) {
        newState.teamRerolls = { ...newState.teamRerolls, teamB: (newState.teamRerolls?.teamB ?? 0) + 1 };
        const log = createLogEntry('action', `Fans en folie : ${newState.teamNames.teamB} gagne 1 relance (D3:${d3B} + ${dfB} fans = ${scoreB} vs D3:${d3A} + ${dfA} fans = ${scoreA})`);
        newState.gameLog = [...newState.gameLog, log];
      } else {
        const log = createLogEntry('action', `Fans en folie : égalité (D3:${d3A} + ${dfA} fans = ${scoreA} vs D3:${d3B} + ${dfB} fans = ${scoreB}), pas de relance`);
        newState.gameLog = [...newState.gameLog, log];
      }
      break;
    }

    case 'brilliant-coaching': {
      const d3A = Math.floor(rng() * 3) + 1;
      const d3B = Math.floor(rng() * 3) + 1;
      if (d3A > d3B) {
        newState.teamRerolls = { ...newState.teamRerolls, teamA: (newState.teamRerolls?.teamA ?? 0) + 1 };
        const log = createLogEntry('action', `Coaching brillant : ${newState.teamNames.teamA} gagne 1 relance`);
        newState.gameLog = [...newState.gameLog, log];
      } else if (d3B > d3A) {
        newState.teamRerolls = { ...newState.teamRerolls, teamB: (newState.teamRerolls?.teamB ?? 0) + 1 };
        const log = createLogEntry('action', `Coaching brillant : ${newState.teamNames.teamB} gagne 1 relance`);
        newState.gameLog = [...newState.gameLog, log];
      } else {
        const log = createLogEntry('action', 'Coaching brillant : égalité, pas de relance');
        newState.gameLog = [...newState.gameLog, log];
      }
      break;
    }

    case 'changing-weather': {
      const log = createLogEntry('action', 'La météo change ! Un nouveau jet de météo est nécessaire.');
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'quick-snap': {
      newState.pendingKickoffEvent = { eventId: 'quick-snap', team: receivingTeam };
      const log = createLogEntry('action', `Snap rapide ! ${receivingTeam === 'A' ? newState.teamNames.teamA : newState.teamNames.teamB} peut déplacer ses joueurs d'1 case`);
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'blitz': {
      newState.pendingKickoffEvent = { eventId: 'blitz', team: kickingTeam };
      const log = createLogEntry('action', `Blitz ! ${kickingTeam === 'A' ? newState.teamNames.teamA : newState.teamNames.teamB} joue un tour immédiat`);
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'officious-ref': {
      const log = createLogEntry('action', 'Arbitre zélé : toute faute entraîne une expulsion automatique ce drive');
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'pitch-invasion': {
      // Pour chaque joueur adverse, D6 = 6 => stunned
      for (const team of ['A', 'B'] as const) {
        const opponents = newState.players.filter(
          p => p.team === team && !p.stunned && p.state === 'active'
        );
        let stunnedCount = 0;
        for (const player of opponents) {
          const d6 = rollD6(rng);
          if (d6 === 6) {
            const idx = newState.players.findIndex(p => p.id === player.id);
            if (idx !== -1) {
              newState.players[idx] = { ...newState.players[idx], stunned: true };
              stunnedCount++;
            }
          }
        }
        if (stunnedCount > 0) {
          const log = createLogEntry('action', `Invasion de terrain : ${stunnedCount} joueur(s) de ${team === 'A' ? newState.teamNames.teamA : newState.teamNames.teamB} sonné(s)`);
          newState.gameLog = [...newState.gameLog, log];
        }
      }
      break;
    }
  }

  return newState;
}

// ---------------------------------------------------------------------------
// Résolveurs pour les événements de kickoff délégués à l'UI
// ---------------------------------------------------------------------------

export interface KickoffResolveResult {
  success: boolean;
  state: GameState;
}

interface Reposition {
  playerId: string;
  to: Position;
}

const PITCH_MID_X = 13; // x < 13 : moitié A (kicking ou receiving) ; x >= 13 : moitié B

function isInsidePitch(state: GameState, pos: Position): boolean {
  return pos.x >= 0 && pos.x < state.width && pos.y >= 0 && pos.y < state.height;
}

function isInTeamHalf(team: TeamId, pos: Position): boolean {
  return team === 'A' ? pos.x < PITCH_MID_X : pos.x >= PITCH_MID_X;
}

function clearPendingKickoff(state: GameState): GameState {
  const next: GameState = { ...state };
  delete next.pendingKickoffEvent;
  return next;
}

/**
 * Défense parfaite : l'équipe qui botte peut réorganiser ses joueurs.
 * Chaque reposition déplace un joueur vers une nouvelle case dans la moitié de l'équipe.
 */
export function resolvePerfectDefence(
  state: GameState,
  repositions: readonly Reposition[]
): KickoffResolveResult {
  if (state.pendingKickoffEvent?.eventId !== 'perfect-defence') {
    return { success: false, state };
  }

  const team = state.pendingKickoffEvent.team;

  // Construire la map des repositions (playerId -> Position)
  const moveMap = new Map<string, Position>();
  for (const r of repositions) {
    const player = state.players.find(p => p.id === r.playerId);
    if (!player) return { success: false, state };
    if (player.team !== team) return { success: false, state };
    if (!isInsidePitch(state, r.to)) return { success: false, state };
    if (!isInTeamHalf(team, r.to)) return { success: false, state };
    if (moveMap.has(r.playerId)) return { success: false, state };
    moveMap.set(r.playerId, r.to);
  }

  // Vérifier l'absence de collision : positions finales doivent être uniques,
  // et ne doivent pas chevaucher un joueur immobile (non repositionné).
  const finalPositions = new Map<string, string>(); // "x,y" -> playerId
  for (const player of state.players) {
    if (player.pos.x < 0) continue; // joueur hors terrain
    const pos = moveMap.get(player.id) ?? player.pos;
    const key = `${pos.x},${pos.y}`;
    if (finalPositions.has(key)) {
      return { success: false, state };
    }
    finalPositions.set(key, player.id);
  }

  const newPlayers = state.players.map(p => {
    const newPos = moveMap.get(p.id);
    return newPos ? { ...p, pos: newPos } : p;
  });

  const log = createLogEntry(
    'action',
    `Défense parfaite résolue : ${repositions.length} joueur(s) repositionné(s)`
  );

  return {
    success: true,
    state: clearPendingKickoff({
      ...state,
      players: newPlayers,
      gameLog: [...state.gameLog, log],
    }),
  };
}

/**
 * Coup de pied en hauteur : un joueur de l'équipe qui reçoit est déplacé sous
 * le ballon, si la case cible est libre.
 */
export function resolveHighKick(
  state: GameState,
  playerId: string,
  ballPos: Position
): KickoffResolveResult {
  if (state.pendingKickoffEvent?.eventId !== 'high-kick') {
    return { success: false, state };
  }

  const team = state.pendingKickoffEvent.team;
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.team !== team) return { success: false, state };
  if (player.state !== 'active' || player.stunned) return { success: false, state };
  if (!isInsidePitch(state, ballPos)) return { success: false, state };

  const occupant = state.players.find(
    p => p.id !== playerId && p.pos.x === ballPos.x && p.pos.y === ballPos.y
  );
  if (occupant) return { success: false, state };

  const newPlayers = state.players.map(p =>
    p.id === playerId ? { ...p, pos: ballPos } : p
  );

  const log = createLogEntry(
    'action',
    `Coup en hauteur résolu : ${player.name ?? playerId} placé sous le ballon`
  );

  return {
    success: true,
    state: clearPendingKickoff({
      ...state,
      players: newPlayers,
      gameLog: [...state.gameLog, log],
    }),
  };
}

/**
 * Snap rapide : chaque joueur de l'équipe qui reçoit peut se déplacer d'une case.
 * Les joueurs non listés dans `moves` ne bougent pas.
 */
export function resolveQuickSnap(
  state: GameState,
  moves: readonly Reposition[]
): KickoffResolveResult {
  if (state.pendingKickoffEvent?.eventId !== 'quick-snap') {
    return { success: false, state };
  }

  const team = state.pendingKickoffEvent.team;
  const moveMap = new Map<string, Position>();

  for (const m of moves) {
    const player = state.players.find(p => p.id === m.playerId);
    if (!player) return { success: false, state };
    if (player.team !== team) return { success: false, state };
    if (player.state !== 'active' || player.stunned) return { success: false, state };
    if (!isInsidePitch(state, m.to)) return { success: false, state };

    const dx = Math.abs(m.to.x - player.pos.x);
    const dy = Math.abs(m.to.y - player.pos.y);
    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
      return { success: false, state };
    }
    if (moveMap.has(m.playerId)) return { success: false, state };
    moveMap.set(m.playerId, m.to);
  }

  // Collision check : aucune case cible ne peut être partagée, ni occupée par
  // un joueur non repositionné.
  const finalPositions = new Map<string, string>();
  for (const player of state.players) {
    if (player.pos.x < 0) continue;
    const pos = moveMap.get(player.id) ?? player.pos;
    const key = `${pos.x},${pos.y}`;
    if (finalPositions.has(key)) {
      return { success: false, state };
    }
    finalPositions.set(key, player.id);
  }

  const newPlayers = state.players.map(p => {
    const newPos = moveMap.get(p.id);
    return newPos ? { ...p, pos: newPos } : p;
  });

  const log = createLogEntry(
    'action',
    `Snap rapide résolu : ${moves.length} joueur(s) déplacé(s) d'une case`
  );

  return {
    success: true,
    state: clearPendingKickoff({
      ...state,
      players: newPlayers,
      gameLog: [...state.gameLog, log],
    }),
  };
}

/**
 * Blitz : l'équipe qui botte prend le contrôle et joue un tour spécial
 * (passes/handoffs interdits). Le flag `blitzKickoffActive` est utilisé par le
 * game flow pour restreindre les actions.
 */
export function resolveBlitzKickoff(state: GameState): KickoffResolveResult {
  if (state.pendingKickoffEvent?.eventId !== 'blitz') {
    return { success: false, state };
  }

  const team = state.pendingKickoffEvent.team;
  const log = createLogEntry(
    'action',
    `Blitz résolu : ${team === 'A' ? state.teamNames.teamA : state.teamNames.teamB} prend le contrôle`
  );

  return {
    success: true,
    state: clearPendingKickoff({
      ...state,
      currentPlayer: team,
      playerActions: {},
      teamBlitzCount: {},
      teamFoulCount: {},
      isTurnover: false,
      rerollUsedThisTurn: false,
      blitzKickoffActive: true,
      gameLog: [...state.gameLog, log],
    }),
  };
}

/**
 * Termine un tour de kickoff Blitz et rend la main à l'équipe qui reçoit.
 * @param state - État en cours de blitz
 * @param kickingTeam - Équipe qui bottait (pour restituer la main à l'autre)
 */
export function endBlitzKickoff(state: GameState, kickingTeam: TeamId): GameState {
  const receivingTeam: TeamId = kickingTeam === 'A' ? 'B' : 'A';
  const log = createLogEntry(
    'action',
    `Fin du Blitz de kickoff : ${state.teamNames[receivingTeam === 'A' ? 'teamA' : 'teamB']} reprend la main`
  );
  return {
    ...state,
    currentPlayer: receivingTeam,
    blitzKickoffActive: false,
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    isTurnover: false,
    rerollUsedThisTurn: false,
    gameLog: [...state.gameLog, log],
  };
}
