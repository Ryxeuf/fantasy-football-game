/**
 * Règles spéciales EFFECTIVES d'une équipe, localisées.
 *
 * Une équipe n'hérite pas seulement des règles spéciales de son roster
 * (`Roster.specialRules`) : la Ligue régionale retenue à la création peut lui
 * apporter un alignement « Favori de… » (Nordiques + Clash du Chaos ⇒ Favori
 * de Khorne, cf. `CONDITIONAL_GRANTS` du moteur). La fiche d'équipe ne lisait
 * que la 1re source et annonçait donc « Aucune » pour ces équipes.
 *
 * La résolution (pure) vit dans `@bb/game-engine`
 * (`resolveTeamSpecialRules`) ; ce service se contente de charger le roster
 * et de localiser le résultat.
 */

import {
  DEFAULT_RULESET,
  favouredOfLabel,
  getTeamSpecialRuleBySlug,
  resolveTeamSpecialRules,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { effectiveRegionalRules } from "./roster-regional-rules";
import { parseSlugList } from "./roster-regional-rules";
import { serverLog } from "../utils/server-log";

/** Règle spéciale résolue et localisée, prête pour l'UI. */
export interface TeamSpecialRuleView {
  /** Slug du catalogue `TEAM_SPECIAL_RULES`. */
  slug: string;
  /** Libellé localisé (« Favori de Khorne » pour un alignement résolu). */
  name: string;
  description: string;
  /** Alignement `favoured_of_*` quand `slug` vaut `favori_de`. */
  alignment?: string;
}

export interface TeamSpecialRulesInput {
  readonly roster: string;
  readonly ruleset?: string | null;
  /** Ligue régionale choisie à la création (`Team.regionalLeague`). */
  readonly regionalLeague?: string | null;
}

/**
 * Règles spéciales effectives d'une équipe. Tolérant : si le roster est
 * illisible en base, on retombe sur le catalogue du moteur — la fiche
 * d'équipe reste servie.
 */
export async function getTeamSpecialRules(
  team: TeamSpecialRulesInput,
  isEnglish = false,
): Promise<TeamSpecialRuleView[]> {
  const ruleset = (team.ruleset ?? DEFAULT_RULESET) as Ruleset;

  let rosterSpecialRules: string[] | null = null;
  let declaredRegionalRules: string[] | null = null;
  try {
    const row = await prisma.roster.findFirst({
      where: { slug: team.roster, ruleset },
      select: { slug: true, specialRules: true, regionalRules: true },
    });
    if (row) {
      rosterSpecialRules = parseSlugList(row.specialRules);
      declaredRegionalRules = effectiveRegionalRules(
        row.regionalRules,
        row.slug,
        ruleset,
      ).rules;
    }
  } catch (e: unknown) {
    serverLog.error("[team-special-rules] lecture roster", e);
  }

  const resolved = resolveTeamSpecialRules({
    rosterSlug: team.roster,
    ruleset,
    regionalLeague: team.regionalLeague ?? null,
    rosterSpecialRules,
    declaredRegionalRules,
  });

  const out: TeamSpecialRuleView[] = [];
  for (const rule of resolved) {
    const def = getTeamSpecialRuleBySlug(rule.slug);
    if (!def) continue;
    out.push({
      slug: def.slug,
      // Un alignement résolu se nomme par son dieu (« Favori de Khorne »)
      // plutôt que par le libellé générique « Favori de... ».
      name: rule.alignment
        ? favouredOfLabel(rule.alignment, isEnglish)
        : isEnglish
          ? def.nameEn
          : def.nameFr,
      description:
        isEnglish && def.descriptionEn ? def.descriptionEn : def.description,
      ...(rule.alignment ? { alignment: rule.alignment } : {}),
    });
  }
  return out;
}
