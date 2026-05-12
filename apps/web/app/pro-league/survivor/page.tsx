"use client";

/**
 * Sprint Q lot Q.D.2 — Page Survivor Pick'em.
 *
 * Affiche :
 *  - Round courant (si saison active) + matchs + boutons pick par equipe
 *  - Mon statut perso (alive / eliminated + historique picks)
 *  - Standings publics (top survivors)
 *
 * Pour le MVP, on se base sur "la saison Pro League courante" — fetch
 * via /pro-league/seasons/current. La page utilise la saison renvoyee
 * et appelle survivor/overview avec son id.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../lib/api-client";

interface SeasonShort {
  readonly id: string;
  readonly year: number;
  readonly status: string;
}

interface CurrentRound {
  readonly id: string;
  readonly roundNumber: number;
  readonly scheduledAt: string | null;
}

interface CurrentMatch {
  readonly id: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly scheduledAt: string | null;
}

interface OverviewResponse {
  readonly season: SeasonShort;
  readonly currentRound: CurrentRound | null;
  readonly currentMatches: readonly CurrentMatch[];
}

interface MyStatusEntry {
  readonly id: string;
  readonly roundId: string;
  readonly weekN: number;
  readonly pickedTeamId: string;
  readonly status: "pending" | "alive" | "eliminated";
  readonly result: "win" | "loss" | "draw" | null;
}

interface MyStatus {
  readonly seasonId: string;
  readonly isAlive: boolean;
  readonly entries: readonly MyStatusEntry[];
  readonly pickedTeamIds: readonly string[];
}

interface StandingsEntry {
  readonly userId: string;
  readonly userName: string | null;
  readonly userEmail: string;
  readonly weeksSurvived: number;
  readonly isAlive: boolean;
}

interface CurrentSeasonHubResponse {
  readonly season: { readonly id: string } | null;
}

export default function SurvivorPage() {
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [myStatus, setMyStatus] = useState<MyStatus | null>(null);
  const [standings, setStandings] = useState<readonly StandingsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const loadAll = useCallback(async (sid: string) => {
    setError(null);
    try {
      const [ov, lb] = await Promise.all([
        apiRequest<OverviewResponse>(
          `/pro-league/survivor/seasons/${sid}/overview`,
        ),
        apiRequest<{ entries: StandingsEntry[] }>(
          `/pro-league/survivor/seasons/${sid}/standings`,
        ),
      ]);
      setOverview(ov);
      setStandings(lb.entries);

      try {
        const me = await apiRequest<MyStatus>(
          `/pro-league/survivor/seasons/${sid}/me`,
        );
        setMyStatus(me);
      } catch (e) {
        // Non auth → on cache le statut perso, ce n'est pas une erreur.
        if (e instanceof ApiClientError && e.status === 401) {
          setMyStatus(null);
        } else {
          throw e;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiRequest<CurrentSeasonHubResponse>("/pro-league/seasons/current")
      .then(async (data) => {
        if (!alive) return;
        if (!data.season) {
          setError("Aucune saison Pro League active.");
          setLoading(false);
          return;
        }
        setSeasonId(data.season.id);
        await loadAll(data.season.id);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadAll]);

  async function handlePick(teamId: string) {
    if (!seasonId || !overview?.currentRound) return;
    setSubmitting(teamId);
    setSubmitMessage(null);
    setError(null);
    try {
      await apiRequest<{ entryId: string }>(
        "/pro-league/survivor/picks",
        {
          method: "POST",
          body: JSON.stringify({
            seasonId,
            roundId: overview.currentRound.id,
            teamId,
          }),
          headers: { "Content-Type": "application/json" },
        },
      );
      setSubmitMessage(`Pick enregistre pour la semaine ${overview.currentRound.roundNumber}.`);
      await loadAll(seasonId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-500" data-testid="survivor-loading">
        Chargement…
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div
        className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
        data-testid="survivor-error"
      >
        {error}
      </div>
    );
  }

  if (!overview) return null;

  const canPick =
    myStatus !== null &&
    myStatus.isAlive &&
    overview.currentRound !== null &&
    !myStatus.entries.some((e) => e.roundId === overview.currentRound!.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite">
            🛡️ Survivor Pick&apos;em
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Saison {overview.season.year} · {overview.season.status}.
            Pique 1 equipe par semaine. Elle gagne → tu survis. Elle perd
            ou nul → t&apos;es elimine. Tu ne peux pas re-piquer une
            equipe deja choisie.
          </p>
        </div>
      </div>

      {myStatus !== null && (
        <div
          className={`p-4 rounded-lg border ${myStatus.isAlive ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}
          data-testid="my-status-banner"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {myStatus.isAlive ? "✓" : "✗"}
            </span>
            <div>
              <div className="font-semibold">
                {myStatus.isAlive ? "Vous etes ALIVE" : "Vous etes ELIMINE"}
              </div>
              <div className="text-xs">
                {myStatus.entries.length} pick{myStatus.entries.length > 1 ? "s" : ""}{" "}
                cette saison · {myStatus.entries.filter((e) => e.status === "alive").length} semaine
                {myStatus.entries.filter((e) => e.status === "alive").length > 1 ? "s" : ""} survecue
                {myStatus.entries.filter((e) => e.status === "alive").length > 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
      )}

      {submitMessage && (
        <div
          className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800"
          data-testid="submit-message"
        >
          {submitMessage}
        </div>
      )}

      {error && (
        <div
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
          data-testid="action-error"
        >
          {error}
        </div>
      )}

      {overview.currentRound ? (
        <section
          className="p-5 rounded-xl border bg-white border-gray-200"
          data-testid="current-round"
        >
          <h2 className="text-lg font-semibold mb-3">
            Semaine {overview.currentRound.roundNumber} · pick avant kickoff
            {overview.currentRound.scheduledAt && (
              <span className="text-sm text-gray-500 font-normal">
                {" "}
                ({new Date(overview.currentRound.scheduledAt).toLocaleString()})
              </span>
            )}
          </h2>

          {!myStatus && (
            <p className="text-sm text-gray-600">
              Vous devez etre connecte pour piquer une equipe.
            </p>
          )}

          {myStatus && !myStatus.isAlive && (
            <p className="text-sm text-rose-700">
              Vous etes elimine sur cette saison, plus de pick possible.
            </p>
          )}

          {myStatus && myStatus.isAlive && !canPick && (
            <p className="text-sm text-blue-700">
              Vous avez deja pick pour cette semaine.
            </p>
          )}

          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            data-testid="match-grid"
          >
            {overview.currentMatches.map((m) => {
              const homePicked = myStatus?.pickedTeamIds.includes(m.homeTeamId);
              const awayPicked = myStatus?.pickedTeamIds.includes(m.awayTeamId);
              return (
                <div
                  key={m.id}
                  className="p-3 rounded-lg border border-gray-200"
                  data-testid={`match-${m.id}`}
                >
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!canPick || homePicked || submitting !== null}
                      onClick={() => handlePick(m.homeTeamId)}
                      className="flex-1 px-3 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      data-testid={`pick-${m.homeTeamId}`}
                    >
                      {m.homeTeamId}
                      {homePicked && (
                        <span className="block text-xs text-gray-500">
                          deja piquee
                        </span>
                      )}
                    </button>
                    <span className="self-center text-xs text-gray-500">vs</span>
                    <button
                      type="button"
                      disabled={!canPick || awayPicked || submitting !== null}
                      onClick={() => handlePick(m.awayTeamId)}
                      className="flex-1 px-3 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      data-testid={`pick-${m.awayTeamId}`}
                    >
                      {m.awayTeamId}
                      {awayPicked && (
                        <span className="block text-xs text-gray-500">
                          deja piquee
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
          Aucun round en cours. Patientez le prochain kickoff.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section
          className="p-5 rounded-xl border bg-white border-gray-200"
          data-testid="standings"
        >
          <h2 className="text-lg font-semibold mb-3">🏆 Standings</h2>
          {standings.length === 0 ? (
            <p className="text-sm text-gray-500">
              Aucun pick enregistre cette saison.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-gray-600">
                <tr>
                  <th className="text-left py-1">#</th>
                  <th className="text-left py-1">Joueur</th>
                  <th className="text-right py-1">Semaines</th>
                  <th className="text-right py-1">Statut</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr
                    key={s.userId}
                    className="border-t border-gray-100"
                    data-testid={`standings-row-${s.userId}`}
                  >
                    <td className="py-1.5">{i + 1}</td>
                    <td className="py-1.5">{s.userName ?? s.userEmail}</td>
                    <td className="py-1.5 text-right font-semibold">
                      {s.weeksSurvived}
                    </td>
                    <td className="py-1.5 text-right">
                      {s.isAlive ? (
                        <span className="text-emerald-700">alive</span>
                      ) : (
                        <span className="text-rose-700">out</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {myStatus && myStatus.entries.length > 0 && (
          <section
            className="p-5 rounded-xl border bg-white border-gray-200"
            data-testid="my-picks"
          >
            <h2 className="text-lg font-semibold mb-3">📝 Mes picks</h2>
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-gray-600">
                <tr>
                  <th className="text-left py-1">Semaine</th>
                  <th className="text-left py-1">Equipe</th>
                  <th className="text-right py-1">Resultat</th>
                </tr>
              </thead>
              <tbody>
                {myStatus.entries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-gray-100"
                    data-testid={`my-pick-${e.id}`}
                  >
                    <td className="py-1.5">S{e.weekN}</td>
                    <td className="py-1.5">{e.pickedTeamId}</td>
                    <td className="py-1.5 text-right">
                      {e.status === "alive" && (
                        <span className="text-emerald-700 font-semibold">
                          ✓ {e.result}
                        </span>
                      )}
                      {e.status === "eliminated" && (
                        <span className="text-rose-700 font-semibold">
                          ✗ {e.result}
                        </span>
                      )}
                      {e.status === "pending" && (
                        <span className="text-gray-500 text-xs">en cours</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <div className="text-xs text-gray-500">
        <Link
          href={"/pro-league" as any}
          className="text-blue-700 hover:underline"
        >
          ← Pro League hub
        </Link>
      </div>
    </div>
  );
}
