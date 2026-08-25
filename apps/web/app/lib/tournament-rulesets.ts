"use client";

/**
 * Règlements de tournoi côté web : servis par l'API, plus par le registre du
 * moteur.
 *
 * Les règlements sont désormais éditables en base (console admin). Le web les
 * charge donc depuis `GET /api/tournament-rulesets` ; les fonctions PURES du
 * moteur (barèmes, quotas, taxe Star Players, validation de plan de
 * compétences) continuent de s'appliquer côté client — elles prennent la
 * définition en argument, peu importe d'où elle vient.
 *
 * Deux précautions :
 *  - `Infinity` ne passe pas en JSON : la borne ouverte de la taxe Star
 *    Players arrive en `null` et est reconvertie ici, sinon la dernière
 *    tranche ne s'appliquerait jamais ;
 *  - un cache module évite de re-télécharger la liste à chaque montage
 *    (builder, formulaire de ligue, fiches d'équipe et de compétition).
 */

import { useEffect, useState } from "react";
import type { TournamentRulesetDefinition } from "@bb/game-engine";
import { apiRequest } from "./api-client";

/** Forme transportée par l'API (borne ouverte en `null`). */
interface SerializedDefinition
  extends Omit<TournamentRulesetDefinition, "starPlayerSppTax"> {
  readonly starPlayerSppTax: ReadonlyArray<{
    readonly maxTotalCostK: number | null;
    readonly spp: number;
  }>;
}

interface RulesetsResponse {
  rulesets: Array<{
    slug: string;
    enabled: boolean;
    definition: SerializedDefinition;
  }>;
}

/** Un règlement prêt à l'emploi côté client. */
export interface TournamentRulesetView {
  readonly slug: string;
  readonly enabled: boolean;
  readonly definition: TournamentRulesetDefinition;
}

/** `null` → `Infinity` : convention du moteur pour « pas de borne haute ». */
function hydrate(def: SerializedDefinition): TournamentRulesetDefinition {
  return {
    ...def,
    starPlayerSppTax: def.starPlayerSppTax.map((b) => ({
      maxTotalCostK: b.maxTotalCostK ?? Number.POSITIVE_INFINITY,
      spp: b.spp,
    })),
  } as TournamentRulesetDefinition;
}

let cache: TournamentRulesetView[] | null = null;
let inFlight: Promise<TournamentRulesetView[]> | null = null;

/** Vide le cache (édition admin dans le même onglet). */
export function invalidateTournamentRulesetsCache(): void {
  cache = null;
  inFlight = null;
}

/**
 * Règlements proposables à la création. Un échec réseau renvoie une liste
 * vide : le sélecteur disparaît plutôt que d'afficher un règlement qui ne
 * serait pas accepté à la création.
 */
export async function fetchTournamentRulesets(): Promise<
  TournamentRulesetView[]
> {
  if (cache) return cache;
  if (inFlight) return inFlight;
  inFlight = apiRequest<RulesetsResponse>("/api/tournament-rulesets")
    .then((r) => {
      cache = (r.rulesets ?? []).map((row) => ({
        slug: row.slug,
        enabled: row.enabled,
        definition: hydrate(row.definition),
      }));
      return cache;
    })
    .catch(() => [])
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export interface UseTournamentRulesets {
  readonly rulesets: readonly TournamentRulesetView[];
  /** Accès direct par slug (règlements proposables uniquement). */
  readonly bySlug: ReadonlyMap<string, TournamentRulesetDefinition>;
  readonly loading: boolean;
}

/** Charge la liste une fois par session d'onglet. */
export function useTournamentRulesets(): UseTournamentRulesets {
  const [rulesets, setRulesets] = useState<readonly TournamentRulesetView[]>(
    () => cache ?? [],
  );
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    let cancelled = false;
    fetchTournamentRulesets().then((list) => {
      if (cancelled) return;
      setRulesets(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    rulesets,
    bySlug: new Map(rulesets.map((r) => [r.slug, r.definition])),
    loading,
  };
}

/**
 * Libellé court d'un règlement pour l'affichage (fiches d'équipe, de ligue,
 * de coupe). Repli sur le slug tant que la liste n'est pas chargée, ou si le
 * règlement a été désactivé depuis.
 */
export function useTournamentRulesetLabel(
  slug: string | null | undefined,
): string | null {
  const [label, setLabel] = useState<string | null>(slug ?? null);

  useEffect(() => {
    if (!slug) {
      setLabel(null);
      return;
    }
    let cancelled = false;
    setLabel(slug);
    // `?slug=` accepte aussi les règlements désactivés : une équipe créée
    // sous un règlement retiré des listes doit continuer à l'afficher.
    apiRequest<RulesetsResponse>(
      `/api/tournament-rulesets?slug=${encodeURIComponent(slug)}`,
    )
      .then((r) => {
        if (cancelled) return;
        setLabel(r.rulesets?.[0]?.definition.shortLabel ?? slug);
      })
      .catch(() => {
        if (!cancelled) setLabel(slug);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return label;
}
