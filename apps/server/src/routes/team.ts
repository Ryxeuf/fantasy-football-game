import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { sendError, sendSuccess } from "../utils/api-response";
import { updateTeamValues } from "../utils/team-values";
import {
  getPositionBySlug,
  getDisplayName,
  LEGACY_POSITION_MAPPING,
  type AllowedRoster,
  getStarPlayerBySlug,
  DEFAULT_RULESET,
  type Ruleset,
  SURCHARGE_PER_ADVANCEMENT,
  getRerollCost,
} from "@bb/game-engine";
import {
  validateStarPlayerPairs,
  validateStarPlayersForTeam,
  calculateStarPlayersCost,
} from "../utils/star-player-validation";
import { getRosterFromDb } from "../utils/roster-helpers";
import { resolveRuleset } from "../utils/ruleset-helpers";
import { validate } from "../middleware/validate";
import {
  createFromRosterSchema,
  buildTeamSchema,
  updateTeamSchema,
  updateTeamInfoSchema,
  purchaseSchema,
  addPlayerSchema,
  updatePlayerSkillsSchema,
  addStarPlayerToTeamSchema,
} from "../schemas/team.schemas";
import { chooseTeamSchema } from "../schemas/match.schemas";
import { serverLog } from "../utils/server-log";

const router = Router();
const ALLOWED_TEAMS = [
  "skaven", 
  "lizardmen", 
  "wood_elf",
  "dark_elf",
  "dwarf",
  "goblin",
  "undead",
  "chaos_renegade",
  "ogre",
  "halfling",
  "underworld",
  "chaos_chosen",
  "imperial_nobility",
  "necromantic_horror",
  "orc",
  "nurgle",
  "old_world_alliance",
  "elven_union",
  "human",
  "black_orc",
  "snotling",
  "chaos_dwarf",
  "slann",
  "amazon",
  "high_elf",
  "khorne",
  "vampire",
  "tomb_kings",
  "gnome",
  "norse"
] as const;

function rosterTemplates(roster: AllowedRoster) {
  if (roster === "skaven") {
    return [
      {
        position: "skaven_blitzer",
        count: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "block",
      },
      {
        position: "skaven_thrower",
        count: 1,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 2,
        av: 8,
        skills: "pass,sure-hands",
      },
      {
        position: "skaven_gutter_runner",
        count: 2,
        ma: 9,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "dodge",
      },
      {
        position: "skaven_lineman",
        count: 6,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "",
      },
      // Big Guy optionnel (non inclus par défaut)
    ];
  }
  
  if (roster === "wood_elf") {
    return [
      {
        position: "wood_elf_wardancer",
        count: 2,
        ma: 8,
        st: 3,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "block,dodge,leap",
      },
      {
        position: "wood_elf_catcher",
        count: 2,
        ma: 8,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "catch,dodge",
      },
      {
        position: "wood_elf_thrower",
        count: 1,
        ma: 7,
        st: 3,
        ag: 2,
        pa: 2,
        av: 8,
        skills: "pass,sure-hands",
      },
      {
        position: "wood_elf_lineman",
        count: 6,
        ma: 7,
        st: 3,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "",
      },
      // Treeman optionnel (non inclus par défaut)
    ];
  }
  
  // lizardmen
  return [
    {
      position: "lizardmen_saurus",
      count: 6,
      ma: 6,
      st: 4,
      ag: 4,
      pa: 6,
      av: 10,
      skills: "",
    },
    {
      position: "lizardmen_skink_runner",
      count: 4,
      ma: 8,
      st: 2,
      ag: 3,
      pa: 4,
      av: 8,
      skills: "dodge,stunty",
    },
    {
      position: "lizardmen_chameleon_skink",
      count: 1,
      ma: 7,
      st: 2,
      ag: 3,
      pa: 3,
      av: 8,
      skills: "dodge,on-the-ball,shadowing,stunty",
    },
    // Kroxigor optionnel (non inclus par défaut)
  ];
}

// O.8a — Générateur de noms d'équipe par roster.
// Public (pas d'auth) : aide à la création d'équipe, sans contenu sensible.
// (S25.5n — ApiResponse<T>)
// S27.8.22 — Handlers de lecture seule (name-generator / available /
// mine / rosters/:id) extraits dans `routes/team-readonly-handlers.ts`.
// Re-export pour preserver l'API publique consommee par les tests
// d'integration (`team.test.ts`).
export {
  handleGenerateTeamName,
  handleListAvailableTeams,
  handleListMyTeams,
  handleGetRoster,
} from './team-readonly-handlers';
import {
  handleGenerateTeamName as handleGenerateTeamNameImpl,
  handleListAvailableTeams as handleListAvailableTeamsImpl,
  handleListMyTeams as handleListMyTeamsImpl,
  handleGetRoster as handleGetRosterImpl,
} from './team-readonly-handlers';

router.get("/name-generator", handleGenerateTeamNameImpl);
router.get("/available", authUser, handleListAvailableTeamsImpl);
router.get("/mine", authUser, handleListMyTeamsImpl);
router.get("/rosters/:id", authUser, handleGetRosterImpl);

// Endpoint pour choisir une equipe pour un match (S25.5x — ApiResponse<T>)
export async function handleChooseTeam(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { matchId, teamId } = req.body;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, status: true },
    });
    if (!match) {
      sendError(res, "Partie introuvable", 404);
      return;
    }
    if (match.status !== "pending") {
      sendError(res, `Match non modifiable (statut: ${match.status})`, 400);
      return;
    }

    const selection = await prisma.$transaction(async (tx: any) => {
      const existingMineTx = await tx.teamSelection.findFirst({
        where: { matchId, userId: req.user!.id },
      });
      if (existingMineTx)
        throw Object.assign(
          new Error("Vous avez deja choisi une equipe pour ce match"),
          { status: 409 },
        );

      const alreadyUsedTx = await tx.teamSelection.findFirst({
        where: { matchId, teamId },
      });
      if (alreadyUsedTx)
        throw Object.assign(
          new Error("Cette equipe est deja utilisee dans ce match"),
          { status: 409 },
        );

      return tx.teamSelection.create({
        data: {
          match: { connect: { id: matchId } },
          user: { connect: { id: req.user!.id } },
          team: teamId,
          teamRef: { connect: { id: teamId } },
        },
        include: { teamRef: true },
      } as any);
    });
    sendSuccess(res, { selection }, 201);
  } catch (e: any) {
    if (e?.status) {
      sendError(res, e.message, e.status);
      return;
    }
    if (e?.code === "P2002") {
      sendError(
        res,
        e?.meta?.target?.includes("userId")
          ? "Vous avez deja choisi une equipe pour ce match"
          : "Conflit d'unicite pour ce match",
        409,
      );
      return;
    }
    serverLog.error(e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.post(
  "/choose",
  authUser,
  validate(chooseTeamSchema),
  handleChooseTeam,
);

// Endpoint pour obtenir le detail d'une equipe (S25.5ae — ApiResponse<T>)
export async function handleGetTeamDetail(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const team = await prisma.team.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
      include: {
        players: true,
        starPlayers: true,
      },
    });
    if (!team) {
      sendError(res, "Introuvable", 404);
      return;
    }

    const enrichedStarPlayers = team.starPlayers.map((sp: any) => {
      const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug, team.ruleset);
      return {
        id: sp.id,
        slug: sp.starPlayerSlug,
        cost: sp.cost,
        hiredAt: sp.hiredAt,
        ...starPlayerData,
      };
    });

    const selection = await prisma.teamSelection.findFirst({
      where: { teamId: team.id },
      include: { match: true },
    });

    const localMatches = await prisma.localMatch.findMany({
      where: {
        OR: [{ teamAId: team.id }, { teamBId: team.id }],
      },
      select: {
        id: true,
        status: true,
        teamAId: true,
        teamBId: true,
        scoreTeamA: true,
        scoreTeamB: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    let pending = 0;
    let waitingForPlayer = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let touchdownsFor = 0;
    let touchdownsAgainst = 0;

    for (const match of localMatches) {
      switch (match.status) {
        case "pending":
          pending += 1;
          break;
        case "waiting_for_player":
          waitingForPlayer += 1;
          break;
        case "in_progress":
          inProgress += 1;
          break;
        case "completed":
          completed += 1;
          break;
        case "cancelled":
          cancelled += 1;
          break;
        default:
          break;
      }

      if (match.status === "completed") {
        const isTeamA = match.teamAId === team.id;
        const myScore = isTeamA ? match.scoreTeamA ?? 0 : match.scoreTeamB ?? 0;
        const oppScore = isTeamA
          ? match.scoreTeamB ?? 0
          : match.scoreTeamA ?? 0;

        touchdownsFor += myScore;
        touchdownsAgainst += oppScore;

        if (myScore > oppScore) {
          wins += 1;
        } else if (myScore < oppScore) {
          losses += 1;
        } else {
          draws += 1;
        }
      }
    }

    const localMatchStats = {
      total: localMatches.length,
      pending,
      waitingForPlayer,
      inProgress,
      completed,
      cancelled,
      matchesPlayed: completed,
      wins,
      draws,
      losses,
      touchdownsFor,
      touchdownsAgainst,
      touchdownDiff: touchdownsFor - touchdownsAgainst,
    };

    sendSuccess(res, {
      team: {
        ...team,
        starPlayers: enrichedStarPlayers,
      },
      currentMatch: selection?.match || null,
      localMatchStats,
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de la recuperation de l'equipe:", e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.get("/:id", authUser, handleGetTeamDetail);

router.post(
  "/create-from-roster",
  authUser,
  validate(createFromRosterSchema),
  async (req: AuthenticatedRequest, res) => {
    const {
      name,
      roster,
      teamValue,
      starPlayers: starPlayerSlugs,
      ruleset: bodyRuleset,
    } = req.body as {
      name: string;
      roster: string;
      teamValue?: number;
      starPlayers?: string[];
      ruleset?: string;
    };
    if (!ALLOWED_TEAMS.includes(roster as any))
      return res.status(400).json({ error: "Roster non autorisé" });

    const ruleset = resolveRuleset(bodyRuleset);

    const finalTeamValue = teamValue || 1000;

    // Valider les Star Players si fournis
    const starPlayersToHire = starPlayerSlugs || [];
    if (starPlayersToHire.length > 0) {
      // Valider les paires obligatoires
      const pairValidation = validateStarPlayerPairs(starPlayersToHire);
      if (!pairValidation.valid) {
        return res.status(400).json({ error: pairValidation.error });
      }

      // Calculer le nombre de joueurs du template
      const templates = rosterTemplates(roster);
      let playerCount = 0;
      for (const t of templates) {
        playerCount += t.count;
        if (playerCount >= 16) {
          playerCount = 16;
          break;
        }
      }
      playerCount = Math.max(11, playerCount); // Au moins 11 joueurs

      // Valider que Star Players + joueurs ne dépassent pas 16
      if (playerCount + starPlayersToHire.length > 16) {
        return res.status(400).json({ 
          error: `Trop de joueurs ! ${playerCount} joueurs + ${starPlayersToHire.length} Star Players = ${playerCount + starPlayersToHire.length} (maximum: 16)` 
        });
      }

      // Calculer le coût des Star Players
      const starPlayersCost = calculateStarPlayersCost(starPlayersToHire);
      const budgetInPo = finalTeamValue * 1000;
      
      if (starPlayersCost > budgetInPo) {
        return res.status(400).json({ 
          error: `Budget insuffisant pour les Star Players. Coût: ${(starPlayersCost / 1000).toLocaleString()} K po, budget: ${finalTeamValue} K po` 
        });
      }

      // Valider la disponibilité pour ce roster
      const validation = validateStarPlayersForTeam(
        starPlayersToHire,
        roster,
        playerCount,
        budgetInPo,
        ruleset,
      );
      
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }

    const team = await prisma.team.create({
      data: { 
        ownerId: req.user!.id, 
        name, 
        roster,
        ruleset,
        teamValue: finalTeamValue,
        initialBudget: finalTeamValue,
        treasury: 0,
        rerolls: 0,
        cheerleaders: 0,
        assistants: 0,
        apothecary: false,
        dedicatedFans: 1,
        currentValue: 0,
      },
    });

    // Créer les joueurs
    const templates = rosterTemplates(roster);
    const players: any[] = [];
    let number = 1;
    for (const t of templates) {
      for (let i = 0; i < t.count; i += 1) {
        players.push({
          teamId: team.id,
          name: `${t.position} ${i + 1}`,
          position: t.position,
          number: number++,
          ma: t.ma,
          st: t.st,
          ag: t.ag,
          pa: t.pa,
          av: t.av,
          skills: t.skills,
        });
        if (number > 16) break;
      }
      if (number > 16) break;
    }

    // Assurer au moins 11 joueurs
    while (players.length < 11) {
      players.push({
        teamId: team.id,
        name: `Lineman ${players.length + 1}`,
        position: "Lineman",
        number: players.length + 1,
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "",
      });
    }
    
    await prisma.teamPlayer.createMany({ data: players.slice(0, 16) });

    // Recruter les Star Players si fournis
    if (starPlayersToHire.length > 0) {
      const starPlayersData = starPlayersToHire.map((slug: string) => {
        const sp = getStarPlayerBySlug(slug, ruleset);
        return {
          teamId: team.id,
          starPlayerSlug: slug,
          cost: sp?.cost || 0
        };
      });

      await prisma.teamStarPlayer.createMany({ data: starPlayersData });
    }
    
    // Calculer automatiquement les valeurs d'équipe
    await updateTeamValues(prisma, team.id);
    
    const withPlayers = await prisma.team.findUnique({
      where: { id: team.id },
      include: { 
        players: true,
        starPlayers: true
      },
    });

    // Enrichir les Star Players
    const enrichedTeam = {
      ...withPlayers,
      starPlayers: withPlayers?.starPlayers.map((sp: any) => {
        const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug, withPlayers.ruleset);
        return {
          id: sp.id,
          slug: sp.starPlayerSlug,
          cost: sp.cost,
          hiredAt: sp.hiredAt,
          ...starPlayerData
        };
      }) || []
    };

    res.status(201).json({ team: enrichedTeam });
  },
);

// Endpoint pour creer une equipe via le team-builder (S25.5ad — ApiResponse<T>)
export async function handleBuildTeam(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      name,
      roster,
      teamValue,
      choices,
      starPlayers: starPlayerSlugs,
      ruleset: bodyRuleset,
      rerolls: bodyRerolls,
      cheerleaders: bodyCheerleaders,
      assistants: bodyAssistants,
      apothecary: bodyApothecary,
      dedicatedFans: bodyDedicatedFans,
    } = req.body as {
      name: string;
      roster: string;
      teamValue?: number;
      choices: Array<{ key: string; count: number }>;
      starPlayers?: string[];
      ruleset?: string;
      rerolls?: number;
      cheerleaders?: number;
      assistants?: number;
      apothecary?: boolean;
      dedicatedFans?: number;
    };
    if (!ALLOWED_TEAMS.includes(roster as any)) {
      sendError(res, "Roster non autorise", 400);
      return;
    }
    const ruleset = resolveRuleset(bodyRuleset);

    const finalTeamValue = teamValue || 1000;

    const def = await getRosterFromDb(roster as AllowedRoster, "fr", ruleset);
    if (!def) {
      sendError(res, "Roster non trouve", 400);
      return;
    }

    let totalPlayers = 0;
    let totalCost = 0;
    for (const p of def.positions) {
      const c = Math.max(0, choices.find((x) => x.key === p.slug)?.count ?? 0);
      if (c < p.min || c > p.max) {
        sendError(
          res,
          `Poste ${p.displayName}: min ${p.min}, max ${p.max}`,
          400,
        );
        return;
      }
      totalPlayers += c;
      totalCost += c * p.cost;
    }
    if (totalPlayers < 11 || totalPlayers > 16) {
      sendError(res, "Il faut entre 11 et 16 joueurs", 400);
      return;
    }

    const rerolls = bodyRerolls ?? 0;
    const cheerleaders = bodyCheerleaders ?? 0;
    const assistants = bodyAssistants ?? 0;
    const apothecary = bodyApothecary ?? false;
    const dedicatedFans = bodyDedicatedFans ?? 1;

    const rerollUnitCost = getRerollCost(roster) / 1000;
    const staffCost =
      rerolls * rerollUnitCost +
      cheerleaders * 10 +
      assistants * 10 +
      (apothecary ? 50 : 0) +
      Math.max(0, dedicatedFans - 1) * 10;

    const starPlayersToHire = starPlayerSlugs || [];
    let starPlayersCost = 0;

    if (starPlayersToHire.length > 0) {
      const pairValidation = validateStarPlayerPairs(starPlayersToHire);
      if (!pairValidation.valid) {
        sendError(res, pairValidation.error ?? "Validation paires echouee", 400);
        return;
      }

      if (totalPlayers + starPlayersToHire.length > 16) {
        sendError(
          res,
          `Trop de joueurs ! ${totalPlayers} joueurs + ${starPlayersToHire.length} Star Players = ${totalPlayers + starPlayersToHire.length} (maximum: 16)`,
          400,
        );
        return;
      }

      starPlayersCost =
        calculateStarPlayersCost(starPlayersToHire, ruleset) / 1000;

      const budgetInPo = finalTeamValue * 1000;
      const validation = validateStarPlayersForTeam(
        starPlayersToHire,
        roster,
        totalPlayers,
        budgetInPo - totalCost * 1000 - staffCost * 1000,
        ruleset,
      );

      if (!validation.valid) {
        sendError(res, validation.error ?? "Validation Star Players echouee", 400);
        return;
      }
    }

    const totalBudgetUsed = totalCost + starPlayersCost + staffCost;
    if (totalBudgetUsed > finalTeamValue) {
      sendError(
        res,
        `Budget depasse: ${totalBudgetUsed}k (${totalCost}k joueurs + ${starPlayersCost}k Star Players + ${staffCost}k staff) / ${finalTeamValue}k`,
        400,
      );
      return;
    }

    const team = await prisma.team.create({
      data: {
        ownerId: req.user!.id,
        name,
        roster,
        ruleset,
        teamValue: finalTeamValue,
        initialBudget: finalTeamValue,
        treasury: 0,
        rerolls,
        cheerleaders,
        assistants,
        apothecary,
        dedicatedFans,
        currentValue: 0,
      },
    });

    let number = 1;
    const players: any[] = [];
    for (const p of def.positions) {
      const c = Math.max(0, choices.find((x) => x.key === p.slug)?.count ?? 0);
      for (let i = 0; i < c; i += 1) {
        players.push({
          teamId: team.id,
          name: `${p.displayName} ${i + 1}`,
          position: p.slug,
          number: number++,
          ma: p.ma,
          st: p.st,
          ag: p.ag,
          pa: p.pa,
          av: p.av,
          skills: p.skills,
        });
      }
    }
    await prisma.teamPlayer.createMany({ data: players });

    if (starPlayersToHire.length > 0) {
      const starPlayersData = starPlayersToHire.map((slug: string) => {
        const sp = getStarPlayerBySlug(slug, ruleset);
        return {
          teamId: team.id,
          starPlayerSlug: slug,
          cost: sp?.cost || 0,
        };
      });

      await prisma.teamStarPlayer.createMany({ data: starPlayersData });
    }

    await updateTeamValues(prisma, team.id);

    const withPlayers = await prisma.team.findUnique({
      where: { id: team.id },
      include: { players: true, starPlayers: true },
    });

    const enrichedTeam = {
      ...withPlayers,
      starPlayers:
        withPlayers?.starPlayers.map((sp: any) => {
          const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug, ruleset);
          return {
            id: sp.id,
            slug: sp.starPlayerSlug,
            cost: sp.cost,
            hiredAt: sp.hiredAt,
            ...starPlayerData,
          };
        }) || [],
    };

    sendSuccess(
      res,
      {
        team: enrichedTeam,
        cost: totalBudgetUsed,
        budget: finalTeamValue,
        breakdown: {
          players: totalCost,
          starPlayers: starPlayersCost,
          staff: staffCost,
        },
      },
      201,
    );
  } catch (e: unknown) {
    serverLog.error("Erreur lors de la creation de l'equipe:", e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.post("/build", authUser, validate(buildTeamSchema), handleBuildTeam);

// Endpoint pour mettre a jour les informations d'equipe (S25.5u — ApiResponse<T>)
// S27.8.25 — Handlers de mutation team (info / recalculate / update)
// extraits dans `routes/team-mutation-handlers.ts`. Re-export pour
// preserver l'API publique consommee par `team.test.ts`.
export {
  handlePutTeamInfo,
  handleRecalculateTeam,
  handleUpdateTeam,
} from './team-mutation-handlers';
import {
  handlePutTeamInfo as handlePutTeamInfoImpl,
  handleRecalculateTeam as handleRecalculateTeamImpl,
  handleUpdateTeam as handleUpdateTeamImpl,
} from './team-mutation-handlers';

router.put(
  "/:id/info",
  authUser,
  validate(updateTeamInfoSchema),
  handlePutTeamInfoImpl,
);
router.post("/:id/recalculate", authUser, handleRecalculateTeamImpl);
router.put("/:id", authUser, validate(updateTeamSchema), handleUpdateTeamImpl);

// S27.8.24 — Handlers Player CRUD (add / delete / update-skills /
// list-available-positions) extraits dans
// `routes/team-player-handlers.ts`. Re-export pour preserver l'API
// publique consommee par les tests d'integration (`team.test.ts`).
export {
  handleAddTeamPlayer,
  handleDeleteTeamPlayer,
  handleUpdatePlayerSkills,
  handleListAvailablePositions,
} from './team-player-handlers';
import {
  handleAddTeamPlayer as handleAddTeamPlayerImpl,
  handleDeleteTeamPlayer as handleDeleteTeamPlayerImpl,
  handleUpdatePlayerSkills as handleUpdatePlayerSkillsImpl,
  handleListAvailablePositions as handleListAvailablePositionsImpl,
} from './team-player-handlers';

router.post(
  "/:id/players",
  authUser,
  validate(addPlayerSchema),
  handleAddTeamPlayerImpl,
);
router.delete(
  "/:id/players/:playerId",
  authUser,
  handleDeleteTeamPlayerImpl,
);
router.put(
  "/:id/players/:playerId/skills",
  authUser,
  validate(updatePlayerSkillsSchema),
  handleUpdatePlayerSkillsImpl,
);
router.get(
  "/:id/available-positions",
  authUser,
  handleListAvailablePositionsImpl,
);

// =============================================================================
// STAR PLAYERS ENDPOINTS
// =============================================================================

// S27.8.23 — Handlers Star Players (list / list available / hire /
// delete) extraits dans `routes/team-star-player-handlers.ts`.
// Re-export pour preserver l'API publique consommee par les tests
// d'integration (`team.test.ts`).
export {
  handleListTeamStarPlayers,
  handleListAvailableStarPlayers,
  handleHireStarPlayer,
  handleDeleteTeamStarPlayer,
} from './team-star-player-handlers';
import {
  handleListTeamStarPlayers as handleListTeamStarPlayersImpl,
  handleListAvailableStarPlayers as handleListAvailableStarPlayersImpl,
  handleHireStarPlayer as handleHireStarPlayerImpl,
  handleDeleteTeamStarPlayer as handleDeleteTeamStarPlayerImpl,
} from './team-star-player-handlers';

router.get("/:id/star-players", authUser, handleListTeamStarPlayersImpl);
router.get(
  "/:id/available-star-players",
  authUser,
  handleListAvailableStarPlayersImpl,
);
router.post(
  "/:id/star-players",
  authUser,
  validate(addStarPlayerToTeamSchema),
  handleHireStarPlayerImpl,
);
router.delete(
  "/:id/star-players/:starPlayerId",
  authUser,
  handleDeleteTeamStarPlayerImpl,
);

// Endpoint pour acheter avec la trésorerie (entre les matchs)
// Endpoint pour acheter avec la tresorerie (S25.5w — ApiResponse<T>)
export async function handlePurchase(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const { type, position, name, number } = req.body as {
    type:
      | "player"
      | "reroll"
      | "cheerleader"
      | "assistant"
      | "apothecary"
      | "dedicated_fan";
    position?: string;
    name?: string;
    number?: number;
  };

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true },
    });

    if (!team) {
      sendError(res, "Equipe introuvable", 404);
      return;
    }

    const activeSelection = await prisma.teamSelection.findFirst({
      where: {
        teamId,
        match: { status: { in: ["pending", "active"] } },
      },
    });

    if (activeSelection) {
      sendError(res, "Impossible d'acheter pendant un match en cours", 400);
      return;
    }

    let cost = 0;
    let description = "";

    switch (type) {
      case "player": {
        if (!position || !name || !number) {
          sendError(
            res,
            "position, name et number requis pour acheter un joueur",
            400,
          );
          return;
        }

        if (
          team.players.filter((p: typeof team.players[number]) => !p.dead)
            .length >= 16
        ) {
          sendError(
            res,
            "Une equipe ne peut pas avoir plus de 16 joueurs vivants",
            400,
          );
          return;
        }

        const existingNumber = team.players.find(
          (p: typeof team.players[number]) => p.number === number && !p.dead,
        );
        if (existingNumber) {
          sendError(
            res,
            `Le numero ${number} est deja utilise par ${existingNumber.name}`,
            400,
          );
          return;
        }

        const rosterData = await getRosterFromDb(
          team.roster as AllowedRoster,
          "fr",
          (team.ruleset as Ruleset) ?? DEFAULT_RULESET,
        );
        if (!rosterData) {
          sendError(res, "Roster non reconnu", 400);
          return;
        }

        const positionData = rosterData.positions.find(
          (p: any) => p.slug === position,
        );
        if (!positionData) {
          sendError(
            res,
            `Position '${position}' non trouvee dans le roster ${team.roster}`,
            400,
          );
          return;
        }

        const currentPositionCount = team.players.filter(
          (p: typeof team.players[number]) =>
            p.position === position && !p.dead,
        ).length;
        if (currentPositionCount >= positionData.max) {
          sendError(
            res,
            `Limite maximale atteinte pour la position ${positionData.displayName} (${positionData.max})`,
            400,
          );
          return;
        }

        cost = positionData.cost * 1000;

        if (team.treasury < cost) {
          sendError(
            res,
            `Tresorerie insuffisante. Cout: ${Math.round(cost / 1000)}k po, Tresorerie: ${Math.round(team.treasury / 1000)}k po`,
            400,
          );
          return;
        }

        await prisma.$transaction([
          prisma.teamPlayer.create({
            data: {
              teamId,
              name: name.trim(),
              position,
              number,
              ma: positionData.ma,
              st: positionData.st,
              ag: positionData.ag,
              pa: positionData.pa,
              av: positionData.av,
              skills: positionData.skills,
            },
          }),
          prisma.team.update({
            where: { id: teamId },
            data: { treasury: team.treasury - cost },
          }),
        ]);

        description = `Joueur ${name.trim()} (${positionData.displayName}) recrute`;
        break;
      }

      case "reroll": {
        if (team.rerolls >= 8) {
          sendError(res, "Maximum 8 relances par equipe", 400);
          return;
        }
        cost = getRerollCost(team.roster) * 2;

        if (team.treasury < cost) {
          sendError(
            res,
            `Tresorerie insuffisante. Cout: ${Math.round(cost / 1000)}k po, Tresorerie: ${Math.round(team.treasury / 1000)}k po`,
            400,
          );
          return;
        }

        await prisma.team.update({
          where: { id: teamId },
          data: {
            rerolls: team.rerolls + 1,
            treasury: team.treasury - cost,
          },
        });
        description = `Relance achetee (cout double: ${Math.round(cost / 1000)}k po)`;
        break;
      }

      case "cheerleader": {
        if (team.cheerleaders >= 12) {
          sendError(res, "Maximum 12 cheerleaders", 400);
          return;
        }
        cost = 10000;

        if (team.treasury < cost) {
          sendError(
            res,
            `Tresorerie insuffisante. Cout: 10k po, Tresorerie: ${Math.round(team.treasury / 1000)}k po`,
            400,
          );
          return;
        }

        await prisma.team.update({
          where: { id: teamId },
          data: {
            cheerleaders: team.cheerleaders + 1,
            treasury: team.treasury - cost,
          },
        });
        description = "Cheerleader recrutee";
        break;
      }

      case "assistant": {
        if (team.assistants >= 6) {
          sendError(res, "Maximum 6 assistants", 400);
          return;
        }
        cost = 10000;

        if (team.treasury < cost) {
          sendError(
            res,
            `Tresorerie insuffisante. Cout: 10k po, Tresorerie: ${Math.round(team.treasury / 1000)}k po`,
            400,
          );
          return;
        }

        await prisma.team.update({
          where: { id: teamId },
          data: {
            assistants: team.assistants + 1,
            treasury: team.treasury - cost,
          },
        });
        description = "Assistant recrute";
        break;
      }

      case "apothecary": {
        if (team.apothecary) {
          sendError(res, "L'equipe a deja un apothicaire", 400);
          return;
        }
        cost = 50000;

        if (team.treasury < cost) {
          sendError(
            res,
            `Tresorerie insuffisante. Cout: 50k po, Tresorerie: ${Math.round(team.treasury / 1000)}k po`,
            400,
          );
          return;
        }

        await prisma.team.update({
          where: { id: teamId },
          data: {
            apothecary: true,
            treasury: team.treasury - cost,
          },
        });
        description = "Apothicaire recrute";
        break;
      }

      case "dedicated_fan": {
        if (team.dedicatedFans >= 6) {
          sendError(res, "Maximum 6 fans devoues", 400);
          return;
        }
        cost = 10000;

        if (team.treasury < cost) {
          sendError(
            res,
            `Tresorerie insuffisante. Cout: 10k po, Tresorerie: ${Math.round(team.treasury / 1000)}k po`,
            400,
          );
          return;
        }

        await prisma.team.update({
          where: { id: teamId },
          data: {
            dedicatedFans: team.dedicatedFans + 1,
            treasury: team.treasury - cost,
          },
        });
        description = "Fan devoue recrute";
        break;
      }
    }

    await updateTeamValues(prisma, teamId);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    sendSuccess(res, {
      team: updatedTeam,
      purchase: { type, cost, description },
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de l'achat:", e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.post(
  "/:id/purchase",
  authUser,
  validate(purchaseSchema),
  handlePurchase,
);

export default router;
