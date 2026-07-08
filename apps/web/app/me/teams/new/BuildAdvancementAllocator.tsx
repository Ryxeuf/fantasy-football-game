"use client";

/**
 * Allocateur de PSP « au build » (mode édition avancée / coupe).
 *
 * Permet, avant la création de l'équipe, de dépenser un pool de PSP en
 * améliorations sur les joueurs sélectionnés. Chaque joueur est identifié par
 * (positionSlug, ordinal) — le serveur crée les joueurs dans le même ordre puis
 * applique les advancements (cf. `applyCupBuildAdvancements`).
 *
 * E10 : jusqu'à DEUX améliorations de compétence choisies (Principale/
 * Secondaire) par joueur, piochées dans le pool d'accès de la position. Le
 * coût suit le barème BB (1er puis 2e palier). Le serveur re-valide tout
 * (coût croissant par avancement déjà pris).
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

// E10 — 2 améliorations max par joueur au build.
const MAX_ADVANCEMENTS_PER_PLAYER = 2;

// Coûts des 2 premiers paliers (barème BB2025), miroir de advancements.ts :
// le coût dépend du nombre d'avancements DÉJÀ pris par le joueur.
const TIER_COSTS: Record<BuildAdvancement["type"], [number, number]> = {
  primary: [6, 8],
  secondary: [10, 12],
};

function costForSlot(type: BuildAdvancement["type"], slot: number): number {
  return TIER_COSTS[type][Math.min(Math.max(slot, 0), 1)];
}

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

  // E10 — avancements d'une instance, dans l'ordre (slot 0 puis 1).
  const advsFor = (slug: string, ordinal: number): BuildAdvancement[] =>
    value.filter((a) => a.positionSlug === slug && a.ordinal === ordinal);

  // Coût total : pour chaque instance, le 1er avancement coûte le palier 1,
  // le 2e le palier 2 (le serveur applique le même barème croissant).
  const spent = useMemo(() => {
    let total = 0;
    const seen = new Map<string, number>();
    for (const a of value) {
      const key = `${a.positionSlug}#${a.ordinal}`;
      const slot = seen.get(key) ?? 0;
      total += costForSlot(a.type, slot);
      seen.set(key, slot + 1);
    }
    return total;
  }, [value]);
  const remaining = Math.max(0, pool - spent);

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

  /** Remplace les avancements d'une instance par la liste donnée. */
  const setAdvs = (
    slug: string,
    ordinal: number,
    advs: BuildAdvancement[],
  ) => {
    const others = value.filter(
      (a) => !(a.positionSlug === slug && a.ordinal === ordinal),
    );
    onChange([...others, ...advs]);
  };

  const patchSlot = (
    slug: string,
    ordinal: number,
    slot: number,
    patch: Partial<BuildAdvancement> | null,
  ) => {
    const advs = advsFor(slug, ordinal);
    if (patch === null) {
      setAdvs(
        slug,
        ordinal,
        advs.filter((_, i) => i !== slot),
      );
      return;
    }
    const existing = advs[slot];
    const next: BuildAdvancement = {
      positionSlug: slug,
      ordinal,
      type: patch.type ?? existing?.type ?? "primary",
      skillSlug: patch.skillSlug ?? existing?.skillSlug ?? "",
    };
    const copy = [...advs];
    copy[slot] = next;
    setAdvs(slug, ordinal, copy);
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
      <p className="text-xs text-amber-800/80">
        Jusqu'à {MAX_ADVANCEMENTS_PER_PLAYER} compétences par joueur (coût
        croissant : 2e amélioration au palier supérieur).
      </p>

      {instances.length === 0 ? (
        <p className="text-xs text-gray-500">
          Ajoutez d'abord des joueurs pour leur attribuer des PSP.
        </p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {instances.map(({ position, ordinal }) => {
            const advs = advsFor(position.slug, ordinal);
            // Lignes affichées : les avancements existants + une ligne vide
            // s'il reste un slot (E10 : max 2).
            const rowCount = Math.min(
              advs.length + 1,
              MAX_ADVANCEMENTS_PER_PLAYER,
            );
            return (
              <div
                key={`${position.slug}-${ordinal}`}
                className="space-y-1 bg-white rounded border border-gray-200 px-2 py-1.5"
              >
                {Array.from({ length: rowCount }, (_, slot) => {
                  const adv = advs[slot];
                  const type = adv?.type ?? "primary";
                  const options = skillsForType(position, type).filter(
                    // La 2e compétence doit différer de la 1re (empilement,
                    // pas doublon).
                    (s) =>
                      !advs.some(
                        (a, i) => i !== slot && a.skillSlug === s.slug,
                      ),
                  );
                  const cost = costForSlot(type, slot);
                  const cannotAfford = !adv && cost > remaining;
                  return (
                    <div
                      key={slot}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <span className="min-w-[9rem] font-medium text-gray-700">
                        {slot === 0
                          ? `${position.displayName} #${ordinal + 1}`
                          : ""}
                      </span>
                      <select
                        value={type}
                        onChange={(e) =>
                          patchSlot(position.slug, ordinal, slot, {
                            type: e.target.value as BuildAdvancement["type"],
                            skillSlug: "",
                          })
                        }
                        className="border border-gray-300 rounded px-2 py-1 text-xs"
                        disabled={cannotAfford && !adv}
                      >
                        <option value="primary">
                          Principale ({costForSlot("primary", slot)})
                        </option>
                        <option value="secondary">
                          Secondaire ({costForSlot("secondary", slot)})
                        </option>
                      </select>
                      <select
                        value={adv?.skillSlug ?? ""}
                        data-testid={`allocator-skill-${position.slug}-${ordinal}-${slot}`}
                        onChange={(e) =>
                          e.target.value
                            ? patchSlot(position.slug, ordinal, slot, {
                                skillSlug: e.target.value,
                              })
                            : patchSlot(position.slug, ordinal, slot, null)
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
                          onClick={() =>
                            patchSlot(position.slug, ordinal, slot, null)
                          }
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          retirer
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
