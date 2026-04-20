/**
 * Practice vs AI — online match variant.
 *
 * Creates a `Match` (online) where one side is a human user and the other side
 * is played by the AI system user. Reuses `ensureAISystemUser` / `spawnAITeam`
 * from the existing `ai-practice` service.
 *
 * Contract: once this runs, the returned match has two `TeamSelection` rows
 * (user + AI), both players are connected, and the AI side is already marked
 * as "accepted" via a turn of type `accept`. The human user still needs to
 * accept via `/match/accept` to trigger `acceptAndMaybeStartMatch`.
 */

import {
  isAIOpponentRosterAllowed,
  pickAIOpponentRoster,
  makeRNG,
  type AIDifficulty,
  type AIOpponentRoster,
} from "@bb/game-engine";
import { ensureAISystemUser, spawnAITeam } from "./ai-practice";

export type AITeamSide = "A" | "B";

export interface CreateOnlinePracticeMatchParams {
  readonly creatorId: string;
  readonly userTeamId: string;
  readonly difficulty: AIDifficulty;
  /** AI roster slug override (must be in the whitelist). */
  readonly aiRosterSlug?: string;
  /** User-controlled side. Defaults to 'A' (AI gets 'B'). */
  readonly userSide?: AITeamSide;
  /** Deterministic seed for reproducible roster pick. */
  readonly seed?: string;
}

export interface CreateOnlinePracticeMatchResult {
  readonly matchId: string;
  readonly aiUserId: string;
  readonly aiTeamId: string;
  readonly aiRoster: AIOpponentRoster;
  readonly aiTeamSide: AITeamSide;
}

type PrismaLike = {
  user: {
    findUnique: (args: any) => Promise<any>;
    upsert: (args: any) => Promise<any>;
  };
  team: {
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
  };
  teamPlayer: {
    createMany: (args: any) => Promise<any>;
  };
  match: {
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  teamSelection: {
    createMany: (args: any) => Promise<any>;
  };
  turn: {
    create: (args: any) => Promise<any>;
    count: (args: any) => Promise<number>;
  };
};

export async function createOnlinePracticeMatch(
  prisma: PrismaLike,
  params: CreateOnlinePracticeMatchParams,
): Promise<CreateOnlinePracticeMatchResult> {
  const { creatorId, userTeamId, difficulty } = params;
  if (!userTeamId) {
    throw new Error("userTeamId est requis");
  }

  const userTeam = await prisma.team.findUnique({ where: { id: userTeamId } });
  if (!userTeam) {
    throw new Error("Equipe utilisateur introuvable");
  }
  if (userTeam.ownerId !== creatorId) {
    throw new Error("Vous devez etre proprietaire de l'equipe utilisateur");
  }

  let aiRosterSlug: AIOpponentRoster | null = null;
  if (params.aiRosterSlug) {
    if (!isAIOpponentRosterAllowed(params.aiRosterSlug)) {
      throw new Error(`Roster IA non autorise: ${params.aiRosterSlug}`);
    }
    aiRosterSlug = params.aiRosterSlug;
  } else {
    const seed =
      params.seed ?? `online-practice-${creatorId}-${Date.now()}`;
    const rng = makeRNG(seed);
    const exclude = isAIOpponentRosterAllowed(userTeam.roster)
      ? [userTeam.roster]
      : [];
    aiRosterSlug = pickAIOpponentRoster({ rng, exclude });
  }

  if (!aiRosterSlug) {
    throw new Error("Impossible de selectionner un roster IA");
  }

  const aiUser = await ensureAISystemUser(prisma as any);
  const aiTeam = await spawnAITeam({
    prisma: prisma as any,
    ownerId: aiUser.id,
    rosterSlug: aiRosterSlug,
  });

  const userSide: AITeamSide = params.userSide ?? "A";
  const aiTeamSide: AITeamSide = userSide === "A" ? "B" : "A";

  const seed = `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const match = await prisma.match.create({
    data: {
      status: "pending",
      seed,
      creatorId,
      aiOpponent: true,
      aiDifficulty: difficulty,
      aiTeamSide,
      aiUserId: aiUser.id,
      players: {
        connect: [{ id: creatorId }, { id: aiUser.id }],
      },
    },
  });

  // Deterministic order: user first (createdAt via createMany is not guaranteed,
  // so we create them in two calls to enforce ordering when the resolver reads
  // by `orderBy: createdAt asc`). `createMany` preserves insertion order on
  // PostgreSQL but to be defensive we rely on explicit side flags in the match
  // row too (aiTeamSide).
  await prisma.teamSelection.createMany({
    data:
      userSide === "A"
        ? [
            {
              matchId: match.id,
              userId: creatorId,
              teamId: userTeamId,
              team: userTeamId,
            },
            {
              matchId: match.id,
              userId: aiUser.id,
              teamId: aiTeam.id,
              team: aiTeam.id,
            },
          ]
        : [
            {
              matchId: match.id,
              userId: aiUser.id,
              teamId: aiTeam.id,
              team: aiTeam.id,
            },
            {
              matchId: match.id,
              userId: creatorId,
              teamId: userTeamId,
              team: userTeamId,
            },
          ],
  });

  // Auto-accept the AI side so only the human user still has to accept.
  const nextNumber = (await prisma.turn.count({ where: { matchId: match.id } })) + 1;
  await prisma.turn.create({
    data: {
      matchId: match.id,
      number: nextNumber,
      payload: {
        type: "accept",
        userId: aiUser.id,
        at: new Date().toISOString(),
      } as any,
    },
  });

  return {
    matchId: match.id,
    aiUserId: aiUser.id,
    aiTeamId: aiTeam.id,
    aiRoster: aiRosterSlug,
    aiTeamSide,
  };
}
