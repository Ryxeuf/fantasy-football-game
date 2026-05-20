"use client";

/**
 * Page admin Phase 3.C.1 — detail d'une NflTeam : metadata + roster
 * groupes par status + games sur la saison filtree.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ApiClientError, apiRequest } from "../../../../lib/api-client";
import { useNflFantasySeason } from "../../_components/SeasonContext";

interface PlayerRow {
  readonly id: string;
  readonly pseudonym: string;
  readonly realName: string;
  readonly realNameDisplay: boolean;
  readonly jerseyNumber: number | null;
  readonly nflPosition: string;
  readonly bbPosition: string;
  readonly status: string;
}

interface GameRow {
  readonly id: string;
  readonly weekId: string;
  readonly opponent: string;
  readonly isHome: boolean;
  readonly kickoffAt: string;
  readonly status: string;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
}

interface TeamDetail {
  readonly code: string;
  readonly city: string;
  readonly bbRace: string;
  readonly raceLabel: string;
  readonly activePlayers: number;
  readonly totalPlayers: number;
  readonly gamesInSeason: number;
  readonly players: ReadonlyArray<PlayerRow>;
  readonly games: ReadonlyArray<GameRow>;
}

function statusBadge(status: string): JSX.Element {
  const color =
    status === "active"
      ? "bg-emerald-100 text-emerald-700"
      : status === "ir"
        ? "bg-amber-100 text-amber-700"
        : status === "retired"
          ? "bg-gray-200 text-gray-600"
          : status === "suspended"
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-600";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${color}`}
    >
      {status}
    </span>
  );
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

export default function AdminNflFantasyTeamDetailPage(): JSX.Element {
  const params = useParams<{ code: string }>();
  const code = params?.code?.toUpperCase() ?? "";
  const { selectedSeasonId } = useNflFantasySeason();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (selectedSeasonId) qs.set("seasonId", selectedSeasonId);
    apiRequest<TeamDetail>(
      `/admin/nfl-fantasy/explore/teams/${code}${qs.toString() ? `?${qs}` : ""}`,
    )
      .then((d) => {
        if (cancelled) return;
        setTeam(d);
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
  }, [code, selectedSeasonId]);

  const playersByStatus = useMemo(() => {
    const map = new Map<string, PlayerRow[]>();
    if (!team) return map;
    for (const p of team.players) {
      const list = map.get(p.status) ?? [];
      list.push(p);
      map.set(p.status, list);
    }
    return map;
  }, [team]);

  if (loading) {
    return <div className="text-sm text-gray-500">Chargement…</div>;
  }
  if (error?.status === 404) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">Équipe introuvable</h1>
        <p className="mt-2 text-sm text-gray-500">{error.message}</p>
        <Link
          href="/admin/nfl-fantasy/teams"
          className="mt-4 inline-block text-sm text-nuffle-bronze hover:text-nuffle-gold"
        >
          ← Retour à la liste
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
  if (!team) return <></>;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/nfl-fantasy/teams"
          className="text-sm text-gray-500 hover:text-nuffle-anthracite"
        >
          ← Toutes les équipes
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-nuffle-anthracite">
              <span className="font-mono">{team.code}</span>
              <span className="text-gray-500">·</span>
              <span>{team.city}</span>
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {team.raceLabel}{" "}
              <span className="ml-2 rounded-full bg-nuffle-gold/10 px-2 py-0.5 text-xs font-medium text-nuffle-bronze">
                {team.bbRace}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Actifs</div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">
            {team.activePlayers}
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Total roster</div>
          <div className="mt-1 text-2xl font-bold text-gray-700">
            {team.totalPlayers}
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">
            Games (saison {selectedSeasonId ?? "—"})
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-700">
            {team.gamesInSeason}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Roster</h2>
        {team.players.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Aucun joueur ingéré pour cette équipe. Lance « ESPN rosters
            snapshot » ou « Ingest nflverse W{"{n}"} » depuis l’onglet Actions.
          </div>
        ) : (
          <div
            className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm"
            data-testid="nfl-fantasy-team-roster"
          >
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Pseudonym</th>
                  <th className="px-3 py-2">Real name</th>
                  <th className="px-3 py-2">NFL pos</th>
                  <th className="px-3 py-2">BB pos</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {team.players.map((p) => (
                  <tr key={p.id} className="hover:bg-nuffle-gold/5">
                    <td className="px-3 py-2 font-mono text-gray-500">
                      {p.jerseyNumber ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/nfl-fantasy/players/${p.id}` as never}
                        className="text-nuffle-bronze hover:underline"
                      >
                        {p.pseudonym}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {p.realName}
                      {!p.realNameDisplay && (
                        <span
                          title="Q8 — realName non exposé publiquement"
                          className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-gray-500"
                        >
                          privé
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600">
                      {p.nflPosition}
                    </td>
                    <td className="px-3 py-2 font-mono text-nuffle-anthracite">
                      {p.bbPosition}
                    </td>
                    <td className="px-3 py-2">{statusBadge(p.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {team.players.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
            {Array.from(playersByStatus.entries()).map(([status, list]) => (
              <span key={status}>
                {statusBadge(status)}{" "}
                <span className="font-mono">{list.length}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Calendrier {selectedSeasonId ? `(${selectedSeasonId})` : "(toutes saisons)"}
        </h2>
        {team.games.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Aucun game ingéré sur cette saison.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Week</th>
                  <th className="px-3 py-2">Adversaire</th>
                  <th className="px-3 py-2">Lieu</th>
                  <th className="px-3 py-2">Kickoff</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {team.games.map((g) => (
                  <tr key={g.id}>
                    <td className="px-3 py-2 font-mono text-gray-700">
                      {g.weekId}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700">
                      {g.opponent}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {g.isHome ? "🏟️ Home" : "✈️ Away"}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {new Date(g.kickoffAt).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {g.homeScore !== null && g.awayScore !== null
                        ? g.isHome
                          ? `${g.homeScore} - ${g.awayScore}`
                          : `${g.awayScore} - ${g.homeScore}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{gameStatusBadge(g.status)}</td>
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
