"use client";
/**
 * L2.C.9 — Sprint Ligues v2 PR9 : page publique des ligues archivees.
 *
 * Liste paginee des ligues dont le `status` est `completed` ou
 * `archived`. Les ligues actives restent sur `/leagues`. Pas de gate
 * par feature flag : la page est purement consultative et n'expose
 * aucune action utilisateur (juste un lien vers la page de detail
 * existante).
 *
 * Pour gagner du temps cote backend, on consomme l'endpoint existant
 * `GET /league?status=...&limit=&offset=` deux fois (1 fois par
 * status) et on merge cote client. La pagination est par-status pour
 * la simplicite ; un endpoint dedie pourrait combiner les deux plus
 * proprement plus tard si la volumetrie grandit.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";

interface ArchivedLeague {
  id: string;
  name: string;
  description: string | null;
  ruleset: string;
  status: string;
  isPublic: boolean;
  maxParticipants: number;
  allowedRosters: string[] | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  leagues: ArchivedLeague[];
}

const PAGE_SIZE = 50;

export default function ArchivedLeaguesPage() {
  const { t } = useLanguage();
  const [completed, setCompleted] = useState<ArchivedLeague[]>([]);
  const [archived, setArchived] = useState<ArchivedLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [c, a] = await Promise.all([
          apiRequest<ListResponse>(
            `/leagues?status=completed&limit=${PAGE_SIZE}`,
          ),
          apiRequest<ListResponse>(
            `/leagues?status=archived&limit=${PAGE_SIZE}`,
          ),
        ]);
        if (cancelled) return;
        setCompleted(c.leagues ?? []);
        setArchived(a.leagues ?? []);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : t.leagues.errorLoad,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [t.leagues.errorLoad]);

  const merged = useMemo<ArchivedLeague[]>(() => {
    // Merge sans duplication (rare, mais defensif si le backend
    // tagge une ligue avec deux status simultanement).
    const seen = new Set<string>();
    const out: ArchivedLeague[] = [];
    for (const l of [...archived, ...completed]) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      out.push(l);
    }
    // Tri : plus recente d'abord (par updatedAt).
    out.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return out;
  }, [archived, completed]);

  if (loading) {
    return (
      <div className="w-full p-6">
        <p>{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div
      data-testid="archived-leagues-page"
      className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-4"
    >
      <div>
        <Link
          href="/leagues"
          className="text-sm text-gray-600 hover:text-gray-800 inline-flex items-center gap-1"
        >
          ← {t.leagues.backToLeagues}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2">
          📦 {t.leagues.archivedTitle ?? "Ligues archivees"}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {t.leagues.archivedDescription ??
            "Ligues terminees ou archivees, accessibles en lecture seule pour consulter classements et recap."}
        </p>
      </div>

      {error ? (
        <div
          data-testid="archived-leagues-error"
          className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm"
        >
          {error}
        </div>
      ) : null}

      {merged.length === 0 ? (
        <div
          data-testid="archived-leagues-empty"
          className="text-center py-8 text-gray-500"
        >
          {t.leagues.archivedEmpty ?? "Aucune ligue archivee pour le moment."}
        </div>
      ) : (
        <ul
          data-testid="archived-leagues-list"
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {merged.map((l) => (
            <li
              key={l.id}
              data-testid={`archived-league-${l.id}`}
              className="border border-gray-200 rounded-lg bg-white hover:border-nuffle-gold transition-colors"
            >
              <Link href={`/leagues/${l.id}`} className="block p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-nuffle-anthracite">
                    {l.name}
                  </h2>
                  <span
                    className={`text-xs uppercase tracking-wide px-2 py-0.5 rounded ${
                      l.status === "archived"
                        ? "bg-gray-200 text-gray-700"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {l.status === "archived"
                      ? t.leagues.statusArchived
                      : t.leagues.statusCompleted}
                  </span>
                </div>
                {l.description ? (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {l.description}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>
                    {l.ruleset === "season_3"
                      ? t.leagues.rulesetSeason3
                      : t.leagues.rulesetSeason2}
                  </span>
                  <span>
                    {t.leagues.maxParticipants}: {l.maxParticipants}
                  </span>
                  <span>
                    {new Date(l.updatedAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
