/**
 * Workstream ligue offline — saisie manuelle d'un resultat de match joue
 * hors-ligne (tabletop), facon regles officielles BB / sites type
 * mordorbihan.
 *
 * Permet de comptabiliser un resultat (score TD + casualties par equipe)
 * SANS passer par le game-engine, en miroir de `recordForfeit`, mais avec
 * un vrai score saisi a la main. Met a jour les compteurs materialises du
 * LeagueParticipant (W/D/L, points, TD, CAS) ET l'ELO saisonnier (a la
 * difference d'un forfait qui reste neutre cote ELO), bascule le pairing
 * en `played`, puis complete round / saison / playoffs via le meme helper
 * que le forfait.
 *
 * Limites (Phase 1) : pas de stats par joueur (SPP / level-up), ni de
 * winnings / blessures / fan factor — ces etapes necessitent la sequence
 * post-match alimentee par des stats joueur et seront ajoutees dans une
 * phase ulterieure. Ici on couvre le coeur : standings + ELO + avancement
 * du calendrier, suffisant pour suivre une saison entiere en offline.
 *
 * Idempotence : un pairing deja terminal (`played` / `forfeit_*` /
 * `cancelled`) ou un match deja comptabilise (`leagueScoredAt`) est ignore.
 */

import { prisma } from "../prisma";
import {
  calculateSeasonEloChange,
  clampSeasonElo,
  isInPlacement,
  type SeasonMatchOutcome,
} from "./season-elo";
import { maybeCompleteRoundAndSeason } from "./league-forfeit";
import { advancePlayoffsWithWinner } from "./league-playoffs";
import { serverLog } from "../utils/server-log";

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
}

export type OfflineResultWinner = "home" | "away" | "draw";

export type RecordOfflineResultOutcome =
  | {
      readonly recorded: true;
      readonly pairingId: string;
      readonly winner: OfflineResultWinner;
    }
  | {
      readonly skipped: true;
      readonly reason:
        | "pairing-missing"
        | "pairing-not-terminal-eligible"
        | "match-already-scored"
        | "participant-missing"
        | "season-missing";
    };

const NON_TERMINAL = new Set(["scheduled", "in_progress"]);

interface ParticipantEloState {
  id: string;
  seasonElo: number;
  wins: number;
  draws: number;
  losses: number;
}

async function loadBareme(
  seasonId: string,
): Promise<{ winPoints: number; drawPoints: number; lossPoints: number } | null> {
  const row = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: {
      league: {
        select: { winPoints: true, drawPoints: true, lossPoints: true },
      },
    },
  });
  return row?.league ?? null;
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
          seasonElo: true,
          wins: true,
          draws: true,
          losses: true,
        },
      },
      awayParticipant: {
        select: {
          id: true,
          seasonElo: true,
          wins: true,
          draws: true,
          losses: true,
        },
      },
    },
  })) as {
    id: string;
    status: string;
    match: { id: string; leagueScoredAt: Date | null } | null;
    round: { id: string; seasonId: string };
    homeParticipant: ParticipantEloState | null;
    awayParticipant: ParticipantEloState | null;
  } | null;

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

  const seasonId = pairing.round.seasonId;
  const bareme = await loadBareme(seasonId);
  if (!bareme) return { skipped: true, reason: "season-missing" };

  const home = pairing.homeParticipant;
  const away = pairing.awayParticipant;

  const winner: OfflineResultWinner =
    input.scoreHome > input.scoreAway
      ? "home"
      : input.scoreAway > input.scoreHome
        ? "away"
        : "draw";

  const pointsHome =
    winner === "draw"
      ? bareme.drawPoints
      : winner === "home"
        ? bareme.winPoints
        : bareme.lossPoints;
  const pointsAway =
    winner === "draw"
      ? bareme.drawPoints
      : winner === "away"
        ? bareme.winPoints
        : bareme.lossPoints;

  // ELO saisonnier : un match joue (contrairement au forfait neutre).
  // Snapshot calcule AVANT l'update des compteurs (placement base sur le
  // nombre de matchs courant).
  const seasonOutcome: SeasonMatchOutcome =
    winner === "home" ? "win" : winner === "away" ? "loss" : "draw";
  const { deltaA: deltaHome, deltaB: deltaAway } = calculateSeasonEloChange({
    ratingA: home.seasonElo,
    ratingB: away.seasonElo,
    outcome: seasonOutcome,
    inPlacementA: isInPlacement(home),
    inPlacementB: isInPlacement(away),
  });
  const newEloHome = clampSeasonElo(home.seasonElo + deltaHome);
  const newEloAway = clampSeasonElo(away.seasonElo + deltaAway);

  await prisma.$transaction([
    prisma.leagueParticipant.update({
      where: { id: home.id },
      data: {
        wins: { increment: winner === "home" ? 1 : 0 },
        draws: { increment: winner === "draw" ? 1 : 0 },
        losses: { increment: winner === "away" ? 1 : 0 },
        points: { increment: pointsHome },
        touchdownsFor: { increment: input.scoreHome },
        touchdownsAgainst: { increment: input.scoreAway },
        casualtiesFor: { increment: input.casualtiesHome },
        casualtiesAgainst: { increment: input.casualtiesAway },
        seasonElo: newEloHome,
      },
    }),
    prisma.leagueParticipant.update({
      where: { id: away.id },
      data: {
        wins: { increment: winner === "away" ? 1 : 0 },
        draws: { increment: winner === "draw" ? 1 : 0 },
        losses: { increment: winner === "home" ? 1 : 0 },
        points: { increment: pointsAway },
        touchdownsFor: { increment: input.scoreAway },
        touchdownsAgainst: { increment: input.scoreHome },
        casualtiesFor: { increment: input.casualtiesAway },
        casualtiesAgainst: { increment: input.casualtiesHome },
        seasonElo: newEloAway,
      },
    }),
    prisma.leaguePairing.update({
      where: { id: pairing.id },
      data: { status: "played" },
    }),
  ]);

  // Completion round / saison / playoffs (meme helper que le forfait).
  await maybeCompleteRoundAndSeason(pairing.round.id, seasonId);

  // Propagation du winner dans le bracket si pairing playoff. Non-bloquant.
  if (winner !== "draw") {
    advancePlayoffsWithWinner(pairing.id, winner).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(`[league-offline-result] advance failed: ${msg}`);
    });
  }

  serverLog.info(
    `[league-offline-result] pairing=${pairing.id} ${input.scoreHome}-${input.scoreAway} winner=${winner}`,
  );

  return { recorded: true, pairingId: pairing.id, winner };
}
