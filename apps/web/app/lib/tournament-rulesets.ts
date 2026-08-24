/**
 * Accès client aux règlements de tournoi via l'API publique
 * (`/api/tournament-rulesets[/:slug]`) — source : base éditable en admin,
 * fusionnée serveur-side avec le registre statique. Le registre
 * `@bb/game-engine` reste ici un FALLBACK réseau (API injoignable) pour
 * que le builder ne casse jamais.
 *
 * Cache module simple : la liste et les définitions sont stables sur la
 * durée d'une session de navigation (TTL serveur 5 min + invalidation
 * admin) ; un échec réseau n'est PAS mis en cache.
 */

import {
  TOURNAMENT_RULESETS,
  getTournamentRuleset,
  type TournamentRulesetDefinition,
} from "@bb/game-engine";
import { API_BASE } from "../auth-client";

export interface TournamentRulesetSummary {
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string;
  readonly shortLabel: string;
  readonly version: string;
  readonly edition: string;
  readonly format: string;
  readonly resurrection: boolean;
}

export type TournamentRulesetDetail = TournamentRulesetDefinition & {
  readonly archived: boolean;
};

let listCache: TournamentRulesetSummary[] | null = null;
const detailCache = new Map<string, TournamentRulesetDetail>();

function staticSummaries(): TournamentRulesetSummary[] {
  return Object.values(TOURNAMENT_RULESETS).map((def) => ({
    slug: def.slug,
    nameFr: def.nameFr,
    nameEn: def.nameEn,
    shortLabel: def.shortLabel,
    version: def.version,
    edition: def.edition,
    format: def.format,
    resurrection: def.resurrection,
  }));
}

/** Liste des règlements sélectionnables (non archivés). */
export async function fetchTournamentRulesetList(): Promise<
  TournamentRulesetSummary[]
> {
  if (listCache) return listCache;
  try {
    const res = await fetch(`${API_BASE}/api/tournament-rulesets`);
    if (res.ok) {
      const data = (await res.json()) as {
        tournamentRulesets?: TournamentRulesetSummary[];
      };
      if (Array.isArray(data.tournamentRulesets)) {
        listCache = data.tournamentRulesets;
        return listCache;
      }
    }
  } catch {
    // API injoignable → fallback registre statique (non mis en cache).
  }
  return staticSummaries();
}

/**
 * Définition complète d'un règlement (archivés résolus, flag `archived`).
 * Les tranches de taxe ouvertes arrivent en `maxTotalCostK: null` (JSON ne
 * transporte pas Infinity) : reconverties ici pour les helpers purs du
 * moteur (`tournamentStarPlayerSppTax`…). null = slug inconnu.
 */
export async function fetchTournamentRulesetDefinition(
  slug: string,
): Promise<TournamentRulesetDetail | null> {
  const cached = detailCache.get(slug);
  if (cached) return cached;
  try {
    const res = await fetch(
      `${API_BASE}/api/tournament-rulesets/${encodeURIComponent(slug)}`,
    );
    if (res.status === 404) return null;
    if (res.ok) {
      const data = (await res.json()) as {
        tournamentRuleset?: TournamentRulesetDetail;
      };
      const raw = data.tournamentRuleset;
      if (raw) {
        const detail: TournamentRulesetDetail = {
          ...raw,
          starPlayerSppTax: (raw.starPlayerSppTax ?? []).map((b) => ({
            maxTotalCostK:
              b.maxTotalCostK === null || b.maxTotalCostK === undefined
                ? Number.POSITIVE_INFINITY
                : b.maxTotalCostK,
            spp: b.spp,
          })),
        };
        detailCache.set(slug, detail);
        return detail;
      }
    }
  } catch {
    // API injoignable → fallback registre statique.
  }
  const staticDef = getTournamentRuleset(slug);
  return staticDef ? { ...staticDef, archived: false } : null;
}

/**
 * Libellé court best-effort SYNCHRONE depuis les caches (liste/détail déjà
 * chargés) puis le registre statique, sinon le slug brut. Pour les badges,
 * préférer un label serveur embarqué quand l'endpoint en fournit un.
 */
export function tournamentRulesetLabel(slug: string): string {
  const fromList = listCache?.find((s) => s.slug === slug)?.shortLabel;
  if (fromList) return fromList;
  const fromDetail = detailCache.get(slug)?.shortLabel;
  if (fromDetail) return fromDetail;
  return getTournamentRuleset(slug)?.shortLabel ?? slug;
}
