/**
 * Données de test pour les ligues — DEV UNIQUEMENT.
 *
 * Permet au commissaire d'ajouter rapidement une équipe de test (avec un
 * coach jetable) inscrite à une saison, pour pouvoir tester le calendrier,
 * les classements, la saisie de résultats, etc. sans devoir créer
 * manuellement plusieurs comptes.
 *
 * Garde-fou : toutes les routes renvoient 404 si `NODE_ENV === "production"`.
 * Le conteneur dev tourne avec `NODE_ENV=development` (cf. docker-compose.yml).
 */

import { Router, type Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { requireLeagueCreator } from "../services/league-scheduler";
import { addParticipant, parseAllowedRosters } from "../services/league";
import { updateTeamValues } from "../utils/team-values";
import { sendError, sendSuccess } from "../utils/api-response";

const router = Router();

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

/** 11 trois-quarts génériques : suffisant pour une équipe de test valide. */
function genericPlayers() {
  return Array.from({ length: 11 }, (_, i) => ({
    name: `Trois-quart ${i + 1}`,
    position: "Lineman",
    number: i + 1,
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    skills: "",
  }));
}

export async function handleAddTestParticipant(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (isProd()) {
    sendError(res, "Indisponible", 404);
    return;
  }
  const userId = req.user?.id;
  if (!userId) {
    sendError(res, "Non authentifié", 401);
    return;
  }
  const seasonId = req.params.seasonId;

  // Seul le commissaire (créateur) de la ligue peut générer des données.
  try {
    await requireLeagueCreator(userId, seasonId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "season-not-found") {
      sendError(res, "Saison introuvable", 404);
    } else {
      sendError(
        res,
        "Seul le commissaire peut ajouter une équipe de test",
        403,
      );
    }
    return;
  }

  const season = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      league: { select: { ruleset: true, allowedRosters: true } },
    },
  });
  if (!season) {
    sendError(res, "Saison introuvable", 404);
    return;
  }

  const ruleset = season.league.ruleset;
  const allowed = parseAllowedRosters(season.league.allowedRosters ?? null);
  // Le `roster` de l'équipe doit respecter `allowedRosters` (validé par
  // addParticipant). On prend le premier autorisé, sinon un défaut.
  const roster = allowed && allowed.length > 0 ? allowed[0] : "lizardmen";

  // Identifiant unique lisible pour le coach + l'équipe de test.
  const stamp = Date.now().toString(36).slice(-5);

  const coach = await prisma.user.create({
    data: {
      email: `test-coach-${stamp}@nuffle.test`,
      // Hash non-bcrypt → ce compte jetable ne peut pas se connecter.
      passwordHash: "!test-account-no-login",
      coachName: `Coach Test ${stamp}`,
    },
  });

  const team = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.team.create({
      data: {
        ownerId: coach.id,
        name: `Test ${roster} ${stamp}`,
        roster,
        ruleset,
        format: "bb11",
        teamValue: 1000,
        initialBudget: 1000,
        treasury: 0,
        rerolls: 0,
        cheerleaders: 0,
        assistants: 0,
        apothecary: false,
        dedicatedFans: 1,
        currentValue: 0,
      },
    });
    await tx.teamPlayer.createMany({
      data: genericPlayers().map((p) => ({ ...p, teamId: created.id })),
    });
    return created;
  });

  await updateTeamValues(prisma as never, team.id);

  try {
    const participant = await addParticipant({ seasonId, teamId: team.id });
    sendSuccess(
      res,
      {
        participant,
        team: { id: team.id, name: team.name, roster },
        coach: { id: coach.id, coachName: coach.coachName },
      },
      201,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Échec de l'inscription";
    sendError(res, msg, 400);
  }
}

router.post(
  "/seasons/:seasonId/test-participant",
  authUser,
  handleAddTestParticipant,
);

export default router;
