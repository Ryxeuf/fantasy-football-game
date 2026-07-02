/**
 * Classements individuels (par joueur) d'une coupe, agrégés depuis les actions
 * de match locales (`LocalMatchAction`).
 *
 * Équivalent des leaderboards de ligue, MAIS restreint aux catégories
 * calculables en coupe : on EXCLUT « future star » (basé sur les PSP, absents
 * en coupe) et « MVP » (aucun MVP n'est désigné en coupe). Les catégories
 * « killer » (mort vs KO non distingués) et « lanceur de coéquipier » (pas
 * d'action dédiée) ne sont pas disponibles non plus.
 *
 * Service **pur** : prend les matchs déjà chargés, ne fait aucune I/O.
 */

/** Action de match exploitable par joueur (sous-ensemble de LocalMatchAction). */
export interface CupPlayerActionLike {
  readonly actionType: string;
  readonly playerTeam: 'A' | 'B';
  readonly playerId: string | null;
  readonly playerName: string | null;
  readonly armorBroken: boolean;
  readonly opponentState: string | null;
  readonly opponentId: string | null;
  readonly opponentName: string | null;
}

export interface CupMatchTeam {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
}

export interface CupMatchForPlayerStats {
  readonly teamA: CupMatchTeam;
  readonly teamB: CupMatchTeam | null;
  readonly actions: readonly CupPlayerActionLike[];
}

export interface CupPlayerStatRow {
  readonly rank: number;
  readonly playerId: string;
  readonly playerName: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly teamRoster: string;
  readonly value: number;
}

export interface CupPlayerLeaderboards {
  readonly topN: number;
  readonly topScorers: CupPlayerStatRow[];
  readonly topBashers: CupPlayerStatRow[];
  readonly topAggressors: CupPlayerStatRow[];
  readonly topPassers: CupPlayerStatRow[];
  readonly topInterceptors: CupPlayerStatRow[];
  readonly topPunchingBags: CupPlayerStatRow[];
}

/** Catégories exposées (clé + libellé + description), pour piloter l'UI. */
export const CUP_LEADERBOARD_CATEGORIES: ReadonlyArray<{
  key: keyof Omit<CupPlayerLeaderboards, 'topN'>;
  label: string;
  description: string;
}> = [
  { key: 'topScorers', label: 'Meilleur marqueur', description: 'Touchdowns inscrits' },
  { key: 'topBashers', label: 'Meilleur castagneur', description: 'Sorties infligées au contact' },
  { key: 'topAggressors', label: 'Meilleur agresseur', description: 'Sorties infligées à l’agression' },
  { key: 'topPassers', label: 'Meilleur passeur', description: 'Passes réussies' },
  { key: 'topInterceptors', label: 'Meilleur intercepteur', description: 'Interceptions' },
  { key: 'topPunchingBags', label: 'Sac de frappe', description: 'Sorties subies' },
];

interface Accumulator {
  playerName: string;
  teamId: string;
  teamName: string;
  teamRoster: string;
  scorer: number;
  basher: number;
  aggressor: number;
  passer: number;
  interceptor: number;
}

const BLOCK_TYPES = new Set(['blocage', 'blitz']);

function ensure(
  map: Map<string, Accumulator>,
  playerId: string,
  playerName: string | null,
  team: CupMatchTeam,
): Accumulator {
  let acc = map.get(playerId);
  if (!acc) {
    acc = {
      playerName: playerName ?? 'Joueur',
      teamId: team.id,
      teamName: team.name,
      teamRoster: team.roster,
      scorer: 0,
      basher: 0,
      aggressor: 0,
      passer: 0,
      interceptor: 0,
    };
    map.set(playerId, acc);
  }
  return acc;
}

function topRows(
  entries: Array<{ playerId: string; acc: Accumulator; value: number }>,
  topN: number,
): CupPlayerStatRow[] {
  return entries
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value || a.acc.playerName.localeCompare(b.acc.playerName))
    .slice(0, topN)
    .map((e, i) => ({
      rank: i + 1,
      playerId: e.playerId,
      playerName: e.acc.playerName,
      teamId: e.acc.teamId,
      teamName: e.acc.teamName,
      teamRoster: e.acc.teamRoster,
      value: e.value,
    }));
}

/**
 * Agrège les classements individuels d'une coupe à partir de ses matchs
 * complétés (avec actions). `topN` borne chaque catégorie (défaut 5).
 */
export function computeCupPlayerLeaderboards(
  matches: readonly CupMatchForPlayerStats[],
  topN = 5,
): CupPlayerLeaderboards {
  const actors = new Map<string, Accumulator>();
  // Sac de frappe : agrégé par victime (opponentId), équipe = équipe adverse.
  const victims = new Map<string, Accumulator>();

  for (const match of matches) {
    for (const action of match.actions) {
      const actorTeam = action.playerTeam === 'A' ? match.teamA : match.teamB;
      const victimTeam = action.playerTeam === 'A' ? match.teamB : match.teamA;

      // Comptage côté acteur.
      if (actorTeam && action.playerId) {
        const acc = ensure(actors, action.playerId, action.playerName, actorTeam);
        if (action.actionType === 'td') acc.scorer += 1;
        else if (action.actionType === 'passe') acc.passer += 1;
        else if (action.actionType === 'interception') acc.interceptor += 1;
        else if (
          BLOCK_TYPES.has(action.actionType) &&
          action.armorBroken &&
          action.opponentState === 'elimine'
        ) {
          acc.basher += 1;
        } else if (
          action.actionType === 'aggression' &&
          action.opponentState === 'elimine'
        ) {
          acc.aggressor += 1;
        }
      }

      // Sac de frappe : la victime d'une sortie (contact ou agression).
      const isCasualty =
        action.opponentState === 'elimine' &&
        ((BLOCK_TYPES.has(action.actionType) && action.armorBroken) ||
          action.actionType === 'aggression');
      if (isCasualty && victimTeam && action.opponentId) {
        const acc = ensure(victims, action.opponentId, action.opponentName, victimTeam);
        acc.scorer += 1; // réutilise le champ scorer comme compteur de sorties subies
      }
    }
  }

  const actorEntries = [...actors.entries()].map(([playerId, acc]) => ({ playerId, acc }));
  const victimEntries = [...victims.entries()].map(([playerId, acc]) => ({
    playerId,
    acc,
    value: acc.scorer,
  }));

  return {
    topN,
    topScorers: topRows(actorEntries.map((e) => ({ ...e, value: e.acc.scorer })), topN),
    topBashers: topRows(actorEntries.map((e) => ({ ...e, value: e.acc.basher })), topN),
    topAggressors: topRows(actorEntries.map((e) => ({ ...e, value: e.acc.aggressor })), topN),
    topPassers: topRows(actorEntries.map((e) => ({ ...e, value: e.acc.passer })), topN),
    topInterceptors: topRows(actorEntries.map((e) => ({ ...e, value: e.acc.interceptor })), topN),
    topPunchingBags: topRows(victimEntries, topN),
  };
}
