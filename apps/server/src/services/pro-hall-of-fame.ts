/**
 * Pro League Hall of Fame light — sprint Pro League lot 1.E.5.
 *
 * Snapshot d'un joueur "immortalise" au moment de l'evenement
 * declenchant son entree au Hall of Fame. Le snapshot fige les
 * caracteristiques (nom, race, stats, careerStats, team) afin que
 * l'archive HoF reste consultable meme si le roster d'origine
 * disparait (cleanup futur, depart d'equipe, etc.).
 *
 * Sources d'induction :
 *  - automatique sur status='dead' (apres le sweep casualties 1.E.4)
 *    -> reason='death_in_match'.
 *  - manuelle/cron later via criteres carriere -> autres reason codes.
 *
 * Idempotence : unique(rosterId, reason) — on n'induit jamais 2 fois
 * le meme joueur pour la meme raison.
 */

import { prisma } from "../prisma";

export type HallOfFameReason =
  | "death_in_match"
  | "career_tds"
  | "mvp_legend"
  | "title";

export interface HallOfFameInductionResult {
  readonly inducted: boolean;
  readonly skipped: boolean;
  readonly skipReason?: string;
  readonly hofId?: string;
}

/**
 * Induit un joueur au Hall of Fame. Idempotent : si un enregistrement
 * existe deja pour `(rosterId, reason)`, no-op.
 */
export async function inductPlayer(
  rosterId: string,
  reason: HallOfFameReason,
  citation?: string,
): Promise<HallOfFameInductionResult> {
  const roster = await prisma.proTeamRoster.findUnique({
    where: { id: rosterId },
    select: {
      id: true,
      name: true,
      position: true,
      ma: true,
      st: true,
      ag: true,
      pa: true,
      av: true,
      skills: true,
      careerStats: true,
      team: { select: { slug: true, name: true, race: true } },
    },
  });
  if (!roster) {
    return { inducted: false, skipped: true, skipReason: "roster_not_found" };
  }
  const existing = await prisma.proHallOfFame.findUnique({
    where: { rosterId_reason: { rosterId, reason } },
    select: { id: true },
  });
  if (existing) {
    return {
      inducted: false,
      skipped: true,
      skipReason: "already_inducted",
      hofId: existing.id,
    };
  }
  const created = await prisma.proHallOfFame.create({
    data: {
      rosterId,
      teamSlug: roster.team.slug,
      teamName: roster.team.name,
      playerName: roster.name,
      race: roster.team.race,
      position: roster.position,
      ma: roster.ma,
      st: roster.st,
      ag: roster.ag,
      pa: roster.pa,
      av: roster.av,
      skills: roster.skills as object,
      careerStats: roster.careerStats as object,
      reason,
      citation,
    },
    select: { id: true },
  });
  return { inducted: true, skipped: false, hofId: created.id };
}

export interface DeathSweepResult {
  readonly inspected: number;
  readonly inducted: number;
  readonly failed: number;
}

/**
 * Sweep cron : pour chaque joueur status='dead' non encore inducte
 * pour `reason='death_in_match'`, cree l'entree HoF.
 *
 * Idempotent — relance OK.
 */
export async function sweepDeathInductions(): Promise<DeathSweepResult> {
  const dead = await prisma.proTeamRoster.findMany({
    where: { status: "dead" },
    select: { id: true },
  });
  let inducted = 0;
  let failed = 0;
  for (const r of dead) {
    try {
      const out = await inductPlayer(
        r.id as string,
        "death_in_match",
        "Tombe au champ d'honneur de Nuffle.",
      );
      if (out.inducted) inducted += 1;
    } catch {
      failed += 1;
    }
  }
  return { inspected: dead.length, inducted, failed };
}

export interface HallOfFameEntry {
  readonly id: string;
  readonly playerName: string;
  readonly teamSlug: string;
  readonly teamName: string;
  readonly race: string;
  readonly position: string;
  readonly reason: HallOfFameReason | string;
  readonly citation: string | null;
  readonly inductedAt: Date;
}

export interface ListHallOfFameOptions {
  readonly teamSlug?: string;
  readonly limit?: number;
}

/**
 * Liste paginee triee par induction recente. Filtrable par equipe.
 */
export async function listHallOfFame(
  opts: ListHallOfFameOptions = {},
): Promise<HallOfFameEntry[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const rows = (await prisma.proHallOfFame.findMany({
    where: opts.teamSlug ? { teamSlug: opts.teamSlug } : {},
    orderBy: { inductedAt: "desc" },
    take: limit,
    select: {
      id: true,
      playerName: true,
      teamSlug: true,
      teamName: true,
      race: true,
      position: true,
      reason: true,
      citation: true,
      inductedAt: true,
    },
  })) as Array<{
    id: string;
    playerName: string;
    teamSlug: string;
    teamName: string;
    race: string;
    position: string;
    reason: string;
    citation: string | null;
    inductedAt: Date;
  }>;
  return rows.map(
    (r): HallOfFameEntry => ({
      id: r.id,
      playerName: r.playerName,
      teamSlug: r.teamSlug,
      teamName: r.teamName,
      race: r.race,
      position: r.position,
      reason: r.reason,
      citation: r.citation,
      inductedAt: r.inductedAt,
    }),
  );
}
