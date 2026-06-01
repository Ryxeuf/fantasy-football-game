/**
 * Workstream ligue offline — REVERSION d'un resultat saisi a la main.
 *
 * Le createur d'une ligue peut corriger une erreur de saisie. Comme la saisie
 * applique des *increments* irreversibles "a l'aveugle" (standings, SPP, eco,
 * blessures) et peut declencher des effets en aval (level-up, completion de
 * round), l'edition = **annuler la saisie puis re-saisir** (cf.
 * `editOfflineLeagueResult`, W-B3).
 *
 * Ce module fournit la brique d'annulation `reverseOfflineLeagueResult` :
 * elle relit le snapshot persiste (`Match.offlineResultInput`, W-B1), verifie
 * des **garde-fous** (refus si un effet a deja ete consomme), puis inverse
 * exactement les effets et supprime le Match synthetique.
 *
 * Garde-fous (refus de reversion) :
 *  - saison clôturee / playoffs generes (le classement final est fige) ;
 *  - un joueur a deja **consomme** un level-up issu de ce match ;
 *  - une blessure `dead` a ete appliquee (on ne ressuscite pas un joueur).
 */

import { prisma } from "../prisma";
import {
  parseOfflineSnapshot,
  recordOfflineLeagueResult,
  OFFLINE_MATCH_MODE,
  type OfflineInjuryType,
  type OfflineResultSnapshot,
  type RecordOfflineResultInput,
  type RecordOfflineResultOutcome,
} from "./league-offline-result";
import {
  calculatePlayerSPP,
  loadLeagueSPPContext,
  type PlayerMatchStats,
} from "./spp-tracking";
import { serverLog } from "../utils/server-log";

export type ReverseOfflineSkipReason =
  | "match-missing"
  | "not-offline-match"
  | "not-scored"
  | "snapshot-missing"
  | "pairing-missing"
  | "season-completed"
  | "playoffs-generated"
  | "injury-dead"
  | "advancement-consumed";

export type ReverseOfflineOutcome =
  | { readonly reversed: true; readonly matchId: string; readonly pairingId: string }
  | { readonly skipped: true; readonly reason: ReverseOfflineSkipReason };

interface PendingChoiceLite {
  readonly teamPlayerId: string;
  readonly advancementsTaken: number;
}

/** Compte tolerant des advancements d'un joueur (array PG / string sqlite). */
function advancementsCount(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

function parsePendingChoices(raw: unknown): PendingChoiceLite[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: PendingChoiceLite[] = [];
  for (const c of arr) {
    if (
      c &&
      typeof c === "object" &&
      typeof (c as { teamPlayerId?: unknown }).teamPlayerId === "string"
    ) {
      out.push({
        teamPlayerId: (c as { teamPlayerId: string }).teamPlayerId,
        advancementsTaken:
          typeof (c as { advancementsTaken?: unknown }).advancementsTaken ===
          "number"
            ? (c as { advancementsTaken: number }).advancementsTaken
            : 0,
      });
    }
  }
  return out;
}

function winnerOf(home: number, away: number): "home" | "away" | "draw" {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

interface Bareme {
  readonly winPoints: number;
  readonly drawPoints: number;
  readonly lossPoints: number;
}

function pointsFor(
  winner: "home" | "away" | "draw",
  side: "home" | "away",
  b: Bareme,
): number {
  if (winner === "draw") return b.drawPoints;
  return winner === side ? b.winPoints : b.lossPoints;
}

/** Inverse de `injuryUpdateData` : decremente les compteurs poses par ce match. */
function injuryReverseData(type: OfflineInjuryType): Record<string, unknown> {
  switch (type) {
    case "mng":
      return { missNextMatch: false };
    case "niggling":
      return { missNextMatch: false, nigglingInjuries: { decrement: 1 } };
    case "ma":
      return { missNextMatch: false, maReduction: { decrement: 1 } };
    case "st":
      return { missNextMatch: false, stReduction: { decrement: 1 } };
    case "ag":
      return { missNextMatch: false, agReduction: { decrement: 1 } };
    case "pa":
      return { missNextMatch: false, paReduction: { decrement: 1 } };
    case "av":
      return { missNextMatch: false, avReduction: { decrement: 1 } };
    case "dead":
      // Garde-fou en amont : on ne reverse jamais une mort.
      return {};
  }
}

/**
 * Annule tous les effets d'un resultat offline et supprime le Match
 * synthetique. Idempotent quant aux garde-fous (refus si effet consomme).
 */
export async function reverseOfflineLeagueResult(
  matchId: string,
): Promise<ReverseOfflineOutcome> {
  const match = (await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      mode: true,
      leagueScoredAt: true,
      leaguePairingId: true,
      leagueRoundId: true,
      leagueSeasonId: true,
      offlineResultInput: true,
      leaguePostMatchSequence: { select: { pendingChoices: true } },
      leagueSeason: {
        select: {
          status: true,
          league: {
            select: {
              winPoints: true,
              drawPoints: true,
              lossPoints: true,
            },
          },
        },
      },
      leagueRound: { select: { id: true, status: true } },
    },
  })) as {
    id: string;
    mode: string;
    leagueScoredAt: Date | null;
    leaguePairingId: string | null;
    leagueRoundId: string | null;
    leagueSeasonId: string | null;
    offlineResultInput: unknown;
    leaguePostMatchSequence: { pendingChoices: unknown } | null;
    leagueSeason: {
      status: string;
      league: { winPoints: number; drawPoints: number; lossPoints: number };
    } | null;
    leagueRound: { id: string; status: string } | null;
  } | null;

  if (!match) return { skipped: true, reason: "match-missing" };
  if (match.mode !== OFFLINE_MATCH_MODE) {
    return { skipped: true, reason: "not-offline-match" };
  }
  if (!match.leagueScoredAt) return { skipped: true, reason: "not-scored" };
  if (!match.leaguePairingId || !match.leagueSeasonId || !match.leagueSeason) {
    return { skipped: true, reason: "pairing-missing" };
  }

  const snapshot = parseOfflineSnapshot(match.offlineResultInput);
  if (!snapshot) return { skipped: true, reason: "snapshot-missing" };

  // Garde-fou : saison clôturee -> classement final fige.
  if (match.leagueSeason.status === "completed") {
    return { skipped: true, reason: "season-completed" };
  }
  // Garde-fou : playoffs generes.
  const playoffRounds = await prisma.leagueRound.count({
    where: { seasonId: match.leagueSeasonId, kind: "playoff" },
  });
  if (playoffRounds > 0) {
    return { skipped: true, reason: "playoffs-generated" };
  }
  // Garde-fou : une mort ne se reverse pas.
  if (snapshot.input.injuries.some((i) => i.type === "dead")) {
    return { skipped: true, reason: "injury-dead" };
  }

  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: match.leaguePairingId },
    select: {
      id: true,
      homeParticipant: {
        select: {
          id: true,
          teamId: true,
          team: { select: { roster: true } },
        },
      },
      awayParticipant: {
        select: {
          id: true,
          teamId: true,
          team: { select: { roster: true } },
        },
      },
    },
  })) as {
    id: string;
    homeParticipant: {
      id: string;
      teamId: string;
      team: { roster: string };
    } | null;
    awayParticipant: {
      id: string;
      teamId: string;
      team: { roster: string };
    } | null;
  } | null;

  if (!pairing || !pairing.homeParticipant || !pairing.awayParticipant) {
    return { skipped: true, reason: "pairing-missing" };
  }
  const home = pairing.homeParticipant;
  const away = pairing.awayParticipant;

  // Garde-fou : level-up deja consomme issu de ce match.
  const choices = parsePendingChoices(
    match.leaguePostMatchSequence?.pendingChoices,
  );
  if (choices.length > 0) {
    const players = (await prisma.teamPlayer.findMany({
      where: { id: { in: choices.map((c) => c.teamPlayerId) } },
      select: { id: true, advancements: true },
    })) as Array<{ id: string; advancements: unknown }>;
    const countById = new Map<string, number>(
      players.map((p) => [p.id, advancementsCount(p.advancements)]),
    );
    const consumed = choices.some(
      (c) => (countById.get(c.teamPlayerId) ?? 0) > c.advancementsTaken,
    );
    if (consumed) {
      return { skipped: true, reason: "advancement-consumed" };
    }
  }

  // --- Reversion ---
  const { input } = snapshot;
  const winner = winnerOf(input.scoreHome, input.scoreAway);
  const bareme = match.leagueSeason.league;
  const pointsHome = pointsFor(winner, "home", bareme);
  const pointsAway = pointsFor(winner, "away", bareme);

  // Recompute le SPP gagne par joueur (meme modifier que la saisie) pour le
  // decrementer exactement.
  const sppOps: Array<{ id: string; earned: number; stats: PlayerMatchStats }> =
    [];
  if (input.playerStats.length > 0) {
    const context = await loadLeagueSPPContext(prisma, {
      isLeagueMatch: true,
      teamARoster: home.team.roster,
      teamBRoster: away.team.roster,
    });
    const ids = input.playerStats.map((s) => s.teamPlayerId);
    const owned = (await prisma.teamPlayer.findMany({
      where: { id: { in: ids } },
      select: { id: true, teamId: true },
    })) as Array<{ id: string; teamId: string }>;
    const teamById = new Map<string, string>(owned.map((p) => [p.id, p.teamId]));
    for (const s of input.playerStats) {
      const teamId = teamById.get(s.teamPlayerId);
      if (teamId !== home.teamId && teamId !== away.teamId) continue;
      const modifier = teamId === home.teamId ? context.teamA : context.teamB;
      const stats: PlayerMatchStats = {
        touchdowns: s.touchdowns ?? 0,
        casualties: s.casualties ?? 0,
        completions: s.completions ?? 0,
        interceptions: s.interceptions ?? 0,
        mvp: s.mvp ?? false,
      };
      sppOps.push({
        id: s.teamPlayerId,
        earned: calculatePlayerSPP(stats, modifier),
        stats,
      });
    }
  }

  const ops: Promise<unknown>[] = [];

  // 1. Standings (decrement). ELO non touche (skipSeasonElo a la saisie).
  ops.push(
    prisma.leagueParticipant.update({
      where: { id: home.id },
      data: {
        wins: { decrement: winner === "home" ? 1 : 0 },
        draws: { decrement: winner === "draw" ? 1 : 0 },
        losses: { decrement: winner === "away" ? 1 : 0 },
        points: { decrement: pointsHome },
        touchdownsFor: { decrement: input.scoreHome },
        touchdownsAgainst: { decrement: input.scoreAway },
        casualtiesFor: { decrement: input.casualtiesHome },
        casualtiesAgainst: { decrement: input.casualtiesAway },
      },
    }),
    prisma.leagueParticipant.update({
      where: { id: away.id },
      data: {
        wins: { decrement: winner === "away" ? 1 : 0 },
        draws: { decrement: winner === "draw" ? 1 : 0 },
        losses: { decrement: winner === "home" ? 1 : 0 },
        points: { decrement: pointsAway },
        touchdownsFor: { decrement: input.scoreAway },
        touchdownsAgainst: { decrement: input.scoreHome },
        casualtiesFor: { decrement: input.casualtiesAway },
        casualtiesAgainst: { decrement: input.casualtiesHome },
      },
    }),
  );

  // 2. SPP par joueur (decrement exact).
  for (const op of sppOps) {
    ops.push(
      prisma.teamPlayer.update({
        where: { id: op.id },
        data: {
          spp: { decrement: op.earned },
          totalTouchdowns: { decrement: op.stats.touchdowns },
          totalCasualties: { decrement: op.stats.casualties },
          totalCompletions: { decrement: op.stats.completions },
          totalInterceptions: { decrement: op.stats.interceptions },
          totalMvpAwards: { decrement: op.stats.mvp ? 1 : 0 },
          matchesPlayed: { decrement: 1 },
        },
      }),
    );
  }

  // 3. Economie : treasury (decrement) + dedicatedFans restaure (pre-valeur).
  ops.push(
    prisma.team.update({
      where: { id: home.teamId },
      data: {
        treasury: { decrement: input.winningsHome },
        dedicatedFans: snapshot.dedicatedFansBefore.home,
      },
    }),
    prisma.team.update({
      where: { id: away.teamId },
      data: {
        treasury: { decrement: input.winningsAway },
        dedicatedFans: snapshot.dedicatedFansBefore.away,
      },
    }),
  );

  // 4. Blessures (decrement compteurs + missNextMatch=false).
  for (const inj of input.injuries) {
    ops.push(
      prisma.teamPlayer.update({
        where: { id: inj.teamPlayerId },
        data: injuryReverseData(inj.type),
      }),
    );
  }

  // 5. Suppression du Match synthetique : d'abord les TeamSelection (pas de
  //    cascade), puis le Match (cascade la post-match-sequence).
  ops.push(
    prisma.teamSelection.deleteMany({ where: { matchId: match.id } }),
    prisma.match.delete({ where: { id: match.id } }),
  );

  // 6. Re-ouverture du pairing + du round si la saisie l'avait clôture.
  ops.push(
    prisma.leaguePairing.update({
      where: { id: pairing.id },
      data: { status: "scheduled" },
    }),
  );
  if (match.leagueRound && match.leagueRound.status === "completed") {
    ops.push(
      prisma.leagueRound.update({
        where: { id: match.leagueRound.id },
        data: { status: "scheduled" },
      }),
    );
  }

  await prisma.$transaction(ops);

  serverLog.info(
    `[league-offline-edit] reversed match=${match.id} pairing=${pairing.id} ${input.scoreHome}-${input.scoreAway}`,
  );

  return { reversed: true, matchId: match.id, pairingId: pairing.id };
}

export type EditOfflineOutcome =
  | RecordOfflineResultOutcome
  | {
      readonly skipped: true;
      readonly reason: ReverseOfflineSkipReason | "no-existing-result";
    };

/**
 * Edite un resultat offline deja saisi : annule la saisie existante puis
 * re-saisit la nouvelle. Reuse integralement `recordOfflineLeagueResult` pour
 * la re-application (aucune duplication de logique).
 *
 * Note : reverse + record sont deux transactions distinctes. Si la
 * re-saisie echoue apres une reversion reussie, le pairing est simplement
 * re-ouvert (status `scheduled`) sans resultat — etat recuperable (le
 * createur peut ressaisir).
 */
export async function editOfflineLeagueResult(
  input: RecordOfflineResultInput,
): Promise<EditOfflineOutcome> {
  const existing = (await prisma.match.findFirst({
    where: { leaguePairingId: input.pairingId, mode: OFFLINE_MATCH_MODE },
    select: { id: true },
  })) as { id: string } | null;
  if (!existing) return { skipped: true, reason: "no-existing-result" };

  const reversed = await reverseOfflineLeagueResult(existing.id);
  if ("skipped" in reversed) return reversed;

  return recordOfflineLeagueResult(input);
}
