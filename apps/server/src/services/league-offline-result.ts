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
 * Stats PAR JOUEUR (TD/CAS/MVP/passes/interceptions) appliquees AVANT
 * `recordLeagueMatchResult` (SPP + totaux carriere + matchesPlayed). Comme le
 * SPP est persiste avant, la sequence post-match voit le SPP a jour et propose
 * les bons level-up.
 *
 * Economie (winnings -> treasury, dedicated fans clampes 1-6) et blessures
 * durables (mng/niggling/-carac/dead) sont aussi appliquees a la main.
 *
 * `missNextMatch` : les matchs offline ne passent pas par le game-engine qui,
 * en online, efface ce flag au demarrage du match suivant. On le purge donc
 * ici (`clearServedSuspensions`) pour les joueurs des 2 equipes avant de
 * re-poser les suspensions issues des blessures de CE match.
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
import { OFFLINE_MATCH_MODE } from "./match-modes";

/** Mode pose sur le Match synthetique pour le distinguer des matchs joues. */
export { OFFLINE_MATCH_MODE };

export interface OfflinePlayerStatInput {
  readonly teamPlayerId: string;
  readonly touchdowns?: number;
  readonly casualties?: number;
  readonly completions?: number;
  readonly interceptions?: number;
  readonly mvp?: boolean;
}

/**
 * Resultat de blessure durable BB applique a un joueur :
 *  - `mng`      : Seriously Hurt -> rate le prochain match.
 *  - `niggling` : Serious Injury -> +1 niggling (+ MNG).
 *  - `ma/st/ag/pa/av` : Lasting Injury -> -1 carac correspondante (+ MNG).
 *  - `dead`     : joueur tue.
 */
export type OfflineInjuryType =
  | "mng"
  | "niggling"
  | "ma"
  | "st"
  | "ag"
  | "pa"
  | "av"
  | "dead";

export interface OfflineInjuryInput {
  readonly teamPlayerId: string;
  readonly type: OfflineInjuryType;
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
  /** Blessures durables par joueur (optionnel). */
  readonly injuries?: readonly OfflineInjuryInput[];
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

/** Map un type de blessure offline -> update Prisma TeamPlayer. */
function injuryUpdateData(type: OfflineInjuryType): Record<string, unknown> {
  switch (type) {
    case "mng":
      return { missNextMatch: true };
    case "niggling":
      return { missNextMatch: true, nigglingInjuries: { increment: 1 } };
    case "ma":
      return { missNextMatch: true, maReduction: { increment: 1 } };
    case "st":
      return { missNextMatch: true, stReduction: { increment: 1 } };
    case "ag":
      return { missNextMatch: true, agReduction: { increment: 1 } };
    case "pa":
      return { missNextMatch: true, paReduction: { increment: 1 } };
    case "av":
      return { missNextMatch: true, avReduction: { increment: 1 } };
    case "dead":
      return { dead: true };
  }
}

/**
 * Purge le flag `missNextMatch` des joueurs (non morts) des 2 equipes : ils
 * viennent de disputer ce match offline, donc toute suspension anterieure est
 * consideree comme purgee.
 *
 * Mirror de `match-start.ts` cote online (qui efface `missNextMatch` au demarrage
 * du match suivant). Les matchs offline ne passant PAS par le game-engine, sans
 * ce purge un joueur suspendu en offline resterait suspendu a vie.
 *
 * IMPORTANT : a appeler AVANT `applyOfflineInjuries`, qui peut re-poser
 * `missNextMatch` pour les blessures encaissees DANS ce match (suspension du
 * match suivant).
 */
async function clearServedSuspensions(
  homeTeamId: string,
  awayTeamId: string,
): Promise<void> {
  await prisma.teamPlayer.updateMany({
    where: {
      teamId: { in: [homeTeamId, awayTeamId] },
      missNextMatch: true,
      dead: false,
    },
    data: { missNextMatch: false },
  });
}

/**
 * Applique les blessures durables saisies a la main. Valide que chaque
 * joueur appartient bien a l'une des deux equipes du match (securite).
 * Retourne le nombre de joueurs blesses.
 */
async function applyOfflineInjuries(
  homeTeamId: string,
  awayTeamId: string,
  injuries: readonly OfflineInjuryInput[],
): Promise<number> {
  const ids = injuries.map((i) => i.teamPlayerId);
  const valid = await prisma.teamPlayer.findMany({
    where: { id: { in: ids }, teamId: { in: [homeTeamId, awayTeamId] } },
    select: { id: true },
  });
  const validSet = new Set(valid.map((p: { id: string }) => p.id));
  const ops: Promise<unknown>[] = [];
  for (const inj of injuries) {
    if (!validSet.has(inj.teamPlayerId)) continue;
    ops.push(
      prisma.teamPlayer.update({
        where: { id: inj.teamPlayerId },
        data: injuryUpdateData(inj.type),
      }),
    );
  }
  if (ops.length > 0) await prisma.$transaction(ops);
  return ops.length;
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

  // Purge les suspensions purgees par ce match (joueurs des 2 equipes) AVANT
  // d'appliquer les nouvelles blessures, qui peuvent re-poser missNextMatch.
  await clearServedSuspensions(home.teamId, away.teamId);

  // Blessures durables saisies a la main.
  if (input.injuries && input.injuries.length > 0) {
    await applyOfflineInjuries(home.teamId, away.teamId, input.injuries);
  }

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
