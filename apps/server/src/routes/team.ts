import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { updateTeamValues } from "../utils/team-values";
import {
  getPositionBySlug,
  getDisplayName,
  LEGACY_POSITION_MAPPING,
  type AllowedRoster,
  getStarPlayerBySlug,
  DEFAULT_RULESET,
  type Ruleset,
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
import { resolveRuleset } from "../utils/ruleset-helpers";

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

router.get("/available", authUser, async (req: AuthenticatedRequest, res) => {
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
  res.json({ teams });
});

router.get("/mine", authUser, async (req: AuthenticatedRequest, res) => {
  const requestedRuleset = req.query.ruleset as string | undefined;
  const filterRuleset = isValidRuleset(requestedRuleset)
    ? (requestedRuleset as Ruleset)
    : undefined;
  const teams = await prisma.team.findMany({
    where: {
      ownerId: req.user!.id,
      ...(filterRuleset && { ruleset: filterRuleset }),
    },
    select: { id: true, name: true, roster: true, ruleset: true, createdAt: true },
  });
  res.json({ teams });
});

router.get("/rosters/:id", authUser, async (req: AuthenticatedRequest, res) => {
  const id = req.params.id as AllowedRoster;
  if (!ALLOWED_TEAMS.includes(id))
    return res.status(404).json({ error: "Roster inconnu" });
  const ruleset = resolveRuleset(req.query.ruleset as string | undefined);
  
  const roster = await getRosterFromDb(id, "fr", ruleset);
  if (!roster) {
    return res.status(404).json({ error: "Roster non trouvé en base de données" });
  }
  
  res.json({ roster, ruleset });
});

router.post("/choose", authUser, async (req: AuthenticatedRequest, res) => {
  const { matchId, teamId } = req.body ?? {};
  if (!matchId) return res.status(400).json({ error: "matchId requis" });
  if (!teamId) return res.status(400).json({ error: "teamId requis" });

  try {
    // Valider match et statut
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, status: true },
    });
    if (!match) return res.status(404).json({ error: "Partie introuvable" });
    if (match.status !== "pending")
      return res
        .status(400)
        .json({ error: `Match non modifiable (statut: ${match.status})` });

    // Transaction atomique: vérifie et crée la sélection
    const selection = await prisma.$transaction(async (tx: any) => {
      const existingMineTx = await tx.teamSelection.findFirst({
        where: { matchId, userId: req.user!.id },
      });
      if (existingMineTx)
        throw Object.assign(
          new Error("Vous avez déjà choisi une équipe pour ce match"),
          { status: 409 },
        );

      const alreadyUsedTx = await tx.teamSelection.findFirst({
        where: { matchId, teamId },
      });
      if (alreadyUsedTx)
        throw Object.assign(
          new Error("Cette équipe est déjà utilisée dans ce match"),
          { status: 409 },
        );

      return tx.teamSelection.create({
        data: {
          match: { connect: { id: matchId } },
          user: { connect: { id: req.user!.id } },
          team: teamId, // compat: certains schémas exigent NOT NULL + unicité (matchId, team)
          teamRef: { connect: { id: teamId } },
        },
        include: { teamRef: true },
      } as any);
    });
    return res.status(201).json({ selection });
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    if (e?.code === "P2002")
      return res
        .status(409)
        .json({
          error: e?.meta?.target?.includes("userId")
            ? "Vous avez déjà choisi une équipe pour ce match"
            : "Conflit d'unicité pour ce match",
        });
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

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
    const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug);
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

  // Statistiques de matchs locaux pour cette équipe
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
  async (req: AuthenticatedRequest, res) => {
    const {
      name,
      roster,
      teamValue,
      starPlayers: starPlayerSlugs,
      ruleset: bodyRuleset,
    } =
      req.body ??
      ({} as {
        name?: string;
        roster?: AllowedRoster;
        teamValue?: number;
        starPlayers?: string[];
        ruleset?: string;
      });
    if (!name || !roster)
      return res.status(400).json({ error: "name et roster requis" });
    if (!ALLOWED_TEAMS.includes(roster))
      return res.status(400).json({ error: "Roster non autorisé" });

    const ruleset = resolveRuleset(bodyRuleset);
    
    const finalTeamValue = teamValue || 1000;
    if (finalTeamValue < 100 || finalTeamValue > 2000)
      return res.status(400).json({ error: "La valeur d'équipe doit être entre 100 et 2000k po" });

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
        const sp = getStarPlayerBySlug(slug);
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
        const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug);
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

router.post("/build", authUser, async (req: AuthenticatedRequest, res) => {
  const { name, roster, teamValue, choices, starPlayers: starPlayerSlugs, ruleset: bodyRuleset } =
    req.body ??
    ({} as {
      name?: string;
      roster?: AllowedRoster;
      teamValue?: number;
      choices?: Array<{ key: string; count: number }>;
      starPlayers?: string[];
      ruleset?: string;
    });
  if (!name || !roster || !Array.isArray(choices))
    return res.status(400).json({ error: "name, roster, choices requis" });
  if (!ALLOWED_TEAMS.includes(roster))
    return res.status(400).json({ error: "Roster non autorisé" });
  const ruleset = resolveRuleset(bodyRuleset);
  
  const finalTeamValue = teamValue || 1000;
  if (finalTeamValue < 100 || finalTeamValue > 2000)
    return res.status(400).json({ error: "La valeur d'équipe doit être entre 100 et 2000k po" });
    
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
    starPlayersCost = calculateStarPlayersCost(starPlayersToHire) / 1000; // Convertir en K po
    
    // Valider la disponibilité pour ce roster
    const budgetInPo = finalTeamValue * 1000;
    const validation = validateStarPlayersForTeam(
      starPlayersToHire,
      roster,
      totalPlayers,
      budgetInPo - (totalCost * 1000),
      ruleset,
    );
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
  }

  // Vérifier le budget total (joueurs + Star Players)
  const totalBudgetUsed = totalCost + starPlayersCost;
  if (totalBudgetUsed > finalTeamValue)
    return res
      .status(400)
      .json({ 
        error: `Budget dépassé: ${totalBudgetUsed}k (${totalCost}k joueurs + ${starPlayersCost}k Star Players) / ${finalTeamValue}k` 
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
      rerolls: 0,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 1,
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
      const sp = getStarPlayerBySlug(slug);
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
      const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug);
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
        starPlayers: starPlayersCost
      }
    });
});

// Endpoint pour mettre à jour les informations d'équipe (fans, coachs, relances, etc.)
router.put("/:id/info", authUser, async (req: AuthenticatedRequest, res) => {
  const teamId = req.params.id;
  const { 
    rerolls, 
    cheerleaders, 
    assistants, 
    apothecary, 
    dedicatedFans 
  } = req.body ?? ({} as {
    rerolls?: number;
    cheerleaders?: number;
    assistants?: number;
    apothecary?: boolean;
    dedicatedFans?: number;
  });

  try {
    // Vérifier que l'équipe appartient à l'utilisateur
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id }
    });

    if (!team) {
      return res.status(404).json({ error: "Équipe introuvable" });
    }

    // Vérifier que l'équipe n'est pas engagée dans un match actif
    const activeSelection = await prisma.teamSelection.findFirst({
      where: { 
        teamId: teamId,
        match: { status: { in: ["pending", "active"] } }
      }
    });

    if (activeSelection) {
      return res.status(400).json({ 
        error: "Impossible de modifier cette équipe car elle est engagée dans un match en cours" 
      });
    }

    // Validation des données selon les règles Blood Bowl
    if (rerolls !== undefined && (rerolls < 0 || rerolls > 8 || !Number.isInteger(rerolls))) {
      return res.status(400).json({ error: "Le nombre de relances doit être entre 0 et 8" });
    }

    if (cheerleaders !== undefined && (cheerleaders < 0 || cheerleaders > 12 || !Number.isInteger(cheerleaders))) {
      return res.status(400).json({ error: "Le nombre de cheerleaders doit être entre 0 et 12" });
    }

    if (assistants !== undefined && (assistants < 0 || assistants > 6 || !Number.isInteger(assistants))) {
      return res.status(400).json({ error: "Le nombre d'assistants doit être entre 0 et 6" });
    }

    if (dedicatedFans !== undefined && (dedicatedFans < 1 || dedicatedFans > 6 || !Number.isInteger(dedicatedFans))) {
      return res.status(400).json({ error: "Le nombre de fans dévoués doit être entre 1 et 6" });
    }

    // Mise à jour de l'équipe
    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(rerolls !== undefined && { rerolls }),
        ...(cheerleaders !== undefined && { cheerleaders }),
        ...(assistants !== undefined && { assistants }),
        ...(apothecary !== undefined && { apothecary }),
        ...(dedicatedFans !== undefined && { dedicatedFans }),
      },
      include: { players: true }
    });

    // Recalculer les valeurs d'équipe après modification
    await updateTeamValues(prisma, teamId);

    // Récupérer l'équipe mise à jour avec les nouvelles valeurs
    const finalTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true }
    });

    res.json({ team: finalTeam });
  } catch (e: any) {
    console.error("Erreur lors de la modification des informations d'équipe:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Endpoint pour recalculer les valeurs d'équipe
router.post("/:id/recalculate", authUser, async (req: AuthenticatedRequest, res) => {
  const teamId = req.params.id;

  try {
    // Vérifier que l'équipe appartient à l'utilisateur
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id }
    });

    if (!team) {
      return res.status(404).json({ error: "Équipe introuvable" });
    }

    // Recalculer les valeurs d'équipe
    const { teamValue, currentValue } = await updateTeamValues(prisma, teamId);

    // Récupérer l'équipe mise à jour
    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true }
    });

    res.json({ 
      team: updatedTeam,
      message: `Valeurs recalculées: VE=${teamValue.toLocaleString()} po, VEA=${currentValue.toLocaleString()} po`
    });
  } catch (e: any) {
    console.error("Erreur lors du recalcul des valeurs d'équipe:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put("/:id", authUser, async (req: AuthenticatedRequest, res) => {
  const teamId = req.params.id;
  const { players, name } = req.body ?? ({} as { 
    players?: Array<{ id: string; name: string; number: number }>;
    name?: string;
  });

  if (!players || !Array.isArray(players)) {
    return res.status(400).json({ error: "players requis (array)" });
  }

  try {
    // Vérifier que l'équipe appartient à l'utilisateur
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true }
    });

    if (!team) {
      return res.status(404).json({ error: "Équipe introuvable" });
    }

    // Vérifier que l'équipe n'est pas engagée dans un match actif
    const activeSelection = await prisma.teamSelection.findFirst({
      where: { 
        teamId: teamId,
        match: { status: { in: ["pending", "active"] } }
      }
    });

    if (activeSelection) {
      return res.status(400).json({ 
        error: "Impossible de modifier cette équipe car elle est engagée dans un match en cours" 
      });
    }

    // Validation des données
    const playerIds = team.players.map((p: any) => p.id);
    const providedPlayerIds = players.map((p: any) => p.id);
    
    // Vérifier que tous les joueurs fournis appartiennent à cette équipe
    const invalidPlayerIds = providedPlayerIds.filter((id: any) => !playerIds.includes(id));
    if (invalidPlayerIds.length > 0) {
      return res.status(400).json({ 
        error: `Joueurs invalides: ${invalidPlayerIds.join(", ")}` 
      });
    }

    // Vérifier que tous les joueurs de l'équipe sont présents
    const missingPlayerIds = playerIds.filter((id: any) => !providedPlayerIds.includes(id));
    if (missingPlayerIds.length > 0) {
      return res.status(400).json({ 
        error: `Joueurs manquants: ${missingPlayerIds.join(", ")}` 
      });
    }

    // Validation des numéros (unique dans l'équipe, entre 1-99)
    const numbers = players.map(p => p.number);
    const uniqueNumbers = new Set(numbers);
    if (uniqueNumbers.size !== numbers.length) {
      return res.status(400).json({ error: "Les numéros de joueurs doivent être uniques" });
    }

    const invalidNumbers = numbers.filter(n => n < 1 || n > 99 || !Number.isInteger(n));
    if (invalidNumbers.length > 0) {
      return res.status(400).json({ error: "Les numéros doivent être des entiers entre 1 et 99" });
    }

    // Validation des noms (non vides)
    const emptyNames = players.filter(p => !p.name || p.name.trim() === "");
    if (emptyNames.length > 0) {
      return res.status(400).json({ error: "Tous les joueurs doivent avoir un nom" });
    }

    // Validation du nom de l'équipe si fourni
    if (name !== undefined) {
      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "Le nom de l'équipe ne peut pas être vide" });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({ error: "Le nom de l'équipe ne peut pas dépasser 100 caractères" });
      }
    }

    // Mise à jour de l'équipe si le nom est fourni
    if (name !== undefined) {
      await prisma.team.update({
        where: { id: teamId },
        data: { name: name.trim() }
      });
    }

    // Mise à jour des joueurs
    const updatePromises = players.map(player => 
      prisma.teamPlayer.update({
        where: { id: player.id },
        data: { 
          name: player.name.trim(),
          number: player.number
        }
      })
    );

    await Promise.all(updatePromises);

    // Retourner l'équipe mise à jour
    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true }
    });

    res.json({ team: updatedTeam });
  } catch (e: any) {
    console.error("Erreur lors de la modification de l'équipe:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Endpoint pour ajouter un joueur à une équipe
router.post("/:id/players", authUser, async (req: AuthenticatedRequest, res) => {
  const teamId = req.params.id;
  const { position, name, number } = req.body ?? ({} as { 
    position?: string; 
    name?: string; 
    number?: number; 
  });

  if (!position || !name || !number) {
    return res.status(400).json({ error: "position, name et number requis" });
  }

  try {
    // Vérifier que l'équipe appartient à l'utilisateur
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true }
    });

    if (!team) {
      return res.status(404).json({ error: "Équipe introuvable" });
    }

    // Vérifier que l'équipe n'est pas engagée dans un match actif
    const activeSelection = await prisma.teamSelection.findFirst({
      where: { 
        teamId: teamId,
        match: { status: { in: ["pending", "active"] } }
      }
    });

    if (activeSelection) {
      return res.status(400).json({ 
        error: "Impossible de modifier cette équipe car elle est engagée dans un match en cours" 
      });
    }

    // Vérifier que l'équipe n'a pas déjà 16 joueurs (limite Blood Bowl)
    if (team.players.length >= 16) {
      return res.status(400).json({ 
        error: "Une équipe ne peut pas avoir plus de 16 joueurs" 
      });
    }

    // Vérifier que le numéro n'est pas déjà utilisé
    const existingPlayer = team.players.find((p: any) => p.number === number);
    if (existingPlayer) {
      return res.status(400).json({ 
        error: `Le numéro ${number} est déjà utilisé par ${existingPlayer.name}` 
      });
    }

    // Validation du numéro (entre 1-99)
    if (number < 1 || number > 99 || !Number.isInteger(number)) {
      return res.status(400).json({ 
        error: "Le numéro doit être un entier entre 1 et 99" 
      });
    }

    // Validation du nom (non vide)
    if (!name.trim()) {
      return res.status(400).json({ 
        error: "Le nom ne peut pas être vide" 
      });
    }

    // Récupérer les informations de la position depuis le roster
    const rosterData = await getRosterFromDb(
      team.roster as AllowedRoster,
      "fr",
      (team.ruleset as Ruleset) ?? DEFAULT_RULESET,
    );
    if (!rosterData) {
      return res.status(400).json({ error: "Roster non reconnu" });
    }

    const positionData = rosterData.positions.find((p: any) => p.slug === position);
    if (!positionData) {
      return res.status(400).json({ 
        error: `Position '${position}' non trouvée dans le roster ${team.roster}` 
      });
    }

    // Vérifier les limites min/max pour cette position
    const currentPositionCount = team.players.filter((p: any) => p.position === position).length;
    if (currentPositionCount >= positionData.max) {
      return res.status(400).json({ 
        error: `Limite maximale atteinte pour la position ${positionData.displayName} (${positionData.max})` 
      });
    }

    // Vérifier le budget avant d'ajouter le joueur
    const { getPlayerCost } = await import('../../../../packages/game-engine/src/utils/team-value-calculator');
    const teamRuleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
    const currentTotalCost = team.players.reduce((total: number, player: any) => {
      return total + getPlayerCost(player.position, team.roster, teamRuleset);
    }, 0);
    
    const newPlayerCost = positionData.cost * 1000; // Convertir le coût de kpo en po
    const newTotalCost = currentTotalCost + newPlayerCost;
    const budgetInPo = team.initialBudget * 1000; // Convertir le budget de kpo en po
    if (newTotalCost > budgetInPo) {
      return res.status(400).json({ 
        error: `Budget dépassé ! Coût actuel: ${Math.round(currentTotalCost / 1000)}k po, nouveau coût: ${Math.round(newTotalCost / 1000)}k po, budget: ${team.initialBudget}k po` 
      });
    }

    // Créer le nouveau joueur
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
      }
    });

    // Recalculer les valeurs d'équipe
    await updateTeamValues(prisma, teamId);

    // Retourner l'équipe mise à jour
    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true }
    });

    res.status(201).json({ 
      team: updatedTeam,
      newPlayer: newPlayer
    });
  } catch (e: any) {
    console.error("Erreur lors de l'ajout du joueur:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Endpoint pour supprimer un joueur d'une équipe
router.delete("/:id/players/:playerId", authUser, async (req: AuthenticatedRequest, res) => {
  const teamId = req.params.id;
  const playerId = req.params.playerId;

  try {
    // Vérifier que l'équipe appartient à l'utilisateur
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true }
    });

    if (!team) {
      return res.status(404).json({ error: "Équipe introuvable" });
    }

    // Vérifier que l'équipe n'est pas engagée dans un match actif
    const activeSelection = await prisma.teamSelection.findFirst({
      where: { 
        teamId: teamId,
        match: { status: { in: ["pending", "active"] } }
      }
    });

    if (activeSelection) {
      return res.status(400).json({ 
        error: "Impossible de modifier cette équipe car elle est engagée dans un match en cours" 
      });
    }

    // Vérifier que le joueur existe et appartient à cette équipe
    const player = team.players.find((p: any) => p.id === playerId);
    if (!player) {
      return res.status(404).json({ error: "Joueur introuvable" });
    }

    // Vérifier qu'il reste au moins 11 joueurs après suppression (minimum Blood Bowl)
    if (team.players.length <= 11) {
      return res.status(400).json({ 
        error: "Une équipe doit avoir au minimum 11 joueurs" 
      });
    }

    // Supprimer le joueur
    await prisma.teamPlayer.delete({
      where: { id: playerId }
    });

    // Recalculer les valeurs d'équipe
    await updateTeamValues(prisma, teamId);

    // Retourner l'équipe mise à jour
    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true }
    });

    res.json({ team: updatedTeam });
  } catch (e: any) {
    console.error("Erreur lors de la suppression du joueur:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Endpoint pour obtenir les positions disponibles pour ajout
router.get("/:id/available-positions", authUser, async (req: AuthenticatedRequest, res) => {
  const teamId = req.params.id;

  try {
    // Vérifier que l'équipe appartient à l'utilisateur
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true }
    });

    if (!team) {
      return res.status(404).json({ error: "Équipe introuvable" });
    }

    // Récupérer les informations du roster
    const rosterData = await getRosterFromDb(
      team.roster as AllowedRoster,
      "fr",
      (team.ruleset as Ruleset) ?? DEFAULT_RULESET,
    );
    if (!rosterData) {
      return res.status(400).json({ error: "Roster non reconnu" });
    }

    // Calculer les positions disponibles
    const availablePositions = rosterData.positions.map((position: any) => {
      const currentCount = team.players.filter((p: any) => p.position === position.slug).length;
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
          skills: position.skills
        }
      };
    });

    res.json({ 
      availablePositions,
      currentPlayerCount: team.players.length,
      maxPlayers: 16
    });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des positions disponibles:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// =============================================================================
// STAR PLAYERS ENDPOINTS
// =============================================================================

// Endpoint pour obtenir les Star Players d'une équipe
router.get("/:id/star-players", authUser, async (req: AuthenticatedRequest, res) => {
  const teamId = req.params.id;

  try {
    // Vérifier que l'équipe appartient à l'utilisateur
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { starPlayers: true }
    });

    if (!team) {
      return res.status(404).json({ error: "Équipe introuvable" });
    }

    // Enrichir les Star Players avec leurs données complètes
    const enrichedStarPlayers = team.starPlayers.map((sp: any) => {
      const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug);
      return {
        id: sp.id,
        slug: sp.starPlayerSlug,
        cost: sp.cost,
        hiredAt: sp.hiredAt,
        ...starPlayerData
      };
    });

    res.json({
      starPlayers: enrichedStarPlayers,
      count: enrichedStarPlayers.length
    });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des Star Players:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Endpoint pour obtenir les Star Players disponibles pour une équipe
router.get("/:id/available-star-players", authUser, async (req: AuthenticatedRequest, res) => {
  const teamId = req.params.id;

  try {
    // Vérifier que l'équipe appartient à l'utilisateur
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { 
        players: true,
        starPlayers: true
      }
    });

    if (!team) {
      return res.status(404).json({ error: "Équipe introuvable" });
    }

    const teamRuleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
    // Obtenir les Star Players disponibles pour ce roster
    const availableStarPlayers = getTeamAvailableStarPlayers(
      team.roster,
      teamRuleset,
    );

    // Calculer le budget disponible
    const { getPlayerCost } = await import(
      "../../../../packages/game-engine/src/utils/team-value-calculator"
    );
    const currentPlayersCost = team.players.reduce((total: number, player: any) => {
      return total + getPlayerCost(player.position, team.roster, teamRuleset);
    }, 0);
    
    const currentStarPlayersCost = team.starPlayers.reduce((total: number, sp: any) => {
      return total + sp.cost;
    }, 0);

    const budgetInPo = team.initialBudget * 1000;
    const availableBudget = budgetInPo - currentPlayersCost - currentStarPlayersCost;

    // Marquer ceux qui sont déjà recrutés
    const hiredSlugs = new Set(team.starPlayers.map((sp: any) => sp.starPlayerSlug));
    const totalPlayers = team.players.length + team.starPlayers.length;

    const enrichedStarPlayers = availableStarPlayers.map((sp: any) => {
      const isHired = hiredSlugs.has(sp.slug);
      const canAfford = sp.cost <= availableBudget;
      const hasRoomForOne = totalPlayers < 16;
      
      // Vérifier les paires obligatoires
      const pairSlug = requiresPair(sp.slug);
      let needsPair = false;
      let pairStatus = null;
      
      if (pairSlug) {
        needsPair = true;
        const pairHired = hiredSlugs.has(pairSlug);
        const pairData = getStarPlayerBySlug(pairSlug);
        pairStatus = {
          slug: pairSlug,
          name: pairData?.displayName,
          hired: pairHired,
          cost: pairData?.cost || 0
        };
      }

      // Pour les paires, vérifier si on peut recruter les deux
      let canHire = !isHired && hasRoomForOne && canAfford;
      if (needsPair && !pairStatus?.hired) {
        const totalPairCost = sp.cost + (pairStatus?.cost || 0);
        const hasRoomForPair = totalPlayers + 1 < 16; // +1 car on recrute 2 à la fois
        canHire = !isHired && hasRoomForPair && totalPairCost <= availableBudget;
      }

      return {
        ...sp,
        isHired,
        canHire,
        needsPair,
        pairStatus
      };
    });

    res.json({
      availableStarPlayers: enrichedStarPlayers,
      currentPlayerCount: team.players.length,
      currentStarPlayerCount: team.starPlayers.length,
      totalPlayers,
      maxPlayers: 16,
      availableBudget: Math.round(availableBudget / 1000), // en K po
      totalBudget: team.initialBudget
    });
  } catch (e: any) {
    console.error("Erreur lors de la récupération des Star Players disponibles:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Endpoint pour recruter un Star Player
router.post("/:id/star-players", authUser, async (req: AuthenticatedRequest, res) => {
  const teamId = req.params.id;
  const { starPlayerSlug } = req.body ?? ({} as { starPlayerSlug?: string });

  if (!starPlayerSlug) {
    return res.status(400).json({ error: "starPlayerSlug requis" });
  }

  try {
    // Vérifier que l'équipe appartient à l'utilisateur
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { 
        players: true,
        starPlayers: true
      }
    });

    if (!team) {
      return res.status(404).json({ error: "Équipe introuvable" });
    }

    // Vérifier que l'équipe n'est pas engagée dans un match actif
    const activeSelection = await prisma.teamSelection.findFirst({
      where: { 
        teamId: teamId,
        match: { status: { in: ["pending", "active"] } }
      }
    });

    if (activeSelection) {
      return res.status(400).json({ 
        error: "Impossible de modifier cette équipe car elle est engagée dans un match en cours" 
      });
    }

    // Calculer le budget disponible
    const { getPlayerCost } = await import('../../../../packages/game-engine/src/utils/team-value-calculator');
    const teamRuleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
    const currentPlayersCost = team.players.reduce((total: number, player: any) => {
      return total + getPlayerCost(player.position, team.roster, teamRuleset);
    }, 0);
    
    const currentStarPlayersCost = team.starPlayers.reduce((total: number, sp: any) => {
      return total + sp.cost;
    }, 0);

    const budgetInPo = team.initialBudget * 1000;
    const availableBudget = budgetInPo - currentPlayersCost - currentStarPlayersCost;

    // Valider le recrutement
    const validation = validateStarPlayerHire(
      starPlayerSlug,
      team.roster,
      team.players.length,
      team.starPlayers,
      availableBudget,
      teamRuleset,
    );

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const starPlayer = validation.starPlayer!;

    // Vérifier les paires obligatoires
    const pairSlug = requiresPair(starPlayerSlug);
    const starPlayersToHire: Array<{ slug: string; cost: number }> = [
      { slug: starPlayerSlug, cost: starPlayer.cost }
    ];

    if (pairSlug) {
      // Vérifier que le partenaire n'est pas déjà recruté
      const pairAlreadyHired = team.starPlayers.some((sp: any) => sp.starPlayerSlug === pairSlug);
      
      if (!pairAlreadyHired) {
        const pairData = getStarPlayerBySlug(pairSlug);
        if (!pairData) {
          return res.status(400).json({ 
            error: `Star Player partenaire '${pairSlug}' introuvable` 
          });
        }

        // Vérifier qu'on a la place pour les deux
        const totalPlayers = team.players.length + team.starPlayers.length;
        if (totalPlayers + 1 >= 16) { // +1 car on recrute 2
          return res.status(400).json({ 
            error: "Pas assez de place pour recruter la paire (limite de 16 joueurs)" 
          });
        }

        // Vérifier le budget pour les deux
        const totalCost = starPlayer.cost + pairData.cost;
        if (totalCost > availableBudget) {
          return res.status(400).json({ 
            error: `Budget insuffisant pour recruter la paire. Coût: ${(totalCost / 1000).toLocaleString()} K po, disponible: ${(availableBudget / 1000).toLocaleString()} K po` 
          });
        }

        starPlayersToHire.push({ slug: pairSlug, cost: pairData.cost });
      }
    }

    // Recruter le(s) Star Player(s)
    const createdStarPlayers = await Promise.all(
      starPlayersToHire.map((sp) =>
        prisma.teamStarPlayer.create({
          data: {
            teamId: teamId,
            starPlayerSlug: sp.slug,
            cost: sp.cost
          }
        })
      )
    );

    // Recalculer les valeurs d'équipe
    await updateTeamValues(prisma, teamId);

    // Retourner l'équipe mise à jour
    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { 
        players: true,
        starPlayers: true
      }
    });

    // Enrichir les Star Players recrutés
    const enrichedNewStarPlayers = createdStarPlayers.map((sp: any) => {
      const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug);
      return {
        id: sp.id,
        slug: sp.starPlayerSlug,
        cost: sp.cost,
        hiredAt: sp.hiredAt,
        ...starPlayerData
      };
    });

    res.status(201).json({ 
      team: updatedTeam,
      newStarPlayers: enrichedNewStarPlayers,
      message: enrichedNewStarPlayers.length > 1 
        ? `${enrichedNewStarPlayers.map((sp: any) => sp.displayName).join(" et ")} recrutés avec succès`
        : `${enrichedNewStarPlayers[0].displayName} recruté avec succès`
    });
  } catch (e: any) {
    console.error("Erreur lors du recrutement du Star Player:", e);
    
    // Gérer les erreurs de contrainte unique
    if (e?.code === "P2002") {
      return res.status(409).json({ 
        error: "Ce Star Player est déjà recruté dans cette équipe" 
      });
    }
    
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Endpoint pour retirer un Star Player
router.delete("/:id/star-players/:starPlayerId", authUser, async (req: AuthenticatedRequest, res) => {
  const teamId = req.params.id;
  const starPlayerId = req.params.starPlayerId;

  try {
    // Vérifier que l'équipe appartient à l'utilisateur
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { 
        players: true,
        starPlayers: true
      }
    });

    if (!team) {
      return res.status(404).json({ error: "Équipe introuvable" });
    }

    // Vérifier que l'équipe n'est pas engagée dans un match actif
    const activeSelection = await prisma.teamSelection.findFirst({
      where: { 
        teamId: teamId,
        match: { status: { in: ["pending", "active"] } }
      }
    });

    if (activeSelection) {
      return res.status(400).json({ 
        error: "Impossible de modifier cette équipe car elle est engagée dans un match en cours" 
      });
    }

    // Vérifier que le Star Player existe et appartient à cette équipe
    const starPlayer = team.starPlayers.find((sp: any) => sp.id === starPlayerId);
    if (!starPlayer) {
      return res.status(404).json({ error: "Star Player introuvable" });
    }

    // Vérifier les paires obligatoires
    const pairSlug = requiresPair(starPlayer.starPlayerSlug);
    const starPlayersToRemove: string[] = [starPlayerId];

    if (pairSlug) {
      // Trouver le partenaire
      const pairStarPlayer = team.starPlayers.find((sp: any) => sp.starPlayerSlug === pairSlug);
      
      if (pairStarPlayer) {
        starPlayersToRemove.push(pairStarPlayer.id);
      }
    }

    // Supprimer le(s) Star Player(s)
    await prisma.teamStarPlayer.deleteMany({
      where: {
        id: { in: starPlayersToRemove }
      }
    });

    // Recalculer les valeurs d'équipe
    await updateTeamValues(prisma, teamId);

    // Retourner l'équipe mise à jour
    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { 
        players: true,
        starPlayers: true
      }
    });

    const removedCount = starPlayersToRemove.length;
    res.json({ 
      team: updatedTeam,
      message: removedCount > 1 
        ? `${removedCount} Star Players retirés avec succès`
        : "Star Player retiré avec succès"
    });
  } catch (e: any) {
    console.error("Erreur lors du retrait du Star Player:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
