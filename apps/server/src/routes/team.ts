import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { updateTeamValues } from "../utils/team-values";
import { TEAM_ROSTERS, getPositionBySlug, getDisplayName, LEGACY_POSITION_MAPPING, type AllowedRoster } from "@bb/game-engine";

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
  "snotling"
] as const;

// Utiliser le nouveau système de rosters
const ROSTERS = TEAM_ROSTERS;

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
  // Renvoie les équipes possédées par l'utilisateur et non engagées dans un match en cours
  const teams = await prisma.team.findMany({
    where: {
      ownerId: req.user!.id,
      selections: {
        none: {
          match: { status: { in: ["pending", "active"] } },
        },
      },
    },
    select: { id: true, name: true, roster: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ teams });
});

router.get("/rosters/:id", authUser, async (req: AuthenticatedRequest, res) => {
  const id = req.params.id as AllowedRoster;
  if (!ALLOWED_TEAMS.includes(id))
    return res.status(404).json({ error: "Roster inconnu" });
  res.json({ roster: ROSTERS[id] });
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

router.get("/mine", authUser, async (req: AuthenticatedRequest, res) => {
  const teams = await prisma.team.findMany({
    where: { ownerId: req.user!.id },
    select: { id: true, name: true, roster: true, createdAt: true },
  });
  res.json({ teams });
});

router.get("/:id", authUser, async (req: AuthenticatedRequest, res) => {
  const team = await prisma.team.findFirst({
    where: { id: req.params.id, ownerId: req.user!.id },
    include: { players: true },
  });
  if (!team) return res.status(404).json({ error: "Introuvable" });
  // état de match si sélectionnée
  const selection = await prisma.teamSelection.findFirst({
    where: { teamId: team.id },
    include: { match: true },
  });
  res.json({ team, currentMatch: selection?.match || null });
});

router.post(
  "/create-from-roster",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    const { name, roster, teamValue } =
      req.body ?? ({} as { name?: string; roster?: AllowedRoster; teamValue?: number });
    if (!name || !roster)
      return res.status(400).json({ error: "name et roster requis" });
    if (!ALLOWED_TEAMS.includes(roster))
      return res.status(400).json({ error: "Roster non autorisé" });
    
    const finalTeamValue = teamValue || 1000;
    if (finalTeamValue < 100 || finalTeamValue > 2000)
      return res.status(400).json({ error: "La valeur d'équipe doit être entre 100 et 2000k po" });

    const team = await prisma.team.create({
      data: { 
        ownerId: req.user!.id, 
        name, 
        roster,
        teamValue: finalTeamValue,
        initialBudget: finalTeamValue, // Conserver le budget initial saisi par l'utilisateur
        // Initialiser les informations d'équipe par défaut
        treasury: 0, // Calculée automatiquement après chaque match
        rerolls: 0,
        cheerleaders: 0,
        assistants: 0,
        apothecary: false,
        dedicatedFans: 1,
        currentValue: 0, // Sera calculée après création des joueurs
      },
    });
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
    
    // Calculer automatiquement les valeurs d'équipe
    await updateTeamValues(prisma, team.id);
    
    const withPlayers = await prisma.team.findUnique({
      where: { id: team.id },
      include: { players: true },
    });
    res.status(201).json({ team: withPlayers });
  },
);

router.post("/build", authUser, async (req: AuthenticatedRequest, res) => {
  const { name, roster, teamValue, choices } =
    req.body ??
    ({} as {
      name?: string;
      roster?: AllowedRoster;
      teamValue?: number;
      choices?: Array<{ key: string; count: number }>;
    });
  if (!name || !roster || !Array.isArray(choices))
    return res.status(400).json({ error: "name, roster, choices requis" });
  if (!ALLOWED_TEAMS.includes(roster))
    return res.status(400).json({ error: "Roster non autorisé" });
  
  const finalTeamValue = teamValue || 1000;
  if (finalTeamValue < 100 || finalTeamValue > 2000)
    return res.status(400).json({ error: "La valeur d'équipe doit être entre 100 et 2000k po" });
    
  const def = ROSTERS[roster as AllowedRoster];
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
  if (totalCost > finalTeamValue)
    return res
      .status(400)
      .json({ error: `Budget dépassé: ${totalCost}k / ${finalTeamValue}k` });

  const team = await prisma.team.create({
    data: { 
      ownerId: req.user!.id, 
      name, 
      roster,
      teamValue: finalTeamValue,
      initialBudget: finalTeamValue, // Conserver le budget initial saisi par l'utilisateur
      // Initialiser les informations d'équipe par défaut
      treasury: 0, // Calculée automatiquement après chaque match
      rerolls: 0,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 1,
      currentValue: 0, // Sera calculée après création des joueurs
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
  
  // Calculer automatiquement les valeurs d'équipe
  await updateTeamValues(prisma, team.id);
  
  const withPlayers = await prisma.team.findUnique({
    where: { id: team.id },
    include: { players: true },
  });
  res
    .status(201)
    .json({ team: withPlayers, cost: totalCost, budget: finalTeamValue });
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
  const { players } = req.body ?? ({} as { players?: Array<{ id: string; name: string; number: number }> });

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
    const rosterData = ROSTERS[team.roster as AllowedRoster];
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
    const currentTotalCost = team.players.reduce((total: number, player: any) => {
      return total + getPlayerCost(player.position, team.roster);
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
    const rosterData = ROSTERS[team.roster as AllowedRoster];
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

export default router;
