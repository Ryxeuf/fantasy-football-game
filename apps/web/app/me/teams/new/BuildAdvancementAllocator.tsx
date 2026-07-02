"use client";

/**
 * Allocateur de PSP « au build » (mode édition avancée / coupe).
 *
 * Permet, avant la création de l'équipe, de dépenser un pool de PSP en
 * améliorations sur les joueurs sélectionnés. Chaque joueur est identifié par
 * (positionSlug, ordinal) — le serveur crée les joueurs dans le même ordre puis
 * applique les advancements (cf. `applyCupBuildAdvancements`).
 *
 * MVP : une amélioration de compétence choisie (Principale/Secondaire) par
 * joueur, la compétence étant piochée dans le pool d'accès de la position. Le
 * coût est décompté du pool (barème BB, 1er palier). Le serveur re-valide tout.
 */

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../lib/api-client";

export interface BuildAdvancement {
  positionSlug: string;
  ordinal: number;
  type: "primary" | "secondary";
  skillSlug: string;
}

interface AllocatorPosition {
  slug: string;
  displayName: string;
  primarySkills?: string | null;
  secondarySkills?: string | null;
}

interface SkillCatalogItem {
  slug: string;
  nameFr: string;
  nameEn?: string;
  category: string;
}

interface SkillsResponse {
  skills: SkillCatalogItem[];
}

const CATEGORY_CODE: Record<string, string> = {
  General: "G",
  Agility: "A",
  Strength: "S",
  Passing: "P",
  Mutation: "M",
  "Scélérates": "K",
};

// Coût du 1er palier (barème BB2025), miroir de advancements.ts.
const FIRST_TIER_COST: Record<BuildAdvancement["type"], number> = {
  primary: 6,
  secondary: 10,
};

/** Parse un CSV d'accès ("G,S" / "GS", alias F→S) en Set de codes. */
function parseAccessCsv(raw: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;
  for (const token of raw.split(/[\s,]+/)) {
    const code = token.trim().toUpperCase().replace("F", "S");
    if (code) out.add(code);
  }
  return out;
}

export interface BuildAdvancementAllocatorProps {
  ruleset: string;
  /** Postes du roster (avec accès compétences). */
  positions: AllocatorPosition[];
  /** Quantités choisies par poste (slug → count). */
  counts: Record<string, number>;
  /** Pool de PSP disponible. */
  pool: number;
  value: BuildAdvancement[];
  onChange: (advancements: BuildAdvancement[]) => void;
}

export default function BuildAdvancementAllocator({
  ruleset,
  positions,
  counts,
  pool,
  value,
  onChange,
}: BuildAdvancementAllocatorProps) {
  const [catalog, setCatalog] = useState<SkillCatalogItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiRequest<SkillsResponse>(
      `/api/skills?ruleset=${encodeURIComponent(ruleset)}`,
    )
      .then((r) => {
        if (!cancelled) setCatalog(r.skills ?? []);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ruleset]);

  // Instances de joueurs (positionSlug + ordinal) dérivées des counts.
  const instances = useMemo(() => {
    const list: Array<{ position: AllocatorPosition; ordinal: number }> = [];
    for (const pos of positions) {
      const c = Math.max(0, counts[pos.slug] ?? 0);
      for (let i = 0; i < c; i += 1) list.push({ position: pos, ordinal: i });
    }
    return list;
  }, [positions, counts]);

  const spent = value.reduce((s, a) => s + FIRST_TIER_COST[a.type], 0);
  const remaining = Math.max(0, pool - spent);

  const findAdv = (slug: string, ordinal: number) =>
    value.find((a) => a.positionSlug === slug && a.ordinal === ordinal);

  const skillsForType = (
    pos: AllocatorPosition,
    type: BuildAdvancement["type"],
  ): SkillCatalogItem[] => {
    const access = parseAccessCsv(
      type === "primary" ? pos.primarySkills : pos.secondarySkills,
    );
    // Accès non renseigné (ex: season_2) → on autorise toutes les catégories.
    return catalog.filter((s) => {
      if (access.size === 0) return true;
      const code = CATEGORY_CODE[s.category];
      return code ? access.has(code) : false;
    });
  };

  const setAdv = (
    slug: string,
    ordinal: number,
    patch: Partial<BuildAdvancement> | null,
  ) => {
    const others = value.filter(
      (a) => !(a.positionSlug === slug && a.ordinal === ordinal),
    );
    if (patch === null) {
      onChange(others);
      return;
    }
    const existing = findAdv(slug, ordinal);
    const next: BuildAdvancement = {
      positionSlug: slug,
      ordinal,
      type: patch.type ?? existing?.type ?? "primary",
      skillSlug: patch.skillSlug ?? existing?.skillSlug ?? "",
    };
    onChange([...others, next]);
  };

  if (pool <= 0) return null;

  return (
    <div
      className="border border-amber-200 rounded-lg p-4 bg-amber-50/40 space-y-3"
      data-testid="build-advancement-allocator"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-amber-900">
          Améliorations au build (PSP)
        </h3>
        <div className="text-sm text-amber-900">
          Pool : <strong data-testid="allocator-remaining">{remaining}</strong> /{" "}
          {pool} PSP
        </div>
      </div>

      {instances.length === 0 ? (
        <p className="text-xs text-gray-500">
          Ajoutez d'abord des joueurs pour leur attribuer des PSP.
        </p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {instances.map(({ position, ordinal }) => {
            const adv = findAdv(position.slug, ordinal);
            const type = adv?.type ?? "primary";
            const options = skillsForType(position, type);
            const cost = FIRST_TIER_COST[type];
            const cannotAfford = !adv && cost > remaining;
            return (
              <div
                key={`${position.slug}-${ordinal}`}
                className="flex flex-wrap items-center gap-2 text-sm bg-white rounded border border-gray-200 px-2 py-1.5"
              >
                <span className="min-w-[9rem] font-medium text-gray-700">
                  {position.displayName} #{ordinal + 1}
                </span>
                <select
                  value={type}
                  onChange={(e) =>
                    setAdv(position.slug, ordinal, {
                      type: e.target.value as BuildAdvancement["type"],
                      skillSlug: "",
                    })
                  }
                  className="border border-gray-300 rounded px-2 py-1 text-xs"
                  disabled={cannotAfford && !adv}
                >
                  <option value="primary">Principale (6)</option>
                  <option value="secondary">Secondaire (10)</option>
                </select>
                <select
                  value={adv?.skillSlug ?? ""}
                  onChange={(e) =>
                    e.target.value
                      ? setAdv(position.slug, ordinal, {
                          skillSlug: e.target.value,
                        })
                      : setAdv(position.slug, ordinal, null)
                  }
                  className="flex-1 min-w-[10rem] border border-gray-300 rounded px-2 py-1 text-xs"
                  disabled={cannotAfford && !adv}
                >
                  <option value="">— Aucune —</option>
                  {options.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.nameFr}
                    </option>
                  ))}
                </select>
                {adv && (
                  <button
                    type="button"
                    onClick={() => setAdv(position.slug, ordinal, null)}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    retirer
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
