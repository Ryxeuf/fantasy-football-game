"use client";

/**
 * Sélecteur multiple générique « chips + recherche », partagé par les
 * formulaires d'admin data. C'est l'UX du sélecteur de compétences des
 * positions, généralisée : valeurs sélectionnées en chips retirables,
 * champ de recherche avec suggestions groupées, filtres par groupe.
 *
 * Les valeurs sélectionnées absentes du catalogue (donnée héritée, autre
 * ruleset) restent affichées en chip « hors catalogue » et ne sont jamais
 * retirées de la sélection à l'enregistrement — même garantie que les
 * grilles de cases à cocher qu'il remplace.
 */

import { useEffect, useMemo, useRef, useState } from "react";

export interface ChipOption {
  /** Valeur remontée dans `onChange`. */
  value: string;
  label: string;
  /** Texte secondaire affiché sous le libellé dans les suggestions. */
  sublabel?: string;
  /** Clé de groupe ; les options sans groupe vont dans `defaultGroup`. */
  group?: string;
}

export interface ChipGroupStyle {
  label: string;
  /** Classes du chip et du badge de groupe (fond + texte + bordure). */
  chipClass: string;
}

const FALLBACK_GROUP_STYLE: ChipGroupStyle = {
  label: "Autres",
  chipClass: "bg-blue-100 text-blue-800 border-blue-300",
};

const OUT_OF_CATALOG_STYLE: ChipGroupStyle = {
  label: "Hors catalogue",
  chipClass: "bg-gray-100 text-gray-600 border-gray-300",
};

const OUT_OF_CATALOG = "__out_of_catalog__";

interface ChipMultiSelectProps {
  options: readonly ChipOption[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
  /** Styles et libellés par clé de groupe. */
  groups?: Record<string, ChipGroupStyle>;
  placeholder?: string;
  /** Libellé au-dessus des chips sélectionnées. */
  selectedLabel?: string;
  /** Libellé au-dessus du champ de recherche. */
  addLabel?: string;
  emptyLabel?: string;
  testId?: string;
}

export function ChipMultiSelect({
  options,
  selected,
  onChange,
  groups = {},
  placeholder = "Rechercher…",
  selectedLabel = "Sélection",
  addLabel = "Ajouter",
  emptyLabel = "Aucune sélection",
  testId = "chip-select",
}: ChipMultiSelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | "all">("all");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const safeOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: ChipOption[] = [];
    for (const option of Array.isArray(options) ? options : []) {
      if (!option?.value || seen.has(option.value)) continue;
      seen.add(option.value);
      out.push(option);
    }
    return out;
  }, [options]);

  // Une valeur sélectionnée hors catalogue reste visible et retirable.
  const allOptions = useMemo(() => {
    const known = new Set(safeOptions.map((o) => o.value));
    const extras: ChipOption[] = selected
      .filter((value) => !known.has(value))
      .map((value) => ({ value, label: value, group: OUT_OF_CATALOG }));
    return [...safeOptions, ...extras];
  }, [safeOptions, selected]);

  const groupStyle = (key: string | undefined): ChipGroupStyle => {
    if (key === OUT_OF_CATALOG) return OUT_OF_CATALOG_STYLE;
    if (key && groups[key]) return groups[key];
    return FALLBACK_GROUP_STYLE;
  };

  const selectedOptions = useMemo(
    () => allOptions.filter((o) => selected.includes(o.value)),
    [allOptions, selected],
  );

  const availableOptions = useMemo(() => {
    let filtered = allOptions.filter((o) => !selected.includes(o.value));
    if (selectedGroup !== "all") {
      filtered = filtered.filter((o) => (o.group ?? "") === selectedGroup);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(
        (o) =>
          o.label.toLowerCase().includes(query) ||
          o.value.toLowerCase().includes(query) ||
          (o.sublabel ?? "").toLowerCase().includes(query),
      );
    }
    return [...filtered].sort((a, b) =>
      (a.label || a.value).localeCompare(b.label || b.value, "fr"),
    );
  }, [allOptions, selected, selectedGroup, searchQuery]);

  // Groupes réellement portés par le catalogue, dans l'ordre de `groups`.
  const groupKeys = useMemo(() => {
    const present = new Set(
      safeOptions.map((o) => o.group).filter((g): g is string => Boolean(g)),
    );
    const ordered = Object.keys(groups).filter((key) => present.has(key));
    for (const key of present) if (!ordered.includes(key)) ordered.push(key);
    return ordered;
  }, [safeOptions, groups]);

  const optionsByGroup = useMemo(() => {
    const grouped = new Map<string, ChipOption[]>();
    for (const option of availableOptions) {
      const key = option.group ?? "";
      const bucket = grouped.get(key);
      if (bucket) bucket.push(option);
      else grouped.set(key, [option]);
    }
    return grouped;
  }, [availableOptions]);

  const handleAdd = (value: string) => {
    if (!selected.includes(value)) onChange([...selected, value]);
    setSearchQuery("");
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleRemove = (value: string) => {
    onChange(selected.filter((v) => v !== value));
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showDropdown) {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showDropdown]);

  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  const renderSuggestion = (option: ChipOption) => (
    <button
      key={option.value}
      type="button"
      data-testid={`${testId}-option-${option.value}`}
      onClick={() => handleAdd(option.value)}
      className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between group"
    >
      <div>
        <div className="font-medium text-gray-900">{option.label}</div>
        {option.sublabel && (
          <div className="text-xs text-gray-500">{option.sublabel}</div>
        )}
      </div>
      <span
        className={`text-xs px-2 py-0.5 rounded border ${groupStyle(option.group).chipClass} opacity-0 group-hover:opacity-100 transition-opacity`}
      >
        {groupStyle(option.group).label}
      </span>
    </button>
  );

  return (
    <div className="space-y-4" data-testid={testId}>
      {/* Valeurs sélectionnées */}
      <div>
        <label className="block text-sm font-medium mb-2">{selectedLabel}</label>
        {selectedOptions.length === 0 ? (
          <div className="text-sm text-gray-500 italic p-3 border border-dashed border-gray-300 rounded">
            {emptyLabel}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded bg-gray-50 min-h-[60px]">
            {selectedOptions.map((option) => (
              <span
                key={option.value}
                data-testid={`${testId}-chip-${option.value}`}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${groupStyle(option.group).chipClass}`}
              >
                {option.group === OUT_OF_CATALOG
                  ? `${option.label} (hors catalogue)`
                  : option.label}
                <button
                  type="button"
                  onClick={() => handleRemove(option.value)}
                  className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
                  title="Retirer"
                  aria-label={`Retirer ${option.label}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Recherche et suggestions */}
      <div className="relative">
        <label className="block text-sm font-medium mb-2">{addLabel}</label>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            data-testid={`${testId}-search`}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={placeholder}
            className="w-full border rounded px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filtres par groupe (seulement si le catalogue est groupé) */}
        {groupKeys.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={() => setSelectedGroup("all")}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                selectedGroup === "all"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Toutes
            </button>
            {groupKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedGroup(key)}
                className={`px-3 py-1 text-sm rounded border transition-colors ${
                  selectedGroup === key
                    ? `${groupStyle(key).chipClass} border-current font-medium`
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {groupStyle(key).label}
              </button>
            ))}
          </div>
        )}

        {showDropdown && availableOptions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-96 overflow-y-auto"
          >
            {groupKeys.length > 0 && selectedGroup === "all" ? (
              Array.from(optionsByGroup.entries()).map(([key, groupOptions]) => (
                <div key={key || "__none__"} className="border-b border-gray-200 last:border-b-0">
                  <div
                    className={`px-3 py-2 text-xs font-semibold uppercase ${groupStyle(key || undefined).chipClass.split(" ")[0]}`}
                  >
                    {key ? groupStyle(key).label : FALLBACK_GROUP_STYLE.label}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {groupOptions.map(renderSuggestion)}
                  </div>
                </div>
              ))
            ) : (
              <div className="divide-y divide-gray-100">
                {availableOptions.map(renderSuggestion)}
              </div>
            )}
          </div>
        )}

        {showDropdown && availableOptions.length === 0 && searchQuery && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg p-4 text-center text-gray-500"
          >
            Aucun résultat
          </div>
        )}
      </div>
    </div>
  );
}
