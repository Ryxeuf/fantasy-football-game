"use client";

/**
 * Catalogues d'aide à la saisie de l'éditeur : compétences Élite du
 * référentiel et Star Players. Ils évitent de taper des slugs à la main —
 * une faute de frappe passerait la validation de format mais désignerait une
 * compétence ou un Star Player qui n'existe pas.
 */

import { useEffect, useState } from "react";
import { API_BASE } from "../../../../auth-client";

export interface EliteSkillOption {
  readonly slug: string;
  readonly nameFr: string;
}
export interface StarPlayerOption {
  readonly slug: string;
  readonly name: string;
}

async function getJSON<T>(path: string): Promise<T> {
  const token =
    typeof window === "undefined" ? null : localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Compétences Élite du référentiel pour l'édition ciblée. Un échec renvoie
 * une liste vide : l'éditeur reste utilisable, seul le confort de saisie
 * disparaît.
 */
export function useEliteSkills(edition: string): readonly EliteSkillOption[] {
  const [skills, setSkills] = useState<readonly EliteSkillOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    getJSON<{ skills: Array<{ slug: string; nameFr: string; isElite: boolean }> }>(
      `/api/skills?ruleset=${encodeURIComponent(edition)}`,
    )
      .then((r) => {
        if (cancelled) return;
        setSkills(
          (r.skills ?? [])
            .filter((s) => s.isElite)
            .map((s) => ({ slug: s.slug, nameFr: s.nameFr })),
        );
      })
      .catch(() => {
        if (!cancelled) setSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, [edition]);
  return skills;
}

/** Star Players du catalogue, pour la liste des interdits. */
export function useStarPlayers(edition: string): readonly StarPlayerOption[] {
  const [stars, setStars] = useState<readonly StarPlayerOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    // `GET /api/star-players` renvoie `{ success, count, data }`.
    getJSON<{
      data?: Array<{ slug: string; displayName?: string; name?: string }>;
    }>(`/api/star-players?ruleset=${encodeURIComponent(edition)}`)
      .then((r) => {
        if (cancelled) return;
        setStars(
          (r.data ?? [])
            .map((s) => ({ slug: s.slug, name: s.displayName ?? s.name ?? s.slug }))
            .sort((a, b) => a.name.localeCompare(b.name, "fr")),
        );
      })
      .catch(() => {
        if (!cancelled) setStars([]);
      });
    return () => {
      cancelled = true;
    };
  }, [edition]);
  return stars;
}
