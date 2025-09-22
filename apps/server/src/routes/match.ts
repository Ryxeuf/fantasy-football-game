import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import jwt from "jsonwebtoken";

const router = Router();
const MATCH_SECRET = process.env.MATCH_SECRET || "dev-match-secret";

// Créer une partie, le créateur reçoit un token de match
router.post("/create", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const seed = `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const match = await prisma.match.create({ data: { status: "pending", seed, players: { connect: { id: req.user!.id } } } });
    const token = jwt.sign({ matchId: match.id, userId: req.user!.id }, MATCH_SECRET, { expiresIn: "2h" });
    return res.status(201).json({ match, matchToken: token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
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
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;


