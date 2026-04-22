// Pure helpers for the mobile Star Players catalog (M.11).
// Network-free so they can be unit-tested in node.

export type StarRuleset = "season_2" | "season_3";
export const DEFAULT_RULESET: StarRuleset = "season_3";

export interface StarPlayerSummary {
  slug: string;
  displayName: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  hirableBy: string[];
  specialRule?: string;
  specialRuleEn?: string;
  imageUrl?: string;
  isMegaStar?: boolean;
}

export type StarStatKey = "ma" | "st" | "ag" | "pa" | "av";

export interface StarPlayerFilters {
  search?: string;
  maxCost?: number;
  minCost?: number;
  skill?: string;
  hirableBy?: string;
  megaStarOnly?: boolean;
}

function isStarSummary(value: unknown): value is StarPlayerSummary {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === "string" &&
    typeof v.displayName === "string" &&
    typeof v.cost === "number" &&
    typeof v.ma === "number" &&
    typeof v.st === "number" &&
    typeof v.ag === "number" &&
    (v.pa === null || typeof v.pa === "number") &&
    typeof v.av === "number" &&
    typeof v.skills === "string" &&
    Array.isArray(v.hirableBy)
  );
}

export function parseStarPlayersResponse(
  response: unknown,
): StarPlayerSummary[] {
  const raw = (response ?? {}) as Record<string, unknown>;
  const rawData = Array.isArray(raw.data) ? raw.data : [];
  const bySlug = new Map<string, StarPlayerSummary>();
  for (const entry of rawData) {
    if (!isStarSummary(entry)) continue;
    if (!bySlug.has(entry.slug)) {
      bySlug.set(entry.slug, entry);
    }
  }
  return Array.from(bySlug.values());
}

export function getStarSkillList(skills: string | undefined): string[] {
  if (!skills) return [];
  return skills
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function filterStarPlayers(
  players: ReadonlyArray<StarPlayerSummary>,
  filters: StarPlayerFilters,
): StarPlayerSummary[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const skill = filters.skill?.trim().toLowerCase() ?? "";
  const hirable = filters.hirableBy?.trim() ?? "";
  return players.filter((p) => {
    if (search) {
      const haystack = `${p.displayName} ${p.slug}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (typeof filters.maxCost === "number" && p.cost > filters.maxCost) {
      return false;
    }
    if (typeof filters.minCost === "number" && p.cost < filters.minCost) {
      return false;
    }
    if (skill) {
      const skillList = getStarSkillList(p.skills).map((s) => s.toLowerCase());
      if (!skillList.some((s) => s.includes(skill))) return false;
    }
    if (hirable) {
      if (!p.hirableBy.includes(hirable)) return false;
    }
    if (filters.megaStarOnly && !p.isMegaStar) return false;
    return true;
  });
}

export function formatStarCost(cost: number | undefined): string {
  const value = cost ?? 0;
  const k = Math.floor(value / 1000);
  return `${k}K po`;
}

export function formatStarStat(
  stat: StarStatKey,
  value: number | null,
): string {
  if (stat === "pa") {
    if (value === null || value <= 0) return "-";
    return `${value}+`;
  }
  if (stat === "ag" || stat === "av") {
    return value === null ? "-" : `${value}+`;
  }
  return value === null ? "-" : String(value);
}

export function formatHirableBy(hirableBy: ReadonlyArray<string>): string {
  if (hirableBy.length === 0) return "Aucune equipe";
  if (hirableBy.includes("all")) return "Toutes les equipes";
  return hirableBy.join(", ");
}

export function resolveStarImageUrl(
  imageUrl: string | undefined,
  apiBase: string,
): string | null {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith("/")) return `${apiBase}${imageUrl}`;
  return `${apiBase}/${imageUrl}`;
}
