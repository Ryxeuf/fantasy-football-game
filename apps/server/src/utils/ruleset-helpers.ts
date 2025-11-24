import { DEFAULT_RULESET, RULESETS, type Ruleset } from "@bb/game-engine";

export function resolveRuleset(value?: string | null): Ruleset {
  if (value) {
    const normalized = value.toLowerCase() as Ruleset;
    if (RULESETS.includes(normalized)) {
      return normalized;
    }
  }
  return DEFAULT_RULESET;
}

export { DEFAULT_RULESET, RULESETS, type Ruleset };

