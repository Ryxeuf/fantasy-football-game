/**
 * Pro League scheduler — sprint Pro League lot 1.A.3.
 *
 * Au démarrage d'une saison Pro League, génère le calendrier
 * round-robin entre les 16 `ProTeam` de la ligue. Avec N=16 (pair) le
 * round-robin "Berger" produit :
 *   - 15 rounds (`ProLeagueRound`)
 *   - 8 matchs/round (`ProLeagueMatch`)
 *   - 120 matchs au total
 *
 * Cadence par défaut : 1 round par semaine, mardi 21h00 (heure UTC) ;
 * paramétrable via `roundCadenceDays` (1 = quotidien pour beta testers).
 *
 * Contrats :
 *  - Idempotent : si la saison contient déjà des rounds + matchs, le
 *    service les conserve et ne crée rien (utiliser `regenerateSchedule`
 *    pour reconstruire de zéro tant qu'aucun match n'est joué).
 *  - Atomique : tout est créé en une seule transaction Prisma. Si la
 *    transaction échoue, la base reste cohérente.
 *  - Status saison : doit être `scheduled` au moment de l'appel ; après
 *    succès la saison passe à `in_progress`.
 *
 * Le service ne touche pas au sim-engine — il prépare uniquement le
 * calendrier. Le pré-sim (lot 1.A.4) consommera ces matchs.
 */

import { prisma } from "../prisma";
import { generateRoundRobin } from "./league-schedule";

/** Cadence par défaut entre deux rounds (jours). */
export const DEFAULT_ROUND_CADENCE_DAYS = 7;

/** Heure par défaut du kickoff (UTC). Mardi 21h00 = 21:00. */
export const DEFAULT_KICKOFF_HOUR_UTC = 21;

export interface BuildProLeagueScheduleInput {
  readonly seasonId: string;
  /** Date du round 1. Si null, prend "now() arrondi au prochain mardi 21h". */
  readonly firstRoundAt?: Date | null;
  /** Cadence en jours entre rounds. Default 7 (1/semaine). */
  readonly roundCadenceDays?: number;
}

export interface BuildProLeagueScheduleResult {
  readonly seasonId: string;
  readonly roundsCreated: number;
  readonly matchesCreated: number;
  readonly idempotentSkip: boolean;
}

/**
 * Renvoie le prochain mardi 21h00 UTC strictement après `from`. Utilisé
 * comme défaut pour `firstRoundAt` quand le caller ne précise pas.
 */
export function nextTuesdayKickoff(from: Date): Date {
  const d = new Date(from.getTime());
  d.setUTCHours(DEFAULT_KICKOFF_HOUR_UTC, 0, 0, 0);
  // 0 = dimanche, 1 = lundi, 2 = mardi, ...
  const targetDow = 2;
  let delta = (targetDow - d.getUTCDay() + 7) % 7;
  // Si on est mardi 21h00 pile, on glisse au mardi suivant.
  if (delta === 0 && d.getTime() <= from.getTime()) delta = 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

/**
 * Construit le calendrier complet d'une saison Pro League. Idempotent.
 */
export async function buildProLeagueSchedule(
  input: BuildProLeagueScheduleInput,
): Promise<BuildProLeagueScheduleResult> {
  const { seasonId } = input;

  const season = await prisma.proLeagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, leagueId: true, status: true },
  });
  if (!season) {
    throw new Error(`ProLeagueSeason '${seasonId}' introuvable`);
  }

  // Idempotency : si déjà des rounds + matchs, ne touche à rien.
  const existing = await prisma.proLeagueRound.count({ where: { seasonId } });
  if (existing > 0) {
    const matchesCreated = await prisma.proLeagueMatch.count({
      where: { seasonId },
    });
    return {
      seasonId,
      roundsCreated: existing,
      matchesCreated,
      idempotentSkip: true,
    };
  }

  if (season.status !== "scheduled") {
    throw new Error(
      `La saison '${seasonId}' n'est pas en status 'scheduled' (actuel: '${season.status}')`,
    );
  }

  const teams = await prisma.proTeam.findMany({
    where: { leagueId: season.leagueId },
    select: { id: true, slug: true },
    orderBy: { slug: "asc" },
  });

  if (teams.length < 2) {
    throw new Error(
      `Au moins 2 équipes requises pour générer un calendrier (trouvé : ${teams.length})`,
    );
  }

  const cadence = input.roundCadenceDays ?? DEFAULT_ROUND_CADENCE_DAYS;
  if (!Number.isInteger(cadence) || cadence <= 0) {
    throw new Error(`roundCadenceDays doit être un entier > 0 (reçu: ${cadence})`);
  }

  const baseDate =
    input.firstRoundAt ?? nextTuesdayKickoff(new Date());

  const rrRounds = generateRoundRobin({
    participantIds: teams.map((t: { id: string }) => t.id),
    doubleRoundRobin: false,
  });

  let roundsCreated = 0;
  let matchesCreated = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    for (const rr of rrRounds) {
      const scheduledAt = new Date(baseDate.getTime());
      scheduledAt.setUTCDate(
        baseDate.getUTCDate() + (rr.roundNumber - 1) * cadence,
      );

      const round = await tx.proLeagueRound.create({
        data: {
          seasonId,
          roundNumber: rr.roundNumber,
          status: "pending",
          scheduledAt,
        },
        select: { id: true },
      });
      roundsCreated += 1;

      for (const pairing of rr.pairings) {
        await tx.proLeagueMatch.create({
          data: {
            seasonId,
            roundId: round.id,
            homeTeamId: pairing.home,
            awayTeamId: pairing.away,
            status: "scheduled",
            scheduledAt,
          },
        });
        matchesCreated += 1;
      }
    }

    await tx.proLeagueSeason.update({
      where: { id: seasonId },
      data: { status: "in_progress", startsAt: baseDate },
    });
  });

  return {
    seasonId,
    roundsCreated,
    matchesCreated,
    idempotentSkip: false,
  };
}

/**
 * Reconstruit le calendrier d'une saison déjà schedulée. Refuse si
 * un match a déjà été simulé (status != 'scheduled') pour éviter
 * d'effacer des résultats.
 */
export async function regenerateProLeagueSchedule(
  input: BuildProLeagueScheduleInput,
): Promise<BuildProLeagueScheduleResult> {
  const { seasonId } = input;

  const playedCount = await prisma.proLeagueMatch.count({
    where: { seasonId, NOT: { status: "scheduled" } },
  });
  if (playedCount > 0) {
    throw new Error(
      `Impossible de régénérer le calendrier : ${playedCount} match(s) déjà simulé(s) ou en cours`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    await tx.proLeagueMatch.deleteMany({ where: { seasonId } });
    await tx.proLeagueRound.deleteMany({ where: { seasonId } });
    await tx.proLeagueSeason.update({
      where: { id: seasonId },
      data: { status: "scheduled" },
    });
  });

  return buildProLeagueSchedule(input);
}
