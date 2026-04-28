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
  parseAllowedRosters,
} from "../services/league";
import {
  createLeagueSchema,
  createSeasonSchema,
  joinSeasonSchema,
  createRoundSchema,
  listLeaguesQuerySchema,
  attachMatchSchema,
  type CreateLeagueBody,
  type CreateSeasonBody,
  type JoinSeasonBody,
  type CreateRoundBody,
  type ListLeaguesQuery,
  type AttachMatchBody,
} from "../schemas/league.schemas";
import { sendError } from "../utils/api-response";

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
    res.status(201).json(serializeLeague(league as Record<string, unknown>));
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
    const leagues = await listLeagues({
      creatorId: query.creatorId,
      status: query.status,
      publicOnly: query.publicOnly,
    });
    res.status(200).json({
      leagues: (leagues as Array<Record<string, unknown>>).map(serializeLeague),
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
  res.status(200).json({
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
  res.status(200).json({
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
    });
    res.status(201).json(season);
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
    res.status(201).json(participant);
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
    res.status(200).json(updated);
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
    res.status(201).json(round);
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
  res.status(200).json({ matchId: match.id, seasonId, roundId });
}

export async function handleGetStandings(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const seasonId = req.params.seasonId;
  try {
    const standings = await computeSeasonStandings(seasonId);
    res.status(200).json({ seasonId, standings });
  } catch (e: unknown) {
    domainError(res, e);
  }
}

const router = Router();

router.post("/", authUser, validate(createLeagueSchema), handleCreateLeague);
router.get("/", authUser, validateQuery(listLeaguesQuerySchema), handleListLeagues);
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
router.get("/seasons/:seasonId/standings", authUser, handleGetStandings);
router.get("/seasons/:seasonId", authUser, handleGetSeason);

export default router;
