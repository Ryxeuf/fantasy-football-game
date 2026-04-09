/**
 * Table des événements de kickoff pour Blood Bowl
 * Résultat sur 2D6 déterminant un événement spécial au début de chaque drive
 */

import { GameState, RNG, TeamId } from '../core/types';
import { roll2D6, rollD6 } from '../utils/dice';
import { createLogEntry } from '../utils/logging';

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
      // L'équipe qui botte peut réorganiser (marqué comme flag, géré côté UI)
      const log = createLogEntry('action', `Défense parfaite — L'équipe qui botte peut réorganiser ses joueurs`);
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'high-kick': {
      // Un joueur de l'équipe qui reçoit peut être déplacé sous le ballon (géré côté UI)
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
      // L'équipe qui reçoit peut déplacer chaque joueur d'1 case (géré côté UI)
      const log = createLogEntry('action', `Snap rapide ! ${receivingTeam === 'A' ? newState.teamNames.teamA : newState.teamNames.teamB} peut déplacer ses joueurs d'1 case`);
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'blitz': {
      // L'équipe qui botte joue un tour immédiat (géré côté UI/game flow)
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
