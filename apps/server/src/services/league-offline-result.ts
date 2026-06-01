/**
 * Workstream ligue offline — saisie manuelle d'un resultat de match joue
 * hors-ligne (tabletop), facon regles officielles BB / sites type
 * mordorbihan.
 *
 * Option (b) : on materialise un Match "offline" synthetique depuis le
 * pairing (mode `offline`, status `completed`, sans game-engine) puis on
 * REUTILISE tout le pipeline existant `recordLeagueMatchResult` :
 *  - compteurs LeagueParticipant (W/D/L, points, TD, CAS) + ELO saisonnier,
 *  - pairing -> `played`, completion round/saison/playoffs,
 *  - sequence post-match (pendingChoices de level-up) via le matchId.
 *
 * Phase 2 : on accepte des stats PAR JOUEUR (TD/CAS/MVP/passes/interceptions)
 * appliquees AVANT `recordLeagueMatchResult` (SPP + totaux carriere +
 * matchesPlayed). Comme le SPP est persiste avant, la sequence post-match
 * voit le SPP a jour et propose les bons level-up.
 *
 * Limites : winnings (tresorerie) / blessures durables / fan factor ne sont
 * pas encore appliques en offline (ils sont injectes par move-processor en
 * online) — phases ulterieures.
 *
 * Idempotence : un pairing terminal ou un match deja compte est ignore.
 */

import { prisma } from "../prisma";
import { recordLeagueMatchResult } from "./league-match-result";
import {
  calculatePlayerSPP,
  loadLeagueSPPContext,
  type PlayerMatchStats,
} from "./spp-tracking";
import { serverLog } from "../utils/server-log";

/** Mode pose sur le Match synthetique pour le distinguer des matchs joues. */
export const OFFLINE_MATCH_MODE = "offline";

export interface OfflinePlayerStatInput {
  readonly teamPlayerId: string;
  readonly touchdowns?: number;
  readonly casualties?: number;
  readonly completions?: number;
  readonly interceptions?: number;
  readonly mvp?: boolean;
}

export interface RecordOfflineResultInput {
  readonly pairingId: string;
  /** TD inscrits par l'equipe a domicile. */
  readonly scoreHome: number;
  /** TD inscrits par l'equipe a l'exterieur. */
  readonly scoreAway: number;
  /** Casualties infligees par l'equipe a domicile. */
  readonly casualtiesHome: number;
  /** Casualties infligees par l'equipe a l'exterieur. */
  readonly casualtiesAway: number;
  /** Stats par joueur (optionnel) -> SPP + totaux carriere + level-up. */
  readonly playerStats?: readonly OfflinePlayerStatInput[];
  /** Gain de tresorerie (or) optionnel par equipe (incremente treasury). */
  readonly winningsHome?: number;
  readonly winningsAway?: number;
  /** Variation de dedicated fans (clampe 1-6) optionnelle par equipe. */
  readonly dedicatedFansDeltaHome?: number;
  readonly dedicatedFansDeltaAway?: number;
}

export type OfflineResultWinner = "home" | "away" | "draw";

export type RecordOfflineResultOutcome =
  | {
      readonly recorded: true;
      readonly pairingId: string;
      readonly matchId: string;
      readonly winner: OfflineResultWinner;
      readonly sppPlayersUpdated: number;
    }
  | {
      readonly skipped: true;
      readonly reason:
        | "pairing-missing"
        | "pairing-not-terminal-eligible"
        | "match-already-scored"
        | "participant-missing"
        | "record-failed";
    };

const NON_TERMINAL = new Set(["scheduled", "in_progress"]);

interface PairingForOffline {
  id: string;
  status: string;
  match: { id: string; leagueScoredAt: Date | null } | null;
  round: { id: string; seasonId: string };
  homeParticipant: {
    id: string;
    teamId: string;
    team: {
      ownerId: string;
      name: string;
      roster: string;
      dedicatedFans: number;
    };
  } | null;
  awayParticipant: {
    id: string;
    teamId: string;
    team: {
      ownerId: string;
      name: string;
      roster: string;
      dedicatedFans: number;
    };
  } | null;
}

/**
 * Applique l'economie post-match saisie a la main : winnings (treasury) et
 * variation de dedicated fans (clampe 1-6, regle BB). Tout est optionnel.
 */
async function applyOfflineEconomy(
  home: { teamId: string; dedicatedFans: number },
  away: { teamId: string; dedicatedFans: number },
  input: RecordOfflineResultInput,
): Promise<void> {
  const sides = [
    {
      teamId: home.teamId,
      fans: home.dedicatedFans,
      winnings: input.winningsHome,
      fansDelta: input.dedicatedFansDeltaHome,
    },
    {
      teamId: away.teamId,
      fans: away.dedicatedFans,
      winnings: input.winningsAway,
      fansDelta: input.dedicatedFansDeltaAway,
    },
  ];
  const ops: Promise<unknown>[] = [];
  for (const s of sides) {
    const data: Record<string, unknown> = {};
    if (s.winnings && s.winnings > 0) {
      data.treasury = { increment: s.winnings };
    }
    if (s.fansDelta && s.fansDelta !== 0) {
      const next = Math.max(1, Math.min(6, s.fans + s.fansDelta));
      if (next !== s.fans) data.dedicatedFans = next;
    }
    if (Object.keys(data).length > 0) {
      ops.push(prisma.team.update({ where: { id: s.teamId }, data }));
    }
  }
  if (ops.length > 0) await prisma.$transaction(ops);
}

/**
 * Applique le SPP des stats joueur saisies a la main. Retourne le nombre de
 * joueurs mis a jour. Le modifier "bagarreurs brutaux" est resolu par equipe
 * via le roster (meme regle que les matchs joues).
 */
async function applyOfflinePlayerSPP(
  homeTeamId: string,
  awayTeamId: string,
  homeRoster: string,
  awayRoster: string,
  playerStats: readonly OfflinePlayerStatInput[],
): Promise<number> {
  const context = await loadLeagueSPPContext(prisma, {
    isLeagueMatch: true,
    teamARoster: homeRoster,
    teamBRoster: awayRoster,
  });
  const ids = playerStats.map((s) => s.teamPlayerId);
  const players = await prisma.teamPlayer.findMany({
    where: { id: { in: ids } },
    select: { id: true, teamId: true },
  });
  const teamById = new Map<string, string>(
    players.map((p: { id: string; teamId: string }) => [p.id, p.teamId]),
  );

  const updates: Promise<unknown>[] = [];
  for (const s of playerStats) {
    const teamId = teamById.get(s.teamPlayerId);
    if (teamId !== homeTeamId && teamId !== awayTeamId) continue;
    const modifier = teamId === homeTeamId ? context.teamA : context.teamB;
    const stats: PlayerMatchStats = {
      touchdowns: s.touchdowns ?? 0,
      casualties: s.casualties ?? 0,
      completions: s.completions ?? 0,
      interceptions: s.interceptions ?? 0,
      mvp: s.mvp ?? false,
    };
    const earned = calculatePlayerSPP(stats, modifier);
    updates.push(
      prisma.teamPlayer.update({
        where: { id: s.teamPlayerId },
        data: {
          spp: { increment: earned },
          totalTouchdowns: { increment: stats.touchdowns },
          totalCasualties: { increment: stats.casualties },
          totalCompletions: { increment: stats.completions },
          totalInterceptions: { increment: stats.interceptions },
          totalMvpAwards: { increment: stats.mvp ? 1 : 0 },
          matchesPlayed: { increment: 1 },
        },
      }),
    );
  }
  if (updates.length > 0) await prisma.$transaction(updates);
  return updates.length;
}

/**
 * Enregistre un resultat de match de ligue saisi a la main. Idempotent.
 */
export async function recordOfflineLeagueResult(
  input: RecordOfflineResultInput,
): Promise<RecordOfflineResultOutcome> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: input.pairingId },
    include: {
      match: { select: { id: true, leagueScoredAt: true } },
      round: { select: { id: true, seasonId: true } },
      homeParticipant: {
        select: {
          id: true,
          teamId: true,
          team: {
          select: {
            ownerId: true,
            name: true,
            roster: true,
            dedicatedFans: true,
          },
        },
        },
      },
      awayParticipant: {
        select: {
          id: true,
          teamId: true,
          team: {
          select: {
            ownerId: true,
            name: true,
            roster: true,
            dedicatedFans: true,
          },
        },
        },
      },
    },
  })) as PairingForOffline | null;

  if (!pairing) return { skipped: true, reason: "pairing-missing" };
  if (!NON_TERMINAL.has(pairing.status)) {
    return { skipped: true, reason: "pairing-not-terminal-eligible" };
  }
  if (pairing.match?.leagueScoredAt) {
    return { skipped: true, reason: "match-already-scored" };
  }
  if (!pairing.homeParticipant || !pairing.awayParticipant) {
    return { skipped: true, reason: "participant-missing" };
  }

  const home = pairing.homeParticipant;
  const away = pairing.awayParticipant;

  // 1. Materialise un Match "offline" synthetique + TeamSelection (ordre
  //    home puis away — recordLeagueMatchResult lit selections[0]=A=home,
  //    [1]=B=away). On force `createdAt` pour garantir cet ordre.
  const ownerIds = Array.from(
    new Set([home.team.ownerId, away.team.ownerId].filter(Boolean)),
  );
  const base = Date.now();
  const match = await prisma.$transaction(async (tx: typeof prisma) => {
    const created = await tx.match.create({
      data: {
        status: "completed",
        mode: OFFLINE_MATCH_MODE,
        seed: `offline-league-${pairing.id}`,
        players: { connect: ownerIds.map((id) => ({ id })) },
        leagueSeasonId: pairing.round.seasonId,
        leagueRoundId: pairing.round.id,
        leaguePairingId: pairing.id,
      },
      select: { id: true },
    });
    await tx.teamSelection.createMany({
      data: [
        {
          matchId: created.id,
          userId: home.team.ownerId,
          teamId: home.teamId,
          team: home.team.name,
          createdAt: new Date(base),
        },
        {
          matchId: created.id,
          userId: away.team.ownerId,
          teamId: away.teamId,
          team: away.team.name,
          createdAt: new Date(base + 1000),
        },
      ],
    });
    return created;
  });

  // 2. SPP par joueur AVANT recordLeagueMatchResult (la sequence post-match
  //    lira le SPP a jour pour proposer les level-up).
  let sppPlayersUpdated = 0;
  if (input.playerStats && input.playerStats.length > 0) {
    sppPlayersUpdated = await applyOfflinePlayerSPP(
      home.teamId,
      away.teamId,
      home.team.roster,
      away.team.roster,
      input.playerStats,
    );
  }

  // 3. Reutilise tout le pipeline : standings + ELO + pairing played +
  //    completion saison + sequence post-match (level-up).
  const recorded = await recordLeagueMatchResult({
    matchId: match.id,
    scoreA: input.scoreHome,
    scoreB: input.scoreAway,
    casualtiesA: input.casualtiesHome,
    casualtiesB: input.casualtiesAway,
  });

  if ("skipped" in recorded) {
    serverLog.error(
      `[league-offline-result] recordLeagueMatchResult skipped (${recorded.reason}) match=${match.id}`,
    );
    return { skipped: true, reason: "record-failed" };
  }

  // Economie post-match (winnings / dedicated fans) saisie a la main.
  await applyOfflineEconomy(
    { teamId: home.teamId, dedicatedFans: home.team.dedicatedFans },
    { teamId: away.teamId, dedicatedFans: away.team.dedicatedFans },
    input,
  );

  const winner: OfflineResultWinner =
    recorded.winner === "A" ? "home" : recorded.winner === "B" ? "away" : "draw";

  serverLog.info(
    `[league-offline-result] pairing=${pairing.id} match=${match.id} ${input.scoreHome}-${input.scoreAway} winner=${winner} spp=${sppPlayersUpdated}`,
  );

  return {
    recorded: true,
    pairingId: pairing.id,
    matchId: match.id,
    winner,
    sppPlayersUpdated,
  };
}
