/**
 * N.7 — Systeme d'achievements (succes).
 *
 * Catalogue statique + persistance d'unlocks par utilisateur.
 * L'evaluation est lazy : chaque appel a `getUserAchievements` recalcule les
 * stats agregees, unlock les achievements nouvellement satisfaits, puis
 * renvoie la liste complete avec statut verrouille/deverouille.
 *
 * Les achievements sont volontairement simples et bases sur des donnees deja
 * tracees (matches termines, score, casualties via matchStats, amities
 * acceptees, rosters distincts joues).
 */

import { prisma } from "../prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AchievementCategory =
  | "matches"
  | "scoring"
  | "casualties"
  | "social"
  | "rosters";

export interface UserAchievementStats {
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  touchdowns: number;
  casualties: number;
  friendsCount: number;
  rostersPlayed: Set<string>;
  winsByRoster: Map<string, number>;
}

export interface AchievementDefinition {
  slug: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  category: AchievementCategory;
  icon: string;
  predicate: (stats: UserAchievementStats) => boolean;
}

export interface AchievementView {
  slug: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  category: AchievementCategory;
  icon: string;
  unlocked: boolean;
  unlockedAt: Date | null;
}

export interface UserAchievementsResult {
  stats: Omit<UserAchievementStats, "rostersPlayed" | "winsByRoster"> & {
    rostersPlayed: string[];
    winsByRoster: Record<string, number>;
  };
  achievements: AchievementView[];
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

const MILESTONE_MATCHES: Array<[string, number, string, string, string]> = [
  ["first-match", 1, "Premier pas", "First step", "Jouer son premier match"],
  ["matches-10", 10, "Vétéran", "Veteran", "Jouer 10 matchs"],
  ["matches-50", 50, "Endurant", "Enduring", "Jouer 50 matchs"],
  ["matches-100", 100, "Légende", "Legend", "Jouer 100 matchs"],
];

const MILESTONE_WINS: Array<[string, number, string, string, string]> = [
  ["first-win", 1, "Première victoire", "First win", "Remporter un match"],
  ["wins-10", 10, "Conquérant", "Conqueror", "Remporter 10 matchs"],
  ["wins-50", 50, "Champion", "Champion", "Remporter 50 matchs"],
];

const MILESTONE_TOUCHDOWNS: Array<[string, number, string, string, string]> = [
  ["first-td", 1, "Premier touchdown", "First touchdown", "Marquer un touchdown"],
  ["td-50", 50, "Marqueur", "Scorer", "Marquer 50 touchdowns"],
  ["td-100", 100, "Légende du score", "Scoring legend", "Marquer 100 touchdowns"],
];

const MILESTONE_CASUALTIES: Array<[string, number, string, string, string]> = [
  ["first-cas", 1, "Premier sang", "First blood", "Infliger une sortie"],
  ["cas-25", 25, "Brutal", "Brutal", "Infliger 25 sorties"],
  ["cas-100", 100, "Boucher", "Butcher", "Infliger 100 sorties"],
];

/**
 * Priority rosters (Sprint 13/14 MVP scope): each gets two achievements —
 *  - `roster-<slug>` (Pionnier/Pioneer) : play one match with the team
 *  - `master-<slug>` (Maître/Master) : win N.8-threshold matches with the team
 *
 * Tuple : [roster slug, FR team name, EN team name]
 */
const PRIORITY_ROSTERS: Array<[string, string, string]> = [
  ["skaven", "Skavens", "Skaven"],
  ["lizardmen", "Hommes-Lézards", "Lizardmen"],
  ["dwarf", "Nains", "Dwarf"],
  ["gnome", "Gnomes", "Gnome"],
  ["imperial_nobility", "Noblesse Impériale", "Imperial Nobility"],
];

/** Minimum wins with a priority roster required to earn its Master badge. */
export const MASTER_ROSTER_WINS_THRESHOLD = 5;

function buildCatalog(): AchievementDefinition[] {
  const catalog: AchievementDefinition[] = [];

  for (const [slug, threshold, nameFr, nameEn, descFr] of MILESTONE_MATCHES) {
    catalog.push({
      slug,
      nameFr,
      nameEn,
      descriptionFr: descFr,
      descriptionEn: `Play ${threshold} match${threshold > 1 ? "es" : ""}`,
      category: "matches",
      icon: "🎯",
      predicate: (s) => s.matchesPlayed >= threshold,
    });
  }

  for (const [slug, threshold, nameFr, nameEn, descFr] of MILESTONE_WINS) {
    catalog.push({
      slug,
      nameFr,
      nameEn,
      descriptionFr: descFr,
      descriptionEn: `Win ${threshold} match${threshold > 1 ? "es" : ""}`,
      category: "matches",
      icon: "🏆",
      predicate: (s) => s.wins >= threshold,
    });
  }

  for (const [slug, threshold, nameFr, nameEn, descFr] of MILESTONE_TOUCHDOWNS) {
    catalog.push({
      slug,
      nameFr,
      nameEn,
      descriptionFr: descFr,
      descriptionEn: `Score ${threshold} touchdown${threshold > 1 ? "s" : ""}`,
      category: "scoring",
      icon: "🏈",
      predicate: (s) => s.touchdowns >= threshold,
    });
  }

  for (const [slug, threshold, nameFr, nameEn, descFr] of MILESTONE_CASUALTIES) {
    catalog.push({
      slug,
      nameFr,
      nameEn,
      descriptionFr: descFr,
      descriptionEn: `Inflict ${threshold} casualt${threshold > 1 ? "ies" : "y"}`,
      category: "casualties",
      icon: "💀",
      predicate: (s) => s.casualties >= threshold,
    });
  }

  catalog.push({
    slug: "first-friend",
    nameFr: "Premier ami",
    nameEn: "First friend",
    descriptionFr: "Avoir un ami accepté",
    descriptionEn: "Have an accepted friend",
    category: "social",
    icon: "🤝",
    predicate: (s) => s.friendsCount >= 1,
  });
  catalog.push({
    slug: "friends-5",
    nameFr: "Cercle proche",
    nameEn: "Inner circle",
    descriptionFr: "Avoir 5 amis acceptés",
    descriptionEn: "Have 5 accepted friends",
    category: "social",
    icon: "👥",
    predicate: (s) => s.friendsCount >= 5,
  });

  for (const [roster, nameFr, nameEn] of PRIORITY_ROSTERS) {
    catalog.push({
      slug: `roster-${roster}`,
      nameFr: `Pionnier des ${nameFr}`,
      nameEn: `${nameEn} pioneer`,
      descriptionFr: `Jouer un match avec l'équipe ${nameFr}`,
      descriptionEn: `Play a match with the ${nameEn} team`,
      category: "rosters",
      icon: "⚔️",
      predicate: (s) => s.rostersPlayed.has(roster),
    });
    catalog.push({
      slug: `master-${roster}`,
      nameFr: `Maître des ${nameFr}`,
      nameEn: `${nameEn} master`,
      descriptionFr: `Gagner ${MASTER_ROSTER_WINS_THRESHOLD} matchs avec l'équipe ${nameFr}`,
      descriptionEn: `Win ${MASTER_ROSTER_WINS_THRESHOLD} matches with the ${nameEn} team`,
      category: "rosters",
      icon: "👑",
      predicate: (s) =>
        (s.winsByRoster.get(roster) ?? 0) >= MASTER_ROSTER_WINS_THRESHOLD,
    });
  }

  return catalog;
}

export const ACHIEVEMENTS_CATALOG: readonly AchievementDefinition[] = buildCatalog();

// ---------------------------------------------------------------------------
// Pure evaluation
// ---------------------------------------------------------------------------

export function evaluateAchievements(
  stats: UserAchievementStats,
  alreadyUnlocked: ReadonlySet<string>,
): string[] {
  const newly: string[] = [];
  for (const def of ACHIEVEMENTS_CATALOG) {
    if (alreadyUnlocked.has(def.slug)) continue;
    if (def.predicate(stats)) newly.push(def.slug);
  }
  return newly;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function unlockAchievements(
  userId: string,
  slugs: ReadonlyArray<string>,
): Promise<void> {
  if (slugs.length === 0) return;
  await (prisma as any).userAchievement.createMany({
    data: slugs.map((slug) => ({ userId, slug })),
    skipDuplicates: true,
  });
}

// ---------------------------------------------------------------------------
// Stats aggregation from Prisma
// ---------------------------------------------------------------------------

interface RawSelection {
  id: string;
  userId: string;
  teamRef: { roster: string } | null;
  match: {
    id: string;
    status: string;
    turns: Array<{ payload: unknown }>;
    teamSelections: Array<{ id: string; userId: string }>;
  };
}

interface RawGameState {
  score?: { teamA?: number; teamB?: number };
  players?: Array<{ id: string; team?: string }>;
  matchStats?: Record<
    string,
    {
      touchdowns?: number;
      casualties?: number;
      completions?: number;
      interceptions?: number;
    }
  >;
}

function parseGameState(raw: unknown): RawGameState | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as { gameState?: unknown };
  const gs = payload.gameState;
  if (!gs) return null;
  if (typeof gs === "string") {
    try {
      return JSON.parse(gs) as RawGameState;
    } catch {
      return null;
    }
  }
  return gs as RawGameState;
}

export async function computeUserStats(
  userId: string,
): Promise<UserAchievementStats> {
  const selections = (await (prisma as any).teamSelection.findMany({
    where: { userId, match: { status: "ended" } },
    include: {
      teamRef: { select: { roster: true } },
      match: {
        include: {
          turns: { orderBy: { number: "desc" }, take: 1 },
          teamSelections: {
            select: { id: true, userId: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  })) as RawSelection[];

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let touchdowns = 0;
  let casualties = 0;
  const rostersPlayed = new Set<string>();
  const winsByRoster = new Map<string, number>();

  for (const sel of selections) {
    if (!sel.match || sel.match.status !== "ended") continue;
    const allSels = sel.match.teamSelections;
    if (allSels.length < 2) continue;
    const teamSide: "A" | "B" = allSels[0].id === sel.id ? "A" : "B";

    const roster = sel.teamRef?.roster;
    if (roster) rostersPlayed.add(roster);

    const lastTurn = sel.match.turns[0];
    const gs = lastTurn ? parseGameState(lastTurn.payload) : null;
    if (!gs) continue;

    const myScore =
      teamSide === "A" ? gs.score?.teamA ?? 0 : gs.score?.teamB ?? 0;
    const oppScore =
      teamSide === "A" ? gs.score?.teamB ?? 0 : gs.score?.teamA ?? 0;

    touchdowns += myScore;
    if (myScore > oppScore) {
      wins += 1;
      if (roster) {
        winsByRoster.set(roster, (winsByRoster.get(roster) ?? 0) + 1);
      }
    } else if (myScore < oppScore) losses += 1;
    else draws += 1;

    const players = gs.players ?? [];
    const matchStats = gs.matchStats ?? {};
    for (const p of players) {
      if (p.team !== teamSide) continue;
      const s = matchStats[p.id];
      if (!s) continue;
      casualties += s.casualties ?? 0;
    }
  }

  const friendsCount = (await (prisma as any).friendship.count({
    where: {
      status: "accepted",
      OR: [{ requesterId: userId }, { receiverId: userId }],
    },
  })) as number;

  return {
    matchesPlayed: selections.filter((s) => s.match?.status === "ended").length,
    wins,
    draws,
    losses,
    touchdowns,
    casualties,
    friendsCount,
    rostersPlayed,
    winsByRoster,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getUserAchievements(
  userId: string,
): Promise<UserAchievementsResult> {
  const priorRows = (await (prisma as any).userAchievement.findMany({
    where: { userId },
    select: { slug: true, unlockedAt: true },
  })) as Array<{ slug: string; unlockedAt: Date }>;
  const priorSet = new Set(priorRows.map((r) => r.slug));

  const stats = await computeUserStats(userId);
  const newly = evaluateAchievements(stats, priorSet);

  let latestRows = priorRows;
  if (newly.length > 0) {
    await unlockAchievements(userId, newly);
    latestRows = (await (prisma as any).userAchievement.findMany({
      where: { userId },
      select: { slug: true, unlockedAt: true },
    })) as Array<{ slug: string; unlockedAt: Date }>;
  }

  const byslug = new Map(
    latestRows.map((r) => [r.slug, r.unlockedAt] as const),
  );

  const achievements: AchievementView[] = ACHIEVEMENTS_CATALOG.map((def) => {
    const unlockedAt = byslug.get(def.slug) ?? null;
    return {
      slug: def.slug,
      nameFr: def.nameFr,
      nameEn: def.nameEn,
      descriptionFr: def.descriptionFr,
      descriptionEn: def.descriptionEn,
      category: def.category,
      icon: def.icon,
      unlocked: unlockedAt !== null,
      unlockedAt,
    };
  });

  return {
    stats: {
      matchesPlayed: stats.matchesPlayed,
      wins: stats.wins,
      draws: stats.draws,
      losses: stats.losses,
      touchdowns: stats.touchdowns,
      casualties: stats.casualties,
      friendsCount: stats.friendsCount,
      rostersPlayed: Array.from(stats.rostersPlayed),
      winsByRoster: Object.fromEntries(stats.winsByRoster),
    },
    achievements,
  };
}
