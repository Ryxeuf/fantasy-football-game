"use client";

/**
 * Allocateur de PSP « au build » (mode édition avancée / coupe / tournoi).
 *
 * Permet, avant la création de l'équipe, de dépenser un pool de PSP en
 * améliorations sur les joueurs sélectionnés. Chaque joueur est identifié par
 * (positionSlug, ordinal) — le serveur crée les joueurs dans le même ordre
 * puis applique les advancements (cf. `applyCupBuildAdvancements`).
 *
 * UI : une carte par joueur (mobile d'abord, deux colonnes dès `sm`), les
 * compétences achetées en puces retirables, et un sélecteur en feuille
 * (`SkillPickerSheet`) avec recherche, filtre par catégorie, badge de
 * catégorie et d'Élite. Les règles (accès, doublons, compétences déjà
 * possédées, barème PSP standard ou de tournoi, quota de cumul) vivent dans
 * `build-advancement-rules.ts` — le serveur re-valide tout.
 */

import { useEffect, useMemo, useState } from "react";
import type {
  TournamentRosterRules,
  TournamentRulesetDefinition,
} from "@bb/game-engine";
import { apiRequest } from "../../../lib/api-client";
import SkillPickerSheet from "./SkillPickerSheet";
import {
  CATEGORY_CODE,
  CATEGORY_LABELS,
  MAX_ADVANCEMENTS_PER_PLAYER,
  advancementsFor,
  parseSkillSlugs,
  planSppTotal,
  planVeSurcharge,
  skillSppCost,
  stackingUsage,
  type AllocatorPosition,
  type BuildAdvancement,
  type BuildAdvancementType,
  type BuildCostContext,
  type SkillCatalogItem,
} from "./build-advancement-rules";

export type { BuildAdvancement } from "./build-advancement-rules";

interface SkillsResponse {
  skills: SkillCatalogItem[];
}

const TYPE_LABELS: Record<BuildAdvancementType, string> = {
  primary: "Principale",
  secondary: "Secondaire",
};

/** Formate un montant en po (« 30 000 po »). */
function formatPo(value: number): string {
  return `${value.toLocaleString("fr-FR")} po`;
}

export interface BuildAdvancementAllocatorProps {
  ruleset: string;
  /** Postes du roster (accès compétences + compétences de base). */
  positions: AllocatorPosition[];
  /** Quantités choisies par poste (slug → count). */
  counts: Record<string, number>;
  /** Pool de PSP disponible. */
  pool: number;
  value: BuildAdvancement[];
  onChange: (advancements: BuildAdvancement[]) => void;
  /** Règlement de tournoi retenu (barème PSP + quota de cumul). */
  pack?: TournamentRulesetDefinition | null;
  /** Règles du règlement pour ce roster. */
  packRules?: TournamentRosterRules | null;
}

export default function BuildAdvancementAllocator({
  ruleset,
  positions,
  counts,
  pool,
  value,
  onChange,
  pack = null,
  packRules = null,
}: BuildAdvancementAllocatorProps) {
  const [catalog, setCatalog] = useState<SkillCatalogItem[]>([]);
  const [playerFilter, setPlayerFilter] = useState("");
  const [onlyImproved, setOnlyImproved] = useState(false);
  // Joueur dont on est en train de choisir une compétence (feuille ouverte).
  const [picking, setPicking] = useState<{
    position: AllocatorPosition;
    ordinal: number;
  } | null>(null);

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

  const ctx: BuildCostContext = useMemo(
    () => ({ pack, packRules }),
    [pack, packRules],
  );

  const catalogBySlug = useMemo(() => {
    const map = new Map<string, SkillCatalogItem>();
    for (const skill of catalog) map.set(skill.slug, skill);
    return map;
  }, [catalog]);

  const eliteSlugs = useMemo(
    () => new Set(catalog.filter((s) => s.isElite).map((s) => s.slug)),
    [catalog],
  );

  const skillName = (slug: string) => catalogBySlug.get(slug)?.nameFr ?? slug;

  // Instances de joueurs (positionSlug + ordinal) dérivées des counts.
  const instances = useMemo(() => {
    const list: Array<{ position: AllocatorPosition; ordinal: number }> = [];
    for (const pos of positions) {
      const c = Math.max(0, counts[pos.slug] ?? 0);
      for (let i = 0; i < c; i += 1) list.push({ position: pos, ordinal: i });
    }
    return list;
  }, [positions, counts]);

  const spent = useMemo(() => planSppTotal(value, ctx), [value, ctx]);
  const remaining = Math.max(0, pool - spent);
  const veSurcharge = useMemo(
    () => planVeSurcharge(value, eliteSlugs),
    [value, eliteSlugs],
  );
  const stacking = useMemo(() => stackingUsage(value, ctx), [value, ctx]);

  const visibleInstances = useMemo(() => {
    const q = playerFilter.trim().toLowerCase();
    return instances.filter(({ position, ordinal }) => {
      if (
        onlyImproved &&
        advancementsFor(value, position.slug, ordinal).length === 0
      ) {
        return false;
      }
      if (!q) return true;
      return `${position.displayName} #${ordinal + 1}`
        .toLowerCase()
        .includes(q);
    });
  }, [instances, playerFilter, onlyImproved, value]);

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

  const addAdvancement = (
    position: AllocatorPosition,
    ordinal: number,
    type: BuildAdvancementType,
    skillSlug: string,
  ) => {
    const advs = advancementsFor(value, position.slug, ordinal);
    setAdvs(position.slug, ordinal, [
      ...advs,
      { positionSlug: position.slug, ordinal, type, skillSlug },
    ]);
    setPicking(null);
  };

  const removeAdvancement = (
    position: AllocatorPosition,
    ordinal: number,
    index: number,
  ) => {
    const advs = advancementsFor(value, position.slug, ordinal);
    setAdvs(
      position.slug,
      ordinal,
      advs.filter((_, i) => i !== index),
    );
  };

  if (pool <= 0) return null;

  const usedPercent = pool > 0 ? Math.min(100, (spent / pool) * 100) : 0;
  const quotaReached = stacking.used >= stacking.max;

  return (
    <div
      className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3 sm:p-4"
      data-testid="build-advancement-allocator"
    >
      {/* En-tête : pool restant + jauge, lisible sur une colonne en mobile. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-amber-900 sm:text-base">
          Améliorations au build (PSP)
        </h3>
        <p className="text-sm text-amber-900">
          <strong data-testid="allocator-remaining">{remaining}</strong>
          <span className="text-amber-700"> / {pool} PSP restants</span>
        </p>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={pool}
        aria-valuenow={spent}
        aria-label="PSP dépensés"
      >
        <div
          className="h-full rounded-full bg-amber-500 transition-all"
          style={{ width: `${usedPercent}%` }}
        />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-amber-800/90">
        Jusqu&apos;à {MAX_ADVANCEMENTS_PER_PLAYER} compétences par joueur
        (la 2e coûte un palier de plus). Une compétence déjà sur la fiche du
        poste, ou déjà choisie pour ce joueur, n&apos;est pas reproposée.
      </p>

      {/* Ce que le plan coûte en Valeur d'Équipe (Élite = +10 000 po). */}
      {value.length > 0 && (
        <p className="mt-1 text-xs text-amber-800/90" data-testid="allocator-ve">
          {value.length} amélioration{value.length > 1 ? "s" : ""} ·{" "}
          {spent} PSP dépensés · +{formatPo(veSurcharge)} de Valeur
          d&apos;Équipe
        </p>
      )}

      {/* Contraintes du règlement de tournoi, quand il y en a un. */}
      {pack && packRules && (
        <p
          className="mt-2 rounded-lg border border-amber-300 bg-white/70 px-2.5 py-1.5 text-xs text-amber-900"
          data-testid="allocator-pack-rules"
        >
          <strong>{pack.shortLabel}</strong> — barème du règlement (1re :{" "}
          {pack.skillCosts.firstPrimary}/{pack.skillCosts.firstSecondary} PSP,
          2e : {pack.skillCosts.secondPrimary}/{pack.skillCosts.secondSecondary}{" "}
          PSP)
          {pack.skillCosts.eliteSurcharge > 0 &&
            `, +${pack.skillCosts.eliteSurcharge} PSP par compétence Élite`}
          {" · "}
          {stacking.max === 0
            ? "aucun joueur ne peut cumuler 2 compétences"
            : `${stacking.used}/${stacking.max} joueur${
                stacking.max > 1 ? "s" : ""
              } à 2 compétences`}
        </p>
      )}

      {instances.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500">
          Ajoutez d&apos;abord des joueurs pour leur attribuer des PSP.
        </p>
      ) : (
        <>
          {/* Filtres de la liste de joueurs (16 joueurs tiennent mal à l'œil). */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
              placeholder="Filtrer les joueurs…"
              aria-label="Filtrer les joueurs"
              data-testid="allocator-player-filter"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm sm:flex-1"
            />
            <button
              type="button"
              onClick={() => setOnlyImproved((v) => !v)}
              aria-pressed={onlyImproved}
              data-testid="allocator-only-improved"
              className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                onlyImproved
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-gray-300 bg-white text-gray-600 hover:border-amber-400"
              }`}
            >
              Améliorés ({improvedPlayerCount(value)})
            </button>
          </div>

          <ul className="mt-2 grid max-h-[26rem] grid-cols-1 gap-2 overflow-y-auto sm:max-h-[30rem] sm:grid-cols-2">
            {visibleInstances.length === 0 ? (
              <li className="col-span-full px-1 py-4 text-center text-xs text-gray-500">
                Aucun joueur ne correspond au filtre.
              </li>
            ) : (
              visibleInstances.map(({ position, ordinal }) => {
                const advs = advancementsFor(value, position.slug, ordinal);
                const label = `${position.displayName} #${ordinal + 1}`;
                const full = advs.length >= MAX_ADVANCEMENTS_PER_PLAYER;
                // 2e compétence : le règlement peut plafonner le nombre de
                // joueurs autorisés à cumuler (`skillStacking`).
                const quotaBlocked = advs.length === 1 && quotaReached;
                const nextCost = Math.min(
                  skillSppCost(advs.length, "primary", undefined, ctx),
                  skillSppCost(advs.length, "secondary", undefined, ctx),
                );
                const tooExpensive = nextCost > remaining;
                const baseSkills = parseSkillSlugs(position.skills);
                return (
                  <li
                    key={`${position.slug}-${ordinal}`}
                    data-testid={`allocator-player-${position.slug}-${ordinal}`}
                    className="rounded-xl border border-gray-200 bg-white p-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900">
                        {label}
                      </span>
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {advs.length}/{MAX_ADVANCEMENTS_PER_PLAYER}
                      </span>
                    </div>
                    {baseSkills.length > 0 && (
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">
                        Base : {baseSkills.map(skillName).join(", ")}
                      </p>
                    )}

                    {advs.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {advs.map((adv, index) => {
                          const skill = catalogBySlug.get(adv.skillSlug);
                          const category = skill
                            ? (CATEGORY_LABELS[CATEGORY_CODE[skill.category]] ??
                              skill.category)
                            : null;
                          return (
                            <li
                              key={`${adv.skillSlug}-${index}`}
                              data-testid={`allocator-pick-${position.slug}-${ordinal}-${index}`}
                              className="flex items-center justify-between gap-2 rounded-lg bg-indigo-50/70 px-2 py-1.5"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-medium text-indigo-900">
                                  {skillName(adv.skillSlug)}
                                  {eliteSlugs.has(adv.skillSlug) && (
                                    <span
                                      title="Compétence Élite : +10 000 po de Valeur d'Équipe."
                                      className="ml-1"
                                    >
                                      ⭐
                                    </span>
                                  )}
                                </span>
                                <span className="block truncate text-[10px] text-indigo-500">
                                  {TYPE_LABELS[adv.type]}
                                  {category ? ` · ${category}` : ""} ·{" "}
                                  {skillSppCost(
                                    index,
                                    adv.type,
                                    adv.skillSlug,
                                    ctx,
                                  )}{" "}
                                  PSP
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  removeAdvancement(position, ordinal, index)
                                }
                                aria-label={`Retirer ${skillName(adv.skillSlug)} de ${label}`}
                                data-testid={`allocator-remove-${position.slug}-${ordinal}-${index}`}
                                className="flex min-h-[36px] shrink-0 items-center rounded px-2 text-xs text-red-600 hover:bg-red-50"
                              >
                                retirer
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <button
                      type="button"
                      disabled={full || tooExpensive || quotaBlocked}
                      onClick={() => setPicking({ position, ordinal })}
                      data-testid={`allocator-add-${position.slug}-${ordinal}`}
                      className={`mt-1.5 min-h-[40px] w-full rounded-lg border border-dashed px-2 py-2 text-xs font-medium transition ${
                        full || tooExpensive || quotaBlocked
                          ? "cursor-not-allowed border-gray-200 text-gray-300"
                          : "border-indigo-300 text-indigo-700 hover:border-indigo-500 hover:bg-indigo-50"
                      }`}
                    >
                      {full
                        ? "2 compétences (maximum)"
                        : quotaBlocked
                          ? "Cumul interdit par le règlement"
                          : tooExpensive
                            ? "PSP insuffisants"
                            : `+ Ajouter une compétence · dès ${nextCost} PSP`}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </>
      )}

      {picking && (
        <SkillPickerSheet
          playerLabel={`${picking.position.displayName} #${picking.ordinal + 1}`}
          position={picking.position}
          slot={
            advancementsFor(value, picking.position.slug, picking.ordinal).length
          }
          pickedSlugs={advancementsFor(
            value,
            picking.position.slug,
            picking.ordinal,
          ).map((a) => a.skillSlug)}
          catalog={catalog}
          remaining={remaining}
          ctx={ctx}
          onPick={(type, skillSlug) =>
            addAdvancement(picking.position, picking.ordinal, type, skillSlug)
          }
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

/** Nombre de joueurs ayant au moins une amélioration. */
function improvedPlayerCount(value: readonly BuildAdvancement[]): number {
  return new Set(value.map((a) => `${a.positionSlug}#${a.ordinal}`)).size;
}
