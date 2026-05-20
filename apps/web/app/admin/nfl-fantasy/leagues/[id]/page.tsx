"use client";

/**
 * Page admin Phase 3.D — detail d'une league : metadata + entries +
 * matchups (admin only, vue cross-utilisateurs).
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ApiClientError, apiRequest } from "../../../../lib/api-client";

interface EntryRow {
  readonly id: string;
  readonly userId: string;
  readonly teamName: string;
  readonly bbRace: string | null;
  readonly totalTV: number;
  readonly joinedAt: string;
}

interface MatchupRow {
  readonly id: string;
  readonly weekId: string;
  readonly homeEntryId: string;
  readonly awayEntryId: string;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly winnerId: string | null;
  readonly settledAt: string | null;
}

interface LeagueDetail {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly seasonId: string;
  readonly size: number;
  readonly type: string;
  readonly draftMode: string;
  readonly status: string;
  readonly inviteCode: string | null;
  readonly entriesCount: number;
  readonly matchupsCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly entries: ReadonlyArray<EntryRow>;
  readonly matchups: ReadonlyArray<MatchupRow>;
}

export default function AdminNflFantasyLeagueDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";

  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<LeagueDetail>(`/admin/nfl-fantasy/explore/leagues/${leagueId}`)
      .then((d) => {
        if (cancelled) return;
        setLeague(d);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiClientError) {
          setError({ message: e.message, status: e.status });
        } else {
          setError({ message: e instanceof Error ? e.message : "Erreur" });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const teamNameByEntry = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of league?.entries ?? []) map.set(e.id, e.teamName);
    return map;
  }, [league]);

  if (loading) return <div className="text-sm text-gray-500">Chargement…</div>;
  if (error?.status === 404) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          League introuvable
        </h1>
        <p className="mt-2 text-sm text-gray-500">{error.message}</p>
        <Link
          href="/admin/nfl-fantasy/leagues"
          className="mt-4 inline-block text-sm text-nuffle-bronze hover:text-nuffle-gold"
        >
          ← Retour aux leagues
        </Link>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
        {error.message}
      </div>
    );
  }
  if (!league) return <></>;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/nfl-fantasy/leagues"
          className="text-sm text-gray-500 hover:text-nuffle-anthracite"
        >
          ← Toutes les leagues
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-nuffle-anthracite">
          🏆 {league.name}
        </h1>
        <p className="mt-1 text-xs font-mono text-gray-400">
          {league.id} · saison {league.seasonId}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Status</div>
          <div className="mt-1 text-base font-bold text-gray-700">
            {league.status}
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Type / Draft</div>
          <div className="mt-1 text-base font-bold text-gray-700">
            {league.type} · {league.draftMode}
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Members</div>
          <div className="mt-1 text-base font-bold text-gray-700">
            {league.entriesCount}/{league.size}
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Matchups</div>
          <div className="mt-1 text-base font-bold text-gray-700">
            {league.matchupsCount}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Entries ({league.entries.length})
        </h2>
        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Race</th>
                <th className="px-3 py-2 text-right">TV</th>
                <th className="px-3 py-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {league.entries.map((e) => (
                <tr key={e.id} className="hover:bg-nuffle-gold/5">
                  <td className="px-3 py-2 font-medium text-gray-700">
                    {e.teamName}
                    {e.userId === league.ownerId && (
                      <span className="ml-2 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-orange-700">
                        owner
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-gray-500">
                    {e.userId}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {e.bbRace ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">
                    {e.totalTV}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {new Date(e.joinedAt).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Matchups ({league.matchups.length})
        </h2>
        {league.matchups.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Aucun matchup généré (draft pas encore finalisé ou aucune week
            settled).
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Week</th>
                  <th className="px-3 py-2">Home</th>
                  <th className="px-3 py-2">Away</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2">Winner</th>
                  <th className="px-3 py-2">Settled</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {league.matchups.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2 font-mono text-gray-700">
                      {m.weekId}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {teamNameByEntry.get(m.homeEntryId) ?? m.homeEntryId}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {teamNameByEntry.get(m.awayEntryId) ?? m.awayEntryId}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {m.homeScore !== null && m.awayScore !== null
                        ? `${m.homeScore} - ${m.awayScore}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {m.winnerId
                        ? (teamNameByEntry.get(m.winnerId) ?? m.winnerId)
                        : m.settledAt
                          ? "Égalité"
                          : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {m.settledAt
                        ? new Date(m.settledAt).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      <Link
                        href={`/admin/nfl-fantasy/matchups/${m.id}`}
                        className="text-nuffle-bronze underline hover:text-nuffle-gold"
                      >
                        Détail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
