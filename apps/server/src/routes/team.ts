import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";

const router = Router();
const ALLOWED_TEAMS = ["skaven", "lizardmen"] as const;
type AllowedRoster = typeof ALLOWED_TEAMS[number];

function rosterTemplates(roster: AllowedRoster) {
  if (roster === "skaven") {
    return [
      { position: "Blitzer", count: 2, ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: "Block" },
      { position: "Thrower", count: 1, ma: 7, st: 3, ag: 3, pa: 2, av: 8, skills: "Pass,Sure Hands" },
      { position: "Gutter Runner", count: 2, ma: 9, st: 2, ag: 2, pa: 4, av: 8, skills: "Dodge" },
      { position: "Lineman", count: 6, ma: 7, st: 3, ag: 3, pa: 4, av: 8, skills: "" },
      // Big Guy optionnel (non inclus par défaut)
    ];
  }
  // lizardmen
  return [
    { position: "Saurus", count: 6, ma: 6, st: 4, ag: 4, pa: 6, av: 10, skills: "" },
    { position: "Skink", count: 5, ma: 8, st: 2, ag: 3, pa: 5, av: 8, skills: "Dodge" },
    // Kroxigor optionnel (non inclus par défaut)
  ];
}

router.get("/available", authUser, async (req: AuthenticatedRequest, res) => {
  res.json({ teams: ALLOWED_TEAMS });
});

router.post("/choose", authUser, async (req: AuthenticatedRequest, res) => {
  const { matchId, team, teamId } = req.body ?? {};
  if (!matchId) return res.status(400).json({ error: "matchId requis" });
  if (!team && !teamId) return res.status(400).json({ error: "team ou teamId requis" });
  if (team && !ALLOWED_TEAMS.includes(team)) return res.status(400).json({ error: "Équipe non autorisée" });

  try {
    const data: any = { matchId, userId: req.user!.id };
    if (team) data.team = team;
    if (teamId) data.teamId = teamId;
    const selection = await prisma.teamSelection.create({ data });
    return res.status(201).json({ selection });
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(409).json({ error: "Équipe déjà choisie pour ce match" });
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/mine", authUser, async (req: AuthenticatedRequest, res) => {
  const teams = await prisma.team.findMany({ where: { ownerId: req.user!.id }, select: { id: true, name: true, roster: true, createdAt: true } });
  res.json({ teams });
});

router.get("/:id", authUser, async (req: AuthenticatedRequest, res) => {
  const team = await prisma.team.findFirst({ where: { id: req.params.id, ownerId: req.user!.id }, include: { players: true } });
  if (!team) return res.status(404).json({ error: "Introuvable" });
  // état de match si sélectionnée
  const selection = await prisma.teamSelection.findFirst({ where: { teamId: team.id }, include: { match: true } });
  res.json({ team, currentMatch: selection?.match || null });
});

router.post("/create-from-roster", authUser, async (req: AuthenticatedRequest, res) => {
  const { name, roster } = req.body ?? {} as { name?: string; roster?: AllowedRoster };
  if (!name || !roster) return res.status(400).json({ error: "name et roster requis" });
  if (!ALLOWED_TEAMS.includes(roster)) return res.status(400).json({ error: "Roster non autorisé" });

  const team = await prisma.team.create({ data: { ownerId: req.user!.id, name, roster } });
  const templates = rosterTemplates(roster);
  const players: any[] = [];
  let number = 1;
  for (const t of templates) {
    for (let i = 0; i < t.count; i += 1) {
      players.push({ teamId: team.id, name: `${t.position} ${i + 1}`, position: t.position, number: number++, ma: t.ma, st: t.st, ag: t.ag, pa: t.pa, av: t.av, skills: t.skills });
      if (number > 16) break;
    }
    if (number > 16) break;
  }
  // Assurer au moins 11 joueurs
  while (players.length < 11) {
    players.push({ teamId: team.id, name: `Lineman ${players.length + 1}`, position: "Lineman", number: players.length + 1, ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: "" });
  }
  await prisma.teamPlayer.createMany({ data: players.slice(0, 16) });
  const withPlayers = await prisma.team.findUnique({ where: { id: team.id }, include: { players: true } });
  res.status(201).json({ team: withPlayers });
});

export default router;


