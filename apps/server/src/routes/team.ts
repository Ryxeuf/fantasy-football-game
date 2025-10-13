import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";

const router = Router();
const ALLOWED_TEAMS = ["skaven", "lizardmen"] as const;
type AllowedRoster = (typeof ALLOWED_TEAMS)[number];

const ROSTERS: Record<
  AllowedRoster,
  {
    name: string;
    budget: number; // 1000k
    positions: Array<{
      key: string;
      name: string;
      cost: number; // en k
      min: number;
      max: number;
      ma: number;
      st: number;
      ag: number;
      pa: number;
      av: number;
      skills: string;
    }>;
  }
> = {
  skaven: {
    name: "Skavens",
    budget: 1000,
    positions: [
      {
        key: "blitzer",
        name: "Blitzer",
        cost: 90,
        min: 0,
        max: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "Block",
      },
      {
        key: "thrower",
        name: "Thrower",
        cost: 85,
        min: 0,
        max: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 2,
        av: 8,
        skills: "Pass,Sure Hands",
      },
      {
        key: "gutter",
        name: "Gutter Runner",
        cost: 85,
        min: 0,
        max: 4,
        ma: 9,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "Dodge",
      },
      {
        key: "lineman",
        name: "Lineman",
        cost: 50,
        min: 0,
        max: 16,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "",
      },
      {
        key: "ratogre",
        name: "Rat Ogre",
        cost: 150,
        min: 0,
        max: 1,
        ma: 6,
        st: 5,
        ag: 5,
        pa: 6,
        av: 9,
        skills: "Frenzy,Animal Savagery",
      },
    ],
  },
  lizardmen: {
    name: "Hommes-Lézards",
    budget: 1000,
    positions: [
      {
        key: "saurus",
        name: "Saurus",
        cost: 85,
        min: 0,
        max: 6,
        ma: 6,
        st: 4,
        ag: 4,
        pa: 6,
        av: 10,
        skills: "",
      },
      {
        key: "skink",
        name: "Skink",
        cost: 60,
        min: 0,
        max: 8,
        ma: 8,
        st: 2,
        ag: 3,
        pa: 5,
        av: 8,
        skills: "Dodge",
      },
      {
        key: "kroxigor",
        name: "Kroxigor",
        cost: 140,
        min: 0,
        max: 1,
        ma: 6,
        st: 5,
        ag: 5,
        pa: 6,
        av: 10,
        skills: "Bone Head,Prehensile Tail",
      },
    ],
  },
};

function rosterTemplates(roster: AllowedRoster) {
  if (roster === "skaven") {
    return [
      {
        position: "Blitzer",
        count: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "Block",
      },
      {
        position: "Thrower",
        count: 1,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 2,
        av: 8,
        skills: "Pass,Sure Hands",
      },
      {
        position: "Gutter Runner",
        count: 2,
        ma: 9,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "Dodge",
      },
      {
        position: "Lineman",
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
  // lizardmen
  return [
    {
      position: "Saurus",
      count: 6,
      ma: 6,
      st: 4,
      ag: 4,
      pa: 6,
      av: 10,
      skills: "",
    },
    {
      position: "Skink",
      count: 5,
      ma: 8,
      st: 2,
      ag: 3,
      pa: 5,
      av: 8,
      skills: "Dodge",
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
    const { name, roster } =
      req.body ?? ({} as { name?: string; roster?: AllowedRoster });
    if (!name || !roster)
      return res.status(400).json({ error: "name et roster requis" });
    if (!ALLOWED_TEAMS.includes(roster))
      return res.status(400).json({ error: "Roster non autorisé" });

    const team = await prisma.team.create({
      data: { ownerId: req.user!.id, name, roster },
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
    const withPlayers = await prisma.team.findUnique({
      where: { id: team.id },
      include: { players: true },
    });
    res.status(201).json({ team: withPlayers });
  },
);

router.post("/build", authUser, async (req: AuthenticatedRequest, res) => {
  const { name, roster, choices } =
    req.body ??
    ({} as {
      name?: string;
      roster?: AllowedRoster;
      choices?: Array<{ key: string; count: number }>;
    });
  if (!name || !roster || !Array.isArray(choices))
    return res.status(400).json({ error: "name, roster, choices requis" });
  if (!ALLOWED_TEAMS.includes(roster))
    return res.status(400).json({ error: "Roster non autorisé" });
  const def = ROSTERS[roster as AllowedRoster];
  // Validation min/max et budget
  let totalPlayers = 0;
  let totalCost = 0;
  for (const p of def.positions) {
    const c = Math.max(0, choices.find((x) => x.key === p.key)?.count ?? 0);
    if (c < p.min || c > p.max)
      return res
        .status(400)
        .json({ error: `Poste ${p.name}: min ${p.min}, max ${p.max}` });
    totalPlayers += c;
    totalCost += c * p.cost;
  }
  if (totalPlayers < 11 || totalPlayers > 16)
    return res.status(400).json({ error: "Il faut entre 11 et 16 joueurs" });
  if (totalCost > def.budget)
    return res
      .status(400)
      .json({ error: `Budget dépassé: ${totalCost}k / ${def.budget}k` });

  const team = await prisma.team.create({
    data: { ownerId: req.user!.id, name, roster },
  });
  let number = 1;
  const players: any[] = [];
  for (const p of def.positions) {
    const c = Math.max(0, choices.find((x) => x.key === p.key)?.count ?? 0);
    for (let i = 0; i < c; i += 1) {
      players.push({
        teamId: team.id,
        name: `${p.name} ${i + 1}`,
        position: p.name,
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
  const withPlayers = await prisma.team.findUnique({
    where: { id: team.id },
    include: { players: true },
  });
  res
    .status(201)
    .json({ team: withPlayers, cost: totalCost, budget: def.budget });
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

export default router;
