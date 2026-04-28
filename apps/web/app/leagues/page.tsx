"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../lib/api-client";
import { useLanguage } from "../contexts/LanguageContext";

type LeagueStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "completed"
  | "archived";

interface League {
  id: string;
  name: string;
  description: string | null;
  creatorId: string;
  ruleset: string;
  status: LeagueStatus | string;
  isPublic: boolean;
  maxParticipants: number;
  allowedRosters: string[] | null;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
  createdAt: string;
  updatedAt: string;
}

type StatusFilter = "all" | LeagueStatus;

const STATUS_VALUES: LeagueStatus[] = [
  "draft",
  "open",
  "in_progress",
  "completed",
  "archived",
];

// S25.5c — chemin relatif (sans API_BASE) : `apiRequest` re-prefixe en
// ajoutant API_BASE et l'`Authorization: Bearer ...` automatiquement,
// puis unwrap l'enveloppe `ApiResponse<T>` quand elle est presente.
function buildListPath(status: StatusFilter): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  const qs = params.toString();
  return `/league${qs ? `?${qs}` : ""}`;
}

export default function LeaguesPage() {
  const { t } = useLanguage();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let cancelled = false;
    async function fetchLeagues() {
      try {
        setLoading(true);
        setError(null);
        const body = await apiRequest<{ leagues: League[] }>(
          buildListPath(statusFilter),
        );
        if (!cancelled) setLeagues(body.leagues ?? []);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t.leagues.errorLoad);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLeagues();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, t.leagues.errorLoad]);

  const rulesetLabels = useMemo<Record<string, string>>(
    () => ({
      season_2: t.leagues.rulesetSeason2,
      season_3: t.leagues.rulesetSeason3,
    }),
    [t.leagues.rulesetSeason2, t.leagues.rulesetSeason3],
  );

  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      draft: t.leagues.statusDraft,
      open: t.leagues.statusOpen,
      in_progress: t.leagues.statusInProgress,
      completed: t.leagues.statusCompleted,
      archived: t.leagues.statusArchived,
    }),
    [
      t.leagues.statusArchived,
      t.leagues.statusCompleted,
      t.leagues.statusDraft,
      t.leagues.statusInProgress,
      t.leagues.statusOpen,
    ],
  );

  if (loading) {
    return (
      <div className="w-full p-6">
        <p>{t.common.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-6">
        <p className="text-red-600">
          {t.common.error} : {error}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="leagues-page"
      className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6"
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          {t.leagues.title}
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          {t.leagues.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="leagues-status-filter"
          className="text-sm font-medium text-gray-700"
        >
          {t.leagues.filterStatus}
        </label>
        <select
          id="leagues-status-filter"
          data-testid="leagues-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="all">{t.common.all}</option>
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </div>

      {leagues.length === 0 ? (
        <div
          data-testid="leagues-empty"
          className="text-center py-8 text-gray-500"
        >
          {t.leagues.empty}
        </div>
      ) : (
        <ul
          data-testid="leagues-list"
          className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4"
        >
          {leagues.map((league) => {
            const ruleset = rulesetLabels[league.ruleset] ?? league.ruleset;
            const statusLabel =
              statusLabels[league.status] ?? league.status;
            return (
              <li
                key={league.id}
                data-testid={`league-item-${league.id}`}
                className="border border-gray-200 rounded-lg bg-white hover:border-nuffle-gold transition-colors"
              >
                <Link
                  href={`/leagues/${league.id}`}
                  className="block p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-nuffle-anthracite">
                      {league.name}
                    </h2>
                    <span className="text-xs uppercase tracking-wide bg-nuffle-gold/10 border border-nuffle-gold/30 text-nuffle-bronze px-2 py-0.5 rounded">
                      {statusLabel}
                    </span>
                  </div>
                  {league.description ? (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {league.description}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                    <span>{ruleset}</span>
                    <span>
                      {t.leagues.maxParticipants}: {league.maxParticipants}
                    </span>
                    <span>
                      {league.isPublic
                        ? t.leagues.visibilityPublic
                        : t.leagues.visibilityPrivate}
                    </span>
                    {league.allowedRosters &&
                    league.allowedRosters.length > 0 ? (
                      <span>
                        {t.leagues.allowedRosters}:{" "}
                        {league.allowedRosters.length}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
