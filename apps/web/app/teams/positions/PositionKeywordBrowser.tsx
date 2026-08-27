"use client";

/**
 * Navigateur de positions filtrable par mot-clé (lignée + type).
 * Reçoit la liste complète des positions (API, season_3) et laisse l'utilisateur
 * activer des étiquettes pour ne garder que les positions qui les portent toutes
 * (ET logique). Bilingue via `useLanguage` (FR/EN des mots-clés).
 *
 * La liste complète fait ~300 entrées : elle est REPLIÉE par défaut et bornée
 * à `PAGE_SIZE` lignes, sinon elle repousse le reste de la page hors écran.
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

/** Nombre de résultats affichés avant « voir plus ». */
const PAGE_SIZE = 24;

export default function PositionKeywordBrowser({
  positions,
}: {
  positions: ListedPosition[];
}) {
  const { language } = useLanguage();
  const [active, setActive] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const lang = language === "en" ? "en" : "fr";

  const labels =
    lang === "en"
      ? {
          title: "Browse by keyword",
          hint: "Tap keywords to filter positions (lineage + type).",
          clear: "Clear",
          count: (n: number) => `${n} position${n > 1 ? "s" : ""}`,
          empty: "No position matches these keywords.",
          expand: "Browse",
          collapse: "Hide",
          more: (n: number) => `Show ${n} more`,
          less: "Show fewer",
        }
      : {
          title: "Parcourir par mot-clé",
          hint: "Active des mots-clés pour filtrer les positions (lignée + type).",
          clear: "Réinitialiser",
          count: (n: number) => `${n} position${n > 1 ? "s" : ""}`,
          empty: "Aucune position ne correspond à ces mots-clés.",
          expand: "Parcourir",
          collapse: "Replier",
          more: (n: number) => `Voir ${n} de plus`,
          less: "Réduire la liste",
        };

  const options = useMemo(
    () => collectKeywordOptions(positions, lang),
    [positions, lang],
  );
  const filtered = useMemo(
    () => filterPositionsByKeywords(positions, active, lang),
    [positions, active, lang],
  );

  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE);
  const hidden = filtered.length - visible.length;

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
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500" data-testid="keyword-count">
            {labels.count(filtered.length)}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            data-testid="keyword-toggle"
            className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            {open ? labels.collapse : labels.expand}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">{labels.hint}</p>

      {open && (
        <>
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
            {visible.map((p) => {
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

        {(hidden > 0 || showAll) && filtered.length > PAGE_SIZE && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            data-testid="keyword-show-all"
            className="mt-3 text-xs font-medium text-indigo-700 underline hover:text-indigo-900"
          >
            {showAll ? labels.less : labels.more(hidden)}
          </button>
        )}
        </>
      )}
    </section>
  );
}
