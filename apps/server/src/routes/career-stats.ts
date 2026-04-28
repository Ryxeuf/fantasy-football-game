import { Router } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import {
  aggregateTeamCareer,
  buildTeamMatchRecord,
  toPlayerCareerStats,
  type TeamMatchRecord,
  type TeamPlayerForStats,
} from "../services/career-stats";
import { serverLog } from "../utils/server-log";

const router = Router();

/**
 * N.6 — Historique de matchs avec stats de carriere (par equipe, par joueur).
 *
 * Returns the career snapshot for a team owned by the authenticated user:
 *  - aggregated team record over ended online matches (W/L/D, TDs, casualties,
 *    completions, interceptions)
 *  - per-match history (most recent first)
 *  - per-player career stats (already maintained on TeamPlayer rows by
 *    `persistMatchSPP`)
 */
router.get(
  "/team/:teamId",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    const teamId = req.params.teamId;
    const userId = req.user!.id;

    try {
      const team = await prisma.team.findFirst({
        where: { id: teamId, ownerId: userId },
        include: { players: true },
      });
      if (!team) {
        return res.status(404).json({ error: "Equipe introuvable" });
      }

      const selections = await prisma.teamSelection.findMany({
        where: { teamId: team.id },
        orderBy: { createdAt: "desc" },
        include: {
          match: {
            select: {
              id: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });

      const endedSelections = selections.filter(
        (sel: any) => sel.match?.status === "ended",
      );

      const records: TeamMatchRecord[] = [];
      const history: Array<{
        matchId: string;
        createdAt: Date;
        endedAt: Date | null;
        teamSide: "A" | "B";
        myScore: number;
        opponentScore: number;
        outcome: "win" | "draw" | "loss";
        opponentCoachName: string | null;
        opponentTeamName: string | null;
        opponentRoster: string | null;
      }> = [];

      for (const sel of endedSelections) {
        const matchId = sel.match.id;

        // Fetch side (A vs B) using creation order of teamSelections for this match
        const allSelections = await prisma.teamSelection.findMany({
          where: { matchId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            userId: true,
            teamId: true,
            createdAt: true,
            team: true,
            user: { select: { coachName: true } },
            teamRef: { select: { name: true, roster: true } },
          },
        });
        if (allSelections.length < 2) continue;
        const teamSide: "A" | "B" =
          allSelections[0].id === sel.id ? "A" : "B";
        const opponentSel =
          teamSide === "A" ? allSelections[1] : allSelections[0];

        // Pull the final gameState snapshot from the last turn
        const lastTurn = await prisma.turn.findFirst({
          where: { matchId },
          orderBy: { number: "desc" },
          select: { payload: true, createdAt: true },
        });
        const payload = ((lastTurn as any)?.payload ?? {}) as {
          gameState?: unknown;
        };
        const rawGs = payload.gameState;
        const gameState = typeof rawGs === "string" ? JSON.parse(rawGs) : rawGs;

        const record = buildTeamMatchRecord(teamSide, gameState ?? null, {
          matchId,
          createdAt: sel.match.createdAt,
          endedAt: lastTurn?.createdAt ?? null,
          opponentCoachName: opponentSel?.user?.coachName ?? null,
          opponentTeamName:
            opponentSel?.teamRef?.name ?? opponentSel?.team ?? null,
          opponentRoster: opponentSel?.teamRef?.roster ?? null,
        });
        records.push(record);

        const myScore = teamSide === "A" ? record.scoreA : record.scoreB;
        const opponentScore = teamSide === "A" ? record.scoreB : record.scoreA;
        const outcome: "win" | "draw" | "loss" =
          myScore > opponentScore
            ? "win"
            : myScore < opponentScore
              ? "loss"
              : "draw";

        history.push({
          matchId,
          createdAt: record.createdAt,
          endedAt: record.endedAt,
          teamSide,
          myScore,
          opponentScore,
          outcome,
          opponentCoachName: record.opponentCoachName,
          opponentTeamName: record.opponentTeamName,
          opponentRoster: record.opponentRoster,
        });
      }

      const teamRecord = aggregateTeamCareer(records);

      const players = team.players.map((p: any) =>
        toPlayerCareerStats({
          id: p.id,
          name: p.name,
          number: p.number,
          position: p.position,
          spp: p.spp ?? 0,
          matchesPlayed: p.matchesPlayed ?? 0,
          totalTouchdowns: p.totalTouchdowns ?? 0,
          totalCasualties: p.totalCasualties ?? 0,
          totalCompletions: p.totalCompletions ?? 0,
          totalInterceptions: p.totalInterceptions ?? 0,
          totalMvpAwards: p.totalMvpAwards ?? 0,
          nigglingInjuries: p.nigglingInjuries ?? 0,
          advancements: p.advancements ?? "[]",
          dead: p.dead ?? false,
        } satisfies TeamPlayerForStats),
      );

      return res.json({
        team: {
          id: team.id,
          name: team.name,
          roster: team.roster,
          ruleset: team.ruleset,
        },
        record: teamRecord,
        history,
        players,
      });
    } catch (e: any) {
      serverLog.error("Erreur lors du calcul des stats de carriere:", e);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

export default router;
