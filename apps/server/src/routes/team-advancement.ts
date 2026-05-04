/**
 * L2.B.3 — Sprint Ligues v2 PR4 : routes level-up.
 *
 * Endpoints :
 *   - GET  /team/:teamId/pending-advancements
 *       Liste les pendingChoices ouverts pour les players d'une
 *       equipe (lecture des LeaguePostMatchSequence en status
 *       awaiting_choices). Reservee au proprietaire de l'equipe.
 *
 *   - POST /team/:teamId/players/:playerId/advancement
 *       Applique un choix d'advancement : decremente SPP, ajoute la
 *       skill au joueur, push une entree d'advancement, recalcule la
 *       currentValue de l'equipe. Reservee au proprietaire de l'equipe.
 *       Apres succes, ferme la sequence si tous les pendingChoices
 *       sont resolus.
 *
 * Pas de dependance frontend ici : ces routes sont consommees par les
 * UI L2.B.4 (PR5) et exposees pour des tests automatises / scripts
 * admin.
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { prisma } from "../prisma";
import {
  applyAdvancementChoice,
  markSequenceCompletedIfDone,
  parsePendingChoices,
} from "../services/post-match-league-sequence";
import {
  applyAdvancementSchema,
  type ApplyAdvancementBody,
} from "../schemas/advancement.schemas";
import { sendError, sendSuccess } from "../utils/api-response";

const router = Router();

function requireUserId(
  req: AuthenticatedRequest,
  res: Response,
): string | null {
  const id = req.user?.id;
  if (!id) {
    sendError(res, "Non authentifie", 401);
    return null;
  }
  return id;
}

async function ensureTeamOwner(
  userId: string,
  teamId: string,
  res: Response,
): Promise<{ ownerId: string } | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });
  if (!team) {
    sendError(res, "Equipe introuvable", 404);
    return null;
  }
  if (team.ownerId !== userId) {
    sendError(
      res,
      "Seul le proprietaire de l'equipe peut effectuer cette action",
      403,
    );
    return null;
  }
  return team;
}

/**
 * GET /team/:teamId/pending-advancements
 *
 * Liste les pending choices ouverts pour les joueurs de l'equipe.
 * Aggregation a partir des LeaguePostMatchSequence en status
 * awaiting_choices (toutes saisons confondues, deduplique par player).
 */
export async function handleListPendingAdvancements(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const teamId = req.params.teamId;
  const team = await ensureTeamOwner(userId, teamId, res);
  if (!team) return;

  // On lit les sequences ouvertes liees aux matchs ou cette equipe a
  // joue (via TeamSelection), puis on extrait les pendingChoices
  // dont le teamPlayerId appartient a cette equipe.
  const sequences = await prisma.leaguePostMatchSequence.findMany({
    where: {
      status: "awaiting_choices",
      match: {
        teamSelections: { some: { teamId } },
      },
    },
    select: {
      id: true,
      matchId: true,
      seasonId: true,
      pendingChoices: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const teamPlayerIds = new Set(
    (
      await prisma.teamPlayer.findMany({
        where: { teamId },
        select: { id: true },
      })
    ).map((p: { id: string }) => p.id),
  );

  // Deduplique par teamPlayerId : on garde l'entree la plus recente
  // (la plus ancienne est obsolete si le joueur a deja avance).
  const seen = new Set<string>();
  const items: Array<{
    sequenceId: string;
    matchId: string;
    seasonId: string;
    teamPlayerId: string;
    playerName: string;
    spp: number;
    advancementsTaken: number;
    nextAdvancementCost: number;
    createdAt: Date;
  }> = [];
  for (const seq of sequences) {
    const choices = parsePendingChoices(seq.pendingChoices);
    for (const c of choices) {
      if (!teamPlayerIds.has(c.teamPlayerId)) continue;
      if (seen.has(c.teamPlayerId)) continue;
      seen.add(c.teamPlayerId);
      items.push({
        sequenceId: seq.id,
        matchId: seq.matchId,
        seasonId: seq.seasonId,
        teamPlayerId: c.teamPlayerId,
        playerName: c.playerName,
        spp: c.spp,
        advancementsTaken: c.advancementsTaken,
        nextAdvancementCost: c.nextAdvancementCost,
        createdAt: seq.createdAt,
      });
    }
  }

  sendSuccess(res, { teamId, items });
}

/**
 * POST /team/:teamId/players/:playerId/advancement
 *
 * Applique un choix d'advancement pour un joueur. Decremente SPP,
 * ajoute la skill, push entree d'advancement, recalcule currentValue.
 * Idempotent : on ne peut pas faire avancer un joueur deja avance
 * (le service refuse si SPP < cost ou si max=6 atteint).
 */
export async function handleApplyAdvancement(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const teamId = req.params.teamId;
  const playerId = req.params.playerId;
  const team = await ensureTeamOwner(userId, teamId, res);
  if (!team) return;
  const body = req.body as ApplyAdvancementBody;

  // Pour les types `random-*`, on aurait normalement un tirage 2D6
  // dans la table d'avancements pour determiner la skill. Pour
  // simplifier (et rester compatible avec une UI cliente qui veut
  // afficher la skill avant confirmation), on impose au caller de
  // fournir `skillSlug` egalement pour les types random.
  if (!body.skillSlug) {
    sendError(
      res,
      "skillSlug est obligatoire (le tirage random doit etre realise cote client puis confirme ici)",
      400,
    );
    return;
  }

  const result = await applyAdvancementChoice({
    teamId,
    playerId,
    type: body.type,
    skillSlug: body.skillSlug,
  });

  if ("skipped" in result && result.skipped) {
    const status =
      result.reason === "player-not-found"
        ? 404
        : result.reason === "player-not-on-team"
          ? 403
          : 400;
    sendError(res, `Avancement refuse: ${result.reason}`, status);
    return;
  }

  // Cherche la sequence ouverte pour ce match/equipe et la ferme si
  // tous les pendingChoices sont resolus.
  const seq = await prisma.leaguePostMatchSequence.findFirst({
    where: {
      status: "awaiting_choices",
      match: {
        teamSelections: { some: { teamId } },
      },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  let sequenceClosed = false;
  if (seq) {
    const closure = await markSequenceCompletedIfDone(seq.id);
    sequenceClosed = closure.closed;
  }

  sendSuccess(res, {
    ...result,
    sequenceClosed,
  });
}

router.get(
  "/:teamId/pending-advancements",
  authUser,
  handleListPendingAdvancements,
);
router.post(
  "/:teamId/players/:playerId/advancement",
  authUser,
  validate(applyAdvancementSchema),
  handleApplyAdvancement,
);

export default router;
