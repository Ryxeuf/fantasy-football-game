"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../auth-client";
import {
  buildPositionMetaByPosition,
  buildSkillAccessByPosition,
  type PositionMeta,
  type PositionSkillAccess,
  type RosterPositionLike,
} from "../../me/teams/[id]/roster-skill-access";

export interface RosterPositionMeta {
  readonly metaByPosition: ReadonlyMap<string, PositionMeta>;
  readonly accessByPosition: ReadonlyMap<string, PositionSkillAccess>;
}

/**
 * Méta des postes d'un roster (mots-clés, accès aux compétences, compétences
 * de base, illustration), lue sur l'API publique `/api/rosters/:slug` — la
 * même source que la fiche « Mes équipes ». Best-effort : tant que la réponse
 * n'est pas là (ou en cas d'échec), les cartes vides laissent la fiche
 * s'afficher sans ces compléments.
 */
export function useRosterPositionMeta(
  rosterSlug: string,
  ruleset: string | null | undefined,
): RosterPositionMeta {
  const [positions, setPositions] = useState<RosterPositionLike[] | null>(null);

  useEffect(() => {
    if (!rosterSlug) return;
    let cancelled = false;
    const rulesetQuery = ruleset ? `&ruleset=${encodeURIComponent(ruleset)}` : "";
    const url = `${API_BASE}/api/rosters/${encodeURIComponent(rosterSlug)}?lang=fr${rulesetQuery}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { roster?: { positions?: RosterPositionLike[] } } | null) => {
        if (cancelled) return;
        const list = body?.roster?.positions;
        setPositions(Array.isArray(list) ? list : null);
      })
      .catch(() => {
        if (!cancelled) setPositions(null);
      });
    return () => {
      cancelled = true;
    };
  }, [rosterSlug, ruleset]);

  return useMemo(
    () => ({
      metaByPosition: buildPositionMetaByPosition(positions),
      accessByPosition: buildSkillAccessByPosition(positions),
    }),
    [positions],
  );
}
