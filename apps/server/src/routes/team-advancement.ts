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
import { getNextAdvancementPspCost } from "@bb/game-engine";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { prisma } from "../prisma";
import {
  applyAdvancementChoice,
  rollRandomPrimarySkill,
  markSequenceCompletedIfDone,
  parsePendingChoices,
} from "../services/post-match-league-sequence";
import {
  applyAdvancementSchema,
  type ApplyAdvancementBody,
  rollRandomPrimarySchema,
  type RollRandomPrimaryBody,
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
): Promise<{ ownerId: string; roster: string; ruleset: string } | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true, roster: true, ruleset: true },
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

/** État live d'un joueur pour recalculer son éligibilité à un avancement. */
export interface LiveAdvancementState {
  readonly spp: number;
  readonly advancements: string | null;
  readonly dead: boolean;
}

/**
 * Recalcule spp / advancementsTaken / nextAdvancementCost depuis l'état
 * LIVE du joueur. Les valeurs snapshotées dans `pendingChoices` datent de
 * la création de la séquence : les évolutions stagées sur la feuille de
 * match sont appliquées APRÈS (validation commissaire) et débitent les
 * PSP sans rafraîchir le snapshot — le servir tel quel affichait des PSP
 * déjà dépensés et un coût faux, puis le POST refusait (insufficient-spp).
 * Retourne null si le joueur n'est plus éligible (mort, cap 6 atteint,
 * PSP < prochain palier le moins cher).
 */
export function liveAdvancementItem(player: LiveAdvancementState): {
  spp: number;
  advancementsTaken: number;
  nextAdvancementCost: number;
} | null {
  if (player.dead) return null;
  let advancementsTaken = 0;
  try {
    const parsed: unknown = JSON.parse(player.advancements ?? "[]");
    advancementsTaken = Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    advancementsTaken = 0;
  }
  if (advancementsTaken >= 6) return null;
  const cheapest = getNextAdvancementPspCost(advancementsTaken, "random-primary");
  if (player.spp < cheapest) return null;
  return { spp: player.spp, advancementsTaken, nextAdvancementCost: cheapest };
}

/**
 * GET /team/:teamId/pending-advancements
 *
 * Liste les pending choices ouverts pour les joueurs de l'equipe.
 * Aggregation a partir des LeaguePostMatchSequence en status
 * awaiting_choices (toutes saisons confondues, deduplique par player).
 * Les compteurs (spp, avancements, coût) sont relus sur le joueur —
 * cf. `liveAdvancementItem` — pas depuis le snapshot de la séquence.
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

  interface TeamPlayerRow {
    id: string;
    position: string;
    name: string;
    ma: number;
    st: number;
    ag: number;
    pa: number | null;
    av: number;
    skills: string | null;
    spp: number;
    advancements: string | null;
    dead: boolean;
  }
  const teamPlayers = (await prisma.teamPlayer.findMany({
    where: { teamId },
    select: {
      id: true,
      position: true,
      name: true,
      ma: true,
      st: true,
      ag: true,
      pa: true,
      av: true,
      skills: true,
      spp: true,
      advancements: true,
      dead: true,
    },
  })) as TeamPlayerRow[];
  const playerById = new Map<string, TeamPlayerRow>(
    teamPlayers.map((p) => [p.id, p]),
  );
  const teamPlayerIds = new Set(playerById.keys());

  // Accès primaire/secondaire par slug de position (pour le picker filtré
  // cote UI). Une seule requete pour le roster+ruleset de l'equipe.
  const positions = await prisma.position.findMany({
    where: { roster: { slug: team.roster, ruleset: team.ruleset as never } },
    select: { slug: true, primarySkills: true, secondarySkills: true },
  });
  const accessBySlug = new Map<
    string,
    { primarySkills: string | null; secondarySkills: string | null }
  >(
    positions.map(
      (p: {
        slug: string;
        primarySkills: string | null;
        secondarySkills: string | null;
      }) => [
        p.slug,
        { primarySkills: p.primarySkills, secondarySkills: p.secondarySkills },
      ],
    ),
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
    position: string | null;
    primarySkills: string | null;
    secondarySkills: string | null;
    // Fiche du joueur (pour le toggle « caractéristiques & compétences »).
    stats: {
      ma: number;
      st: number;
      ag: number;
      pa: number | null;
      av: number;
    };
    skills: string | null;
  }> = [];
  for (const seq of sequences) {
    const choices = parsePendingChoices(seq.pendingChoices);
    for (const c of choices) {
      if (!teamPlayerIds.has(c.teamPlayerId)) continue;
      if (seen.has(c.teamPlayerId)) continue;
      seen.add(c.teamPlayerId);
      const player = playerById.get(c.teamPlayerId);
      if (!player) continue;
      // État live (le snapshot de la séquence peut être périmé : évolutions
      // stagées appliquées à la validation, avancement pris ailleurs…).
      const live = liveAdvancementItem(player);
      if (!live) continue;
      const positionSlug = player.position ?? null;
      const access = positionSlug ? accessBySlug.get(positionSlug) : undefined;
      items.push({
        sequenceId: seq.id,
        matchId: seq.matchId,
        seasonId: seq.seasonId,
        teamPlayerId: c.teamPlayerId,
        playerName: c.playerName,
        spp: live.spp,
        advancementsTaken: live.advancementsTaken,
        nextAdvancementCost: live.nextAdvancementCost,
        createdAt: seq.createdAt,
        position: positionSlug,
        primarySkills: access?.primarySkills ?? null,
        secondarySkills: access?.secondarySkills ?? null,
        stats: {
          ma: player?.ma ?? 0,
          st: player?.st ?? 0,
          ag: player?.ag ?? 0,
          pa: player?.pa ?? null,
          av: player?.av ?? 0,
        },
        skills: player?.skills ?? null,
      });
    }
  }

  sendSuccess(res, { teamId, ruleset: team.ruleset, items });
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
  const body: ApplyAdvancementBody = req.body;

  if (body.type === "characteristic") {
    // Amelioration de caracteristique (BB2025) : pas de skill, on cible
    // une stat issue d'un jet D8 (validees par le schema Zod).
    if (!body.stat) {
      sendError(res, "stat est obligatoire pour une amelioration de caracteristique", 400);
      return;
    }
    if (typeof body.d8 !== "number") {
      sendError(res, "d8 est obligatoire pour une amelioration de caracteristique", 400);
      return;
    }
  } else if (!body.skillSlug) {
    // Pour `random-primary`, le tirage doit etre realise cote client
    // puis confirme ici en fournissant `skillSlug`.
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
    category: body.category,
    stat: body.stat,
    d8: body.d8,
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

/**
 * POST /team/:teamId/players/:playerId/advancement/roll-random-primary
 *
 * Tire au sort les 2 compétences candidates d'un `random-primary` (p.121) pour
 * la catégorie choisie. Tirage autoritaire serveur (seed déterministe) : le
 * coach choisira l'une des deux et la confirmera via l'endpoint d'application,
 * qui re-vérifie l'appartenance (anti-triche). Réservé au propriétaire.
 */
export async function handleRollRandomPrimary(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const teamId = req.params.teamId;
  const playerId = req.params.playerId;
  const team = await ensureTeamOwner(userId, teamId, res);
  if (!team) return;
  const body: RollRandomPrimaryBody = req.body;

  const result = await rollRandomPrimarySkill({
    teamId,
    playerId,
    category: body.category,
  });
  if ("skipped" in result && result.skipped) {
    const status =
      result.reason === "player-not-found"
        ? 404
        : result.reason === "player-not-on-team"
          ? 403
          : 400;
    sendError(res, `Tirage refusé: ${result.reason}`, status);
    return;
  }
  sendSuccess(res, result);
}

router.get(
  "/:teamId/pending-advancements",
  authUser,
  handleListPendingAdvancements,
);
router.post(
  "/:teamId/players/:playerId/advancement/roll-random-primary",
  authUser,
  validate(rollRandomPrimarySchema),
  handleRollRandomPrimary,
);
router.post(
  "/:teamId/players/:playerId/advancement",
  authUser,
  validate(applyAdvancementSchema),
  handleApplyAdvancement,
);

export default router;
