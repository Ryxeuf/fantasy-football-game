/**
 * Table des événements de coup d'envoi — Blood Bowl saison 2025.
 *
 * Source : livre de règles 2025, « Tableau des Événements de Coup
 * d'Envoi » (transcription : `docs/regles-bb-2025/page-01.md`, version
 * publiée : `apps/web/app/compendium/data/rules-bb-2025.json`, chapitre
 * `coup-d-envoi`). Les trois représentations doivent rester cohérentes.
 *
 * ⚠️ Avant la saison 2025, cette table reprenait l'édition précédente
 * (Émeute, Défense parfaite, Coup de pied en hauteur, Arbitre zélé…).
 * Elle alimente aussi la liste déroulante de saisie des feuilles de
 * match de ligue (`apps/web/app/leagues/pairings/[id]/sheet`), qui
 * affichait donc des événements qui n'existent plus.
 */

import { GameState, Player, RNG, TeamId } from '../core/types';
import { cloneGameState } from '../core/clone-state';
import { roll2D6, rollD6 } from '../utils/dice';
import { createLogEntry } from '../utils/logging';
import { getWeatherCondition, type WeatherType } from '../core/weather-types';
import { isPlayerOpen } from './tackle-zones';
import { movePlayerToDugoutZone } from './dugout';

/**
 * Identifiants stables des 11 résultats de la table 2D6 (2 → 12).
 *
 * Ils sont persistés dans les feuilles de match de ligue
 * (`LeagueMatchEvent.meta.kickoffEvent`) : ne pas les renommer sans
 * prévoir un alias de compatibilité côté affichage.
 */
export type KickoffEventId =
  | 'get-the-ref'
  | 'timeout'
  | 'solid-defence'
  | 'high-kick'
  | 'cheering-fans'
  | 'brilliant-coaching'
  | 'changing-weather'
  | 'quick-snap'
  | 'blitz'
  | 'dodgy-snack'
  | 'pitch-invasion';

export interface KickoffEvent {
  id: KickoffEventId;
  /** Nom du résultat tel qu'il figure sur la table 2025. */
  nameFr: string;
  /** Résumé de l'effet (reformulé, cf. compendium). */
  description: string;
}

/**
 * Table des événements de coup d'envoi (2D6), saison 2025.
 */
export const KICKOFF_EVENTS: Record<number, KickoffEvent> = {
  2: {
    id: 'get-the-ref',
    nameFr: 'À mort l\'arbitre !',
    description:
      'Chaque équipe reçoit immédiatement 1 Coup de Pouce de Pot-de-vin gratuit, à dépenser avant la fin du match sous peine d\'être perdu.',
  },
  3: {
    id: 'timeout',
    nameFr: 'Temps mort !',
    description:
      'Si le Marqueur de Tour de l\'équipe qui engage indique 6, 7 ou 8, reculez d\'une case le marqueur des deux équipes ; sinon avancez-le d\'une case pour les deux équipes.',
  },
  4: {
    id: 'solid-defence',
    nameFr: 'Solide défense !',
    description:
      'Le coach qui engage retire jusqu\'à D3+3 de ses joueurs Démarqués et les replace en respectant les règles normales de placement d\'équipe.',
  },
  5: {
    id: 'high-kick',
    nameFr: 'Chandelle !',
    description:
      'L\'équipe qui réceptionne peut placer aussitôt 1 de ses joueurs Démarqués sur la case d\'atterrissage prévue du ballon.',
  },
  6: {
    id: 'cheering-fans',
    nameFr: 'Fans en folie !',
    description:
      'Chaque coach lance 1D6 et y additionne ses Cheerleaders. Le plus haut total (les deux en cas d\'égalité) obtient un Soutien Offensif supplémentaire sur sa première Action de Blocage du prochain Tour.',
  },
  7: {
    id: 'brilliant-coaching',
    nameFr: 'Coaching brillant !',
    description:
      'Chaque coach lance 1D6 et y additionne ses Coachs Assistants. Le plus haut total (les deux en cas d\'égalité) gagne 1 Relance d\'Équipe gratuite pour la Phase à venir.',
  },
  8: {
    id: 'changing-weather',
    nameFr: 'Météo capricieuse !',
    description:
      'Refaites immédiatement un jet sur le Tableau de Météo. Si le résultat est Conditions Idéales, le ballon Valdingue (3) dans les airs avant d\'atterrir.',
  },
  9: {
    id: 'quick-snap',
    nameFr: 'Surprise !',
    description:
      'Le coach qui réceptionne choisit jusqu\'à D3+3 de ses joueurs Démarqués : ils avancent aussitôt d\'une case dans n\'importe quelle direction, y compris dans la moitié adverse.',
  },
  10: {
    id: 'blitz',
    nameFr: 'Charge !',
    description:
      'Le coach qui engage choisit jusqu\'à D3+3 de ses joueurs Démarqués et les active un par un pour une Action de Mouvement gratuite (1 peut Blitzer, 1 Lancer un Coéquipier, 1 Botter un Coéquipier). La Charge s\'arrête dès qu\'un joueur activé Chute ou est Plaqué.',
  },
  11: {
    id: 'dodgy-snack',
    nameFr: 'En-cas suspect !',
    description:
      'Chaque coach lance 1D6. Le plus bas total (les deux en cas d\'égalité) désigne au hasard 1 de ses joueurs sur le terrain et lance 1D6 : sur 2+ il perd 1 point de Mouvement et 1 point d\'Armure pour la Phase, sur 1 il file aux latrines et rejoint la Box des Réserves.',
  },
  12: {
    id: 'pitch-invasion',
    nameFr: 'Invasion du terrain !',
    description:
      'Chaque coach lance 1D6 et y ajoute son Facteur de Popularité. Le plus bas total (les deux en cas d\'égalité) désigne au hasard D3 de ses joueurs sur le terrain : ils sont Mis à Terre et deviennent Sonnés.',
  },
};

/**
 * Événements qui nécessitent une décision de coach (UI ou IA). Les
 * moteurs headless (sim-engine, résolution serveur) les loggent sans
 * les appliquer : `applyKickoffEvent` poserait un `pendingKickoffEvent`
 * que personne ne viendrait résoudre, ce qui bloquerait le match.
 */
export const INTERACTIVE_KICKOFF_EVENT_IDS: ReadonlySet<string> = new Set<string>([
  'solid-defence',
  'high-kick',
  'quick-snap',
  'blitz',
]);

/**
 * Anciens identifiants (table d'avant la saison 2025) → identifiant
 * 2025 le plus proche. Utilisé uniquement pour ré-afficher les
 * feuilles de match de ligue saisies avant la correction de la table.
 */
export const LEGACY_KICKOFF_EVENT_IDS: Readonly<Record<string, KickoffEventId>> = {
  riot: 'timeout',
  'perfect-defence': 'solid-defence',
  'officious-ref': 'dodgy-snack',
};

/**
 * Effectue le jet de coup d'envoi et retourne l'événement
 */
export function rollKickoffEvent(rng: RNG): { total: number; event: KickoffEvent } {
  const total = roll2D6(rng);
  const event = KICKOFF_EVENTS[total];
  return { total, event };
}

/** Les 8 directions du dé de Déviation (D8). */
const SCATTER_DIRECTIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];

/**
 * Valdingue le ballon `times` fois pendant qu'il est EN L'AIR : on ne
 * fait que déplacer sa case (pas de réception ni de rebond au sol —
 * c'est l'atterrissage qui s'en charge).
 */
function scatterInFlight(
  state: GameState,
  from: { x: number; y: number },
  times: number,
  rng: RNG
): { x: number; y: number } {
  let pos = { ...from };
  for (let i = 0; i < times; i += 1) {
    const dir = SCATTER_DIRECTIONS[Math.floor(rng() * SCATTER_DIRECTIONS.length) % 8];
    pos = {
      x: Math.max(0, Math.min(state.width - 1, pos.x + dir.x)),
      y: Math.max(0, Math.min(state.height - 1, pos.y + dir.y)),
    };
  }
  return pos;
}

/** D3 (1-3) à partir du RNG partagé. */
function rollD3(rng: RNG): number {
  return Math.floor(rng() * 3) + 1;
}

/** Joueurs d'une équipe présents sur le terrain et en état de jouer. */
function playersOnPitch(state: GameState, team: TeamId): Player[] {
  return state.players.filter(
    p =>
      p.team === team &&
      p.state === 'active' &&
      !p.stunned &&
      p.pos.x >= 0 &&
      p.pos.y >= 0
  );
}

/** Joueurs Démarqués (sans adversaire adjacent) d'une équipe. */
function openPlayers(state: GameState, team: TeamId): Player[] {
  return playersOnPitch(state, team).filter(p => isPlayerOpen(state, p));
}

/** Tire `count` joueurs distincts au hasard dans `pool`. */
function pickRandomPlayers(pool: Player[], count: number, rng: RNG): Player[] {
  const remaining = [...pool];
  const picked: Player[] = [];
  while (picked.length < count && remaining.length > 0) {
    const idx = Math.floor(rng() * remaining.length);
    picked.push(remaining.splice(idx, 1)[0]);
  }
  return picked;
}

const TEAM_KEY = { A: 'teamA', B: 'teamB' } as const;

function teamName(state: GameState, team: TeamId): string {
  return state.teamNames[TEAM_KEY[team]];
}

/**
 * Applique un événement de coup d'envoi à l'état du jeu
 */
export function applyKickoffEvent(
  state: GameState,
  event: KickoffEvent,
  rng: RNG,
  kickingTeam: TeamId
): GameState {
  const newState = cloneGameState(state);
  const receivingTeam: TeamId = kickingTeam === 'A' ? 'B' : 'A';

  const eventLog = createLogEntry(
    'info',
    `Événement de coup d'envoi : ${event.nameFr} — ${event.description}`,
    undefined,
    undefined,
    { kickoffEvent: event.id }
  );
  newState.gameLog = [...newState.gameLog, eventLog];

  switch (event.id) {
    case 'get-the-ref': {
      // 2 — À mort l'arbitre ! « Chaque équipe reçoit immédiatement 1
      // Coup de Pouce de Pot-de-vin gratuit. » Il vaut pour tout le
      // match : `bribesRemaining` n'a pas de portée de drive.
      const bribes = newState.bribesRemaining ?? { teamA: 0, teamB: 0 };
      newState.bribesRemaining = {
        teamA: bribes.teamA + 1,
        teamB: bribes.teamB + 1,
      };
      const log = createLogEntry('action', 'Chaque équipe reçoit 1 Coup de Pouce de Pot-de-vin');
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'timeout': {
      // 3 — Temps mort ! Déterministe (l'ancienne table tirait un D6
      // pour « Émeute ») : sur 6/7/8 le marqueur recule d'une case,
      // sinon il avance d'une case, pour les DEUX équipes.
      const isLateInHalf = newState.turn >= 6;
      const nextTurn = isLateInHalf ? newState.turn - 1 : newState.turn + 1;
      newState.turn = Math.max(1, nextTurn);
      const log = createLogEntry(
        'action',
        `Temps mort ! Le Marqueur de Tour ${isLateInHalf ? 'recule' : 'avance'} d'une case → tour ${newState.turn}`
      );
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'solid-defence': {
      // 4 — Solide défense ! Jusqu'à D3+3 joueurs Démarqués de l'équipe
      // qui engage sont retirés puis replacés.
      const maxPlayers = rollD3(rng) + 3;
      const eligible = openPlayers(newState, kickingTeam);
      newState.pendingKickoffEvent = {
        type: 'solid-defence',
        team: kickingTeam,
        maxPlayers,
        eligiblePlayerIds: eligible.map(p => p.id),
      };
      const log = createLogEntry(
        'action',
        `Solide défense — ${teamName(newState, kickingTeam)} peut replacer jusqu'à ${maxPlayers} joueurs Démarqués`
      );
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'high-kick': {
      // 5 — Chandelle ! 1 joueur Démarqué de l'équipe qui réceptionne.
      const eligible = openPlayers(newState, receivingTeam);
      newState.pendingKickoffEvent = {
        type: 'high-kick',
        team: receivingTeam,
        ballPosition: newState.ball,
        maxPlayers: 1,
        eligiblePlayerIds: eligible.map(p => p.id),
      };
      const log = createLogEntry(
        'action',
        `Chandelle — ${teamName(newState, receivingTeam)} peut placer 1 joueur Démarqué sous le ballon`
      );
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'cheering-fans': {
      // 6 — Fans en folie ! 1D6 + Cheerleaders. Le gagnant (les deux en
      // cas d'égalité) obtient un Soutien Offensif supplémentaire sur sa
      // première Action de Blocage du prochain Tour — et non une relance
      // comme dans l'édition précédente.
      const d6A = rollD6(rng);
      const d6B = rollD6(rng);
      const clA = newState.cheerleaders?.teamA ?? 0;
      const clB = newState.cheerleaders?.teamB ?? 0;
      const scoreA = d6A + clA;
      const scoreB = d6B + clB;
      const detail = `D6:${d6A}+${clA} cheerleaders = ${scoreA} vs D6:${d6B}+${clB} cheerleaders = ${scoreB}`;
      const winners = { teamA: scoreA >= scoreB, teamB: scoreB >= scoreA };
      newState.cheeringFansAssist = {
        teamA: (newState.cheeringFansAssist?.teamA ?? false) || winners.teamA,
        teamB: (newState.cheeringFansAssist?.teamB ?? false) || winners.teamB,
      };
      const beneficiaries =
        winners.teamA && winners.teamB
          ? 'les deux équipes'
          : winners.teamA
            ? teamName(newState, 'A')
            : teamName(newState, 'B');
      const log = createLogEntry(
        'action',
        `Fans en folie : ${beneficiaries} — Soutien Offensif supplémentaire sur la première Action de Blocage du prochain Tour (${detail})`
      );
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'brilliant-coaching': {
      // 7 — Coaching brillant ! 1D6 (et non 1D3) + Coachs Assistants ;
      // en cas d'égalité, les DEUX coachs gagnent la relance.
      const d6A = rollD6(rng);
      const d6B = rollD6(rng);
      const acA = newState.assistantCoaches?.teamA ?? 0;
      const acB = newState.assistantCoaches?.teamB ?? 0;
      const scoreA = d6A + acA;
      const scoreB = d6B + acB;
      const detail = `D6:${d6A}+${acA} coachs = ${scoreA} vs D6:${d6B}+${acB} coachs = ${scoreB}`;
      const gainA = scoreA >= scoreB;
      const gainB = scoreB >= scoreA;
      newState.teamRerolls = {
        teamA: (newState.teamRerolls?.teamA ?? 0) + (gainA ? 1 : 0),
        teamB: (newState.teamRerolls?.teamB ?? 0) + (gainB ? 1 : 0),
      };
      const beneficiaries =
        gainA && gainB
          ? 'les deux équipes gagnent'
          : `${teamName(newState, gainA ? 'A' : 'B')} gagne`;
      const log = createLogEntry(
        'action',
        `Coaching brillant : ${beneficiaries} 1 Relance d'Équipe gratuite (${detail})`
      );
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'changing-weather': {
      // 8 — Météo capricieuse ! Le nouveau jet REMPLACE la météo (dans
      // l'édition précédente, « Conditions parfaites » laissait la météo
      // inchangée). Si le résultat est Conditions Idéales, le ballon
      // Valdingue (3) dans les airs avant d'atterrir.
      const weatherType: WeatherType =
        ((newState as GameState & { preMatch?: { weatherType?: WeatherType } })
          .preMatch?.weatherType ?? 'classique') as WeatherType;
      const dice1 = rollD6(rng);
      const dice2 = rollD6(rng);
      const total = dice1 + dice2;
      const newWeather = getWeatherCondition(weatherType, total);
      if (newWeather) {
        newState.weatherCondition = {
          condition: newWeather.condition,
          description: newWeather.description,
        };
        const log = createLogEntry(
          'action',
          `Météo capricieuse ! 2D6=${total} → ${newWeather.condition} : ${newWeather.description}`
        );
        newState.gameLog = [...newState.gameLog, log];
      }
      // « Conditions Idéales » est le libellé 2025 des conditions
      // parfaites : le ballon Valdingue (3) avant d'atterrir. Le ballon
      // est encore EN L'AIR : on ne déplace que sa case, sans résoudre
      // de réception ni de rebond au sol (ce que fera l'atterrissage).
      if (isIdealConditions(newWeather?.condition) && newState.ball) {
        newState.ball = scatterInFlight(newState, newState.ball, 3, rng);
        const scatterLog = createLogEntry(
          'action',
          `Conditions Idéales : le ballon Valdingue (3) → (${newState.ball.x}, ${newState.ball.y})`
        );
        newState.gameLog = [...newState.gameLog, scatterLog];
      }
      break;
    }

    case 'quick-snap': {
      // 9 — Surprise ! Jusqu'à D3+3 joueurs Démarqués de l'équipe qui
      // réceptionne se déplacent d'1 case.
      const maxPlayers = rollD3(rng) + 3;
      const eligible = openPlayers(newState, receivingTeam);
      newState.pendingKickoffEvent = {
        type: 'quick-snap',
        team: receivingTeam,
        maxPlayers,
        eligiblePlayerIds: eligible.map(p => p.id),
      };
      const log = createLogEntry(
        'action',
        `Surprise ! ${teamName(newState, receivingTeam)} peut déplacer jusqu'à ${maxPlayers} joueurs Démarqués d'1 case`
      );
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'blitz': {
      // 10 — Charge ! Jusqu'à D3+3 joueurs Démarqués de l'équipe qui
      // engage, activés un par un (et non un tour complet comme dans
      // l'édition précédente).
      const maxPlayers = rollD3(rng) + 3;
      const eligible = openPlayers(newState, kickingTeam);
      newState.pendingKickoffEvent = {
        type: 'blitz',
        team: kickingTeam,
        maxPlayers,
        eligiblePlayerIds: eligible.map(p => p.id),
      };
      const log = createLogEntry(
        'action',
        `Charge ! ${teamName(newState, kickingTeam)} peut activer jusqu'à ${maxPlayers} joueurs Démarqués`
      );
      newState.gameLog = [...newState.gameLog, log];
      break;
    }

    case 'dodgy-snack': {
      // 11 — En-cas suspect ! (remplace « Arbitre zélé »). 1D6 chacun,
      // le plus BAS total désigne au hasard 1 de ses joueurs.
      const d6A = rollD6(rng);
      const d6B = rollD6(rng);
      const affected: TeamId[] =
        d6A === d6B ? ['A', 'B'] : d6A < d6B ? ['A'] : ['B'];
      const log = createLogEntry(
        'action',
        `En-cas suspect : D6 ${d6A} vs ${d6B} → ${affected.map(t => teamName(newState, t)).join(' et ')}`
      );
      newState.gameLog = [...newState.gameLog, log];

      for (const team of affected) {
        const pool = playersOnPitch(newState, team);
        const [victim] = pickRandomPlayers(pool, 1, rng);
        if (!victim) continue;
        const effectRoll = rollD6(rng);
        if (effectRoll === 1) {
          // Avarié : le joueur passe le reste de la Phase aux latrines.
          const moved = movePlayerToDugoutZone(newState, victim.id, 'reserves', team);
          const movedPlayer = moved.players.find(p => p.id === victim.id);
          if (movedPlayer) {
            // `movePlayerToDugoutZone` laisse les réservistes sur leur
            // case : on les sort explicitement du terrain.
            movedPlayer.pos = { x: -1, y: -1 };
            movedPlayer.hasBall = false;
          }
          newState.players = moved.players;
          newState.dugouts = moved.dugouts;
          const outLog = createLogEntry(
            'action',
            `En-cas suspect : ${victim.name} (D6=1) est enfermé dans les latrines — Box des Réserves pour le reste de la Phase`
          );
          newState.gameLog = [...newState.gameLog, outLog];
        } else {
          const idx = newState.players.findIndex(p => p.id === victim.id);
          if (idx === -1) continue;
          const before = newState.players[idx];
          newState.driveStatModifiers = [
            ...(newState.driveStatModifiers ?? []),
            { playerId: before.id, source: 'dodgy-snack', ma: before.ma, av: before.av },
          ];
          newState.players[idx] = {
            ...before,
            ma: Math.max(1, before.ma - 1),
            av: Math.max(1, before.av - 1),
            pm: Math.min(before.pm, Math.max(1, before.ma - 1)),
          };
          const malusLog = createLogEntry(
            'action',
            `En-cas suspect : ${victim.name} (D6=${effectRoll}) perd 1 MO et 1 AR pour la Phase`
          );
          newState.gameLog = [...newState.gameLog, malusLog];
        }
      }
      break;
    }

    case 'pitch-invasion': {
      // 12 — Invasion du terrain ! 1D6 + Facteur de Popularité ; le plus
      // BAS total sonne D3 de SES PROPRES joueurs (l'édition précédente
      // faisait jeter un D6 par joueur adverse).
      // Le Facteur de Popularité est le TOTAL du pré-match (1D3 + fans
      // dévoués), pas les seuls fans dévoués. Repli sur `dedicatedFans`
      // pour les parties sauvegardées avant l'introduction de `fanFactors`.
      const d6A = rollD6(rng);
      const d6B = rollD6(rng);
      const fansA =
        newState.fanFactors?.teamA ?? newState.dedicatedFans?.teamA ?? 0;
      const fansB =
        newState.fanFactors?.teamB ?? newState.dedicatedFans?.teamB ?? 0;
      const scoreA = d6A + fansA;
      const scoreB = d6B + fansB;
      const affected: TeamId[] =
        scoreA === scoreB ? ['A', 'B'] : scoreA < scoreB ? ['A'] : ['B'];
      const log = createLogEntry(
        'action',
        `Invasion du terrain : D6:${d6A}+${fansA} = ${scoreA} vs D6:${d6B}+${fansB} = ${scoreB} → ${affected
          .map(t => teamName(newState, t))
          .join(' et ')}`
      );
      newState.gameLog = [...newState.gameLog, log];

      for (const team of affected) {
        const count = rollD3(rng);
        const victims = pickRandomPlayers(playersOnPitch(newState, team), count, rng);
        for (const victim of victims) {
          const idx = newState.players.findIndex(p => p.id === victim.id);
          if (idx === -1) continue;
          newState.players[idx] = { ...newState.players[idx], stunned: true };
        }
        if (victims.length > 0) {
          const stunLog = createLogEntry(
            'action',
            `Invasion du terrain : ${victims.length} joueur(s) de ${teamName(newState, team)} Mis à Terre et Sonnés (${victims
              .map(v => v.name)
              .join(', ')})`
          );
          newState.gameLog = [...newState.gameLog, stunLog];
        }
      }
      break;
    }
  }

  return newState;
}

/**
 * « Conditions Idéales » (saison 2025) = « Conditions parfaites » dans
 * les libellés historiques de `weather-types.ts`.
 */
function isIdealConditions(condition: string | undefined): boolean {
  if (!condition) return false;
  const normalized = condition
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized.includes('conditions parfaites') || normalized.includes('conditions ideales');
}

/**
 * Restaure les caractéristiques réduites pour la durée d'une Phase
 * (coup d'envoi « En-cas suspect »). À appeler à chaque fin de drive
 * (touchdown, mi-temps) — cf. `core/game-state.ts`.
 */
export function restoreDriveStatModifiers(state: GameState): GameState {
  if (!state.driveStatModifiers || state.driveStatModifiers.length === 0) {
    return state;
  }
  const byPlayer = new Map(state.driveStatModifiers.map(m => [m.playerId, m]));
  const players = state.players.map(p => {
    const mod = byPlayer.get(p.id);
    if (!mod) return p;
    return { ...p, ma: mod.ma, av: mod.av };
  });
  return { ...state, players, driveStatModifiers: [] };
}
