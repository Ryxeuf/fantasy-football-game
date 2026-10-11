"use client";

/**
 * Coups de pouce d'une coupe, sur sa fiche : le régime et la liste du
 * commissaire — sous règlement, ce qu'elle AJOUTE et RETIRE à la liste du
 * règlement. Rien sans mode servi (API antérieure).
 */

import { ALLOWED_INDUCEMENT_OPTIONS } from "../components/AllowedInducementsField";
import {
  CUP_INDUCEMENT_MODE_COPY,
  cupInducementListDiff,
  parseCupInducementMode,
} from "./inducement-mode";

const NAME_BY_SLUG = new Map(ALLOWED_INDUCEMENT_OPTIONS.map((o) => [o.slug, o.name]));
const names = (slugs: readonly string[]) =>
  slugs.map((slug) => NAME_BY_SLUG.get(slug) ?? slug).join(", ");

export interface CupInducementRulesSummaryProps {
  readonly mode?: string | null;
  /** Liste de la coupe : `null` = liste par défaut, `[]` = aucun. */
  readonly allowed?: readonly string[] | null;
  /** Slugs de la liste du règlement, s'il y en a un. */
  readonly packSlugs?: readonly string[] | null;
  readonly rulesetLabel?: string | null;
}

function listDetail(
  allowed: readonly string[] | null,
  packSlugs: readonly string[] | null,
  rulesetLabel: string,
): { testId: string; text: string } | null {
  if (allowed === null) {
    return packSlugs
      ? { testId: "cup-allowed-inducements-display", text: `liste du règlement ${rulesetLabel}` }
      : null;
  }
  if (allowed.length === 0) {
    return { testId: "cup-allowed-inducements-display", text: "aucun coup de pouce autorisé" };
  }
  if (!packSlugs) {
    return { testId: "cup-allowed-inducements-display", text: `limités à ${names(allowed)}` };
  }
  const { added, removed } = cupInducementListDiff(allowed, packSlugs);
  const parts = [
    `liste du règlement ${rulesetLabel}`,
    ...(added.length > 0 ? [`+ ${names(added)}`] : []),
    ...(removed.length > 0 ? [`− ${names(removed)}`] : []),
  ];
  return { testId: "cup-allowed-inducements-display", text: parts.join(" · ") };
}

export function CupInducementRulesSummary({
  mode,
  allowed,
  packSlugs = null,
  rulesetLabel,
}: CupInducementRulesSummaryProps) {
  const parsed = parseCupInducementMode(mode);
  if (!parsed) return null;
  const detail =
    parsed === "none"
      ? null
      : listDetail(allowed ?? null, packSlugs, rulesetLabel ?? "");
  return (
    <div className="text-xs text-gray-600 mt-1" data-testid="cup-inducement-mode-display">
      <span className="font-medium">🎁 Coups de pouce : </span>
      {CUP_INDUCEMENT_MODE_COPY[parsed].title}
      {detail ? <span data-testid={detail.testId}> — {detail.text}</span> : null}
    </div>
  );
}
