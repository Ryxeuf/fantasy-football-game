import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import jwt from "jsonwebtoken";
import { acceptAndMaybeStartMatch } from "../services/match-start";

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

// Accepter le match: chaque coach doit accepter. Au second accept, on lance la séquence de pré-match
router.post("/accept", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { matchId } = (req.body ?? {}) as { matchId?: string };
    if (!matchId) return res.status(400).json({ error: "matchId requis" });
    const result = await acceptAndMaybeStartMatch(prisma as any, { matchId, userId: req.user!.id });
    if (!result.ok && 'status' in result && typeof result.status === 'number') return res.status(result.status).json({ error: result.error });
    return res.json(result);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || 'Erreur serveur' });
  }
});

export default router;


// Détails du match: noms des équipes et coachs (via token de match)
router.get("/details", async (req, res) => {
  try {
    const token = (req.headers["x-match-token"] as string) || "";
    if (!token) return res.status(401).json({ error: "x-match-token requis" });
    let payload: any;
    try {
      payload = jwt.verify(token, MATCH_SECRET) as any;
    } catch {
      return res.status(401).json({ error: "x-match-token invalide" });
    }
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

    // Déterminer local/visiteur: par défaut l'utilisateur du token est "local"
    const tokenUserId = (payload as any)?.userId as string | undefined;
    let local = selections.find((s) => s.userId === tokenUserId) || null;
    let visitor = selections.find((s) => s.userId !== tokenUserId) || null;
    if (!local || !visitor) {
      // Fallback si une des équipes manque
      if (match?.creatorId) {
        local = selections.find((s) => s.userId === match.creatorId) || selections[0];
        visitor = selections.find((s) => s.userId !== match.creatorId) || selections[1] || null;
      } else {
        // Pas de creatorId: ordonner simplement
        local = selections[0] || null;
        visitor = selections.length > 1 ? selections[1] : null;
      }
    }

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

// Détails du match (auth) par id
router.get("/:id/details", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const matchId = req.params.id;
    const [match, selections] = await Promise.all([
      prisma.match.findUnique({ where: { id: matchId }, select: { id: true, creatorId: true } }),
      prisma.teamSelection.findMany({
        where: { matchId },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true } }, teamRef: { select: { name: true, roster: true } } },
      }),
    ]);
    if (!match) return res.status(404).json({ error: 'Partie introuvable' });
    // Déterminer local/visiteur: l'utilisateur authentifié est local
    const authenticatedUserId = req.user!.id;
    let local = selections.find((s) => s.userId === authenticatedUserId) || null;
    let visitor = selections.find((s) => s.userId !== authenticatedUserId) || null;
    if (!local || !visitor) {
      // Fallback: creatorId si présent, sinon ordre de sélection
      if (match.creatorId) {
        local = selections.find((s) => s.userId === match.creatorId) || selections[0] || null;
        visitor = selections.find((s) => s.userId !== match.creatorId) || selections[1] || null;
      } else {
        local = selections[0] || null;
        visitor = selections.length > 1 ? selections[1] : null;
      }
    }
    const teamName = (sel: any) => sel?.teamRef?.name || sel?.teamRef?.roster || sel?.team || '';
    const coachName = (sel: any) => sel?.user?.name || sel?.user?.email || '';
    return res.json({
      matchId,
      local: { teamName: teamName(local), coachName: coachName(local) },
      visitor: { teamName: teamName(visitor), coachName: coachName(visitor) },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Nouvel endpoint pour les équipes et joueurs (auth) par id - pour fallback prematch
router.get("/:id/teams", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const matchId = req.params.id;
    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true, creatorId: true } });
    if (!match) return res.status(404).json({ error: 'Partie introuvable' });

    const selections = await prisma.teamSelection.findMany({
      where: { matchId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        teamRef: { 
          include: { players: true } 
        }, // Changé de team à teamRef
        teamRef: { select: { name: true, roster: true } }, // Gardé pour compatibilité, mais redondant
      },
    });

    // Déterminer local/visiteur comme dans /details
    const authenticatedUserId = req.user!.id;
    let localSel = selections.find((s) => s.userId === authenticatedUserId) || null;
    let visitorSel = selections.find((s) => s.userId !== authenticatedUserId) || null;
    if (!localSel || !visitorSel) {
      if (match.creatorId) {
        localSel = selections.find((s) => s.userId === match.creatorId) || selections[0] || null;
        visitorSel = selections.find((s) => s.userId !== match.creatorId) || selections[1] || null;
      } else {
        localSel = selections[0] || null;
        visitorSel = selections.length > 1 ? selections[1] : null;
      }
    }

    const getTeamData = (sel: any) => {
      const teamName = sel?.teamRef?.name || sel.team || 'Équipe Inconnue'; // Utilise teamRef.name ou fallback au scalaire team
      let players: any[] = [];
      if (sel?.teamId && sel.teamRef?.players) {
        players = (sel.teamRef.players || []).map((p: any) => ({ // Changé de sel.team à sel.teamRef
          id: p.id,
          name: p.name,
          position: p.position,
          number: p.number,
          ma: p.ma,
          st: p.st,
          ag: p.ag,
          pa: p.pa,
          av: p.av,
          skills: p.skills || '',
        }));
      } // TODO: Si pas teamId, générer depuis roster si besoin
      return { teamName, players };
    };

    const local = getTeamData(localSel);
    const visitor = getTeamData(visitorSel);

    return res.json({ local, visitor });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Résumé d'un match: équipes, coachs, score (approx), tour/mi-temps
router.get("/:id/summary", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const matchId = req.params.id;
    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true, status: true, seed: true, creatorId: true, createdAt: true } });
    if (!match) return res.status(404).json({ error: "Partie introuvable" });

    const [selections, acceptTurns] = await Promise.all([
      prisma.teamSelection.findMany({
        where: { matchId },
        include: { user: { select: { id: true, name: true, email: true } }, teamRef: { select: { id: true, name: true, roster: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.turn.findMany({ where: { matchId } }),
    ]);
    let local = selections.find(s => s.userId === match.creatorId) || null;
    let visitor = selections.find(s => s.userId !== match.creatorId) || null;
    if (!local || !visitor) {
      if (match.creatorId) {
        local = selections.find(s => s.userId === match.creatorId) || selections[0] || null;
        visitor = selections.find(s => s.userId !== match.creatorId) || selections[1] || null;
      } else {
        local = selections[0] || null;
        visitor = selections.length > 1 ? selections[1] : null;
      }
    }

    const turnsCount = await prisma.turn.count({ where: { matchId } });
    const half = turnsCount < 16 ? 1 : 2; // approximation
    const turn = (turnsCount % 16) + 1; // approximation

    const pickName = (sel: any) => sel?.teamRef?.name || sel?.teamRef?.roster || sel?.team || "";
    const pickCoach = (sel: any) => sel?.user?.name || sel?.user?.email || "";
    const acceptedUserIds = Array.from(
      new Set(
        (acceptTurns || [])
          .map((t: any) => (t as any)?.payload?.type === 'accept' ? (t as any)?.payload?.userId : null)
          .filter(Boolean)
      )
    );
    const localAccepted = !!(local && acceptedUserIds.includes(local.userId));
    const visitorAccepted = !!(visitor && acceptedUserIds.includes(visitor.userId));

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
      acceptances: { local: localAccepted, visitor: visitorAccepted },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Nouvel endpoint pour l'état du jeu
router.get("/:id/state", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const matchId = req.params.id;
    const match = await prisma.match.findUnique({ where: { id: matchId }, include: { turns: { orderBy: { number: 'asc' } } } });
    if (!match) return res.status(404).json({ error: "Partie introuvable" });

    if (match.status === 'pending') return res.status(400).json({ error: "Partie pas encore prête" });

    let gameState: any;

    // Chercher le turn de start pour prematch ou initial
    const startTurn = match.turns.find((t: any) => t.payload?.type === 'start');
    if (startTurn) {
      gameState = JSON.parse(startTurn.payload.gameState);
    } else if (match.status === 'prematch') {
      // Reconstruire si pas encore de turn start (cas edge)
      const selections = await prisma.teamSelection.findMany({
        where: { matchId },
        include: { 
          user: true, 
          teamRef: true 
        },
        orderBy: { createdAt: 'asc' }
      });
      if (selections.length < 2) return res.status(400).json({ error: "Équipes pas prêtes" });

      const [s1, s2] = selections;

      // Fetch teams séparément pour players
      const teamA = s1.teamId ? await prisma.team.findUnique({ 
        where: { id: s1.teamId }, 
        include: { players: true } 
      }) : null;
      const teamB = s2.teamId ? await prisma.team.findUnique({ 
        where: { id: s2.teamId }, 
        include: { players: true } 
      }) : null;

      if (!teamA || !teamB) {
        console.log('Teams not found:', s1.teamId, s2.teamId);
        return res.status(400).json({ error: "Équipes non trouvées" });
      }

      const teamAData = teamA.players.map((p: any) => ({
        id: p.id, name: p.name, position: p.position, number: p.number, ma: p.ma, st: p.st, ag: p.ag, pa: p.pa, av: p.av, skills: p.skills || ''
      }));
      const teamBData = teamB.players.map((p: any) => ({
        id: p.id, name: p.name, position: p.position, number: p.number, ma: p.ma, st: p.st, ag: p.ag, pa: p.pa, av: p.av, skills: p.skills || ''
      }));

      console.log('Players loaded for prematch:', teamAData.length, teamBData.length); // Trace

      const teamAName = s1.teamRef?.name || s1.team || 'Team A';
      const teamBName = s2.teamRef?.name || s2.team || 'Team B';

      const { setupPreMatchWithTeams } = await import('@bb/game-engine');
      gameState = setupPreMatchWithTeams(teamAData, teamBData, teamAName, teamBName);
    } else {
      // Pour active, dernier turn
      const lastTurn = match.turns[match.turns.length - 1];
      if (!lastTurn.payload?.gameState) return res.status(500).json({ error: "État non trouvé" });
      gameState = JSON.parse(lastTurn.payload.gameState);
    }

    // Dans /state, après chargement gameState
    if (match.status === 'prematch-setup') {
      // Entrer en setup si idle
      const lastCoinToss = match.turns.find((t: any) => t.payload?.type === 'coin-toss');
      if (lastCoinToss && gameState.preMatch.phase === 'idle') {
        const receivingTeam = lastCoinToss.payload.receivingUserId === local.userId ? 'A' : 'B'; // À ajuster avec local
        gameState = enterSetupPhase(gameState, receivingTeam);
      }
    }

    res.json({ gameState });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

