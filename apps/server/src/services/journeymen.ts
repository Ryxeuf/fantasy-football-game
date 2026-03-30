import type { PrismaClient } from "@prisma/client";
import type { JourneymanStats } from "@bb/game-engine";

/**
 * Look up the Lineman position stats for a given roster slug.
 *
 * The Lineman is identified by having the highest `max` value among
 * the roster's positions (the "bulk" positional in every BB roster).
 * Falls back to a generic Human Lineman if no roster or position is found.
 *
 * @param prisma - Prisma client
 * @param rosterSlug - Slug of the roster (e.g. "skaven", "lizardmen")
 * @returns JourneymanStats for the Lineman position
 */
export async function getLinemanStats(
  prisma: PrismaClient,
  rosterSlug: string,
): Promise<JourneymanStats | undefined> {
  const roster = await prisma.roster.findFirst({
    where: { slug: rosterSlug },
    include: {
      positions: {
        orderBy: { max: "desc" },
        take: 1,
      },
    },
  });

  if (!roster || roster.positions.length === 0) {
    return undefined;
  }

  const lineman = roster.positions[0];
  return {
    position: lineman.displayName,
    ma: lineman.ma,
    st: lineman.st,
    ag: lineman.ag,
    pa: lineman.pa,
    av: lineman.av,
  };
}
