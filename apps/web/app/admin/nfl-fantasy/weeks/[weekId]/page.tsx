"use client";

/**
 * Page admin Phase 3.D — detail d'une NflWeek : games + scores +
 * statsCount par game.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../../../lib/api-client";

interface GameRow {
  readonly id: string;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly status: string;
  readonly kickoffAt: string;
  readonly statsCount: number;
}

interface WeekDetail {
  readonly id: string;
  readonly seasonId: string;
  readonly weekNumber: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly isPlayoffs: boolean;
  readonly gamesCount: number;
  readonly gamesFinal: number;
  readonly ingestStatus: string | null;
  readonly games: ReadonlyArray<GameRow>;
}

function gameStatusBadge(status: string): JSX.Element {
  const color =
    status === "final"
      ? "bg-gray-200 text-gray-700"
      : status === "in_progress"
        ? "bg-orange-100 text-orange-700"
        : "bg-sky-100 text-sky-700";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${color}`}
    >
      {status}
    </span>
  );
}

export default function AdminNflFantasyWeekDetailPage(): JSX.Element {
  const params = useParams<{ weekId: string }>();
  const weekId = decodeURIComponent(params?.weekId ?? "");

  const [detail, setDetail] = useState<WeekDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );

  useEffect(() => {
    if (!weekId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<WeekDetail>(
      `/admin/nfl-fantasy/explore/weeks/${encodeURIComponent(weekId)}`,
    )
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
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
  }, [weekId]);

  if (loading) {
    return <div className="text-sm text-gray-500">Chargement…</div>;
  }
  if (error?.status === 404) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">Week introuvable</h1>
        <p className="mt-2 text-sm text-gray-500">{error.message}</p>
        <Link
          href="/admin/nfl-fantasy/weeks"
          className="mt-4 inline-block text-sm text-nuffle-bronze hover:text-nuffle-gold"
        >
          ← Retour au calendrier
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
  if (!detail) return <></>;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/nfl-fantasy/weeks"
          className="text-sm text-gray-500 hover:text-nuffle-anthracite"
        >
          ← Calendrier
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-nuffle-anthracite">
          📅 {detail.id}
          {detail.isPlayoffs && (
            <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs uppercase tracking-wide text-orange-700">
              playoffs
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Période :{" "}
          {new Date(detail.startDate).toLocaleDateString("fr-FR")} →{" "}
          {new Date(detail.endDate).toLocaleDateString("fr-FR")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Games</div>
          <div className="mt-1 text-2xl font-bold text-gray-700">
            {detail.gamesCount}
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Final</div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">
            {detail.gamesFinal}
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Dernière ingest</div>
          <div className="mt-1 text-base font-bold text-gray-700">
            {detail.ingestStatus ?? "—"}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Games</h2>
        {detail.games.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Aucun game pour cette week — lance l'ingestion nflverse.
          </div>
        ) : (
          <div
            className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm"
            data-testid="nfl-fantasy-week-games"
          >
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Kickoff</th>
                  <th className="px-3 py-2">Game</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Stats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detail.games.map((g) => (
                  <tr key={g.id} className="hover:bg-nuffle-gold/5">
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {new Date(g.kickoffAt).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700">
                      <Link
                        href={`/admin/nfl-fantasy/teams/${g.awayTeam}` as never}
                        className="text-nuffle-bronze hover:underline"
                      >
                        {g.awayTeam}
                      </Link>{" "}
                      @{" "}
                      <Link
                        href={`/admin/nfl-fantasy/teams/${g.homeTeam}` as never}
                        className="text-nuffle-bronze hover:underline"
                      >
                        {g.homeTeam}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700">
                      {g.awayScore !== null && g.homeScore !== null
                        ? `${g.awayScore} - ${g.homeScore}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{gameStatusBadge(g.status)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600">
                      {g.statsCount}
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
