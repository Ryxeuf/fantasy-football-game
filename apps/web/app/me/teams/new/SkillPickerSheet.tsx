"use client";

/**
 * Sélecteur de compétence du builder — feuille (« bottom sheet ») sur mobile,
 * boîte de dialogue centrée sur desktop.
 *
 * Remplace la paire de `<select>` illisible de l'allocateur : on choisit
 * d'abord le type (Principale / Secondaire, coût affiché), puis on filtre par
 * catégorie et/ou par recherche, et on clique la compétence. Les compétences
 * non sélectionnables (déjà possédées par le poste, déjà prises par ce
 * joueur, retirées de la sélection) restent visibles mais grisées avec la
 * raison — l'UI explique au lieu de faire disparaître.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  groupByCategory,
  matchesSearch,
  parseAccessCodes,
  skillOptionsFor,
  skillSppCost,
  type AllocatorPosition,
  type BuildAdvancementType,
  type BuildCostContext,
  type SkillBlockReason,
  type SkillCatalogItem,
  type SkillOption,
} from "./build-advancement-rules";

const TYPE_LABELS: Record<BuildAdvancementType, string> = {
  primary: "Principale",
  secondary: "Secondaire",
};

const BLOCK_LABELS: Record<SkillBlockReason, string> = {
  owned: "Déjà sur la fiche du poste",
  picked: "Déjà choisie pour ce joueur",
  excluded: "Non sélectionnable",
};

export interface SkillPickerSheetProps {
  /** Nom affiché du joueur ciblé (« Bloqueur Ogre #1 »). */
  readonly playerLabel: string;
  readonly position: AllocatorPosition;
  /** Rang de la compétence achetée (0 = 1re, 1 = 2e). */
  readonly slot: number;
  /** Compétences déjà retenues pour ce joueur. */
  readonly pickedSlugs: readonly string[];
  readonly catalog: readonly SkillCatalogItem[];
  /** PSP encore disponibles dans le pool. */
  readonly remaining: number;
  readonly ctx: BuildCostContext;
  readonly onPick: (type: BuildAdvancementType, skillSlug: string) => void;
  readonly onClose: () => void;
}

export default function SkillPickerSheet({
  playerLabel,
  position,
  slot,
  pickedSlugs,
  catalog,
  remaining,
  ctx,
  onPick,
  onClose,
}: SkillPickerSheetProps) {
  const [type, setType] = useState<BuildAdvancementType>("primary");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Échap ferme, et le fond de page ne défile plus derrière la feuille.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const options = useMemo(
    () =>
      skillOptionsFor({
        catalog,
        position,
        type,
        slot,
        pickedSlugs,
        ctx,
      }),
    [catalog, position, type, slot, pickedSlugs, ctx],
  );

  // Catégories réellement ouvertes au type courant (chips de filtre).
  const accessible = useMemo(
    () =>
      parseAccessCodes(
        type === "primary" ? position.primarySkills : position.secondarySkills,
      ),
    [type, position.primarySkills, position.secondarySkills],
  );
  const categoryChips = useMemo(
    () =>
      CATEGORY_ORDER.filter(
        (code) => accessible.size === 0 || accessible.has(code),
      ),
    [accessible],
  );

  const groups = useMemo(
    () =>
      groupByCategory(
        options
          .filter((o) => matchesSearch(o, search))
          .filter((o) => !category || o.category === category),
      ),
    [options, search, category],
  );

  const baseCost = (t: BuildAdvancementType) =>
    skillSppCost(slot, t, undefined, ctx);

  const canSelect = (option: SkillOption) =>
    option.blocked === null && option.cost <= remaining;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
      data-testid="skill-picker-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ajouter une compétence — ${playerLabel}`}
        data-testid="skill-picker"
        className="flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[80vh] sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête : joueur ciblé + pool restant, toujours visible. */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <div className="min-w-0">
            <h4 className="truncate text-base font-semibold text-gray-900">
              {playerLabel}
            </h4>
            <p className="text-xs text-gray-500">
              {slot === 0 ? "1re" : "2e"} compétence · {remaining} PSP
              disponibles
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="skill-picker-close"
            aria-label="Fermer"
            className="-mr-1 rounded-full px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 border-b border-gray-100 px-4 py-3">
          {/* Type d'amélioration : segmented control, coût affiché. */}
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-label="Type d'amélioration"
          >
            {(["primary", "secondary"] as const).map((value) => {
              const active = type === value;
              const cost = baseCost(value);
              const tooExpensive = cost > remaining;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setType(value);
                    setCategory("");
                  }}
                  aria-pressed={active}
                  data-testid={`skill-picker-type-${value}`}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                      : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300"
                  }`}
                >
                  <span className="block text-sm font-semibold">
                    {TYPE_LABELS[value]}
                  </span>
                  <span
                    className={`block text-xs ${
                      tooExpensive ? "text-red-600" : "text-gray-500"
                    }`}
                  >
                    {cost} PSP{tooExpensive ? " · hors budget" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
            placeholder="Rechercher une compétence…"
            aria-label="Rechercher une compétence"
            data-testid="skill-picker-search"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />

          {/* Filtre par catégorie : seules celles ouvertes au type courant. */}
          <div
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label="Filtrer par catégorie"
          >
            <button
              type="button"
              onClick={() => setCategory("")}
              aria-pressed={category === ""}
              data-testid="skill-picker-cat-all"
              className={chipClass(category === "")}
            >
              Toutes
            </button>
            {categoryChips.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setCategory(category === code ? "" : code)}
                aria-pressed={category === code}
                data-testid={`skill-picker-cat-${code}`}
                className={chipClass(category === code)}
              >
                {CATEGORY_LABELS[code]}
              </button>
            ))}
          </div>
        </div>

        {/* Liste : groupée par catégorie, une ligne tapable par compétence. */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {groups.length === 0 ? (
            <p
              className="px-2 py-6 text-center text-sm text-gray-500"
              data-testid="skill-picker-empty"
            >
              Aucune compétence ne correspond.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.code} className="mb-3">
                <h5 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {group.label}
                </h5>
                <ul className="space-y-1">
                  {group.options.map((option) => {
                    const selectable = canSelect(option);
                    const reason =
                      option.blocked !== null
                        ? BLOCK_LABELS[option.blocked]
                        : option.cost > remaining
                          ? "PSP insuffisants"
                          : null;
                    return (
                      <li key={option.skill.slug}>
                        <button
                          type="button"
                          disabled={!selectable}
                          onClick={() => onPick(type, option.skill.slug)}
                          data-testid={`skill-picker-option-${option.skill.slug}`}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                            selectable
                              ? "border-gray-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/60"
                              : "cursor-not-allowed border-gray-100 bg-gray-50 opacity-70"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`text-sm font-medium ${
                                  selectable ? "text-gray-900" : "text-gray-400"
                                }`}
                              >
                                {option.skill.nameFr}
                              </span>
                              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                                {CATEGORY_LABELS[option.category]}
                              </span>
                              {option.isElite && (
                                <span
                                  className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                                  title="Compétence Élite : +10 000 po sur la valeur du joueur."
                                >
                                  ⭐ Élite
                                </span>
                              )}
                            </span>
                            {reason && (
                              <span className="mt-0.5 block text-[11px] text-gray-400">
                                {reason}
                              </span>
                            )}
                          </span>
                          <span
                            className={`shrink-0 text-xs font-semibold ${
                              selectable ? "text-indigo-700" : "text-gray-300"
                            }`}
                          >
                            {option.cost} PSP
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Puce de filtre (catégorie). */
function chipClass(active: boolean): string {
  const base =
    "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition";
  return active
    ? `${base} border-indigo-500 bg-indigo-500 text-white`
    : `${base} border-gray-300 bg-white text-gray-600 hover:border-indigo-300`;
}
