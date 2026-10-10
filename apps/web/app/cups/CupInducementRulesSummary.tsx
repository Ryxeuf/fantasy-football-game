"use client";

/**
 * Régime des coups de pouce d'une coupe, sur sa fiche : le mode et, s'il y en
 * a une, la liste autorisée. Rien sans mode servi (API antérieure).
 */

import { ALLOWED_INDUCEMENT_OPTIONS } from "../components/AllowedInducementsField";
import { CUP_INDUCEMENT_MODE_COPY, parseCupInducementMode } from "./inducement-mode";

const NAME_BY_SLUG = new Map(ALLOWED_INDUCEMENT_OPTIONS.map((o) => [o.slug, o.name]));

export interface CupInducementRulesSummaryProps {
  readonly mode?: string | null;
  readonly allowed?: readonly string[] | null;
}

export function CupInducementRulesSummary({ mode, allowed }: CupInducementRulesSummaryProps) {
  const parsed = parseCupInducementMode(mode);
  if (!parsed) return null;
  const list = parsed !== "none" ? (allowed ?? []) : [];
  return (
    <div className="text-xs text-gray-600 mt-1" data-testid="cup-inducement-mode-display">
      <span className="font-medium">🎁 Coups de pouce : </span>
      {CUP_INDUCEMENT_MODE_COPY[parsed].title}
      {list.length > 0 ? (
        <span data-testid="cup-allowed-inducements-display">
          {" "}
          — limités à {list.map((slug) => NAME_BY_SLUG.get(slug) ?? slug).join(", ")}
        </span>
      ) : null}
    </div>
  );
}
