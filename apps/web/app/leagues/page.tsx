"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "../lib/api-client";
import { useLanguage } from "../contexts/LanguageContext";
import ScopeToggle from "../components/ScopeToggle";
import ViewerRoleBadges from "../components/ViewerRoleBadges";
import {
  parseCompetitionScope,
  type CompetitionScope,
  type ViewerRoles,
} from "../lib/competition-scope";
import { PendingLeagueInvitations } from "./_components/PendingLeagueInvitations";
import { JoinByCodeField } from "./_components/JoinByCodeField";

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
  /** Rôle du lecteur, tranché par le serveur. Optionnel : API antérieure. */
  viewerRoles?: ViewerRoles | null;
}

type StatusFilter = "all" | LeagueStatus;

/**
 * Statuts proposés au filtre. Les ligues ARCHIVÉES n'y figurent pas : elles
 * ne s'affichent plus dans la liste de base (le serveur les exclut quand
 * aucun statut n'est demandé) et vivent sur `/leagues/archived`.
 */
const STATUS_VALUES: LeagueStatus[] = [
  "draft",
  "open",
  "in_progress",
  "completed",
];

// S25.5c — chemin relatif (sans API_BASE) : `apiRequest` re-prefixe en
// ajoutant API_BASE et l'`Authorization: Bearer ...` automatiquement,
// puis unwrap l'enveloppe `ApiResponse<T>` quand elle est presente.
//
// `scope=mine` : le filtre « Les miennes » est appliqué par le SERVEUR (la
// liste est paginée, un filtre client ne trierait que la page courante).
export function buildListPath(
  status: StatusFilter,
  scope: CompetitionScope = "all",
): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (scope === "mine") params.set("scope", "mine");
  const qs = params.toString();
  return `/leagues${qs ? `?${qs}` : ""}`;
}

/** `useSearchParams` impose un `<Suspense>` (rendu statique de Next 14). */
export default function LeaguesPage() {
  return (
    <Suspense fallback={null}>
      <LeaguesPageContent />
    </Suspense>
  );
}

function LeaguesPageContent() {
  const { t } = useLanguage();
  // « Toutes / Les miennes » vit dans l'URL (`?scope=mine`).
  const scope = parseCompetitionScope(useSearchParams()?.get("scope"));
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
          buildListPath(statusFilter, scope),
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
  }, [statusFilter, scope, t.leagues.errorLoad]);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            {t.leagues.title}
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {t.leagues.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/leagues/archived"
            data-testid="leagues-archived-link"
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            📦 {t.leagues.archivedLink}
          </Link>
          <Link
            href="/leagues/new"
            data-testid="leagues-create-cta"
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-nuffle-gold text-white text-sm font-medium hover:bg-nuffle-gold/90"
          >
            + {t.leagues.createLeagueButton}
          </Link>
        </div>
      </div>

      {/* Invitations reçues en attente (accepter / refuser) + saisie de code.
          Le composant ne rend rien si l'utilisateur n'a aucune invitation. */}
      <PendingLeagueInvitations />

      <JoinByCodeField />

      <div className="flex flex-wrap items-center gap-3">
        <ScopeToggle testIdPrefix="leagues-scope" />
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
          {scope === "mine" ? t.myCompetitions.mineEmpty : t.leagues.empty}
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
                    <ViewerRoleBadges
                      roles={league.viewerRoles}
                      testIdPrefix={`league-role-${league.id}`}
                    />
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
