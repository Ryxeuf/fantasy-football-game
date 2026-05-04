/**
 * L.3 — Routes API ligue (Sprint 17).
 *
 * Expose les operations create / list / detail / join / schedule /
 * standings / withdraw au-dessus du service `services/league.ts`.
 * La logique metier (bornes, unicite, etats autorises) reste dans le
 * service — les handlers s'occupent de l'auth, du parse et du format.
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate, validateQuery } from "../middleware/validate";
import { prisma } from "../prisma";
import {
  createLeague,
  createSeason,
  addParticipant,
  createRound,
  listLeagues,
  getLeagueById,
  getSeasonById,
  computeSeasonStandings,
  withdrawParticipant,
  listThemedSeasons,
  parseAllowedRosters,
} from "../services/league";
import {
  startSeason,
  regenerateSchedule,
  openSeasonForRegistration,
  closeSeason,
  requireLeagueCreator,
} from "../services/league-scheduler";
import { createMatchFromPairing } from "../services/league-match-from-pairing";
import { recordForfeit } from "../services/league-forfeit";
import {
  computeSeasonRecap,
  getPersistedSeasonAward,
} from "../services/league-scoring";
import { listLeagueThemes } from "../services/league-themes";
import {
  createLeagueSchema,
  createSeasonSchema,
  joinSeasonSchema,
  createRoundSchema,
  listLeaguesQuerySchema,
  listSeasonsByThemeQuerySchema,
  attachMatchSchema,
  startSeasonSchema,
  createMatchFromPairingSchema,
  forfeitPairingSchema,
  type CreateLeagueBody,
  type CreateSeasonBody,
  type JoinSeasonBody,
  type CreateRoundBody,
  type ListLeaguesQuery,
  type ListSeasonsByThemeQuery,
  type AttachMatchBody,
  type StartSeasonBody,
  type CreateMatchFromPairingBody,
  type ForfeitPairingBody,
} from "../schemas/league.schemas";
import { sendError, sendSuccess } from "../utils/api-response";

function requireUserId(req: AuthenticatedRequest, res: Response): string | null {
  const id = req.user?.id;
  if (!id) {
    sendError(res, "Non authentifie", 401);
    return null;
  }
  return id;
}

function serializeLeague(
  league: Record<string, unknown> & { allowedRosters?: string | null },
) {
  return {
    ...league,
    allowedRosters: parseAllowedRosters(
      (league.allowedRosters as string | null) ?? null,
    ),
  };
}

function domainError(res: Response, e: unknown): void {
  const message = e instanceof Error ? e.message : "Erreur inconnue";
  const isMissing = /introuvable|not found/i.test(message);
  sendError(res, message, isMissing ? 404 : 400);
}

export async function handleCreateLeague(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const body = req.body as CreateLeagueBody;
  try {
    const league = await createLeague({
      creatorId: userId,
      name: body.name,
      description: body.description ?? null,
      ruleset: body.ruleset,
      isPublic: body.isPublic,
      maxParticipants: body.maxParticipants,
      allowedRosters: body.allowedRosters ?? null,
      winPoints: body.winPoints,
      drawPoints: body.drawPoints,
      lossPoints: body.lossPoints,
      forfeitPoints: body.forfeitPoints,
    });
    sendSuccess(res, serializeLeague(league as Record<string, unknown>), 201);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

export async function handleListLeagues(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const query = req.query as unknown as ListLeaguesQuery;
  try {
    const { items, total, limit, offset } = await listLeagues({
      creatorId: query.creatorId,
      status: query.status,
      publicOnly: query.publicOnly,
      limit: query.limit,
      offset: query.offset,
    });
    // S25.6 — pagination : on garde le champ `leagues` pour la
    // retro-compat des clients existants, et on expose total/limit/offset
    // dans `meta` (cf. ApiSuccess<T>.meta).
    res.status(200).json({
      success: true,
      data: {
        leagues: (items as Array<Record<string, unknown>>).map(serializeLeague),
      },
      meta: { total, limit, page: Math.floor(offset / limit) },
    });
  } catch (e: unknown) {
    domainError(res, e);
  }
}

export async function handleGetLeague(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const leagueId = req.params.id;
  const league = await getLeagueById(leagueId);
  if (!league) {
    sendError(res, "Ligue introuvable", 404);
    return;
  }
  sendSuccess(res, {
    league: serializeLeague(league as unknown as Record<string, unknown>),
  });
}

export async function handleGetSeason(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const seasonId = req.params.seasonId;
  const season = await getSeasonById(seasonId);
  if (!season) {
    sendError(res, "Saison introuvable", 404);
    return;
  }
  const raw = season as unknown as Record<string, unknown> & {
    league?: { allowedRosters?: string | null } & Record<string, unknown>;
  };
  const league = raw.league;
  const serializedLeague = league
    ? {
        ...league,
        allowedRosters: parseAllowedRosters(league.allowedRosters ?? null),
      }
    : league;
  sendSuccess(res, {
    season: {
      ...raw,
      league: serializedLeague,
    },
  });
}

export async function handleCreateSeason(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const leagueId = req.params.id;
  const league = await getLeagueById(leagueId);
  if (!league) {
    sendError(res, "Ligue introuvable", 404);
    return;
  }
  if ((league as { creatorId: string }).creatorId !== userId) {
    sendError(
      res,
      "Seul le createur de la ligue peut creer une saison",
      403,
    );
    return;
  }
  const body = req.body as CreateSeasonBody;
  try {
    const season = await createSeason({
      leagueId,
      name: body.name,
      seasonNumber: body.seasonNumber,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      // S26.6 — propagation du theme + themeYear (validation finale dans
      // le service : isLeagueThemeSlug + Number.isInteger(year)).
      theme: body.theme,
      themeYear: body.themeYear,
    });
    sendSuccess(res, season, 201);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

export async function handleJoinSeason(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  const body = req.body as JoinSeasonBody;

  const season = await getSeasonById(seasonId);
  if (!season) {
    sendError(res, "Saison introuvable", 404);
    return;
  }

  const team = await prisma.team.findUnique({ where: { id: body.teamId } });
  if (!team) {
    sendError(res, "Equipe introuvable", 404);
    return;
  }
  if ((team as { ownerId: string }).ownerId !== userId) {
    sendError(
      res,
      "Vous ne pouvez inscrire que vos propres equipes",
      403,
    );
    return;
  }

  // L.9 — la restriction allowedRosters est enforcee dans `addParticipant`
  // (source de verite metier). Le domainError ci-dessous convertit en 400.
  try {
    const participant = await addParticipant({ seasonId, teamId: body.teamId });
    sendSuccess(res, participant, 201);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

export async function handleLeaveSeason(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  const body = req.body as JoinSeasonBody;

  const team = await prisma.team.findUnique({ where: { id: body.teamId } });
  if (!team) {
    sendError(res, "Equipe introuvable", 404);
    return;
  }
  if ((team as { ownerId: string }).ownerId !== userId) {
    sendError(
      res,
      "Vous ne pouvez retirer que vos propres equipes",
      403,
    );
    return;
  }

  try {
    const updated = await withdrawParticipant({ seasonId, teamId: body.teamId });
    sendSuccess(res, updated);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

export async function handleCreateRound(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  const body = req.body as CreateRoundBody;

  const season = await getSeasonById(seasonId);
  if (!season) {
    sendError(res, "Saison introuvable", 404);
    return;
  }
  if ((season as { league: { creatorId: string } }).league.creatorId !== userId) {
    sendError(res, "Seul le createur de la ligue peut planifier", 403);
    return;
  }

  try {
    const round = await createRound({
      seasonId,
      roundNumber: body.roundNumber,
      name: body.name ?? null,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
    });
    sendSuccess(res, round, 201);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/**
 * L.7 — Rattache un match existant a un round de ligue.
 * Reserve au createur de la ligue. Refuse si le match est deja termine
 * ou deja rattache a une autre saison/round.
 */
export async function handleAttachMatch(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const { seasonId, roundId } = req.params;
  const body = req.body as AttachMatchBody;

  const season = await getSeasonById(seasonId);
  if (!season) {
    sendError(res, "Saison introuvable", 404);
    return;
  }
  if ((season as { league: { creatorId: string } }).league.creatorId !== userId) {
    sendError(
      res,
      "Seul le createur de la ligue peut rattacher un match",
      403,
    );
    return;
  }

  const round = await prisma.leagueRound.findUnique({ where: { id: roundId } });
  if (!round || (round as { seasonId: string }).seasonId !== seasonId) {
    sendError(res, "Journee introuvable dans cette saison", 404);
    return;
  }

  const match = await prisma.match.findUnique({
    where: { id: body.matchId },
    select: {
      id: true,
      status: true,
      leagueSeasonId: true,
      leagueScoredAt: true,
    },
  });
  if (!match) {
    sendError(res, "Partie introuvable", 404);
    return;
  }
  if (match.status === "ended" || match.leagueScoredAt) {
    sendError(
      res,
      "Impossible de rattacher un match deja termine ou deja comptabilise",
      400,
    );
    return;
  }
  if (match.leagueSeasonId && match.leagueSeasonId !== seasonId) {
    sendError(res, "Match deja rattache a une autre saison", 409);
    return;
  }

  await prisma.match.update({
    where: { id: match.id },
    data: { leagueSeasonId: seasonId, leagueRoundId: roundId },
  });
  sendSuccess(res, { matchId: match.id, seasonId, roundId });
}

/**
 * S26.6b — Catalogue public des themes saisonniers (statique).
 * Sert d'alimentation pour l'UI calendrier `/leagues/seasons` et le
 * sitemap (themes indexables).
 */
export async function handleListThemes(
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const themes = listLeagueThemes();
  sendSuccess(res, { themes });
}

/**
 * S26.6b — Liste paginee des saisons d'un theme.
 * Validation Zod en amont (slug refuse si non canonique). Le service
 * fait une 2e validation defensive et renvoie une erreur metier si le
 * slug est forge a la main.
 */
export async function handleListSeasonsByTheme(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const query = req.query as unknown as ListSeasonsByThemeQuery;
  try {
    const { items, total, limit, offset } = await listThemedSeasons({
      theme: query.theme,
      themeYear: query.themeYear,
      limit: query.limit,
      offset: query.offset,
    });
    res.status(200).json({
      success: true,
      data: { seasons: items },
      meta: { total, limit, page: Math.floor(offset / limit) },
    });
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/**
 * L2.C.1 — Awards/recap d'une saison de ligue.
 *
 * - Si la saison est `completed` ET un snapshot LeagueSeasonAward
 *   existe : renvoie le snapshot persiste (champion + awards).
 * - Sinon : recalcule a la demande via `computeSeasonRecap` (utile
 *   pour la page recap "live" pendant une saison en cours).
 *
 * Le payload contient toujours `standings` (classement actuel) et
 * `awards` (peut etre vide si aucun match joue). `champion*` est null
 * tant qu'aucun match n'a ete joue.
 */
export async function handleGetSeasonAwards(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const seasonId = req.params.seasonId;
  try {
    const persisted = await getPersistedSeasonAward(seasonId);
    const recap = await computeSeasonRecap(seasonId);
    sendSuccess(res, {
      seasonId,
      // Le champion + awards persistes prennent priorite quand
      // disponibles (snapshot fige a la cloture). Sinon on retombe
      // sur le calcul live.
      championUserId: persisted?.championUserId ?? recap.championUserId,
      championTeamId: persisted?.championTeamId ?? recap.championTeamId,
      championLabel: recap.championLabel,
      awards: persisted?.awards ?? recap.awards,
      standings: recap.standings,
      persistedAt: persisted?.createdAt ?? null,
    });
  } catch (e: unknown) {
    domainError(res, e);
  }
}

export async function handleGetStandings(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const seasonId = req.params.seasonId;
  try {
    const standings = await computeSeasonStandings(seasonId);
    sendSuccess(res, { seasonId, standings });
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/**
 * L2.A.3 — Convertit les erreurs typees `season-not-found` /
 * `forbidden` levees par `requireLeagueCreator` en HTTP 404 / 403.
 * Retourne `true` si la verification a reussi (le handler peut
 * continuer), `false` sinon (la reponse a deja ete envoyee).
 */
async function ensureLeagueCreator(
  userId: string,
  seasonId: string,
  res: Response,
): Promise<boolean> {
  try {
    await requireLeagueCreator(userId, seasonId);
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "season-not-found") {
      sendError(res, "Saison introuvable", 404);
    } else if (msg === "forbidden") {
      sendError(res, "Seul le createur de la ligue peut faire cette action", 403);
    } else {
      domainError(res, e);
    }
    return false;
  }
}

/**
 * L2.A.3 — Ouvre une saison aux inscriptions (`draft -> scheduled`).
 * Reserve au createur de la ligue. No-op si deja `scheduled`.
 */
export async function handleOpenSeason(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  if (!(await ensureLeagueCreator(userId, seasonId, res))) return;
  try {
    await openSeasonForRegistration(seasonId);
    sendSuccess(res, { seasonId, status: "scheduled" });
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/**
 * L2.A.3 — Demarre une saison : genere le calendrier round-robin et
 * passe la saison a `in_progress`. Reserve au createur de la ligue.
 */
export async function handleStartSeason(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  if (!(await ensureLeagueCreator(userId, seasonId, res))) return;
  const body = req.body as StartSeasonBody;
  try {
    const result = await startSeason(seasonId, {
      doubleRoundRobin: body.doubleRoundRobin,
      firstRoundStartDate: body.firstRoundStartDate ?? null,
      roundDurationDays: body.roundDurationDays ?? null,
    });
    sendSuccess(res, result, 201);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/**
 * L2.A.3 — Regenere le calendrier d'une saison. Refuse si un match a
 * deja ete comptabilise. Reserve au createur de la ligue.
 */
export async function handleRegenerateSchedule(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  if (!(await ensureLeagueCreator(userId, seasonId, res))) return;
  const body = req.body as StartSeasonBody;
  try {
    const result = await regenerateSchedule(seasonId, {
      doubleRoundRobin: body.doubleRoundRobin,
      firstRoundStartDate: body.firstRoundStartDate ?? null,
      roundDurationDays: body.roundDurationDays ?? null,
    });
    sendSuccess(res, result);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/**
 * L2.A.3 — Force la cloture d'une saison (admin). Cancelle les
 * pairings non joues et passe la saison en `completed`. Reserve au
 * createur de la ligue.
 */
export async function handleCloseSeason(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  if (!(await ensureLeagueCreator(userId, seasonId, res))) return;
  try {
    await closeSeason(seasonId);
    sendSuccess(res, { seasonId, status: "completed" });
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/**
 * L2.A.4 — Cree un Match a partir d'un pairing du calendrier. Reserve
 * a un coach proprietaire de l'une des 2 equipes apparies. Idempotent :
 * si le pairing a deja un match, retourne l'existant.
 */
export async function handleCreateMatchFromPairing(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const pairingId = req.params.pairingId;
  const body = req.body as CreateMatchFromPairingBody;
  try {
    const result = await createMatchFromPairing({
      pairingId,
      userId,
      seed: body?.seed,
    });
    sendSuccess(res, result, result.created ? 201 : 200);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "";
    if (/un des deux coachs/i.test(message)) {
      sendError(res, message, 403);
      return;
    }
    domainError(res, e);
  }
}

/**
 * L2.A.11c — Force un forfait sur un pairing. Reserve au createur de
 * la ligue (verifie via le `seasonId` extrait du pairing). Le cron
 * `sweepDeadlinePairings` fait pareil automatiquement a la deadline,
 * ce handler donne juste un levier admin manuel anticipe.
 */
export async function handleForfeitPairing(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const pairingId = req.params.pairingId;
  const body = req.body as ForfeitPairingBody;

  // On a besoin du seasonId du pairing pour verifier que l'appelant
  // est bien le creator de la ligue. On le lit ici plutot que dans
  // `recordForfeit` pour garder le service decouple de l'autorisation.
  const pairing = await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    select: { id: true, round: { select: { seasonId: true } } },
  });
  if (!pairing) {
    sendError(res, "Pairing introuvable", 404);
    return;
  }
  if (!(await ensureLeagueCreator(userId, pairing.round.seasonId, res))) {
    return;
  }

  try {
    const result = await recordForfeit({
      pairingId,
      side: body?.side,
      winnerScore: body?.winnerScore,
    });
    sendSuccess(res, result);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

const router = Router();

router.post("/", authUser, validate(createLeagueSchema), handleCreateLeague);
router.get("/", authUser, validateQuery(listLeaguesQuerySchema), handleListLeagues);
// S26.6b — catalogue public des themes (pas d'auth : contenu de jeu
// statique, utilise par l'UI calendrier et le sitemap SEO).
router.get("/themes", handleListThemes);
// S26.6b — listing public des saisons d'un theme (pas d'auth : sert
// l'UI calendrier `/leagues/seasons` accessible aux non-loggues).
router.get(
  "/seasons/themed",
  validateQuery(listSeasonsByThemeQuerySchema),
  handleListSeasonsByTheme,
);
router.get("/:id", authUser, handleGetLeague);
router.post(
  "/:id/seasons",
  authUser,
  validate(createSeasonSchema),
  handleCreateSeason,
);
router.post(
  "/seasons/:seasonId/join",
  authUser,
  validate(joinSeasonSchema),
  handleJoinSeason,
);
router.post(
  "/seasons/:seasonId/leave",
  authUser,
  validate(joinSeasonSchema),
  handleLeaveSeason,
);
router.post(
  "/seasons/:seasonId/rounds",
  authUser,
  validate(createRoundSchema),
  handleCreateRound,
);
router.post(
  "/seasons/:seasonId/rounds/:roundId/matches",
  authUser,
  validate(attachMatchSchema),
  handleAttachMatch,
);
// L2.A.3 — Routes admin saison (ouverture inscriptions, demarrage,
// regeneration calendrier, cloture forcee). Reservees au createur.
router.post("/seasons/:seasonId/open", authUser, handleOpenSeason);
router.post(
  "/seasons/:seasonId/start",
  authUser,
  validate(startSeasonSchema),
  handleStartSeason,
);
router.post(
  "/seasons/:seasonId/regenerate",
  authUser,
  validate(startSeasonSchema),
  handleRegenerateSchedule,
);
router.post("/seasons/:seasonId/close", authUser, handleCloseSeason);
// L2.A.4 — Lancement d'une rencontre depuis un pairing pre-genere.
router.post(
  "/pairings/:pairingId/match",
  authUser,
  validate(createMatchFromPairingSchema),
  handleCreateMatchFromPairing,
);
// L2.A.11c — Forfait force par le createur de la ligue. Le cron
// `sweepDeadlinePairings` fait l'equivalent automatiquement a la
// deadline, ceci permet un trigger admin manuel anticipe.
router.post(
  "/pairings/:pairingId/forfeit",
  authUser,
  validate(forfeitPairingSchema),
  handleForfeitPairing,
);
router.get("/seasons/:seasonId/standings", authUser, handleGetStandings);
// L2.C.1 — recap public de fin de saison : champion + awards.
// Pas d'auth : la page recap doit etre indexable / partageable.
router.get("/seasons/:seasonId/awards", handleGetSeasonAwards);
router.get("/seasons/:seasonId", authUser, handleGetSeason);

export default router;
