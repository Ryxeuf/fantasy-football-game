/**
 * Calculs purs sur les actions et le gameState pour produire les agregats
 * affiches dans le PDF (box score, MVP, casualties).
 *
 * Tout est extrait du composant pour rester testable en isolation et reutilisable.
 */

import type {
  ActionType,
  MatchAggregates,
  MvpInfo,
  PdfAction,
  PdfMatch,
  TeamAggregateStats,
} from "./types";

const EMPTY_TEAM_STATS: TeamAggregateStats = {
  touchdowns: 0,
  completions: 0,
  receptions: 0,
  blitzes: 0,
  blocks: 0,
  fouls: 0,
  sprints: 0,
  dodges: 0,
  interceptions: 0,
  armorBreaks: 0,
  casualties: 0,
  kos: 0,
  stuns: 0,
  fumbles: 0,
  totalActions: 0,
};

function newTeamStats(): TeamAggregateStats {
  return { ...EMPTY_TEAM_STATS };
}

/**
 * Calcule les stats par equipe a partir des actions.
 * Logique alignee sur celle deja en place dans LocalMatchSummary (UI) pour
 * eviter toute divergence entre l'affichage et l'export.
 */
export function computeTeamStats(actions: ReadonlyArray<PdfAction>): {
  teamA: TeamAggregateStats;
  teamB: TeamAggregateStats;
} {
  const teamA = newTeamStats();
  const teamB = newTeamStats();

  for (const action of actions) {
    const stats = action.playerTeam === "A" ? teamA : teamB;
    stats.totalActions += 1;

    if (action.fumble) {
      stats.fumbles += 1;
    }

    switch (action.actionType) {
      case "td":
        stats.touchdowns += 1;
        break;
      case "passe":
        if (!action.fumble) stats.completions += 1;
        break;
      case "reception":
        stats.receptions += 1;
        break;
      case "blocage":
        stats.blocks += 1;
        if (action.armorBroken) stats.armorBreaks += 1;
        break;
      case "blitz":
        stats.blitzes += 1;
        if (action.armorBroken) stats.armorBreaks += 1;
        break;
      case "aggression":
        stats.fouls += 1;
        if (action.armorBroken) stats.armorBreaks += 1;
        break;
      case "sprint":
        stats.sprints += 1;
        break;
      case "esquive":
        stats.dodges += 1;
        break;
      case "interception":
        stats.interceptions += 1;
        break;
      default:
        break;
    }

    // Casualties / KO / stun: convention BB — credites a l'equipe AGISSANTE
    // (qui a inflige le dommage), pas a la victime. Aligne sur la logique
    // d'agregation deja en place dans LocalMatchSummary.tsx.
    if (
      action.actionType === "blocage" ||
      action.actionType === "blitz" ||
      action.actionType === "aggression"
    ) {
      const state = (action.opponentState || "").toLowerCase();
      if (state === "elimine") stats.casualties += 1;
      else if (state === "ko") stats.kos += 1;
      else if (state === "sonne" || state === "stun" || state === "stunned")
        stats.stuns += 1;
    }
  }

  return { teamA, teamB };
}

/** Compte les actions reussies par type, par equipe — utilise pour le drive chart. */
export function countActionsByType(
  actions: ReadonlyArray<PdfAction>,
): Record<"A" | "B", Partial<Record<ActionType, number>>> {
  const acc: Record<"A" | "B", Partial<Record<ActionType, number>>> = { A: {}, B: {} };
  for (const a of actions) {
    const tally = acc[a.playerTeam];
    tally[a.actionType] = (tally[a.actionType] ?? 0) + 1;
  }
  return acc;
}

/** Calcule le gagnant a partir des scores (null => DRAW). */
export function computeOutcome(
  scoreA: number | null,
  scoreB: number | null,
): "A" | "B" | "DRAW" {
  const a = scoreA ?? 0;
  const b = scoreB ?? 0;
  if (a > b) return "A";
  if (b > a) return "B";
  return "DRAW";
}

const SPP_VALUES = {
  touchdown: 3,
  casualty: 2,
  completion: 1,
  interception: 1,
  mvp: 4,
} as const;

function sppFromStats(stats: {
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
  mvp: boolean;
}): number {
  return (
    stats.touchdowns * SPP_VALUES.touchdown +
    stats.casualties * SPP_VALUES.casualty +
    stats.completions * SPP_VALUES.completion +
    stats.interceptions * SPP_VALUES.interception +
    (stats.mvp ? SPP_VALUES.mvp : 0)
  );
}

/**
 * Determine le MVP du match en se basant prioritairement sur gameState.matchStats
 * (champ MVP officiel + SPP), puis en fallback sur les actions brutes.
 */
export function computeMvp(
  match: PdfMatch,
  actions: ReadonlyArray<PdfAction>,
): MvpInfo | null {
  const matchStats = match.gameState?.matchStats;
  const players = match.gameState?.players ?? [];
  const playerLookup = new Map(players.map((p) => [p.id, p]));

  if (matchStats) {
    const buildInfo = (
      playerId: string,
      stats: PdfMatch["gameState"] extends infer GS
        ? GS extends { matchStats?: infer MS }
          ? MS extends Record<string, infer V>
            ? V
            : never
          : never
        : never,
    ): MvpInfo => {
      const meta = playerLookup.get(playerId);
      const fallbackName =
        actions.find((a) => a.playerId === playerId)?.playerName ??
        meta?.name ??
        "Inconnu";
      const team =
        meta?.team ??
        actions.find((a) => a.playerId === playerId)?.playerTeam ??
        "A";
      return {
        playerId,
        playerName: meta?.name ?? fallbackName,
        team,
        number: meta?.number ?? null,
        position: meta?.position ?? null,
        spp: sppFromStats(stats),
        touchdowns: stats.touchdowns,
        casualties: stats.casualties,
        completions: stats.completions,
        interceptions: stats.interceptions,
      };
    };

    // Two-pass: 1) si un joueur est marque mvp officiel, on le retient, en
    // departageant les ex-aequo (pathologique) par SPP. 2) sinon, on prend
    // le plus haut SPP du match.
    let officialMvp: MvpInfo | null = null;
    let topByScore: MvpInfo | null = null;
    for (const [playerId, stats] of Object.entries(matchStats)) {
      const info = buildInfo(playerId, stats);
      if (stats.mvp && (officialMvp === null || info.spp > officialMvp.spp)) {
        officialMvp = info;
      }
      if (topByScore === null || info.spp > topByScore.spp) {
        topByScore = info;
      }
    }
    if (officialMvp) return officialMvp;
    if (topByScore) return topByScore;
  }

  // Fallback: deriver depuis les actions
  const perPlayer = new Map<
    string,
    {
      playerName: string;
      team: "A" | "B";
      touchdowns: number;
      casualties: number;
      completions: number;
      interceptions: number;
    }
  >();

  for (const action of actions) {
    const cur = perPlayer.get(action.playerId) ?? {
      playerName: action.playerName,
      team: action.playerTeam,
      touchdowns: 0,
      casualties: 0,
      completions: 0,
      interceptions: 0,
    };
    if (action.actionType === "td") cur.touchdowns += 1;
    else if (action.actionType === "passe" && !action.fumble) cur.completions += 1;
    else if (action.actionType === "interception") cur.interceptions += 1;
    if (
      (action.actionType === "blocage" ||
        action.actionType === "blitz" ||
        action.actionType === "aggression") &&
      action.armorBroken &&
      (action.opponentState || "").toLowerCase() === "elimine"
    ) {
      cur.casualties += 1;
    }
    perPlayer.set(action.playerId, cur);
  }

  let best: MvpInfo | null = null;
  let bestSpp = -1;
  for (const [playerId, stats] of perPlayer.entries()) {
    const spp = sppFromStats({ ...stats, mvp: false });
    if (spp <= bestSpp) continue;
    const meta = playerLookup.get(playerId);
    bestSpp = spp;
    best = {
      playerId,
      playerName: stats.playerName,
      team: stats.team,
      number: meta?.number ?? null,
      position: meta?.position ?? null,
      spp,
      touchdowns: stats.touchdowns,
      casualties: stats.casualties,
      completions: stats.completions,
      interceptions: stats.interceptions,
    };
  }
  return best;
}

export function computeAggregates(
  match: PdfMatch,
  actions: ReadonlyArray<PdfAction>,
): MatchAggregates {
  const { teamA, teamB } = computeTeamStats(actions);
  return {
    teamA,
    teamB,
    mvp: computeMvp(match, actions),
    outcome: computeOutcome(match.scoreTeamA, match.scoreTeamB),
  };
}
