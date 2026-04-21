"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { API_BASE } from "../../auth-client";
import { useLanguage } from "../../contexts/LanguageContext";
import { SeasonCalendar } from "./SeasonCalendar";
import { SeasonStandings } from "./SeasonStandings";
import { SeasonParticipants } from "./SeasonParticipants";
import type {
  LeagueDetail,
  LeagueSeasonDetail,
  StandingRow,
} from "./types";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export default function LeagueDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const leagueId = typeof params.id === "string" ? params.id : "";

  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [season, setSeason] = useState<LeagueSeasonDetail | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    async function loadLeague() {
      try {
        setLoading(true);
        setError(null);
        const { league: data } = await fetchJson<{ league: LeagueDetail }>(
          `/league/${leagueId}`,
        );
        if (cancelled) return;
        setLeague(data);
        setSelectedSeasonId((prev) => {
          if (prev) return prev;
          return data.seasons.length > 0
            ? data.seasons[data.seasons.length - 1].id
            : null;
        });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t.leagues.errorLoad);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadLeague();
    return () => {
      cancelled = true;
    };
  }, [leagueId, t.leagues.errorLoad]);

  const loadSeason = useCallback(
    async (seasonId: string) => {
      try {
        setSeasonLoading(true);
        setSeasonError(null);
        const [seasonRes, standingsRes] = await Promise.all([
          fetchJson<{ season: LeagueSeasonDetail }>(
            `/league/seasons/${seasonId}`,
          ),
          fetchJson<{ seasonId: string; standings: StandingRow[] }>(
            `/league/seasons/${seasonId}/standings`,
          ),
        ]);
        setSeason(seasonRes.season);
        setStandings(standingsRes.standings);
      } catch (e: unknown) {
        setSeason(null);
        setStandings([]);
        setSeasonError(
          e instanceof Error ? e.message : t.leagues.seasonError,
        );
      } finally {
        setSeasonLoading(false);
      }
    },
    [t.leagues.seasonError],
  );

  useEffect(() => {
    if (!selectedSeasonId) {
      setSeason(null);
      setStandings([]);
      return;
    }
    loadSeason(selectedSeasonId);
  }, [selectedSeasonId, loadSeason]);

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

  const seasonStatusLabels = useMemo<Record<string, string>>(
    () => ({
      draft: t.leagues.seasonStatusDraft,
      scheduled: t.leagues.seasonStatusScheduled,
      in_progress: t.leagues.seasonStatusInProgress,
      completed: t.leagues.seasonStatusCompleted,
    }),
    [
      t.leagues.seasonStatusCompleted,
      t.leagues.seasonStatusDraft,
      t.leagues.seasonStatusInProgress,
      t.leagues.seasonStatusScheduled,
    ],
  );

  if (loading) {
    return (
      <div className="w-full p-6">
        <p>{t.common.loading}</p>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div data-testid="league-error" className="w-full p-6 space-y-4">
        <p className="text-red-600">
          {t.common.error} : {error ?? t.leagues.errorLoad}
        </p>
        <Link
          href="/leagues"
          className="inline-block text-sm text-blue-600 hover:underline"
        >
          ← {t.leagues.backToLeagues}
        </Link>
      </div>
    );
  }

  return (
    <div
      data-testid="league-detail-page"
      className="w-full p-4 sm:p-6 space-y-6"
    >
      <div>
        <Link
          href="/leagues"
          className="text-sm text-gray-600 hover:text-gray-800 mb-2 inline-flex items-center gap-1"
        >
          ← {t.leagues.backToLeagues}
        </Link>
        <div className="flex flex-wrap items-start gap-3 mt-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-nuffle-anthracite">
            {league.name}
          </h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-nuffle-gold/10 border border-nuffle-gold/30 text-nuffle-bronze">
            {statusLabels[league.status] ?? league.status}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
            {rulesetLabels[league.ruleset] ?? league.ruleset}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {league.isPublic
              ? t.leagues.visibilityPublic
              : t.leagues.visibilityPrivate}
          </span>
        </div>
        {league.description ? (
          <p className="text-sm text-gray-700 mt-2">{league.description}</p>
        ) : null}
        <p className="text-xs text-gray-500 mt-2">
          {t.leagues.creator} : {league.creator.coachName ?? league.creator.email}
          {" • "}
          {t.leagues.maxParticipants} : {league.maxParticipants}
          {league.allowedRosters && league.allowedRosters.length > 0
            ? ` • ${t.leagues.allowedRosters} : ${league.allowedRosters.join(", ")}`
            : ""}
        </p>
      </div>

      <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
          {t.leagues.scoringConfig}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div>
            {t.leagues.scoreWin} : <strong>{league.winPoints}</strong>{" "}
            {t.leagues.points}
          </div>
          <div>
            {t.leagues.scoreDraw} : <strong>{league.drawPoints}</strong>{" "}
            {t.leagues.points}
          </div>
          <div>
            {t.leagues.scoreLoss} : <strong>{league.lossPoints}</strong>{" "}
            {t.leagues.points}
          </div>
          <div>
            {t.leagues.scoreForfeit} :{" "}
            <strong>{league.forfeitPoints}</strong> {t.leagues.points}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-nuffle-anthracite">
          {t.leagues.seasonsSection}
        </h2>
        {league.seasons.length === 0 ? (
          <div
            data-testid="league-seasons-empty"
            className="text-sm text-gray-500"
          >
            {t.leagues.seasonsEmpty}
          </div>
        ) : (
          <ul
            data-testid="league-seasons"
            className="flex flex-wrap gap-2"
          >
            {league.seasons.map((s) => {
              const active = s.id === selectedSeasonId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedSeasonId(s.id)}
                    data-testid={`season-tab-${s.id}`}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                      active
                        ? "bg-nuffle-gold text-white border-nuffle-gold"
                        : "bg-white text-gray-700 border-gray-300 hover:border-nuffle-gold"
                    }`}
                  >
                    S{s.seasonNumber} — {s.name}
                    <span className="ml-2 text-xs opacity-80">
                      {seasonStatusLabels[s.status] ?? s.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {league.seasons.length > 0 ? (
        <section className="space-y-6">
          {seasonLoading ? (
            <p className="text-sm text-gray-500">
              {t.leagues.seasonLoading}
            </p>
          ) : null}
          {seasonError ? (
            <p className="text-sm text-red-600">
              {t.common.error} : {seasonError}
            </p>
          ) : null}

          {season ? (
            <>
              <div className="space-y-3">
                <h3 className="text-md font-semibold text-nuffle-anthracite">
                  {t.leagues.calendarSection}
                </h3>
                <SeasonCalendar rounds={season.rounds} />
              </div>

              <div className="space-y-3">
                <h3 className="text-md font-semibold text-nuffle-anthracite">
                  {t.leagues.standingsSection}
                </h3>
                <SeasonStandings rows={standings} />
              </div>

              <div className="space-y-3">
                <h3 className="text-md font-semibold text-nuffle-anthracite">
                  {t.leagues.participantsSection}
                </h3>
                <SeasonParticipants participants={season.participants} />
              </div>
            </>
          ) : !seasonLoading && !seasonError ? (
            <p className="text-sm text-gray-500">
              {t.leagues.seasonNotSelected}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
