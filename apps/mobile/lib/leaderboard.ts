// Pure helpers for the leaderboard screen.
// Network-free so they can be unit-tested in node.

export const LEADERBOARD_PAGE_SIZE = 20;

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  coachName: string;
  eloRating: number;
}

export interface LeaderboardMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface LeaderboardStats {
  top: number;
  average: number;
}

export function computeLeaderboardStats(
  entries: ReadonlyArray<LeaderboardEntry>,
): LeaderboardStats {
  if (entries.length === 0) {
    return { top: 0, average: 0 };
  }
  const ratings = entries.map((e) => e.eloRating);
  const top = Math.max(...ratings);
  const average = Math.round(
    ratings.reduce((sum, r) => sum + r, 0) / entries.length,
  );
  return { top, average };
}

export function getCurrentPage(offset: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.floor(offset / pageSize) + 1;
}

export function getTotalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function isFirstPage(offset: number): boolean {
  return offset <= 0;
}

export function isLastPage(
  offset: number,
  pageSize: number,
  total: number,
): boolean {
  return offset + pageSize >= total;
}

export function formatEloRating(rating: number): string {
  return String(Math.floor(rating));
}

function isValidEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.rank === "number" &&
    typeof v.userId === "string" &&
    typeof v.coachName === "string" &&
    typeof v.eloRating === "number"
  );
}

export interface ParsedLeaderboard {
  entries: LeaderboardEntry[];
  meta: LeaderboardMeta;
}

export function parseLeaderboardResponse(response: unknown): ParsedLeaderboard {
  const raw = (response ?? {}) as Record<string, unknown>;
  const rawEntries = Array.isArray(raw.data) ? raw.data : [];
  const entries = rawEntries.filter(isValidEntry);

  const rawMeta = (raw.meta ?? {}) as Record<string, unknown>;
  const meta: LeaderboardMeta = {
    total: typeof rawMeta.total === "number" ? rawMeta.total : 0,
    limit:
      typeof rawMeta.limit === "number" ? rawMeta.limit : LEADERBOARD_PAGE_SIZE,
    offset: typeof rawMeta.offset === "number" ? rawMeta.offset : 0,
  };

  return { entries, meta };
}
