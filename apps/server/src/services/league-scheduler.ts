/**
 * L2.A.2 — Orchestration du calendrier d'une saison de ligue.
 *
 * Sprint Ligues v2 : branche le generateur round-robin pur
 * (`league-schedule.ts`) sur la persistance Prisma. Cree les
 * `LeagueRound` + `LeaguePairing` correspondants en une transaction,
 * puis fait basculer la saison de `scheduled` -> `in_progress`.
 *
 * Contrats :
 *  - `startSeason(seasonId, opts)` :
 *      * status saison doit etre `draft` ou `scheduled`
 *      * minimum 2 participants `active`
 *      * idempotent partiel : refuse si des pairings existent deja
 *        (utiliser `regenerateSchedule` pour recreer)
 *      * passe la saison a `in_progress` apres la creation reussie
 *  - `regenerateSchedule(seasonId)` :
 *      * autorise tant qu'aucun match n'a encore ete joue
 *        (`Match.leagueScoredAt = null` pour tous les matchs lies)
 *      * supprime les pairings + rounds existants et reconstruit
 *  - `requireLeagueCreator(userId, seasonId)` : helper d'autorisation
 *    utilise par les routes admin pour verifier que l'appelant est
 *    bien le createur de la ligue.
 *
 * Le pairing genere a un `homeParticipantId / awayParticipantId` qui
 * pointent sur des `LeagueParticipant.id` (pas des teamId), ce qui
 * permet aux pairings de survivre a un retrait d'equipe (`withdrawn`)
 * sans rompre les FK.
 */

import { prisma } from "../prisma";
import { generateRoundRobin, type RoundRobinRound } from "./league-schedule";
import { notifyParticipantsOfFirstRound } from "./league-round-reminder";
import { persistSeasonAwards } from "./league-scoring";
import { serverLog } from "../utils/server-log";

export interface StartSeasonOptions {
  /**
   * Si true, double round-robin (home/away inverses sur le 2e tour).
   * Default : false (single round-robin uniquement).
   */
  readonly doubleRoundRobin?: boolean;
  /**
   * Date de debut du round 1 (optionnel). Sert de base pour
   * `LeagueRound.startDate`. Les rounds suivants n'ont pas de date
   * automatique : c'est au creator d'editer la saison s'il veut un
   * etalement temporel (out of scope L2.A.2).
   */
  readonly firstRoundStartDate?: Date | null;
  /**
   * Deadline par round (en jours apres `firstRoundStartDate`). Si
   * fourni, alimente `LeaguePairing.deadlineAt` pour permettre au cron
   * de forfait (L2.A.11) de fonctionner. Default : null (pas de
   * forfait automatique).
   */
  readonly roundDurationDays?: number | null;
}

export interface StartSeasonResult {
  readonly seasonId: string;
  readonly roundsCreated: number;
  readonly pairingsCreated: number;
  readonly status: "in_progress";
}

const ALLOWED_START_STATUSES = new Set(["draft", "scheduled"]);

function ensureSeasonStartable(status: string): void {
  if (!ALLOWED_START_STATUSES.has(status)) {
    throw new Error(
      `La saison ne peut pas etre demarree depuis le status '${status}' (attendu : draft ou scheduled)`,
    );
  }
}

function computeRoundDates(
  baseStart: Date | null,
  durationDays: number | null,
  roundIndex: number,
): { startDate: Date | null; endDate: Date | null } {
  if (!baseStart || !durationDays || durationDays <= 0) {
    return { startDate: null, endDate: null };
  }
  const startMs = baseStart.getTime() + roundIndex * durationDays * 86400000;
  const endMs = startMs + durationDays * 86400000;
  return {
    startDate: new Date(startMs),
    endDate: new Date(endMs),
  };
}

/**
 * Verifie que `userId` est bien le createur de la ligue dont depend
 * la saison `seasonId`. Renvoie l'objet saison + league pour
 * eviter de re-fetch dans le handler. Throws `'forbidden'` ou
 * `'season-not-found'` selon le cas — les handlers convertissent en
 * 403 / 404.
 */
export async function requireLeagueCreator(
  userId: string,
  seasonId: string,
): Promise<{
  seasonId: string;
  leagueId: string;
  status: string;
  creatorId: string;
}> {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      status: true,
      league: { select: { id: true, creatorId: true } },
    },
  });
  if (!season) {
    throw new Error("season-not-found");
  }
  if (season.league.creatorId !== userId) {
    throw new Error("forbidden");
  }
  return {
    seasonId: season.id,
    leagueId: season.league.id,
    status: season.status,
    creatorId: season.league.creatorId,
  };
}

/**
 * Liste les participants `active` d'une saison, ordonne par
 * `joinedAt ASC` pour rendre la generation deterministe (meme entree
 * -> meme calendrier).
 */
async function listActiveParticipantIds(seasonId: string): Promise<string[]> {
  const rows = await prisma.leagueParticipant.findMany({
    where: { seasonId, status: "active" },
    orderBy: { joinedAt: "asc" },
    select: { id: true },
  });
  return rows.map((r: { id: string }) => r.id);
}

async function hasExistingSchedule(seasonId: string): Promise<boolean> {
  const count = await prisma.leagueRound.count({
    where: { seasonId },
  });
  return count > 0;
}

async function persistRoundsAndPairings(
  seasonId: string,
  generated: readonly RoundRobinRound[],
  baseStart: Date | null,
  durationDays: number | null,
): Promise<{ roundsCreated: number; pairingsCreated: number }> {
  let roundsCreated = 0;
  let pairingsCreated = 0;

  // Sequentiel (et non `Promise.all`) pour preserver l'ordre des rounds
  // et garantir la coherence si la transaction echoue a mi-chemin.
  for (let i = 0; i < generated.length; i += 1) {
    const round = generated[i];
    const { startDate, endDate } = computeRoundDates(
      baseStart,
      durationDays,
      i,
    );
    const created = await prisma.leagueRound.create({
      data: {
        seasonId,
        roundNumber: round.roundNumber,
        name: `Journee ${round.roundNumber}`,
        status: "pending",
        startDate,
        endDate,
      },
      select: { id: true },
    });
    roundsCreated += 1;

    if (round.pairings.length === 0) {
      continue;
    }
    await prisma.leaguePairing.createMany({
      data: round.pairings.map((p) => ({
        roundId: created.id,
        homeParticipantId: p.home,
        awayParticipantId: p.away,
        status: "scheduled",
        scheduledAt: startDate,
        deadlineAt: endDate,
      })),
    });
    pairingsCreated += round.pairings.length;
  }

  return { roundsCreated, pairingsCreated };
}

/**
 * Demarre une saison : genere le calendrier round-robin a partir des
 * participants actifs, persiste rounds + pairings, et passe la saison
 * a `in_progress`.
 */
export async function startSeason(
  seasonId: string,
  opts: StartSeasonOptions = {},
): Promise<StartSeasonResult> {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, status: true },
  });
  if (!season) {
    throw new Error(`Saison introuvable: ${seasonId}`);
  }
  ensureSeasonStartable(season.status);

  if (await hasExistingSchedule(seasonId)) {
    throw new Error(
      "Calendrier deja genere pour cette saison. Utiliser regenerateSchedule pour recreer.",
    );
  }

  const participantIds = await listActiveParticipantIds(seasonId);
  if (participantIds.length < 2) {
    throw new Error(
      `Au moins 2 participants actifs requis (${participantIds.length} trouves)`,
    );
  }

  const generated = generateRoundRobin({
    participantIds,
    doubleRoundRobin: opts.doubleRoundRobin ?? false,
  });
  const baseStart = opts.firstRoundStartDate ?? null;
  const durationDays = opts.roundDurationDays ?? null;

  const { roundsCreated, pairingsCreated } = await persistRoundsAndPairings(
    seasonId,
    generated,
    baseStart,
    durationDays,
  );

  await prisma.leagueSeason.update({
    where: { id: seasonId },
    data: { status: "in_progress" },
  });

  // L2.A.12 — fire-and-forget : push reminder a chaque coach implique
  // dans un pairing du round 1. Echec non-bloquant : on log mais on
  // ne propage pas pour ne pas faire echouer le startSeason si un
  // user n'a pas de subscription push.
  notifyParticipantsOfFirstRound({ seasonId })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "unknown";
      serverLog.error(`[league-scheduler] notifyFirstRound failed: ${msg}`);
    });

  return {
    seasonId,
    roundsCreated,
    pairingsCreated,
    status: "in_progress",
  };
}

/**
 * Regenere le calendrier d'une saison. Refuse si un match a deja ete
 * compte (`leagueScoredAt != null`) pour ne jamais detruire un
 * resultat. Si aucun match joue, supprime tous les pairings + rounds
 * existants puis reconstruit.
 */
export async function regenerateSchedule(
  seasonId: string,
  opts: StartSeasonOptions = {},
): Promise<StartSeasonResult> {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, status: true },
  });
  if (!season) {
    throw new Error(`Saison introuvable: ${seasonId}`);
  }
  if (season.status === "completed") {
    throw new Error("Saison terminee : regeneration interdite");
  }

  const playedMatches = await prisma.match.count({
    where: {
      leagueSeasonId: seasonId,
      leagueScoredAt: { not: null },
    },
  });
  if (playedMatches > 0) {
    throw new Error(
      `Impossible de regenerer : ${playedMatches} match(s) deja comptabilise(s) dans cette saison`,
    );
  }

  // `LeaguePairing` est en cascade sur `LeagueRound`, donc supprimer
  // les rounds vide aussi les pairings. Les Match.leaguePairingId
  // tombent en SET NULL (FK schema) — coherent puisqu'aucun match
  // n'a encore ete compte (verifie ci-dessus).
  await prisma.leagueRound.deleteMany({ where: { seasonId } });

  const participantIds = await listActiveParticipantIds(seasonId);
  if (participantIds.length < 2) {
    throw new Error(
      `Au moins 2 participants actifs requis (${participantIds.length} trouves)`,
    );
  }

  const generated = generateRoundRobin({
    participantIds,
    doubleRoundRobin: opts.doubleRoundRobin ?? false,
  });
  const baseStart = opts.firstRoundStartDate ?? null;
  const durationDays = opts.roundDurationDays ?? null;

  const { roundsCreated, pairingsCreated } = await persistRoundsAndPairings(
    seasonId,
    generated,
    baseStart,
    durationDays,
  );

  // Si la saison etait deja `in_progress` (rare cas : regen avant tout
  // match joue), on conserve ce statut. Sinon on la passe en
  // `in_progress` puisqu'un calendrier est desormais publie.
  await prisma.leagueSeason.update({
    where: { id: seasonId },
    data: { status: "in_progress" },
  });

  return {
    seasonId,
    roundsCreated,
    pairingsCreated,
    status: "in_progress",
  };
}

/**
 * Bascule une saison `draft` -> `scheduled` (inscriptions ouvertes
 * mais calendrier non genere). No-op si deja `scheduled`.
 */
export async function openSeasonForRegistration(
  seasonId: string,
): Promise<void> {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, status: true },
  });
  if (!season) {
    throw new Error(`Saison introuvable: ${seasonId}`);
  }
  if (season.status === "scheduled") {
    return;
  }
  if (season.status !== "draft") {
    throw new Error(
      `Impossible d'ouvrir les inscriptions depuis le status '${season.status}'`,
    );
  }
  await prisma.leagueSeason.update({
    where: { id: seasonId },
    data: { status: "scheduled" },
  });
}

/**
 * Force la cloture d'une saison (admin). Met les pairings non joues
 * en `cancelled` et passe la saison en `completed`. Ne touche pas aux
 * pairings deja `played` ou `forfeit_*`.
 */
export async function closeSeason(seasonId: string): Promise<void> {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, status: true },
  });
  if (!season) {
    throw new Error(`Saison introuvable: ${seasonId}`);
  }
  if (season.status === "completed") {
    return;
  }

  await prisma.leaguePairing.updateMany({
    where: {
      round: { seasonId },
      status: { in: ["scheduled", "in_progress"] },
    },
    data: { status: "cancelled" },
  });
  await prisma.leagueRound.updateMany({
    where: { seasonId, status: { not: "completed" } },
    data: { status: "completed" },
  });
  await prisma.leagueSeason.update({
    where: { id: seasonId },
    data: { status: "completed" },
  });

  // L2.C.1 — fire-and-forget : snapshot d'awards de fin de saison.
  // closeSeason est l'admin path (force close), il faut aussi
  // creer le snapshot a ce moment. Idempotent via seasonId @unique.
  persistSeasonAwards(seasonId).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.error(`[closeSeason] persistSeasonAwards failed: ${msg}`);
  });
}
