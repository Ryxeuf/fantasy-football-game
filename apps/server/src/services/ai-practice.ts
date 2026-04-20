/**
 * AI practice helpers — shared by the online practice match flow.
 *
 * Responsibilities:
 *  - guarantee that a system "AI" user exists (owner of AI teams);
 *  - provision an AI team from a priority roster via `getRosterFromDb`,
 *    filling at least 11 players from the declared "min" positions and
 *    topping up with available positions if needed.
 *
 * The AI opponent is constrained to the `AI_OPPONENT_ALLOWED_ROSTERS`
 * whitelist (see `@bb/game-engine`).
 */

import { randomBytes } from "crypto";
import type { AIOpponentRoster } from "@bb/game-engine";
import { getRosterFromDb } from "../utils/roster-helpers";

/** Email / contextual id of the system AI user. */
const AI_SYSTEM_EMAIL = "ai-opponent@system.bloobowl.local";
const AI_SYSTEM_COACH_NAME = "AI Coach";

type PrismaLike = {
  user: {
    findUnique: (args: any) => Promise<any>;
    upsert: (args: any) => Promise<any>;
  };
  team: {
    create: (args: any) => Promise<any>;
  };
  teamPlayer: {
    createMany: (args: any) => Promise<any>;
  };
};

/**
 * Idempotent: creates the system AI user on first call, reuses the existing
 * row otherwise.
 */
export async function ensureAISystemUser(
  prisma: PrismaLike,
): Promise<{ id: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: AI_SYSTEM_EMAIL },
  });
  if (existing) return { id: existing.id };
  const passwordHash = randomBytes(24).toString("hex");
  const user = await prisma.user.upsert({
    where: { email: AI_SYSTEM_EMAIL },
    update: {},
    create: {
      email: AI_SYSTEM_EMAIL,
      passwordHash,
      name: AI_SYSTEM_COACH_NAME,
      coachName: AI_SYSTEM_COACH_NAME,
      role: "ai",
      roles: ["ai"],
    },
  });
  return { id: user.id };
}

export interface SpawnAITeamParams {
  readonly prisma: PrismaLike;
  readonly ownerId: string;
  readonly rosterSlug: AIOpponentRoster;
  readonly teamName?: string;
}

/**
 * Creates an AI team with at least 11 players derived from the roster's
 * `min` positions. If the sum of mins is < 11, we fill up from the remaining
 * positions (respecting `max`). As a last resort we pad with generic Linemen
 * so the team is always fieldable.
 */
export async function spawnAITeam(
  params: SpawnAITeamParams,
): Promise<{ id: string }> {
  const { prisma, ownerId, rosterSlug, teamName } = params;
  const roster = await getRosterFromDb(rosterSlug, "fr");
  if (!roster) {
    throw new Error(`Roster IA introuvable en base: ${rosterSlug}`);
  }

  const players: Array<{
    name: string;
    position: string;
    number: number;
    ma: number;
    st: number;
    ag: number;
    pa: number;
    av: number;
    skills: string;
  }> = [];

  let jerseyNumber = 1;
  for (const position of roster.positions) {
    const minCount = Math.max(0, position.min ?? 0);
    for (let i = 0; i < minCount; i += 1) {
      if (jerseyNumber > 16) break;
      players.push({
        name: `${position.displayName} ${i + 1}`,
        position: position.slug,
        number: jerseyNumber++,
        ma: position.ma,
        st: position.st,
        ag: position.ag,
        pa: position.pa,
        av: position.av,
        skills: position.skills ?? "",
      });
    }
    if (jerseyNumber > 16) break;
  }

  while (players.length < 11 && jerseyNumber <= 16) {
    let added = false;
    for (const position of roster.positions) {
      const alreadyInPos = players.filter(
        (p) => p.position === position.slug,
      ).length;
      const maxCount = position.max ?? 0;
      if (alreadyInPos >= maxCount) continue;
      players.push({
        name: `${position.displayName} ${alreadyInPos + 1}`,
        position: position.slug,
        number: jerseyNumber++,
        ma: position.ma,
        st: position.st,
        ag: position.ag,
        pa: position.pa,
        av: position.av,
        skills: position.skills ?? "",
      });
      added = true;
      if (players.length >= 11) break;
    }
    if (!added) break;
  }

  while (players.length < 11) {
    players.push({
      name: `Lineman ${players.length + 1}`,
      position: "Lineman",
      number: jerseyNumber++,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "",
    });
  }

  const finalTeamValue = roster.budget ?? 1_000_000;
  const finalName = teamName ?? `${roster.name} (IA)`;
  const team = await prisma.team.create({
    data: {
      ownerId,
      name: finalName,
      roster: rosterSlug,
      teamValue: finalTeamValue,
      initialBudget: finalTeamValue,
      treasury: 0,
      rerolls: 0,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 1,
      currentValue: finalTeamValue,
    },
  });

  await prisma.teamPlayer.createMany({
    data: players.map((p) => ({ ...p, teamId: team.id })),
  });

  return { id: team.id };
}
