"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  bestStatValue,
  type ListedPosition,
  type RankDir,
  type StatKey,
} from "../../position-rankings";
import { stripRosterPrefix, cleanDisplayName } from "../../position-slug";

const MAX_SELECTION = 4;
const MIN_SELECTION = 2;
const PICKER_CAP = 48;

interface CompareMetric {
  readonly key: string;
  readonly label: string;
  /** Stat numérique : permet de surligner la meilleure valeur. */
  readonly stat?: { key: StatKey; dir: RankDir };
  readonly render: (p: ListedPosition) => React.ReactNode;
}

interface PositionComparatorClientProps {
  initialPositions: ListedPosition[];
  initialSelected: string[];
}

function positionUrl(p: ListedPosition): string {
  return `/teams/${p.rosterSlug}/${stripRosterPrefix(p.slug, p.rosterSlug)}`;
}

const METRICS: CompareMetric[] = [
  {
    key: "roster",
    label: "Roster",
    render: (p) => <span className="text-gray-700">{p.rosterName}</span>,
  },
  {
    key: "cost",
    label: "Coût",
    stat: { key: "cost", dir: "asc" },
    render: (p) => <span className="font-mono">{p.cost}k</span>,
  },
  {
    key: "ma",
    label: "MA",
    stat: { key: "ma", dir: "desc" },
    render: (p) => <span className="font-mono">{p.ma}</span>,
  },
  {
    key: "st",
    label: "ST",
    stat: { key: "st", dir: "desc" },
    render: (p) => <span className="font-mono">{p.st}</span>,
  },
  {
    key: "ag",
    label: "AG",
    stat: { key: "ag", dir: "asc" },
    render: (p) => <span className="font-mono">{p.ag}+</span>,
  },
  {
    key: "pa",
    label: "PA",
    stat: { key: "pa", dir: "asc" },
    render: (p) => (
      <span className="font-mono">{p.pa > 0 ? `${p.pa}+` : "—"}</span>
    ),
  },
  {
    key: "av",
    label: "AV",
    stat: { key: "av", dir: "desc" },
    render: (p) => <span className="font-mono">{p.av}+</span>,
  },
  {
    key: "minmax",
    label: "Min-Max",
    render: (p) => (
      <span className="font-mono text-gray-600">
        {p.min}-{p.max}
      </span>
    ),
  },
  {
    key: "skills",
    label: "Compétences",
    render: (p) => {
      const list = p.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return list.length > 0 ? (
        <span className="text-xs text-gray-600">{list.join(", ")}</span>
      ) : (
        <span className="text-xs text-gray-400">—</span>
      );
    },
  },
];

export default function PositionComparatorClient({
  initialPositions,
  initialSelected,
}: PositionComparatorClientProps) {
  const positions = initialPositions;
  const bySlug = useMemo(
    () => new Map(positions.map((p) => [p.slug, p])),
    [positions],
  );

  const [selected, setSelected] = useState<string[]>(() => {
    const known = new Set(positions.map((p) => p.slug));
    return initialSelected.filter((s) => known.has(s)).slice(0, MAX_SELECTION);
  });
  const [query, setQuery] = useState("");

  // Synchronise l'URL (?ids=) pour rendre la sélection partageable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selected.length > 0) url.searchParams.set("ids", selected.join(","));
    else url.searchParams.delete("ids");
    window.history.replaceState(null, "", url.toString());
  }, [selected]);

  const selectedPositions = useMemo(
    () =>
      selected
        .map((s) => bySlug.get(s))
        .filter((p): p is ListedPosition => Boolean(p)),
    [selected, bySlug],
  );

  const atMax = selected.length >= MAX_SELECTION;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? positions.filter(
          (p) =>
            p.displayName.toLowerCase().includes(q) ||
            p.rosterName.toLowerCase().includes(q) ||
            (p.displayNameEn ?? "").toLowerCase().includes(q),
        )
      : positions;
    return [...list]
      .sort((a, b) => {
        if (a.rosterName !== b.rosterName)
          return a.rosterName.localeCompare(b.rosterName);
        return a.displayName.localeCompare(b.displayName);
      })
      .slice(0, PICKER_CAP);
  }, [positions, query]);

  function toggle(slug: string) {
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_SELECTION) return prev;
      return [...prev, slug];
    });
  }

  const mobileGridCols =
    selectedPositions.length >= 4
      ? "grid-cols-4"
      : selectedPositions.length === 3
        ? "grid-cols-3"
        : "grid-cols-2";

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <nav aria-label="Fil d'Ariane" className="text-sm text-gray-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-emerald-700">
              Accueil
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/teams/positions" className="hover:text-emerald-700">
              Positions
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-900 font-semibold" aria-current="page">
            Comparer
          </li>
        </ol>
      </nav>

      <header>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
          Comparateur de positions
        </h1>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Choisis 2 à 4 positions de n'importe quel roster pour comparer leurs
          caractéristiques côte à côte. Le lien est partageable.
        </p>
      </header>

      {/* Sélecteur */}
      <section className="rounded-2xl bg-white border border-gray-200 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">
            Choisis tes postes
          </h2>
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="text-sm font-semibold text-red-600 hover:underline"
            >
              Effacer ({selected.length})
            </button>
          )}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une position ou un roster…"
          aria-label="Rechercher une position"
          className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {atMax && (
          <p className="mt-2 text-xs text-gray-500">
            Maximum {MAX_SELECTION} positions. Retire-en une pour en ajouter.
          </p>
        )}
        <div
          className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
          data-testid="position-picker"
        >
          {filtered.map((p) => {
            const isSelected = selected.includes(p.slug);
            const disabled = !isSelected && atMax;
            const { name } = cleanDisplayName(p.displayName);
            return (
              <button
                key={p.slug}
                type="button"
                onClick={() => toggle(p.slug)}
                disabled={disabled}
                aria-pressed={isSelected}
                data-testid={`picker-${p.slug}`}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-300"
                    : disabled
                      ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                      : "border-gray-200 bg-white hover:border-emerald-400"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-sm text-gray-900">
                    {name}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {p.rosterName}
                  </span>
                </span>
                {isSelected && (
                  <span
                    className="text-emerald-600 font-bold"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <p className="mt-4 text-center text-gray-500">
            Aucune position trouvée.
          </p>
        )}
      </section>

      {/* Comparaison */}
      {selectedPositions.length < MIN_SELECTION ? (
        <p
          className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-gray-500"
          data-testid="comparator-hint"
        >
          Sélectionne au moins {MIN_SELECTION} positions pour les comparer.
        </p>
      ) : (
        <section data-testid="position-comparison" className="space-y-4">
          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-gray-900 px-4 py-3" />
                  {selectedPositions.map((p) => (
                    <th
                      key={p.slug}
                      className="bg-gray-900 px-4 py-3 text-center min-w-[150px]"
                    >
                      <Link
                        href={positionUrl(p)}
                        className="font-bold text-white hover:text-emerald-300"
                      >
                        {cleanDisplayName(p.displayName).name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {METRICS.map((metric) => {
                  const best = metric.stat
                    ? bestStatValue(
                        selectedPositions,
                        metric.stat.key,
                        metric.stat.dir,
                      )
                    : null;
                  return (
                    <tr key={metric.key}>
                      <th
                        scope="row"
                        className="bg-gray-50 px-4 py-3 text-left text-xs uppercase tracking-wide text-gray-500 whitespace-nowrap"
                      >
                        {metric.label}
                      </th>
                      {selectedPositions.map((p) => {
                        const isBest =
                          metric.stat != null &&
                          best != null &&
                          selectedPositions.length > 1 &&
                          p[metric.stat.key] === best;
                        return (
                          <td
                            key={p.slug}
                            className={`px-4 py-3 text-center ${
                              isBest
                                ? "bg-emerald-50 font-bold text-emerald-800"
                                : "text-gray-900"
                            }`}
                          >
                            {metric.render(p)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden space-y-3" data-testid="comparator-cards">
            <div className={`grid ${mobileGridCols} gap-2`}>
              {selectedPositions.map((p) => (
                <Link
                  key={p.slug}
                  href={positionUrl(p)}
                  className="rounded-xl bg-gray-900 p-2 text-center text-xs font-bold text-white"
                >
                  {cleanDisplayName(p.displayName).name}
                </Link>
              ))}
            </div>
            {METRICS.map((metric) => {
              const best = metric.stat
                ? bestStatValue(
                    selectedPositions,
                    metric.stat.key,
                    metric.stat.dir,
                  )
                : null;
              return (
                <div
                  key={metric.key}
                  className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">
                    {metric.label}
                  </div>
                  <div className={`grid ${mobileGridCols} gap-2`}>
                    {selectedPositions.map((p) => {
                      const isBest =
                        metric.stat != null &&
                        best != null &&
                        selectedPositions.length > 1 &&
                        p[metric.stat.key] === best;
                      return (
                        <div
                          key={p.slug}
                          className={`text-center text-sm ${
                            isBest
                              ? "font-bold text-emerald-700"
                              : "text-gray-900"
                          }`}
                        >
                          {metric.render(p)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
