"use client";

/**
 * Navigateur de positions filtrable par mot-clé (lignée + type).
 * Reçoit la liste complète des positions (API, season_3) et laisse l'utilisateur
 * activer des étiquettes pour ne garder que les positions qui les portent toutes
 * (ET logique). Bilingue via `useLanguage` (FR/EN des mots-clés).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../../contexts/LanguageContext";
import { stripRosterPrefix, cleanDisplayName } from "../position-slug";
import type { ListedPosition } from "../position-rankings";
import {
  collectKeywordOptions,
  filterPositionsByKeywords,
  normalizeKeyword,
  positionKeywords,
} from "../position-keyword-filter";

export default function PositionKeywordBrowser({
  positions,
}: {
  positions: ListedPosition[];
}) {
  const { language } = useLanguage();
  const [active, setActive] = useState<string[]>([]);
  const lang = language === "en" ? "en" : "fr";

  const labels =
    lang === "en"
      ? {
          title: "Browse by keyword",
          hint: "Tap keywords to filter positions (lineage + type).",
          clear: "Clear",
          count: (n: number) => `${n} position${n > 1 ? "s" : ""}`,
          empty: "No position matches these keywords.",
        }
      : {
          title: "Parcourir par mot-clé",
          hint: "Active des mots-clés pour filtrer les positions (lignée + type).",
          clear: "Réinitialiser",
          count: (n: number) => `${n} position${n > 1 ? "s" : ""}`,
          empty: "Aucune position ne correspond à ces mots-clés.",
        };

  const options = useMemo(
    () => collectKeywordOptions(positions, lang),
    [positions, lang],
  );
  const filtered = useMemo(
    () => filterPositionsByKeywords(positions, active, lang),
    [positions, active, lang],
  );

  const toggle = (kw: string) => {
    const norm = normalizeKeyword(kw);
    setActive((prev) =>
      prev.some((a) => normalizeKeyword(a) === norm)
        ? prev.filter((a) => normalizeKeyword(a) !== norm)
        : [...prev, kw],
    );
  };

  const isActive = (kw: string) =>
    active.some((a) => normalizeKeyword(a) === normalizeKeyword(kw));

  return (
    <section
      data-testid="keyword-browser"
      className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold text-gray-900">{labels.title}</h2>
        <span className="text-xs text-gray-500" data-testid="keyword-count">
          {labels.count(filtered.length)}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{labels.hint}</p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {options.map((kw) => (
          <button
            key={kw}
            type="button"
            onClick={() => toggle(kw)}
            data-testid={`keyword-chip-${normalizeKeyword(kw).replace(/ /g, "-")}`}
            aria-pressed={isActive(kw)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              isActive(kw)
                ? "bg-indigo-600 text-white"
                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            }`}
          >
            {kw}
          </button>
        ))}
      </div>

      {active.length > 0 && (
        <button
          type="button"
          onClick={() => setActive([])}
          data-testid="keyword-clear"
          className="text-xs text-gray-500 underline hover:text-gray-700 mb-3"
        >
          {labels.clear}
        </button>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          {labels.empty}
        </p>
      ) : (
        <ul
          className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5"
          data-testid="keyword-results"
        >
          {filtered.map((p) => {
            const segment = stripRosterPrefix(p.slug, p.rosterSlug);
            const { name } = cleanDisplayName(
              lang === "en" ? p.displayNameEn ?? p.displayName : p.displayName,
            );
            return (
              <li key={p.slug}>
                <Link
                  href={`/teams/${p.rosterSlug}/${segment}`}
                  className="group flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 hover:bg-emerald-50 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900 group-hover:text-emerald-700">
                      {name}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {p.rosterName} · {positionKeywords(p, lang).join(", ")}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
