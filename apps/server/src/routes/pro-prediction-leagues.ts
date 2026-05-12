/**
 * Sprint Q lot Q.D.1 — Endpoints HTTP pour les mini-ligues de pronostics.
 *
 * Endpoints (tous authentifies) :
 *   POST  /pro-league/prediction-leagues             - create
 *   GET   /pro-league/prediction-leagues/me          - list mes ligues
 *   POST  /pro-league/prediction-leagues/join        - join via code
 *   GET   /pro-league/prediction-leagues/:id         - detail + members
 *   GET   /pro-league/prediction-leagues/:id/leaderboard
 *   POST  /pro-league/prediction-leagues/:id/picks   - submit pick
 *   GET   /pro-league/prediction-leagues/:id/picks/me
 *
 * Mapping erreurs PredictionLeagueError → HTTP status.
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import {
  createPredictionLeagueSchema,
  joinPredictionLeagueSchema,
  submitPredictionPickSchema,
} from "../schemas/pro-prediction.schemas";
import { serverLog } from "../utils/server-log";
import {
  PredictionLeagueError,
  createLeague,
  joinLeagueByCode,
  submitPick,
  getLeagueLeaderboard,
  assertMember,
} from "../services/pro-prediction-leagues";

const router = Router();

router.use(authUser);

function errorStatus(code: PredictionLeagueError["code"]): number {
  switch (code) {
    case "LEAGUE_NOT_FOUND":
    case "MATCH_NOT_FOUND":
    case "JOIN_CODE_INVALID":
      return 404;
    case "NOT_MEMBER":
      return 403;
    case "MATCH_LOCKED":
    case "ALREADY_MEMBER":
    case "OWNER_CANNOT_LEAVE":
      return 409;
    case "INVALID_SELECTION":
    case "INVALID_INPUT":
      return 400;
    default:
      return 500;
  }
}

/** POST /pro-league/prediction-leagues — cree une ligue. */
router.post(
  "/",
  validate(createPredictionLeagueSchema),
  async (req, res) => {
    try {
      const auth = req as AuthenticatedRequest;
      const userId = auth.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifie" });
      }
      const { name, isPrivate } = req.body as {
        name: string;
        isPrivate?: boolean;
      };
      const result = await createLeague({ name, ownerId: userId, isPrivate });
      res.status(201).json(result);
    } catch (e) {
      if (e instanceof PredictionLeagueError) {
        return res.status(errorStatus(e.code)).json({ error: e.message });
      }
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors de la creation" });
    }
  },
);

/** GET /pro-league/prediction-leagues/me — liste mes ligues. */
router.get("/me", async (req, res) => {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    const memberships = (await prisma.proPredictionLeagueMember.findMany({
      where: { userId },
      select: {
        joinedAt: true,
        league: {
          select: {
            id: true,
            name: true,
            joinCode: true,
            ownerId: true,
            isPrivate: true,
            createdAt: true,
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    })) as Array<{
      joinedAt: Date;
      league: {
        id: string;
        name: string;
        joinCode: string;
        ownerId: string;
        isPrivate: boolean;
        createdAt: Date;
        _count: { members: number };
      };
    }>;

    res.json({
      leagues: memberships.map((m) => ({
        id: m.league.id,
        name: m.league.name,
        joinCode: m.league.joinCode,
        isPrivate: m.league.isPrivate,
        isOwner: m.league.ownerId === userId,
        memberCount: m.league._count.members,
        joinedAt: m.joinedAt,
        createdAt: m.league.createdAt,
      })),
    });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la lecture" });
  }
});

/** POST /pro-league/prediction-leagues/join — join via joinCode. */
router.post(
  "/join",
  validate(joinPredictionLeagueSchema),
  async (req, res) => {
    try {
      const auth = req as AuthenticatedRequest;
      const userId = auth.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifie" });
      }
      const { joinCode } = req.body as { joinCode: string };
      const result = await joinLeagueByCode(joinCode, userId);
      res.json(result);
    } catch (e) {
      if (e instanceof PredictionLeagueError) {
        return res.status(errorStatus(e.code)).json({ error: e.message });
      }
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors du join" });
    }
  },
);

/** GET /pro-league/prediction-leagues/:id — detail + members. */
router.get("/:id", async (req, res) => {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    await assertMember(req.params.id, userId);

    const league = (await prisma.proPredictionLeague.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        joinCode: true,
        ownerId: true,
        isPrivate: true,
        createdAt: true,
        members: {
          select: {
            userId: true,
            joinedAt: true,
            user: { select: { name: true, email: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    })) as {
      id: string;
      name: string;
      joinCode: string;
      ownerId: string;
      isPrivate: boolean;
      createdAt: Date;
      members: Array<{
        userId: string;
        joinedAt: Date;
        user: { name: string | null; email: string };
      }>;
    } | null;

    if (!league) {
      return res.status(404).json({ error: "Ligue introuvable" });
    }

    res.json({
      id: league.id,
      name: league.name,
      joinCode: league.joinCode,
      isPrivate: league.isPrivate,
      isOwner: league.ownerId === userId,
      ownerId: league.ownerId,
      memberCount: league.members.length,
      createdAt: league.createdAt,
      members: league.members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        joinedAt: m.joinedAt,
        isOwner: m.userId === league.ownerId,
      })),
    });
  } catch (e) {
    if (e instanceof PredictionLeagueError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la lecture" });
  }
});

/** GET /pro-league/prediction-leagues/:id/leaderboard — leaderboard. */
router.get("/:id/leaderboard", async (req, res) => {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    await assertMember(req.params.id, userId);
    const entries = await getLeagueLeaderboard(req.params.id);
    res.json({ entries });
  } catch (e) {
    if (e instanceof PredictionLeagueError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la lecture" });
  }
});

/** POST /pro-league/prediction-leagues/:id/picks — submit ou update pick. */
router.post(
  "/:id/picks",
  validate(submitPredictionPickSchema),
  async (req, res) => {
    try {
      const auth = req as AuthenticatedRequest;
      const userId = auth.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifie" });
      }
      const { matchId, selection } = req.body as {
        matchId: string;
        selection: string;
      };
      const result = await submitPick({
        leagueId: req.params.id,
        userId,
        matchId,
        selection,
      });
      res.status(result.isUpdate ? 200 : 201).json(result);
    } catch (e) {
      if (e instanceof PredictionLeagueError) {
        return res.status(errorStatus(e.code)).json({ error: e.message });
      }
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors du pick" });
    }
  },
);

/** GET /pro-league/prediction-leagues/:id/picks/me — mes picks dans la ligue. */
router.get("/:id/picks/me", async (req, res) => {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    await assertMember(req.params.id, userId);

    const picks = (await prisma.proPredictionPick.findMany({
      where: { leagueId: req.params.id, userId },
      select: {
        id: true,
        matchId: true,
        selection: true,
        result: true,
        correct: true,
        createdAt: true,
        updatedAt: true,
        match: {
          select: {
            id: true,
            status: true,
            scheduledAt: true,
            homeTeamId: true,
            awayTeamId: true,
            scoreHome: true,
            scoreAway: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })) as Array<{
      id: string;
      matchId: string;
      selection: string;
      result: string | null;
      correct: boolean | null;
      createdAt: Date;
      updatedAt: Date;
      match: {
        id: string;
        status: string;
        scheduledAt: Date | null;
        homeTeamId: string;
        awayTeamId: string;
        scoreHome: number | null;
        scoreAway: number | null;
      };
    }>;

    res.json({ picks });
  } catch (e) {
    if (e instanceof PredictionLeagueError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors de la lecture" });
  }
});

export default router;
