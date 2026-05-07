import { DEFAULT_RULESET, RULESETS, type Ruleset } from "@bb/game-engine";

export const RULESET_LABELS: Record<Ruleset, string> = {
  season_2: "Saison 2 (2020)",
  season_3: "Saison 3 (2025)",
  // S27.5 — skeleton vide en attente des rosters officiels GW 2025-2026.
  season_4: "Saison 4 (2026, skeleton)",
};

export const RULESET_OPTIONS = RULESETS.map((value) => ({
  value,
  label: RULESET_LABELS[value] ?? value,
}));

export const getRulesetLabel = (value?: string | null): string => {
  if (!value) return "Inconnu";
  return RULESET_LABELS[value as Ruleset] ?? value;
};

export { DEFAULT_RULESET, RULESETS };
export type { Ruleset };

