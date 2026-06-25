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
import {
  generateRoundRobin,
  generateMultiPoolRoundRobin,
  type RoundRobinRound,
} from "./league-schedule";
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

/**
 * Lot C.2 — Construit le calendrier (round-robin) en tenant compte
 * des poules eventuelles de la saison.
 *
 * - Si la saison n'a aucune poule : round-robin global classique.
 * - Si la saison a >= 1 poule : round-robin par poule avec journees
 *   partagees (`generateMultiPoolRoundRobin`). Les participants
 *   actifs non affectes a une poule sont regroupes dans une poule
 *   implicite "sans poule" pour ne pas les exclure du calendrier.
 *
 * Retourne aussi `participantCount` pour la validation "au moins 2".
 */
async function buildSchedule(
  seasonId: string,
  doubleRoundRobin: boolean,
): Promise<{ generated: RoundRobinRound[]; participantCount: number }> {
  const pools = (await prisma.leaguePool.findMany({
    where: { seasonId },
    orderBy: { order: "asc" },
    select: { id: true },
  })) as Array<{ id: string }>;

  // Pas de poule -> comportement historique.
  if (pools.length === 0) {
    const participantIds = await listActiveParticipantIds(seasonId);
    return {
      generated: generateRoundRobin({ participantIds, doubleRoundRobin }),
      participantCount: participantIds.length,
    };
  }

  // Mode multi-poules : groupe les participants actifs par poolId.
  const participants = (await prisma.leagueParticipant.findMany({
    where: { seasonId, status: "active" },
    orderBy: { joinedAt: "asc" },
    select: { id: true, poolId: true },
  })) as Array<{ id: string; poolId: string | null }>;

  const byPool = new Map<string, string[]>();
  for (const p of pools) byPool.set(p.id, []);
  const UNASSIGNED = "__unassigned__";
  byPool.set(UNASSIGNED, []);
  for (const part of participants) {
    const key =
      part.poolId && byPool.has(part.poolId) ? part.poolId : UNASSIGNED;
    byPool.get(key)!.push(part.id);
  }

  // Ne conserve que les poules ayant >= 1 participant (les vides sont
  // ignorees). On garde la poule "unassigned" seulement si elle a des
  // membres (>= 2 pour produire des matchs).
  const poolInputs = [...byPool.entries()]
    .filter(([, ids]) => ids.length > 0)
    .map(([poolId, participantIds]) => ({ poolId, participantIds }));

  return {
    generated: generateMultiPoolRoundRobin({
      pools: poolInputs,
      doubleRoundRobin,
    }),
    participantCount: participants.length,
  };
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
/**
 * Auto-avancement du statut de la *ligue* en reaction aux actions sur
 * ses saisons.
 *
 * Historiquement `League.status` restait fige a "draft" : `createLeague`
 * ne l'ecrit jamais et aucun chemin (hors force-status admin) ne le
 * faisait progresser. Resultat : toute ligue affichait « Brouillon » a
 * vie alors que seul `Season.status` avancait. On le fait donc avancer
 * en effet de bord des actions de saison qui existent deja.
 *
 * Echelle "forward-only" : draft < open < in_progress. `completed` et
 * `archived` sont hors echelle — pilotes manuellement par l'admin
 * (PATCH /admin/leagues/:id/status) et jamais retrogrades/ecrases ici.
 * Idempotent : no-op si la ligue est deja au niveau cible ou au-dela.
 */
const LEAGUE_STATUS_FORWARD_RANK: Record<string, number> = {
  draft: 0,
  open: 1,
  in_progress: 2,
};

async function advanceLeagueStatus(
  leagueId: string,
  target: "open" | "in_progress",
): Promise<void> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, status: true },
  });
  if (!league) return;
  const currentRank = LEAGUE_STATUS_FORWARD_RANK[league.status];
  // Statut hors echelle (completed / archived / inconnu) : on n'y touche pas.
  if (currentRank === undefined) return;
  if (currentRank >= LEAGUE_STATUS_FORWARD_RANK[target]) return;
  await prisma.league.update({
    where: { id: leagueId },
    data: { status: target },
  });
}

export async function startSeason(
  seasonId: string,
  opts: StartSeasonOptions = {},
): Promise<StartSeasonResult> {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, status: true, leagueId: true },
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

  // Lot C.2 — round-robin global ou par poule selon la config saison.
  const { generated, participantCount } = await buildSchedule(
    seasonId,
    opts.doubleRoundRobin ?? false,
  );
  if (participantCount < 2) {
    throw new Error(
      `Au moins 2 participants actifs requis (${participantCount} trouves)`,
    );
  }

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

  // Une saison qui demarre fait passer la ligue a `in_progress`
  // (depuis draft ou open). Forward-only + idempotent.
  await advanceLeagueStatus(season.leagueId, "in_progress");

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

  // Lot C.2 — round-robin global ou par poule selon la config saison.
  const { generated, participantCount } = await buildSchedule(
    seasonId,
    opts.doubleRoundRobin ?? false,
  );
  if (participantCount < 2) {
    throw new Error(
      `Au moins 2 participants actifs requis (${participantCount} trouves)`,
    );
  }

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
    select: { id: true, status: true, leagueId: true },
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

  // Ouvrir les inscriptions d'une saison fait sortir la ligue du
  // brouillon : draft -> open. Forward-only + idempotent.
  await advanceLeagueStatus(season.leagueId, "open");
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
