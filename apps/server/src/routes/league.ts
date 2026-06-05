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
  updateLeague,
  hasLeagueScoredMatch,
  createSeason,
  addParticipant,
  createRound,
  listLeagues,
  getLeagueById,
  getSeasonById,
  computeSeasonStandings,
  computeSeasonStandingsByPool,
  isSeasonEloRanked,
  withdrawParticipant,
  listThemedSeasons,
  parseAllowedRosters,
  LeagueWithdrawError,
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
  recordOfflineLeagueResult,
  parseOfflineSnapshot,
  OFFLINE_MATCH_MODE,
} from "../services/league-offline-result";
import { editOfflineLeagueResult } from "../services/league-offline-edit";
import {
  computeSeasonRecap,
  getPersistedSeasonAward,
} from "../services/league-scoring";
import {
  startPlayoffs,
  overridePlayoffParticipants,
  PlayoffOverrideError,
} from "../services/league-playoffs";
import {
  createManualRound,
  createManualPairing,
  deleteManualPairing,
  updateManualPairing,
  LeagueManualPairingError,
} from "../services/league-manual-pairing";
import {
  createManualRoundSchema,
  createManualPairingSchema,
  updateManualPairingSchema,
  type CreateManualRoundBody,
  type CreateManualPairingBody,
  type UpdateManualPairingBody,
} from "../schemas/league-manual-pairing.schemas";
import {
  createPool,
  updatePool,
  deletePool,
  listPoolsForSeason,
  assignParticipantsToPools,
  autoAssignBySnakeDraft,
  LeaguePoolError,
} from "../services/league-pool";
import {
  createPoolSchema,
  updatePoolSchema,
  assignPoolsSchema,
  type CreatePoolBody,
  type UpdatePoolBody,
  type AssignPoolsBody,
} from "../schemas/league-pool.schemas";
import {
  playMecene,
  LeaguePatronError,
} from "../services/league-patron";
import { listLeagueThemes } from "../services/league-themes";
import {
  createLeagueSchema,
  updateLeagueSchema,
  createSeasonSchema,
  joinSeasonSchema,
  createRoundSchema,
  listLeaguesQuerySchema,
  listSeasonsByThemeQuerySchema,
  attachMatchSchema,
  startSeasonSchema,
  createMatchFromPairingSchema,
  forfeitPairingSchema,
  recordOfflineResultSchema,
  type CreateLeagueBody,
  type UpdateLeagueBody,
  type CreateSeasonBody,
  type JoinSeasonBody,
  type CreateRoundBody,
  type ListLeaguesQuery,
  type ListSeasonsByThemeQuery,
  type AttachMatchBody,
  type StartSeasonBody,
  type CreateMatchFromPairingBody,
  type ForfeitPairingBody,
  type RecordOfflineResultBody,
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
  league: Record<string, unknown> & {
    allowedRosters?: string | null;
    tieBreakRules?: string | null;
  },
) {
  // L2.C.5 — parse `tieBreakRules` JSON pour le frontend.
  let tieBreakRules: string[] | null = null;
  if (league.tieBreakRules) {
    try {
      const parsed: unknown = JSON.parse(league.tieBreakRules);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
        tieBreakRules = parsed as string[];
      }
    } catch {
      tieBreakRules = null;
    }
  }
  return {
    ...league,
    allowedRosters: parseAllowedRosters(
      (league.allowedRosters as string | null) ?? null,
    ),
    tieBreakRules,
  };
}

function domainError(res: Response, e: unknown): void {
  // Lot B — map les erreurs typees vers les bons status HTTP.
  if (e instanceof LeagueWithdrawError) {
    const status =
      e.code === "season_not_found" || e.code === "not_registered"
        ? 404
        : e.code === "season_started" || e.code === "season_completed"
          ? 409
          : 400;
    sendError(res, e.message, status);
    return;
  }
  // Lot C — pool errors.
  if (e instanceof LeaguePoolError) {
    const status =
      e.code === "season_not_found" ||
      e.code === "pool_not_found" ||
      e.code === "participant_not_found"
        ? 404
        : e.code === "season_started" ||
            e.code === "pool_name_taken" ||
            e.code === "pool_not_empty" ||
            e.code === "participant_not_in_season"
          ? 409
          : 400;
    sendError(res, e.message, status);
    return;
  }
  // Lot D — playoff override errors.
  if (e instanceof PlayoffOverrideError) {
    const status =
      e.code === "season_not_found" || e.code === "playoffs_not_started"
        ? 404
        : e.code === "playoffs_in_progress" ||
            e.code === "duplicate_participant" ||
            e.code === "size_mismatch" ||
            e.code === "participant_not_active"
          ? 409
          : 400;
    sendError(res, e.message, status);
    return;
  }
  // Lot F — manual pairing errors.
  if (e instanceof LeagueManualPairingError) {
    const status =
      e.code === "round_not_found" ||
      e.code === "season_not_found" ||
      e.code === "pairing_not_found" ||
      e.code === "participant_not_found"
        ? 404
        : e.code === "duplicate_pairing" ||
            e.code === "pairing_already_played" ||
            e.code === "round_completed" ||
            e.code === "participant_not_active"
          ? 409
          : 400;
    sendError(res, e.message, status);
    return;
  }
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
      tieBreakRules: body.tieBreakRules ?? null,
      // Lot E — config bonus optionnelle, propagee au service.
      bonusPointsConfig: body.bonusPointsConfig ?? null,
    });
    sendSuccess(res, serializeLeague(league as Record<string, unknown>), 201);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

export async function handleUpdateLeague(
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
      "Seul le commissaire (createur) peut modifier cette ligue",
      403,
    );
    return;
  }
  // Verrou : une fois un match joue/saisi, les parametres sont figes.
  if (await hasLeagueScoredMatch(leagueId)) {
    sendError(
      res,
      "Ligue verrouillee : un match a deja ete joue, les parametres ne peuvent plus etre modifies",
      409,
    );
    return;
  }
  const body = req.body as UpdateLeagueBody;
  try {
    const updated = await updateLeague(leagueId, {
      name: body.name,
      description: body.description,
      ruleset: body.ruleset,
      isPublic: body.isPublic,
      maxParticipants: body.maxParticipants,
      allowedRosters: body.allowedRosters,
      winPoints: body.winPoints,
      drawPoints: body.drawPoints,
      lossPoints: body.lossPoints,
      forfeitPoints: body.forfeitPoints,
      tieBreakRules: body.tieBreakRules,
      // Lot E — propagation de la config bonus en edition.
      bonusPointsConfig: body.bonusPointsConfig,
    });
    sendSuccess(res, serializeLeague(updated as Record<string, unknown>));
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
  // L2.D — `hasScoredMatch` : verrou d'edition expose au frontend pour
  // afficher/masquer le bouton "Modifier" (la verite reste serveur dans
  // handleUpdateLeague).
  const hasScoredMatch = await hasLeagueScoredMatch(leagueId);
  sendSuccess(res, {
    league: {
      ...serializeLeague(league as unknown as Record<string, unknown>),
      hasScoredMatch,
    },
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
      // L2.C.3 — propagation playoffSize (default 0, mode classique).
      playoffSize: body.playoffSize,
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
    // L2.C.8 — expose `leagueName` + `seasonName` + `seasonStatus`
    // pour permettre au frontend de construire le JSON-LD SEO.
    const seasonRow = await prisma.leagueSeason.findUnique({
      where: { id: seasonId },
      select: {
        id: true,
        name: true,
        status: true,
        league: { select: { id: true, name: true } },
      },
    });
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
      leagueId: seasonRow?.league?.id ?? null,
      leagueName: seasonRow?.league?.name ?? null,
      seasonName: seasonRow?.name ?? null,
      seasonStatus: seasonRow?.status ?? null,
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
    // L'ELO n'est affiche que s'il est un critere de classement effectif
    // (present dans tieBreakRules) — masque par defaut, cf. neutralisation ELO.
    const seasonRow = await prisma.leagueSeason.findUnique({
      where: { id: seasonId },
      select: { league: { select: { tieBreakRules: true } } },
    });
    const showSeasonElo = isSeasonEloRanked(
      seasonRow?.league?.tieBreakRules ?? null,
    );
    // Lot C — si query `byPool=true`, retourne aussi le groupement
    // par poule (vide si la saison n'a pas de poules).
    const wantsByPool =
      typeof req.query.byPool === "string" &&
      (req.query.byPool === "true" || req.query.byPool === "1");
    const pools = wantsByPool
      ? await computeSeasonStandingsByPool(seasonId)
      : undefined;
    sendSuccess(res, {
      seasonId,
      standings,
      showSeasonElo,
      ...(pools !== undefined ? { pools } : {}),
    });
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/**
 * L2.C.3 — bracket de playoffs d'une saison.
 *
 * Renvoie tous les rounds avec `kind="playoff"` ordonnes par
 * roundNumber, avec leurs pairings + participants. Format pret a
 * etre rendu par PlayoffBracketView. Endpoint public (pas d'auth).
 */
export async function handleGetPlayoffBracket(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const seasonId = req.params.seasonId;
  try {
    const seasonRow = await prisma.leagueSeason.findUnique({
      where: { id: seasonId },
      select: { id: true, playoffSize: true, status: true },
    });
    if (!seasonRow) {
      sendError(res, "Saison introuvable", 404);
      return;
    }
    const rounds = await prisma.leagueRound.findMany({
      where: { seasonId, kind: "playoff" },
      orderBy: { roundNumber: "asc" },
      include: {
        pairings: {
          orderBy: { createdAt: "asc" },
          include: {
            match: { select: { id: true, status: true } },
            homeParticipant: {
              select: {
                id: true,
                team: {
                  select: {
                    id: true,
                    name: true,
                    roster: true,
                    owner: { select: { id: true, coachName: true } },
                  },
                },
              },
            },
            awayParticipant: {
              select: {
                id: true,
                team: {
                  select: {
                    id: true,
                    name: true,
                    roster: true,
                    owner: { select: { id: true, coachName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    sendSuccess(res, {
      seasonId,
      playoffSize: seasonRow.playoffSize,
      seasonStatus: seasonRow.status,
      rounds,
    });
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/**
 * L2.C.3 — Demarre manuellement les playoffs (admin force).
 * Reserve au createur de la ligue. Le hook automatique fire-and-
 * forget (a la cloture du dernier round regulier) doit normalement
 * suffire ; ce levier permet de redemarrer en cas de skip ou de
 * forcer manuellement quand `playoffSize=0` mais que l'admin veut
 * tout de meme un bracket adhoc.
 */
export async function handleStartPlayoffs(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  if (!(await ensureLeagueCreator(userId, seasonId, res))) return;

  try {
    const result = await startPlayoffs(seasonId);
    if (!result.created) {
      sendError(
        res,
        `Playoffs non demarres: ${result.skippedReason ?? "raison inconnue"}`,
        400,
      );
      return;
    }
    sendSuccess(res, result, 201);
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
 * Lot F — variante de `ensureLeagueCreator` qui resout le seasonId
 * a partir d'un roundId. Utilisee par les handlers de creation
 * manuelle de pairings.
 */
async function ensureLeagueCreatorByRound(
  userId: string,
  roundId: string,
  res: Response,
): Promise<{ seasonId: string } | null> {
  const round = await prisma.leagueRound.findUnique({
    where: { id: roundId },
    select: { id: true, seasonId: true },
  });
  if (!round) {
    sendError(res, "Round introuvable", 404);
    return null;
  }
  if (!(await ensureLeagueCreator(userId, round.seasonId, res))) return null;
  return { seasonId: round.seasonId };
}

/**
 * Lot F — variante de `ensureLeagueCreator` qui resout le seasonId
 * a partir d'un pairingId.
 */
async function ensureLeagueCreatorByPairing(
  userId: string,
  pairingId: string,
  res: Response,
): Promise<{ seasonId: string; roundId: string } | null> {
  const pairing = await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    select: { id: true, roundId: true, round: { select: { seasonId: true } } },
  });
  if (!pairing) {
    sendError(res, "Pairing introuvable", 404);
    return null;
  }
  const seasonId = (pairing.round as { seasonId: string }).seasonId;
  if (!(await ensureLeagueCreator(userId, seasonId, res))) return null;
  return { seasonId, roundId: pairing.roundId };
}

// ===========================================================
// Lot F — handlers : creation manuelle de rounds et pairings.
// ===========================================================

/** POST /leagues/seasons/:seasonId/rounds/manual */
export async function handleCreateManualRound(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  if (!(await ensureLeagueCreator(userId, seasonId, res))) return;
  const body = req.body as CreateManualRoundBody;
  try {
    const round = await createManualRound({
      seasonId,
      name: body.name,
      kind: body.kind,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
    });
    sendSuccess(res, round, 201);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/** POST /leagues/rounds/:roundId/pairings */
export async function handleCreateManualPairing(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const roundId = req.params.roundId;
  const ctx = await ensureLeagueCreatorByRound(userId, roundId, res);
  if (!ctx) return;
  const body = req.body as CreateManualPairingBody;
  try {
    const pairing = await createManualPairing({
      roundId,
      homeParticipantId: body.homeParticipantId,
      awayParticipantId: body.awayParticipantId,
      scheduledAt: body.scheduledAt ?? null,
      deadlineAt: body.deadlineAt ?? null,
    });
    sendSuccess(res, pairing, 201);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/** DELETE /leagues/pairings/:pairingId */
export async function handleDeleteManualPairing(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const pairingId = req.params.pairingId;
  const ctx = await ensureLeagueCreatorByPairing(userId, pairingId, res);
  if (!ctx) return;
  try {
    const out = await deleteManualPairing({ pairingId });
    sendSuccess(res, out);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/** PATCH /leagues/pairings/:pairingId */
export async function handleUpdateManualPairing(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const pairingId = req.params.pairingId;
  const ctx = await ensureLeagueCreatorByPairing(userId, pairingId, res);
  if (!ctx) return;
  const body = req.body as UpdateManualPairingBody;
  try {
    const pairing = await updateManualPairing({
      pairingId,
      scheduledAt: body.scheduledAt,
      deadlineAt: body.deadlineAt,
      targetRoundId: body.targetRoundId,
    });
    sendSuccess(res, pairing);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

// ===========================================================
// Lot C — handlers : gestion des poules.
// ===========================================================

/** Resoud le seasonId a partir d'un poolId et applique ensureLeagueCreator. */
async function ensureLeagueCreatorByPool(
  userId: string,
  poolId: string,
  res: Response,
): Promise<{ seasonId: string } | null> {
  const pool = await prisma.leaguePool.findUnique({
    where: { id: poolId },
    select: { id: true, seasonId: true },
  });
  if (!pool) {
    sendError(res, "Poule introuvable", 404);
    return null;
  }
  if (!(await ensureLeagueCreator(userId, pool.seasonId, res))) return null;
  return { seasonId: pool.seasonId };
}

/** POST /leagues/seasons/:seasonId/pools */
export async function handleCreatePool(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  if (!(await ensureLeagueCreator(userId, seasonId, res))) return;
  const body = req.body as CreatePoolBody;
  try {
    const pool = await createPool({
      seasonId,
      name: body.name,
      qualifiesForPlayoffs: body.qualifiesForPlayoffs,
      color: body.color ?? null,
      order: body.order,
    });
    sendSuccess(res, pool, 201);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/** GET /leagues/seasons/:seasonId/pools (public). */
export async function handleListPools(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const seasonId = req.params.seasonId;
  try {
    const pools = await listPoolsForSeason(seasonId);
    sendSuccess(res, { pools });
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/** PATCH /leagues/pools/:poolId */
export async function handleUpdatePool(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const poolId = req.params.poolId;
  const ctx = await ensureLeagueCreatorByPool(userId, poolId, res);
  if (!ctx) return;
  const body = req.body as UpdatePoolBody;
  try {
    const updated = await updatePool({
      poolId,
      name: body.name,
      qualifiesForPlayoffs: body.qualifiesForPlayoffs,
      color: body.color ?? undefined,
      order: body.order,
    });
    sendSuccess(res, updated);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/** DELETE /leagues/pools/:poolId */
export async function handleDeletePool(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const poolId = req.params.poolId;
  const ctx = await ensureLeagueCreatorByPool(userId, poolId, res);
  if (!ctx) return;
  try {
    const out = await deletePool({ poolId });
    sendSuccess(res, out);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/** POST /leagues/seasons/:seasonId/pools/assign */
export async function handleAssignPools(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  if (!(await ensureLeagueCreator(userId, seasonId, res))) return;
  const body = req.body as AssignPoolsBody;
  try {
    const out = await assignParticipantsToPools({
      seasonId,
      assignments: body.assignments,
    });
    sendSuccess(res, out);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/** POST /leagues/seasons/:seasonId/pools/auto-assign */
export async function handleAutoAssignPools(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  if (!(await ensureLeagueCreator(userId, seasonId, res))) return;
  try {
    const out = await autoAssignBySnakeDraft({ seasonId });
    sendSuccess(res, out);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

// ===========================================================
// Lot D — override des participants du bracket playoffs.
// ===========================================================

/**
 * PATCH /leagues/seasons/:seasonId/playoff-bracket/participants
 *
 * Le commissaire fournit la liste complete des seeds du bracket
 * (taille = playoffSize). Le service refuse si un match du round 1
 * a deja ete lance / joue.
 */
export async function handleOverridePlayoffParticipants(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const seasonId = req.params.seasonId;
  if (!(await ensureLeagueCreator(userId, seasonId, res))) return;
  const body = req.body as { participantIds: string[] };
  if (
    !body ||
    !Array.isArray(body.participantIds) ||
    body.participantIds.length === 0
  ) {
    sendError(res, "participantIds[] requis", 400);
    return;
  }
  try {
    const out = await overridePlayoffParticipants({
      seasonId,
      participantIds: body.participantIds,
    });
    sendSuccess(res, out);
  } catch (e: unknown) {
    domainError(res, e);
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

/**
 * Workstream ligue offline — saisie manuelle d'un resultat de match joue
 * hors-ligne (tabletop). Reservee au createur de la ligue (meme controle
 * que le forfait). Le pairing doit etre encore non joue.
 */
export async function handleRecordOfflineResult(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const pairingId = req.params.pairingId;
  const body = req.body as RecordOfflineResultBody;

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
    const result = await recordOfflineLeagueResult({
      pairingId,
      scoreHome: body.scoreHome,
      scoreAway: body.scoreAway,
      casualtiesHome: body.casualtiesHome,
      casualtiesAway: body.casualtiesAway,
      playerStats: body.playerStats,
      winningsHome: body.winningsHome,
      winningsAway: body.winningsAway,
      dedicatedFansDeltaHome: body.dedicatedFansDeltaHome,
      dedicatedFansDeltaAway: body.dedicatedFansDeltaAway,
      injuries: body.injuries,
    });
    if ("skipped" in result) {
      sendError(res, `Resultat non enregistre (${result.reason})`, 409);
      return;
    }
    sendSuccess(res, result);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/**
 * Workstream ligue offline (W-B4) — saisie brute d'un resultat offline deja
 * enregistre, pour pre-remplir la modale d'edition. Createur only. 404 si le
 * pairing n'a pas de resultat offline comptabilise.
 */
export async function handleGetOfflineResult(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const pairingId = req.params.pairingId;

  const pairing = await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      round: { select: { seasonId: true } },
      match: {
        select: { mode: true, leagueScoredAt: true, offlineResultInput: true },
      },
    },
  });
  if (!pairing) {
    sendError(res, "Pairing introuvable", 404);
    return;
  }
  if (!(await ensureLeagueCreator(userId, pairing.round.seasonId, res))) {
    return;
  }
  const match = pairing.match as {
    mode: string;
    leagueScoredAt: Date | null;
    offlineResultInput: unknown;
  } | null;
  if (!match || match.mode !== OFFLINE_MATCH_MODE || !match.leagueScoredAt) {
    sendError(res, "Aucun resultat offline pour ce pairing", 404);
    return;
  }
  const snapshot = parseOfflineSnapshot(match.offlineResultInput);
  if (!snapshot) {
    sendError(res, "Snapshot de resultat indisponible", 404);
    return;
  }
  sendSuccess(res, { input: snapshot.input });
}

/**
 * Workstream ligue offline (W-B3) — EDITION d'un resultat deja saisi, en cas
 * d'erreur de saisie. Reservee au createur. Annule la saisie existante puis
 * re-saisit (cf. editOfflineLeagueResult). Refus (409) si un effet a deja ete
 * consomme (level-up, saison clôturee, playoffs, mort).
 */
export async function handleEditOfflineResult(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const pairingId = req.params.pairingId;
  const body = req.body as RecordOfflineResultBody;

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
    const result = await editOfflineLeagueResult({
      pairingId,
      scoreHome: body.scoreHome,
      scoreAway: body.scoreAway,
      casualtiesHome: body.casualtiesHome,
      casualtiesAway: body.casualtiesAway,
      playerStats: body.playerStats,
      winningsHome: body.winningsHome,
      winningsAway: body.winningsAway,
      dedicatedFansDeltaHome: body.dedicatedFansDeltaHome,
      dedicatedFansDeltaAway: body.dedicatedFansDeltaAway,
      injuries: body.injuries,
    });
    if ("skipped" in result) {
      sendError(res, `Edition refusee (${result.reason})`, 409);
      return;
    }
    sendSuccess(res, result);
  } catch (e: unknown) {
    domainError(res, e);
  }
}

/**
 * Workstream ligue offline (Phase 2b) — rosters des deux equipes d'un
 * pairing, pour la saisie de stats par joueur (SPP). Reservee au createur
 * de la ligue : `GET /team/:id` est owner-only, donc inutilisable ici.
 */
export async function handleGetPairingRosters(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const pairingId = req.params.pairingId;
  const pairing = await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    select: {
      round: { select: { seasonId: true } },
      homeParticipant: {
        select: { teamId: true, team: { select: { name: true } } },
      },
      awayParticipant: {
        select: { teamId: true, team: { select: { name: true } } },
      },
    },
  });
  if (!pairing || !pairing.homeParticipant || !pairing.awayParticipant) {
    sendError(res, "Pairing introuvable", 404);
    return;
  }
  if (!(await ensureLeagueCreator(userId, pairing.round.seasonId, res))) {
    return;
  }

  const playerSelect = {
    id: true,
    name: true,
    number: true,
    position: true,
    spp: true,
  } as const;
  const [homePlayers, awayPlayers] = await Promise.all([
    prisma.teamPlayer.findMany({
      where: { teamId: pairing.homeParticipant.teamId },
      select: playerSelect,
      orderBy: { number: "asc" },
    }),
    prisma.teamPlayer.findMany({
      where: { teamId: pairing.awayParticipant.teamId },
      select: playerSelect,
      orderBy: { number: "asc" },
    }),
  ]);

  sendSuccess(res, {
    home: {
      teamId: pairing.homeParticipant.teamId,
      teamName: pairing.homeParticipant.team.name,
      players: homePlayers,
    },
    away: {
      teamId: pairing.awayParticipant.teamId,
      teamName: pairing.awayParticipant.team.name,
      players: awayPlayers,
    },
  });
}

// L2.B.5 — Coup de mecene (1x par saison ligue par equipe). Le coach
// proprietaire de l'equipe declenche, on credite +100k po.
async function handlePlayMecene(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    sendError(res, "Non authentifie", 401);
    return;
  }
  const { seasonId, teamId } = req.params;
  if (!seasonId || !teamId) {
    sendError(res, "seasonId et teamId requis", 400);
    return;
  }

  // Verite cote serveur : seul le owner de l'equipe peut declencher.
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: userId },
    select: { id: true },
  });
  if (!team) {
    sendError(res, "Equipe introuvable ou non autorisee", 404);
    return;
  }

  try {
    const result = await playMecene({ prisma, seasonId, teamId });
    sendSuccess(res, result);
  } catch (e: unknown) {
    if (e instanceof LeaguePatronError) {
      const status =
        e.code === "season_not_found" || e.code === "team_not_found"
          ? 404
          : e.code === "team_not_in_season"
            ? 404
            : e.code === "already_played"
              ? 409
              : 400;
      sendError(res, e.message, status);
      return;
    }
    domainError(res, e);
  }
}

const router = Router();

router.post("/", authUser, validate(createLeagueSchema), handleCreateLeague);
router.patch(
  "/:id",
  authUser,
  validate(updateLeagueSchema),
  handleUpdateLeague,
);
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
// Lot F — saisie manuelle de matchs : creation d'un round vide hors
// du calendrier auto-genere + ajout de pairings.
router.post(
  "/seasons/:seasonId/rounds/manual",
  authUser,
  validate(createManualRoundSchema),
  handleCreateManualRound,
);
router.post(
  "/rounds/:roundId/pairings",
  authUser,
  validate(createManualPairingSchema),
  handleCreateManualPairing,
);
router.delete(
  "/pairings/:pairingId",
  authUser,
  handleDeleteManualPairing,
);
router.patch(
  "/pairings/:pairingId",
  authUser,
  validate(updateManualPairingSchema),
  handleUpdateManualPairing,
);

// Lot C — gestion des poules (groups). Mutation reservee au
// commissaire ; lecture publique pour permettre l'affichage des
// poules dans le calendrier / standings.
router.get("/seasons/:seasonId/pools", handleListPools);
router.post(
  "/seasons/:seasonId/pools",
  authUser,
  validate(createPoolSchema),
  handleCreatePool,
);
router.post(
  "/seasons/:seasonId/pools/assign",
  authUser,
  validate(assignPoolsSchema),
  handleAssignPools,
);
router.post(
  "/seasons/:seasonId/pools/auto-assign",
  authUser,
  handleAutoAssignPools,
);
router.patch(
  "/pools/:poolId",
  authUser,
  validate(updatePoolSchema),
  handleUpdatePool,
);
router.delete("/pools/:poolId", authUser, handleDeletePool);

// Lot D — override des participants du bracket (avant le 1er match
// playoff joue). Permet de gerer un desistement tardif.
router.patch(
  "/seasons/:seasonId/playoff-bracket/participants",
  authUser,
  handleOverridePlayoffParticipants,
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
// Workstream ligue offline — saisie manuelle d'un resultat de match joue
// hors-ligne (tabletop). Reservee au createur de la ligue.
router.post(
  "/pairings/:pairingId/result",
  authUser,
  validate(recordOfflineResultSchema),
  handleRecordOfflineResult,
);
// W-B3 — edition d'un resultat offline deja saisi (correction d'erreur de
// saisie). Createur only. Annule puis re-saisit ; 409 si effet consomme.
router.put(
  "/pairings/:pairingId/result",
  authUser,
  validate(recordOfflineResultSchema),
  handleEditOfflineResult,
);
// Rosters des 2 equipes d'un pairing (createur only) pour la saisie de
// stats par joueur.
router.get(
  "/pairings/:pairingId/rosters",
  authUser,
  handleGetPairingRosters,
);
// W-B4 — saisie brute d'un resultat offline existant (createur only) pour
// pre-remplir la modale d'edition.
router.get(
  "/pairings/:pairingId/result",
  authUser,
  handleGetOfflineResult,
);
router.get("/seasons/:seasonId/standings", authUser, handleGetStandings);
// L2.C.1 — recap public de fin de saison : champion + awards.
// Pas d'auth : la page recap doit etre indexable / partageable.
router.get("/seasons/:seasonId/awards", handleGetSeasonAwards);
// L2.C.3 — bracket playoffs (public, indexable).
router.get(
  "/seasons/:seasonId/playoff-bracket",
  handleGetPlayoffBracket,
);
// L2.C.3 — demarrage manuel des playoffs (createur de la ligue).
router.post(
  "/seasons/:seasonId/playoff/start",
  authUser,
  handleStartPlayoffs,
);
router.get("/seasons/:seasonId", authUser, handleGetSeason);

// L2.B.5 — Coup de mecene par equipe et par saison.
router.post(
  "/seasons/:seasonId/teams/:teamId/mecene",
  authUser,
  handlePlayMecene,
);

export default router;
