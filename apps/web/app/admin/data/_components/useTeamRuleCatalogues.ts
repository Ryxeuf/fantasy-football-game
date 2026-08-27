"use client";

/**
 * Catalogues de règles spéciales et de Ligues régionales pour les
 * formulaires d'administration d'un roster (lot 6.5).
 *
 * Les cases à cocher listaient les catalogues COMPILÉS de `@bb/game-engine` :
 * une règle créée ou renommée en admin n'apparaissait donc jamais dans le
 * formulaire qui sert à l'attribuer. On lit maintenant les tables
 * (`/admin/data/special-rules`, `/admin/data/regional-leagues`) et on retombe
 * sur le catalogue compilé tant que la réponse n'est pas là (ou en cas
 * d'échec) — le formulaire reste utilisable, jamais vide.
 */

import { useEffect, useState } from "react";
import { API_BASE } from "../../../auth-client";
import {
  ENGINE_REGIONAL_LEAGUE_OPTIONS,
  ENGINE_SPECIAL_RULE_OPTIONS,
  type SlugOption,
} from "./SlugCheckboxGrid";

interface CatalogueRow {
  slug: string;
  ruleset: string;
  nameFr: string;
}

async function fetchCatalogue(endpoint: string): Promise<CatalogueRow[]> {
  const token =
    typeof window === "undefined" ? null : localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const body = await res.json();
  return Array.isArray(body?.rules) ? body.rules : [];
}

/**
 * Dédoublonne par slug : les tables portent une ligne par édition, le
 * formulaire ne coche qu'un slug. Le libellé retenu est celui de l'édition
 * demandée quand elle existe.
 */
function toOptions(
  rows: readonly CatalogueRow[],
  ruleset: string | undefined,
  fallback: readonly SlugOption[],
): SlugOption[] {
  if (rows.length === 0) return [...fallback];
  const bySlug = new Map<string, string>();
  for (const row of rows) {
    if (bySlug.has(row.slug) && ruleset && row.ruleset !== ruleset) continue;
    bySlug.set(row.slug, row.nameFr);
  }
  return [...bySlug.entries()]
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export interface TeamRuleCatalogues {
  readonly specialRuleOptions: SlugOption[];
  readonly regionalLeagueOptions: SlugOption[];
}

export function useTeamRuleCatalogues(ruleset?: string): TeamRuleCatalogues {
  const [specialRuleOptions, setSpecialRuleOptions] = useState<SlugOption[]>([
    ...ENGINE_SPECIAL_RULE_OPTIONS,
  ]);
  const [regionalLeagueOptions, setRegionalLeagueOptions] = useState<
    SlugOption[]
  >([...ENGINE_REGIONAL_LEAGUE_OPTIONS]);

  useEffect(() => {
    let cancelled = false;
    const query = ruleset ? `?ruleset=${encodeURIComponent(ruleset)}` : "";
    void Promise.all([
      fetchCatalogue(`/admin/data/special-rules${query}`).catch(
        () => [] as CatalogueRow[],
      ),
      fetchCatalogue(`/admin/data/regional-leagues${query}`).catch(
        () => [] as CatalogueRow[],
      ),
    ]).then(([rules, leagues]) => {
      if (cancelled) return;
      setSpecialRuleOptions(
        toOptions(rules, ruleset, ENGINE_SPECIAL_RULE_OPTIONS),
      );
      setRegionalLeagueOptions(
        toOptions(leagues, ruleset, ENGINE_REGIONAL_LEAGUE_OPTIONS),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [ruleset]);

  return { specialRuleOptions, regionalLeagueOptions };
}
