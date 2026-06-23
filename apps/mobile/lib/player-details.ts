// Pure helpers for the mobile player detail screen (M.10).
// Network-free so they can be unit-tested in node.

import type { AdvancementType, PlayerAdvancement } from "@bb/game-engine";
import type { TeamPlayer } from "./teams";

export type { AdvancementType, PlayerAdvancement };

// Mirror of packages/game-engine/src/utils/advancements.ts SPP_COST_TABLE.
// Inlined locally because mobile's vitest/metro resolve @bb/game-engine as
// the built package (types only) — runtime values are duplicated to keep the
// mobile helper dependency-free.
// Table BB2025 (Saison 3) — alignee sur packages/game-engine.
const SPP_COST_TABLE: Record<AdvancementType, readonly number[]> = {
  primary: [0, 6, 8, 12, 16, 20, 30],
  secondary: [0, 10, 12, 16, 20, 24, 34],
  "random-primary": [0, 3, 4, 6, 8, 10, 15],
  characteristic: [0, 14, 16, 20, 24, 28, 38],
};

export function getNextAdvancementPspCost(
  alreadyTaken: number,
  type: AdvancementType,
): number {
  const next = Math.min(Math.max(alreadyTaken + 1, 1), 6);
  return SPP_COST_TABLE[type][next];
}

export interface TeamPlayerWithProgression extends TeamPlayer {
  spp: number;
  totalTouchdowns: number;
  totalCasualties: number;
  totalCompletions: number;
  totalInterceptions: number;
  totalMvpAwards: number;
  matchesPlayed: number;
  nigglingInjuries: number;
  maReduction: number;
  stReduction: number;
  agReduction: number;
  paReduction: number;
  avReduction: number;
  missNextMatch: boolean;
  advancements: string;
  dead: boolean;
}

export type StatKey = "ma" | "st" | "ag" | "pa" | "av";

export interface AdvancementOption {
  type: AdvancementType;
  sppCost: number;
}

export function parsePlayerAdvancements(raw: string): PlayerAdvancement[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    // skillSlug est optionnel (absent pour une amelioration de
    // caracteristique) : on ne filtre que sur la presence du type.
    (entry): entry is PlayerAdvancement =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as PlayerAdvancement).type === "string",
  );
}

export function formatSpp(spp: number | null | undefined): string {
  const value = spp ?? 0;
  return `${value} SPP`;
}

export function formatStatValue(stat: StatKey, value: number): string {
  if (stat === "pa") {
    return value > 0 ? `${value}+` : "-";
  }
  if (stat === "ag" || stat === "av") {
    return `${value}+`;
  }
  return String(value);
}

const REDUCTION_KEYS: Record<StatKey, keyof TeamPlayerWithProgression> = {
  ma: "maReduction",
  st: "stReduction",
  ag: "agReduction",
  pa: "paReduction",
  av: "avReduction",
};

export function getEffectiveStat(
  player: TeamPlayerWithProgression,
  stat: StatKey,
): number {
  const base = player[stat] ?? 0;
  const reduction = (player[REDUCTION_KEYS[stat]] as number) ?? 0;
  return Math.max(1, base - reduction);
}

const ORDERED_TYPES: AdvancementType[] = [
  "primary",
  "secondary",
  "random-primary",
  "characteristic",
];

export function getNextAdvancementOptions(
  advancementsCount: number,
): AdvancementOption[] {
  return ORDERED_TYPES.map((type) => ({
    type,
    sppCost: getNextAdvancementPspCost(advancementsCount, type),
  }));
}

export function canAffordAdvancement(spp: number, cost: number): boolean {
  return spp >= cost;
}

/**
 * Locale-agnostic structured representation of a player's persistent
 * injuries. Formatting is the UI layer's responsibility (consume via
 * `t("players.detail.injuries.*")`).
 */
export type InjurySummaryEntry =
  | { kind: "niggling"; count: number }
  | { kind: "stat-reduction"; stat: StatKey; value: number }
  | { kind: "miss-next-match" };

export function computeInjurySummary(
  player: TeamPlayerWithProgression,
): InjurySummaryEntry[] {
  const summary: InjurySummaryEntry[] = [];
  if (player.nigglingInjuries > 0) {
    summary.push({ kind: "niggling", count: player.nigglingInjuries });
  }
  const reductions: Array<[StatKey, number]> = [
    ["ma", player.maReduction ?? 0],
    ["st", player.stReduction ?? 0],
    ["ag", player.agReduction ?? 0],
    ["pa", player.paReduction ?? 0],
    ["av", player.avReduction ?? 0],
  ];
  for (const [stat, value] of reductions) {
    if (value > 0) {
      summary.push({ kind: "stat-reduction", stat, value });
    }
  }
  if (player.missNextMatch) {
    summary.push({ kind: "miss-next-match" });
  }
  return summary;
}

export type PlayerStatusKind = "dead" | "miss-next-match" | "injured" | "fit";

export function computePlayerStatus(
  player: TeamPlayerWithProgression,
): PlayerStatusKind {
  if (player.dead) return "dead";
  if (player.missNextMatch) return "miss-next-match";
  if ((player.nigglingInjuries ?? 0) > 0) return "injured";
  return "fit";
}
