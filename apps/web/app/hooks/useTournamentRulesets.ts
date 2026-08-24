"use client";
/**
 * Hook client : liste des règlements de tournoi (API publique, fallback
 * registre statique) + résolveur de libellé pour les badges. Un composant
 * qui n'affiche qu'un badge passe par `label(slug)` — la liste couvre les
 * règlements créés en admin absents du registre statique.
 */

import { useEffect, useState } from "react";
import {
  fetchTournamentRulesetList,
  tournamentRulesetLabel,
  type TournamentRulesetSummary,
} from "../lib/tournament-rulesets";

export interface UseTournamentRulesetsResult {
  readonly rulesets: TournamentRulesetSummary[];
  readonly loading: boolean;
  /** Libellé court d'un slug (liste chargée → statique → slug brut). */
  readonly label: (slug: string) => string;
}

export function useTournamentRulesets(): UseTournamentRulesetsResult {
  const [rulesets, setRulesets] = useState<TournamentRulesetSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchTournamentRulesetList()
      .then((list) => {
        if (!cancelled) setRulesets(list);
      })
      .catch(() => {
        /* fallback statique déjà géré par le fetcher */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label = (slug: string): string =>
    rulesets.find((r) => r.slug === slug)?.shortLabel ??
    tournamentRulesetLabel(slug);

  return { rulesets, loading, label };
}
