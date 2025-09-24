import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import jwt from "jsonwebtoken";

const router = Router();
const MATCH_SECRET = process.env.MATCH_SECRET || "dev-match-secret";
const ALLOWED_TEAMS = ["skaven", "lizardmen"] as const;

// Créer une partie, le créateur reçoit un token de match
router.post("/create", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const seed = `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Ne pas écrire creatorId pour compatibilité (certains environnements n'ont pas encore la colonne)
    const match = await prisma.match.create({ data: { status: "pending", seed, players: { connect: { id: req.user!.id } } } });
    const token = jwt.sign({ matchId: match.id, userId: req.user!.id }, MATCH_SECRET, { expiresIn: "2h" });
    return res.status(201).json({ match, matchToken: token });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
});

// Rejoindre une partie existante, retourne un token de match
router.post("/join", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { matchId } = req.body ?? {};
    if (!matchId) return res.status(400).json({ error: "matchId requis" });
    const match = await prisma.match.update({ where: { id: matchId }, data: { players: { connect: { id: req.user!.id } } } });
    if (!match) return res.status(404).json({ error: "Partie introuvable" });
    const token = jwt.sign({ matchId: match.id, userId: req.user!.id }, MATCH_SECRET, { expiresIn: "2h" });
    return res.json({ match, matchToken: token });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
});

export default router;


// Détails du match: noms des équipes et coachs (via token de match)
router.get("/details", async (req, res) => {
  try {
    const token = (req.headers["x-match-token"] as string) || "";
    if (!token) return res.status(401).json({ error: "x-match-token requis" });
    const payload = jwt.verify(token, MATCH_SECRET) as any;
    const matchId = payload?.matchId as string | undefined;
    if (!matchId) return res.status(400).json({ error: "matchId manquant dans le token" });

    const [match, selections] = await Promise.all([
      prisma.match.findUnique({ where: { id: matchId }, select: { id: true, creatorId: true } }),
      prisma.teamSelection.findMany({
        where: { matchId },
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          teamRef: { select: { name: true, roster: true } },
        },
      }),
    ]);

    // Déterminer local/visiteur via creatorId: local = créateur
    const local = selections.find((s) => s.userId === match?.creatorId) || selections[0];
    const visitor = selections.find((s) => s.userId !== match?.creatorId) || selections[1];

    function teamName(sel: any): string {
      if (!sel) return "";
      return sel.teamRef?.name || sel.teamRef?.roster || sel.team || "";
    }
    function coachName(sel: any): string {
      if (!sel) return "";
      return sel.user?.name || sel.user?.email || "";
    }

    return res.json({
      matchId,
      local: { teamName: teamName(local), coachName: coachName(local), userId: local?.userId || null },
      visitor: { teamName: teamName(visitor), coachName: coachName(visitor), userId: visitor?.userId || null },
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Résumé d'un match: équipes, coachs, score (approx), tour/mi-temps
router.get("/:id/summary", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const matchId = req.params.id;
    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true, status: true, seed: true, creatorId: true, createdAt: true } });
    if (!match) return res.status(404).json({ error: "Partie introuvable" });

    const selections = await prisma.teamSelection.findMany({
      where: { matchId },
      include: { user: { select: { id: true, name: true, email: true } }, teamRef: { select: { id: true, name: true, roster: true } } },
      orderBy: { createdAt: "asc" },
    });
    const local = selections.find(s => s.userId === match.creatorId) || selections[0] || null;
    const visitor = selections.find(s => s.userId !== match.creatorId) || selections[1] || null;

    const turnsCount = await prisma.turn.count({ where: { matchId } });
    const half = turnsCount < 16 ? 1 : 2; // approximation
    const turn = (turnsCount % 16) + 1; // approximation

    const pickName = (sel: any) => sel?.teamRef?.name || sel?.teamRef?.roster || sel?.team || "";
    const pickCoach = (sel: any) => sel?.user?.name || sel?.user?.email || "";

    return res.json({
      id: match.id,
      status: match.status,
      createdAt: match.createdAt,
      teams: {
        local: { name: pickName(local), coach: pickCoach(local) },
        visitor: { name: pickName(visitor), coach: pickCoach(visitor) },
      },
      score: { teamA: 0, teamB: 0 }, // TODO: remplacer par score réel quand disponible
      half,
      turn,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

