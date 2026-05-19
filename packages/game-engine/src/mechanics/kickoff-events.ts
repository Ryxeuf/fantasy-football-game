/**
 * Table des événements de kickoff pour Blood Bowl
 * Résultat sur 2D6 déterminant un événement spécial au début de chaque drive
 */

import { GameState, RNG, TeamId } from '../core/types';
import { roll2D6, rollD6 } from '../utils/dice';
import { createLogEntry } from '../utils/logging';
import { getWeatherCondition, type WeatherType } from '../core/weather-types';

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
    description: 'Chaque équipe reçoit 1 Pot-de-vin (Bribe) supplémentaire pour le reste du match.',
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
      // BUG fix : BB2020 dit « Each team receives one additional Bribe to
      // use during the game », pas +1 relance. Avant le fix, l'event Get
      // the Ref! donnait des relances comme Brilliant Coaching ou Cheering
      // Fans — c'etait redondant avec ces 2 events et ignorait la mecanique
      // Bribe (qui annule l'expulsion sur fouls, eject sur secret weapons).
      const bribes = newState.bribesRemaining ?? { teamA: 0, teamB: 0 };
      newState.bribesRemaining = {
        teamA: bribes.teamA + 1,
        teamB: bribes.teamB + 1,
      };
      const log = createLogEntry('action', 'Chaque équipe reçoit 1 Pot-de-vin (Bribe) supplémentaire');
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
      newState.pendingKickoffEvent = { type: 'perfect-defence', team: kickingTeam };
      const log = createLogEntry('action', `Défense parfaite — L'équipe qui botte peut réorganiser ses joueurs`);
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'high-kick': {
      newState.pendingKickoffEvent = {
        type: 'high-kick',
        team: receivingTeam,
        ballPosition: newState.ball,
      };
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
      // Audit round 10 (HIGH/regle BB3) : la regle BB3 dit
      // "Each coach rolls a D3 and adds the number of Assistant
      // Coaches they have. The team with the highest total gains
      // an extra Team Re-roll." Avant ce fix, seul le D3 brut etait
      // compare — une equipe avec 6 assistant coaches gagnait 50/50.
      // Pattern aligne sur 'cheering-fans' qui ajoute dedicatedFans.
      const d3A = Math.floor(rng() * 3) + 1;
      const d3B = Math.floor(rng() * 3) + 1;
      const acA = newState.assistantCoaches?.teamA ?? 0;
      const acB = newState.assistantCoaches?.teamB ?? 0;
      const scoreA = d3A + acA;
      const scoreB = d3B + acB;
      if (scoreA > scoreB) {
        newState.teamRerolls = { ...newState.teamRerolls, teamA: (newState.teamRerolls?.teamA ?? 0) + 1 };
        const log = createLogEntry('action', `Coaching brillant : ${newState.teamNames.teamA} gagne 1 relance (D3:${d3A} + ${acA} coachs = ${scoreA} vs D3:${d3B} + ${acB} coachs = ${scoreB})`);
        newState.gameLog = [...newState.gameLog, log];
      } else if (scoreB > scoreA) {
        newState.teamRerolls = { ...newState.teamRerolls, teamB: (newState.teamRerolls?.teamB ?? 0) + 1 };
        const log = createLogEntry('action', `Coaching brillant : ${newState.teamNames.teamB} gagne 1 relance (D3:${d3B} + ${acB} coachs = ${scoreB} vs D3:${d3A} + ${acA} coachs = ${scoreA})`);
        newState.gameLog = [...newState.gameLog, log];
      } else {
        const log = createLogEntry('action', `Coaching brillant : égalité (D3:${d3A} + ${acA} coachs = ${scoreA} vs D3:${d3B} + ${acB} coachs = ${scoreB}), pas de relance`);
        newState.gameLog = [...newState.gameLog, log];
      }
      break;
    }

    case 'changing-weather': {
      // BUG fix audit round 5 (CRITICAL) : avant, le case ne faisait que
      // logger "La meteo change" SANS re-roll le 2D6 ni mettre a jour
      // state.weatherCondition. Resultat : les modificateurs (gfi, dodge,
      // pass) etaient figes sur la meteo initiale du match alors que la
      // regle BB dit "Roll on the weather table again. If the result is
      // Perfect Conditions, the weather does not change."
      const weatherType: WeatherType =
        ((newState as GameState & { preMatch?: { weatherType?: WeatherType } })
          .preMatch?.weatherType ?? 'classique') as WeatherType;
      const dice1 = Math.floor(rng() * 6) + 1;
      const dice2 = Math.floor(rng() * 6) + 1;
      const total = dice1 + dice2;
      const newWeather = getWeatherCondition(weatherType, total);
      if (newWeather && newWeather.condition !== 'Conditions parfaites') {
        // "Conditions parfaites" (total=6-7 selon la table) : on garde
        // la meteo courante par regle BB. Sinon, on remplace.
        newState.weatherCondition = {
          condition: newWeather.condition,
          description: newWeather.description,
        };
        const log = createLogEntry(
          'action',
          `La meteo change ! 2D6=${total} → ${newWeather.condition} : ${newWeather.description}`,
        );
        newState.gameLog = [...newState.gameLog, log];
      } else {
        const log = createLogEntry(
          'action',
          `La meteo change ! 2D6=${total} → temps clement, pas de changement.`,
        );
        newState.gameLog = [...newState.gameLog, log];
      }
      break;
    }

    case 'quick-snap': {
      newState.pendingKickoffEvent = { type: 'quick-snap', team: receivingTeam };
      const log = createLogEntry('action', `Snap rapide ! ${receivingTeam === 'A' ? newState.teamNames.teamA : newState.teamNames.teamB} peut déplacer ses joueurs d'1 case`);
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'blitz': {
      newState.pendingKickoffEvent = { type: 'blitz', team: kickingTeam };
      const log = createLogEntry('action', `Blitz ! ${kickingTeam === 'A' ? newState.teamNames.teamA : newState.teamNames.teamB} joue un tour immédiat`);
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'officious-ref': {
      // BB2020 : « Each Coach rolls a D6 each time their Player commits a
      // Foul this drive. If they roll a 1, the player is Sent Off. »
      // Avant le fix, le log etait emis mais aucun flag n'etait pose sur
      // state ; `executeFoul` ne pouvait pas declencher ce check.
      newState.officiousRefForDrive = true;
      const log = createLogEntry('action', 'Arbitre zélé : toute faute peut entraîner une expulsion (D6=1) ce drive');
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'pitch-invasion': {
      // BB3 S3 : « Each Coach rolls a D6 for each opposing player on the
      // pitch ; on 6+, that player is Stunned. » BUG fix : avant, le filtre
      // sur `p.state === 'active'` et `!p.stunned` n'excluait pas les
      // reservistes (pos.x = -1, en dugout) — leur state peut etre
      // 'active' s'ils n'ont pas encore joue. Resultat : joueurs en
      // reserves stunned a tort. Maintenant on filtre aussi sur
      // `pos.x >= 0` (sur le terrain).
      for (const team of ['A', 'B'] as const) {
        const opponents = newState.players.filter(
          p =>
            p.team === team &&
            !p.stunned &&
            p.state === 'active' &&
            p.pos.x >= 0 && // exclure les reservistes en dugout
            p.pos.y >= 0
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
