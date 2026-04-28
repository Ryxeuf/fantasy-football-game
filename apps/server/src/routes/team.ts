import { Router } from "express";
import type { Response } from "express";
import { Prisma } from "@prisma/client";
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
  getNextAdvancementPspCost,
  SURCHARGE_PER_ADVANCEMENT,
  getPositionCategoryAccess,
  SKILLS_BY_SLUG,
  SKILLS_DEFINITIONS,
  type AdvancementType,
  type PlayerAdvancement,
  getRerollCost,
} from "@bb/game-engine";
import {
  validateStarPlayerHire,
  validateStarPlayerPairs,
  validateStarPlayersForTeam,
  getTeamAvailableStarPlayers,
  calculateStarPlayersCost,
  requiresPair,
} from "../utils/star-player-validation";
import { getRosterFromDb } from "../utils/roster-helpers";
import { resolveRuleset, isValidRuleset } from "../utils/ruleset-helpers";
import { parsePagination, buildApiMeta } from "../utils/pagination";
import { generateTeamName } from "../services/team-name-generator";
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
export function handleGenerateTeamName(
  req: AuthenticatedRequest,
  res: Response,
): void {
  const roster =
    typeof req.query.roster === "string" && req.query.roster.length > 0
      ? req.query.roster
      : "generic";
  const seed =
    typeof req.query.seed === "string" && req.query.seed.length > 0
      ? req.query.seed
      : undefined;
  const name = generateTeamName(roster, seed ? { seed } : {});
  sendSuccess(res, { name, roster });
}

router.get("/name-generator", handleGenerateTeamName);

// (S25.5o — ApiResponse<T>)
export async function handleListAvailableTeams(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const requestedRuleset = req.query.ruleset as string | undefined;
  const filterRuleset = isValidRuleset(requestedRuleset)
    ? (requestedRuleset as Ruleset)
    : undefined;
  const teams = await prisma.team.findMany({
    where: {
      ownerId: req.user!.id,
      ...(filterRuleset && { ruleset: filterRuleset }),
      selections: {
        none: {
          match: { status: { in: ["pending", "active"] } },
        },
      },
    },
    select: { id: true, name: true, roster: true, ruleset: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  sendSuccess(res, { teams });
}

router.get("/available", authUser, handleListAvailableTeams);

// (S25.5p — ApiResponse<T>)
export async function handleListMyTeams(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const requestedRuleset = req.query.ruleset as string | undefined;
  const filterRuleset = isValidRuleset(requestedRuleset)
    ? (requestedRuleset as Ruleset)
    : undefined;
  const { limit, offset } = parsePagination(
    req.query as Record<string, unknown>,
  );
  const where = {
    ownerId: req.user!.id,
    ...(filterRuleset && { ruleset: filterRuleset }),
  };
  const [teams, total] = await Promise.all([
    prisma.team.findMany({
      where,
      select: { id: true, name: true, roster: true, ruleset: true, createdAt: true, currentValue: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.team.count({ where }),
  ]);
  sendSuccess(res, { teams, meta: buildApiMeta({ total, limit, offset }) });
}

router.get("/mine", authUser, handleListMyTeams);

// (S25.5n — ApiResponse<T>)
export async function handleGetRoster(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id;
  if (!(ALLOWED_TEAMS as readonly string[]).includes(id)) {
    sendError(res, "Roster inconnu", 404);
    return;
  }
  const ruleset = resolveRuleset(req.query.ruleset as string | undefined);

  const roster = await getRosterFromDb(id, "fr", ruleset);
  if (!roster) {
    sendError(res, "Roster non trouve en base de donnees", 404);
    return;
  }

  sendSuccess(res, { roster, ruleset });
}

router.get("/rosters/:id", authUser, handleGetRoster);

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

router.get("/:id", authUser, async (req: AuthenticatedRequest, res) => {
  const team = await prisma.team.findFirst({
    where: { id: req.params.id, ownerId: req.user!.id },
    include: { 
      players: true,
      starPlayers: true
    },
  });
  if (!team) return res.status(404).json({ error: "Introuvable" });
  
  // Enrichir les Star Players avec leurs données complètes
  const enrichedStarPlayers = team.starPlayers.map((sp: any) => {
    const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug, team.ruleset);
    return {
      id: sp.id,
      slug: sp.starPlayerSlug,
      cost: sp.cost,
      hiredAt: sp.hiredAt,
      ...starPlayerData
    };
  });
  
  // état de match si sélectionnée
  const selection = await prisma.teamSelection.findFirst({
    where: { teamId: team.id },
    include: { match: true },
  });

  // Statistiques de matchs locaux pour cette équipe — bornées pour éviter
  // une croissance illimitée (cap à 500 derniers matchs, agrégats locaux).
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
      const oppScore = isTeamA ? match.scoreTeamB ?? 0 : match.scoreTeamA ?? 0;

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

  res.json({ 
    team: {
      ...team,
      starPlayers: enrichedStarPlayers
    }, 
    currentMatch: selection?.match || null,
    localMatchStats,
  });
});

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

router.post("/build", authUser, validate(buildTeamSchema), async (req: AuthenticatedRequest, res) => {
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
  if (!ALLOWED_TEAMS.includes(roster as any))
    return res.status(400).json({ error: "Roster non autorisé" });
  const ruleset = resolveRuleset(bodyRuleset);

  const finalTeamValue = teamValue || 1000;
    
  const def = await getRosterFromDb(roster as AllowedRoster, "fr", ruleset);
  if (!def) {
    return res.status(400).json({ error: "Roster non trouvé" });
  }
  
  // Validation min/max et budget
  let totalPlayers = 0;
  let totalCost = 0;
  for (const p of def.positions) {
    const c = Math.max(0, choices.find((x) => x.key === p.slug)?.count ?? 0);
    if (c < p.min || c > p.max)
      return res
        .status(400)
        .json({ error: `Poste ${p.displayName}: min ${p.min}, max ${p.max}` });
    totalPlayers += c;
    totalCost += c * p.cost;
  }
  if (totalPlayers < 11 || totalPlayers > 16)
    return res.status(400).json({ error: "Il faut entre 11 et 16 joueurs" });

  // Staff facultatif: valeurs par défaut si non fournies. Calculé avant
  // la validation Star Players pour que leur budget disponible soit juste.
  const rerolls = bodyRerolls ?? 0;
  const cheerleaders = bodyCheerleaders ?? 0;
  const assistants = bodyAssistants ?? 0;
  const apothecary = bodyApothecary ?? false;
  const dedicatedFans = bodyDedicatedFans ?? 1;

  const rerollUnitCost = getRerollCost(roster) / 1000; // kpo
  const staffCost =
    rerolls * rerollUnitCost +
    cheerleaders * 10 +
    assistants * 10 +
    (apothecary ? 50 : 0) +
    Math.max(0, dedicatedFans - 1) * 10;

  // Valider les Star Players si fournis
  const starPlayersToHire = starPlayerSlugs || [];
  let starPlayersCost = 0;

  if (starPlayersToHire.length > 0) {
    // Valider les paires obligatoires
    const pairValidation = validateStarPlayerPairs(starPlayersToHire);
    if (!pairValidation.valid) {
      return res.status(400).json({ error: pairValidation.error });
    }

    // Valider que Star Players + joueurs ne dépassent pas 16
    if (totalPlayers + starPlayersToHire.length > 16) {
      return res.status(400).json({
        error: `Trop de joueurs ! ${totalPlayers} joueurs + ${starPlayersToHire.length} Star Players = ${totalPlayers + starPlayersToHire.length} (maximum: 16)`
      });
    }

    // Calculer le coût des Star Players
    starPlayersCost = calculateStarPlayersCost(starPlayersToHire, ruleset) / 1000;

    // Budget disponible = budget total - joueurs - staff déjà engagé
    const budgetInPo = finalTeamValue * 1000;
    const validation = validateStarPlayersForTeam(
      starPlayersToHire,
      roster,
      totalPlayers,
      budgetInPo - (totalCost * 1000) - (staffCost * 1000),
      ruleset,
    );

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
  }

  // Vérifier le budget total (joueurs + Star Players + staff)
  const totalBudgetUsed = totalCost + starPlayersCost + staffCost;
  if (totalBudgetUsed > finalTeamValue)
    return res
      .status(400)
      .json({
        error: `Budget dépassé: ${totalBudgetUsed}k (${totalCost}k joueurs + ${starPlayersCost}k Star Players + ${staffCost}k staff) / ${finalTeamValue}k`
      });

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

  // Créer les joueurs
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
      const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug, ruleset);
      return {
        id: sp.id,
        slug: sp.starPlayerSlug,
        cost: sp.cost,
        hiredAt: sp.hiredAt,
        ...starPlayerData
      };
    }) || []
  };

  res
    .status(201)
    .json({
      team: enrichedTeam,
      cost: totalBudgetUsed,
      budget: finalTeamValue,
      breakdown: {
        players: totalCost,
        starPlayers: starPlayersCost,
        staff: staffCost,
      }
    });
});

// Endpoint pour mettre a jour les informations d'equipe (S25.5u — ApiResponse<T>)
export async function handlePutTeamInfo(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const { rerolls, cheerleaders, assistants, apothecary, dedicatedFans } =
    req.body as {
      rerolls?: number;
      cheerleaders?: number;
      assistants?: number;
      apothecary?: boolean;
      dedicatedFans?: number;
    };

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
    });

    if (!team) {
      sendError(res, "Equipe introuvable", 404);
      return;
    }

    const activeSelection = await prisma.teamSelection.findFirst({
      where: {
        teamId: teamId,
        match: { status: { in: ["pending", "active"] } },
      },
    });

    if (activeSelection) {
      sendError(
        res,
        "Impossible de modifier cette equipe car elle est engagee dans un match en cours",
        400,
      );
      return;
    }

    await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(rerolls !== undefined && { rerolls }),
        ...(cheerleaders !== undefined && { cheerleaders }),
        ...(assistants !== undefined && { assistants }),
        ...(apothecary !== undefined && { apothecary }),
        ...(dedicatedFans !== undefined && { dedicatedFans }),
      },
      include: { players: true },
    });

    await updateTeamValues(prisma, teamId);

    const finalTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    sendSuccess(res, { team: finalTeam });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de la modification des informations d'equipe:", e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.put(
  "/:id/info",
  authUser,
  validate(updateTeamInfoSchema),
  handlePutTeamInfo,
);

// Endpoint pour recalculer les valeurs d'equipe (S25.5r — ApiResponse<T>)
export async function handleRecalculateTeam(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
    });

    if (!team) {
      sendError(res, "Equipe introuvable", 404);
      return;
    }

    const { teamValue, currentValue } = await updateTeamValues(prisma, teamId);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    sendSuccess(res, {
      team: updatedTeam,
      message: `Valeurs recalculees: VE=${teamValue.toLocaleString()} po, VEA=${currentValue.toLocaleString()} po`,
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors du recalcul des valeurs d'equipe:", e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.post("/:id/recalculate", authUser, handleRecalculateTeam);

// Endpoint pour mettre a jour une equipe (S25.5y — ApiResponse<T>)
export async function handleUpdateTeam(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const { players, name } = req.body as {
    players: Array<{ id: string; name: string; number: number }>;
    name?: string;
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
        teamId: teamId,
        match: { status: { in: ["pending", "active"] } },
      },
    });

    if (activeSelection) {
      sendError(
        res,
        "Impossible de modifier cette equipe car elle est engagee dans un match en cours",
        400,
      );
      return;
    }

    const playerIds = team.players.map((p: any) => p.id);
    const providedPlayerIds = players.map((p: any) => p.id);

    const invalidPlayerIds = providedPlayerIds.filter(
      (id: any) => !playerIds.includes(id),
    );
    if (invalidPlayerIds.length > 0) {
      sendError(res, `Joueurs invalides: ${invalidPlayerIds.join(", ")}`, 400);
      return;
    }

    const missingPlayerIds = playerIds.filter(
      (id: any) => !providedPlayerIds.includes(id),
    );
    if (missingPlayerIds.length > 0) {
      sendError(res, `Joueurs manquants: ${missingPlayerIds.join(", ")}`, 400);
      return;
    }

    const numbers = players.map((p) => p.number);
    const uniqueNumbers = new Set(numbers);
    if (uniqueNumbers.size !== numbers.length) {
      sendError(res, "Les numeros de joueurs doivent etre uniques", 400);
      return;
    }

    const invalidNumbers = numbers.filter(
      (n) => n < 1 || n > 99 || !Number.isInteger(n),
    );
    if (invalidNumbers.length > 0) {
      sendError(res, "Les numeros doivent etre des entiers entre 1 et 99", 400);
      return;
    }

    const emptyNames = players.filter((p) => !p.name || p.name.trim() === "");
    if (emptyNames.length > 0) {
      sendError(res, "Tous les joueurs doivent avoir un nom", 400);
      return;
    }

    if (name !== undefined) {
      if (!name || name.trim() === "") {
        sendError(res, "Le nom de l'equipe ne peut pas etre vide", 400);
        return;
      }
      if (name.trim().length > 100) {
        sendError(
          res,
          "Le nom de l'equipe ne peut pas depasser 100 caracteres",
          400,
        );
        return;
      }
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [];
    if (name !== undefined) {
      operations.push(
        prisma.team.update({
          where: { id: teamId },
          data: { name: name.trim() },
        }),
      );
    }
    for (const player of players) {
      operations.push(
        prisma.teamPlayer.update({
          where: { id: player.id },
          data: {
            name: player.name.trim(),
            number: player.number,
          },
        }),
      );
    }
    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    const updates = new Map(
      players.map((p) => [
        p.id,
        { name: p.name.trim(), number: p.number },
      ]),
    );
    const updatedTeam = {
      ...team,
      name: name !== undefined ? name.trim() : team.name,
      players: team.players.map((existing: any) => {
        const update = updates.get(existing.id);
        return update ? { ...existing, ...update } : existing;
      }),
    };

    sendSuccess(res, { team: updatedTeam });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de la modification de l'equipe:", e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.put("/:id", authUser, validate(updateTeamSchema), handleUpdateTeam);

// Endpoint pour ajouter un joueur à une équipe
// Endpoint pour ajouter un joueur a une equipe (S25.5z — ApiResponse<T>)
export async function handleAddTeamPlayer(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const { position, name, number } = req.body;

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
        teamId: teamId,
        match: { status: { in: ["pending", "active"] } },
      },
    });

    if (activeSelection) {
      sendError(
        res,
        "Impossible de modifier cette equipe car elle est engagee dans un match en cours",
        400,
      );
      return;
    }

    if (team.players.length >= 16) {
      sendError(res, "Une equipe ne peut pas avoir plus de 16 joueurs", 400);
      return;
    }

    const existingPlayer = team.players.find((p: any) => p.number === number);
    if (existingPlayer) {
      sendError(
        res,
        `Le numero ${number} est deja utilise par ${existingPlayer.name}`,
        400,
      );
      return;
    }

    if (number < 1 || number > 99 || !Number.isInteger(number)) {
      sendError(res, "Le numero doit etre un entier entre 1 et 99", 400);
      return;
    }

    if (!name.trim()) {
      sendError(res, "Le nom ne peut pas etre vide", 400);
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
      (p: any) => p.position === position,
    ).length;
    if (currentPositionCount >= positionData.max) {
      sendError(
        res,
        `Limite maximale atteinte pour la position ${positionData.displayName} (${positionData.max})`,
        400,
      );
      return;
    }

    const { getPlayerCost } = await import(
      "../../../../packages/game-engine/src/utils/team-value-calculator"
    );
    const teamRuleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
    const currentTotalCost = team.players.reduce(
      (total: number, player: any) => {
        return total + getPlayerCost(player.position, team.roster, teamRuleset);
      },
      0,
    );

    const newPlayerCost = positionData.cost * 1000;
    const newTotalCost = currentTotalCost + newPlayerCost;
    const budgetInPo = team.initialBudget * 1000;
    if (newTotalCost > budgetInPo) {
      sendError(
        res,
        `Budget depasse ! Cout actuel: ${Math.round(currentTotalCost / 1000)}k po, nouveau cout: ${Math.round(newTotalCost / 1000)}k po, budget: ${team.initialBudget}k po`,
        400,
      );
      return;
    }

    const newPlayer = await prisma.teamPlayer.create({
      data: {
        teamId: teamId,
        name: name.trim(),
        position: position,
        number: number,
        ma: positionData.ma,
        st: positionData.st,
        ag: positionData.ag,
        pa: positionData.pa,
        av: positionData.av,
        skills: positionData.skills,
      },
    });

    await updateTeamValues(prisma, teamId);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    sendSuccess(
      res,
      {
        team: updatedTeam,
        newPlayer: newPlayer,
      },
      201,
    );
  } catch (e: unknown) {
    serverLog.error("Erreur lors de l'ajout du joueur:", e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.post(
  "/:id/players",
  authUser,
  validate(addPlayerSchema),
  handleAddTeamPlayer,
);

// Endpoint pour supprimer un joueur d'une equipe (S25.5t — ApiResponse<T>)
export async function handleDeleteTeamPlayer(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const playerId = req.params.playerId;

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
        teamId: teamId,
        match: { status: { in: ["pending", "active"] } },
      },
    });

    if (activeSelection) {
      sendError(
        res,
        "Impossible de modifier cette equipe car elle est engagee dans un match en cours",
        400,
      );
      return;
    }

    const player = team.players.find((p: any) => p.id === playerId);
    if (!player) {
      sendError(res, "Joueur introuvable", 404);
      return;
    }

    if (team.players.length <= 11) {
      sendError(res, "Une equipe doit avoir au minimum 11 joueurs", 400);
      return;
    }

    await prisma.teamPlayer.delete({ where: { id: playerId } });

    await updateTeamValues(prisma, teamId);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    sendSuccess(res, { team: updatedTeam });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de la suppression du joueur:", e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.delete("/:id/players/:playerId", authUser, handleDeleteTeamPlayer);

// Endpoint pour ajouter une competence a un joueur (S25.5ac — ApiResponse<T>)
export async function handleUpdatePlayerSkills(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const playerId = req.params.playerId;
  const {
    skillSlug: clientSkillSlug,
    advancementType,
    skillCategory,
  } = req.body as {
    skillSlug?: string;
    advancementType: AdvancementType;
    skillCategory?: string;
  };

  try {
    const isRandom =
      advancementType === "random-primary" ||
      advancementType === "random-secondary";

    if (!isRandom && !clientSkillSlug) {
      sendError(res, "skillSlug est requis pour un avancement choisi", 400);
      return;
    }
    if (isRandom && !skillCategory) {
      sendError(res, "skillCategory est requis pour un avancement aleatoire", 400);
      return;
    }

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
      sendError(
        res,
        "Impossible de modifier cette equipe car elle est engagee dans un match en cours",
        400,
      );
      return;
    }

    const player = team.players.find((p: any) => p.id === playerId);
    if (!player) {
      sendError(res, "Joueur introuvable", 404);
      return;
    }

    if ((player as any).dead) {
      sendError(
        res,
        "Ce joueur est mort et ne peut pas recevoir d'avancement",
        400,
      );
      return;
    }

    let advancements: PlayerAdvancement[] = [];
    try {
      advancements = JSON.parse((player as any).advancements || "[]");
    } catch {
      advancements = [];
    }

    if (advancements.length >= 6) {
      sendError(res, "Ce joueur a atteint le maximum de 6 avancements", 400);
      return;
    }

    const currentSkills = player.skills.split(",").filter(Boolean);

    const categoryAccessType =
      advancementType === "primary" || advancementType === "random-primary"
        ? "primary"
        : "secondary";
    const access = getPositionCategoryAccess(player.position);
    const allowedCategories =
      categoryAccessType === "primary" ? access.primary : access.secondary;

    let finalSkillSlug: string;

    if (isRandom) {
      if (!allowedCategories.includes(skillCategory as any)) {
        sendError(
          res,
          `La categorie '${skillCategory}' n'est pas accessible en ${categoryAccessType} pour cette position`,
          400,
        );
        return;
      }

      const eligibleSkills = SKILLS_DEFINITIONS.filter(
        (s) => s.category === skillCategory,
      ).filter((s) => !currentSkills.includes(s.slug));

      if (eligibleSkills.length === 0) {
        sendError(res, "Aucune competence disponible dans cette categorie", 400);
        return;
      }

      const randomIndex = Math.floor(Math.random() * eligibleSkills.length);
      finalSkillSlug = eligibleSkills[randomIndex].slug;
    } else {
      finalSkillSlug = clientSkillSlug!;
      const skillDef = SKILLS_BY_SLUG[finalSkillSlug];
      if (!skillDef) {
        sendError(res, `Competence '${finalSkillSlug}' inconnue`, 400);
        return;
      }

      if (currentSkills.includes(finalSkillSlug)) {
        sendError(res, "Ce joueur possede deja cette competence", 400);
        return;
      }

      if (!allowedCategories.includes(skillDef.category as any)) {
        sendError(
          res,
          `La competence '${skillDef.nameFr}' (${skillDef.category}) n'est pas accessible en ${categoryAccessType} pour cette position`,
          400,
        );
        return;
      }
    }

    const sppCost = getNextAdvancementPspCost(
      advancements.length,
      advancementType,
    );
    const playerSpp = (player as any).spp || 0;

    if (playerSpp < sppCost) {
      sendError(
        res,
        `SPP insuffisants : ${playerSpp} disponibles, ${sppCost} requis pour un avancement ${advancementType}`,
        400,
      );
      return;
    }

    const newSkills = [...currentSkills, finalSkillSlug].join(",");
    const newAdvancement: PlayerAdvancement = {
      skillSlug: finalSkillSlug,
      type: advancementType,
      isRandom,
      at: Date.now(),
    };
    const newAdvancements = [...advancements, newAdvancement];

    await prisma.teamPlayer.update({
      where: { id: playerId },
      data: {
        skills: newSkills,
        advancements: JSON.stringify(newAdvancements),
        spp: { decrement: sppCost },
      },
    });

    await updateTeamValues(prisma, teamId);

    const updatedPlayer = await prisma.teamPlayer.findUnique({
      where: { id: playerId },
    });

    sendSuccess(res, {
      player: updatedPlayer,
      sppSpent: sppCost,
      advancement: newAdvancement,
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de l'ajout de competence:", e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.put(
  "/:id/players/:playerId/skills",
  authUser,
  validate(updatePlayerSkillsSchema),
  handleUpdatePlayerSkills,
);

// Endpoint pour obtenir les positions disponibles pour ajout (S25.5s — ApiResponse<T>)
export async function handleListAvailablePositions(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true },
    });

    if (!team) {
      sendError(res, "Equipe introuvable", 404);
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

    const availablePositions = rosterData.positions.map((position: any) => {
      const currentCount = team.players.filter(
        (p: any) => p.position === position.slug,
      ).length;
      const canAdd = currentCount < position.max && team.players.length < 16;

      return {
        key: position.slug,
        name: position.displayName,
        cost: position.cost,
        currentCount,
        maxCount: position.max,
        canAdd,
        stats: {
          ma: position.ma,
          st: position.st,
          ag: position.ag,
          pa: position.pa,
          av: position.av,
          skills: position.skills,
        },
      };
    });

    sendSuccess(res, {
      availablePositions,
      currentPlayerCount: team.players.length,
      maxPlayers: 16,
    });
  } catch (e: unknown) {
    serverLog.error(
      "Erreur lors de la recuperation des positions disponibles:",
      e,
    );
    sendError(res, "Erreur serveur", 500);
  }
}

router.get("/:id/available-positions", authUser, handleListAvailablePositions);

// =============================================================================
// STAR PLAYERS ENDPOINTS
// =============================================================================

// Endpoint pour obtenir les Star Players d'une equipe (S25.5q — ApiResponse<T>)
export async function handleListTeamStarPlayers(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { starPlayers: true },
    });

    if (!team) {
      sendError(res, "Equipe introuvable", 404);
      return;
    }

    const enrichedStarPlayers = team.starPlayers.map((sp: any) => {
      const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug);
      return {
        id: sp.id,
        slug: sp.starPlayerSlug,
        cost: sp.cost,
        hiredAt: sp.hiredAt,
        ...starPlayerData,
      };
    });

    sendSuccess(res, {
      starPlayers: enrichedStarPlayers,
      count: enrichedStarPlayers.length,
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de la recuperation des Star Players:", e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.get("/:id/star-players", authUser, handleListTeamStarPlayers);

// Endpoint pour obtenir les Star Players disponibles pour une equipe (S25.5aa — ApiResponse<T>)
export async function handleListAvailableStarPlayers(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true, starPlayers: true },
    });

    if (!team) {
      sendError(res, "Equipe introuvable", 404);
      return;
    }

    const teamRuleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
    const availableStarPlayers = getTeamAvailableStarPlayers(
      team.roster,
      teamRuleset,
    );

    const { getPlayerCost } = await import(
      "../../../../packages/game-engine/src/utils/team-value-calculator"
    );
    const currentPlayersCost = team.players.reduce(
      (total: number, player: any) => {
        return total + getPlayerCost(player.position, team.roster, teamRuleset);
      },
      0,
    );

    const currentStarPlayersCost = team.starPlayers.reduce(
      (total: number, sp: any) => {
        return total + sp.cost;
      },
      0,
    );

    const budgetInPo = team.initialBudget * 1000;
    const availableBudget =
      budgetInPo - currentPlayersCost - currentStarPlayersCost;

    const hiredSlugs = new Set(
      team.starPlayers.map((sp: any) => sp.starPlayerSlug),
    );
    const totalPlayers = team.players.length + team.starPlayers.length;

    const enrichedStarPlayers = availableStarPlayers.map((sp: any) => {
      const isHired = hiredSlugs.has(sp.slug);
      const canAfford = sp.cost <= availableBudget;
      const hasRoomForOne = totalPlayers < 16;

      const pairSlug = requiresPair(sp.slug);
      let needsPair = false;
      let pairStatus = null;

      if (pairSlug) {
        needsPair = true;
        const pairHired = hiredSlugs.has(pairSlug);
        const pairData = getStarPlayerBySlug(pairSlug, team.ruleset);
        pairStatus = {
          slug: pairSlug,
          name: pairData?.displayName,
          hired: pairHired,
          cost: pairData?.cost || 0,
        };
      }

      let canHire = !isHired && hasRoomForOne && canAfford;
      if (needsPair && !pairStatus?.hired) {
        const totalPairCost = sp.cost + (pairStatus?.cost || 0);
        const hasRoomForPair = totalPlayers + 1 < 16;
        canHire = !isHired && hasRoomForPair && totalPairCost <= availableBudget;
      }

      return {
        ...sp,
        isHired,
        canHire,
        needsPair,
        pairStatus,
      };
    });

    sendSuccess(res, {
      availableStarPlayers: enrichedStarPlayers,
      currentPlayerCount: team.players.length,
      currentStarPlayerCount: team.starPlayers.length,
      totalPlayers,
      maxPlayers: 16,
      availableBudget: Math.round(availableBudget / 1000),
      totalBudget: team.initialBudget,
    });
  } catch (e: unknown) {
    serverLog.error(
      "Erreur lors de la recuperation des Star Players disponibles:",
      e,
    );
    sendError(res, "Erreur serveur", 500);
  }
}

router.get(
  "/:id/available-star-players",
  authUser,
  handleListAvailableStarPlayers,
);

// Endpoint pour recruter un Star Player (S25.5ab — ApiResponse<T>)
export async function handleHireStarPlayer(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const { starPlayerSlug } = req.body;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true, starPlayers: true },
    });

    if (!team) {
      sendError(res, "Equipe introuvable", 404);
      return;
    }

    const activeSelection = await prisma.teamSelection.findFirst({
      where: {
        teamId: teamId,
        match: { status: { in: ["pending", "active"] } },
      },
    });

    if (activeSelection) {
      sendError(
        res,
        "Impossible de modifier cette equipe car elle est engagee dans un match en cours",
        400,
      );
      return;
    }

    const { getPlayerCost } = await import(
      "../../../../packages/game-engine/src/utils/team-value-calculator"
    );
    const teamRuleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
    const currentPlayersCost = team.players.reduce(
      (total: number, player: any) => {
        return total + getPlayerCost(player.position, team.roster, teamRuleset);
      },
      0,
    );

    const currentStarPlayersCost = team.starPlayers.reduce(
      (total: number, sp: any) => {
        return total + sp.cost;
      },
      0,
    );

    const budgetInPo = team.initialBudget * 1000;
    const availableBudget =
      budgetInPo - currentPlayersCost - currentStarPlayersCost;

    const validation = validateStarPlayerHire(
      starPlayerSlug,
      team.roster,
      team.players.length,
      team.starPlayers,
      availableBudget,
      teamRuleset,
    );

    if (!validation.valid) {
      sendError(res, validation.error ?? "Validation echouee", 400);
      return;
    }

    const starPlayer = validation.starPlayer!;

    const pairSlug = requiresPair(starPlayerSlug);
    const starPlayersToHire: Array<{ slug: string; cost: number }> = [
      { slug: starPlayerSlug, cost: starPlayer.cost },
    ];

    if (pairSlug) {
      const pairAlreadyHired = team.starPlayers.some(
        (sp: any) => sp.starPlayerSlug === pairSlug,
      );

      if (!pairAlreadyHired) {
        const pairData = getStarPlayerBySlug(pairSlug, team.ruleset);
        if (!pairData) {
          sendError(
            res,
            `Star Player partenaire '${pairSlug}' introuvable`,
            400,
          );
          return;
        }

        const totalPlayers = team.players.length + team.starPlayers.length;
        if (totalPlayers + 1 >= 16) {
          sendError(
            res,
            "Pas assez de place pour recruter la paire (limite de 16 joueurs)",
            400,
          );
          return;
        }

        const totalCost = starPlayer.cost + pairData.cost;
        if (totalCost > availableBudget) {
          sendError(
            res,
            `Budget insuffisant pour recruter la paire. Cout: ${(totalCost / 1000).toLocaleString()} K po, disponible: ${(availableBudget / 1000).toLocaleString()} K po`,
            400,
          );
          return;
        }

        starPlayersToHire.push({ slug: pairSlug, cost: pairData.cost });
      }
    }

    const createdStarPlayers = await Promise.all(
      starPlayersToHire.map((sp) =>
        prisma.teamStarPlayer.create({
          data: {
            teamId: teamId,
            starPlayerSlug: sp.slug,
            cost: sp.cost,
          },
        }),
      ),
    );

    await updateTeamValues(prisma, teamId);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true, starPlayers: true },
    });

    const enrichedNewStarPlayers = createdStarPlayers.map((sp: any) => {
      const starPlayerData = getStarPlayerBySlug(
        sp.starPlayerSlug,
        team.ruleset,
      );
      return {
        id: sp.id,
        slug: sp.starPlayerSlug,
        cost: sp.cost,
        hiredAt: sp.hiredAt,
        ...starPlayerData,
      };
    });

    sendSuccess(
      res,
      {
        team: updatedTeam,
        newStarPlayers: enrichedNewStarPlayers,
        message:
          enrichedNewStarPlayers.length > 1
            ? `${enrichedNewStarPlayers
                .map((sp: any) => sp.displayName)
                .join(" et ")} recrutes avec succes`
            : `${enrichedNewStarPlayers[0]?.displayName ?? starPlayerSlug} recrute avec succes`,
      },
      201,
    );
  } catch (e: any) {
    serverLog.error("Erreur lors du recrutement du Star Player:", e);

    if (e?.code === "P2002") {
      sendError(res, "Ce Star Player est deja recrute dans cette equipe", 409);
      return;
    }

    sendError(res, "Erreur serveur", 500);
  }
}

router.post(
  "/:id/star-players",
  authUser,
  validate(addStarPlayerToTeamSchema),
  handleHireStarPlayer,
);

// Endpoint pour retirer un Star Player (S25.5v — ApiResponse<T>)
export async function handleDeleteTeamStarPlayer(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const starPlayerId = req.params.starPlayerId;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true, starPlayers: true },
    });

    if (!team) {
      sendError(res, "Equipe introuvable", 404);
      return;
    }

    const activeSelection = await prisma.teamSelection.findFirst({
      where: {
        teamId: teamId,
        match: { status: { in: ["pending", "active"] } },
      },
    });

    if (activeSelection) {
      sendError(
        res,
        "Impossible de modifier cette equipe car elle est engagee dans un match en cours",
        400,
      );
      return;
    }

    const starPlayer = team.starPlayers.find(
      (sp: any) => sp.id === starPlayerId,
    );
    if (!starPlayer) {
      sendError(res, "Star Player introuvable", 404);
      return;
    }

    const pairSlug = requiresPair(starPlayer.starPlayerSlug);
    const starPlayersToRemove: string[] = [starPlayerId];

    if (pairSlug) {
      const pairStarPlayer = team.starPlayers.find(
        (sp: any) => sp.starPlayerSlug === pairSlug,
      );
      if (pairStarPlayer) {
        starPlayersToRemove.push(pairStarPlayer.id);
      }
    }

    await prisma.teamStarPlayer.deleteMany({
      where: { id: { in: starPlayersToRemove } },
    });

    await updateTeamValues(prisma, teamId);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true, starPlayers: true },
    });

    const removedCount = starPlayersToRemove.length;
    sendSuccess(res, {
      team: updatedTeam,
      message:
        removedCount > 1
          ? `${removedCount} Star Players retires avec succes`
          : "Star Player retire avec succes",
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors du retrait du Star Player:", e);
    sendError(res, "Erreur serveur", 500);
  }
}

router.delete(
  "/:id/star-players/:starPlayerId",
  authUser,
  handleDeleteTeamStarPlayer,
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
