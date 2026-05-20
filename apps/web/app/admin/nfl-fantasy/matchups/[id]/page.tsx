"use client";

/**
 * Page admin Phase 3.J — detail d'un matchup individuel : metadata +
 * les 2 cotes avec lineup + starters (finalSpp, rawSpp, breakdown).
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../../../lib/api-client";

interface MatchupStarterRow {
  readonly playerId: string;
  readonly playerPseudonym: string;
  readonly teamCode: string | null;
  readonly nflPosition: string;
  readonly bbPosition: string;
  readonly isCaptain: boolean;
  readonly isViceCaptain: boolean;
  readonly rawSpp: number | null;
  readonly finalSpp: number | null;
  readonly sppBreakdown: unknown;
}

interface MatchupSideRow {
  readonly entryId: string;
  readonly userId: string;
  readonly teamName: string;
  readonly bbRace: string | null;
  readonly score: number | null;
  readonly lineupId: string | null;
  readonly captainPlayerId: string | null;
  readonly viceCaptainPlayerId: string | null;
  readonly lineupLockedAt: string | null;
  readonly lineupTotalSpp: number | null;
  readonly starters: ReadonlyArray<MatchupStarterRow>;
}

interface MatchupGazette {
  readonly title: string;
  readonly body: string;
  readonly generatedAt: string;
}

interface MatchupDetail {
  readonly id: string;
  readonly leagueId: string;
  readonly leagueName: string;
  readonly seasonId: string;
  readonly weekId: string;
  readonly home: MatchupSideRow;
  readonly away: MatchupSideRow;
  readonly winnerEntryId: string | null;
  readonly winnerSide: "home" | "away" | "tie" | null;
  readonly settledAt: string | null;
  readonly createdAt: string;
  readonly gazette: MatchupGazette | null;
}

interface GazetteGenerateResult {
  readonly matchupId: string;
  readonly title: string;
  readonly body: string;
  readonly generatedAt: string;
  readonly skipped: boolean;
  readonly skipReason?: string;
  readonly usage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  };
}

export default function AdminNflFantasyMatchupDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const matchupId = params?.id ?? "";

  const [matchup, setMatchup] = useState<MatchupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [gazetteBusy, setGazetteBusy] = useState(false);
  const [gazetteError, setGazetteError] = useState<string | null>(null);

  async function generateGazette(force: boolean): Promise<void> {
    if (!matchupId) return;
    setGazetteBusy(true);
    setGazetteError(null);
    try {
      const out = await apiRequest<GazetteGenerateResult>(
        `/admin/nfl-fantasy/explore/matchups/${matchupId}/generate-gazette`,
        {
          method: "POST",
          body: JSON.stringify({ force }),
        },
      );
      setMatchup((prev) =>
        prev
          ? {
              ...prev,
              gazette: {
                title: out.title,
                body: out.body,
                generatedAt: out.generatedAt,
              },
            }
          : prev,
      );
    } catch (e) {
      if (e instanceof ApiClientError) {
        setGazetteError(`${e.message}${e.status ? ` (HTTP ${e.status})` : ""}`);
      } else {
        setGazetteError(e instanceof Error ? e.message : "Erreur");
      }
    } finally {
      setGazetteBusy(false);
    }
  }

  useEffect(() => {
    if (!matchupId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<MatchupDetail>(
      `/admin/nfl-fantasy/explore/matchups/${matchupId}`,
    )
      .then((d) => {
        if (cancelled) return;
        setMatchup(d);
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
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchupId]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500">Chargement du matchup…</div>
    );
  }
  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Erreur {error.status ?? ""} — {error.message}
        </div>
      </div>
    );
  }
  if (!matchup) return <div className="p-6 text-sm">Matchup introuvable.</div>;

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <nav className="text-xs text-gray-500">
          <Link
            href={`/admin/nfl-fantasy/leagues/${matchup.leagueId}`}
            className="text-nuffle-bronze underline hover:text-nuffle-gold"
          >
            ← {matchup.leagueName}
          </Link>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">
          Matchup {matchup.weekId}
        </h1>
        <p className="text-xs text-gray-500">
          ID <code>{matchup.id}</code> · Saison {matchup.seasonId} ·
          {matchup.settledAt
            ? ` Settled le ${new Date(matchup.settledAt).toLocaleDateString("fr-FR")}`
            : " Non settled"}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <SideCard side={matchup.home} label="Home" isWinner={matchup.winnerSide === "home"} />
        <SideCard side={matchup.away} label="Away" isWinner={matchup.winnerSide === "away"} />
      </section>

      {matchup.settledAt && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            matchup.winnerSide === "tie"
              ? "border-gray-300 bg-gray-50 text-gray-700"
              : "border-emerald-300 bg-emerald-50 text-emerald-800"
          }`}
        >
          {matchup.winnerSide === "tie" ? (
            <>Égalité {matchup.home.score} – {matchup.away.score}.</>
          ) : (
            <>
              Winner :{" "}
              <strong>
                {matchup.winnerSide === "home"
                  ? matchup.home.teamName
                  : matchup.away.teamName}
              </strong>{" "}
              ({matchup.home.score} – {matchup.away.score})
            </>
          )}
        </div>
      )}

      {matchup.settledAt && (
        <section className="rounded-md border border-amber-200 bg-amber-50/30 p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-nuffle-bronze">
              📜 Nuffle Gazette
            </h2>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => generateGazette(false)}
                disabled={gazetteBusy}
                data-testid="nfl-fantasy-matchup-gazette-generate"
                className="rounded-md bg-nuffle-gold px-3 py-1 font-medium text-white hover:bg-nuffle-bronze disabled:cursor-not-allowed disabled:opacity-50"
              >
                {gazetteBusy ? "En cours…" : matchup.gazette ? "Re-load" : "Générer"}
              </button>
              {matchup.gazette && (
                <button
                  type="button"
                  onClick={() => generateGazette(true)}
                  disabled={gazetteBusy}
                  className="rounded-md border border-nuffle-bronze px-3 py-1 font-medium text-nuffle-bronze hover:bg-nuffle-bronze/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {gazetteBusy ? "…" : "Régénérer (force)"}
                </button>
              )}
            </div>
          </div>
          {gazetteError && (
            <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {gazetteError}
            </div>
          )}
          {matchup.gazette ? (
            <article className="mt-3 space-y-2">
              <h3 className="text-lg font-bold text-gray-900">
                {matchup.gazette.title}
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {matchup.gazette.body}
              </p>
              <p className="text-xs text-gray-400">
                Generee le{" "}
                {new Date(matchup.gazette.generatedAt).toLocaleString("fr-FR")}
              </p>
            </article>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              Aucune gazette generee pour ce matchup. Clique "Générer" pour
              produire un article narratif via Claude Haiku (necessite
              ANTHROPIC_API_KEY cote serveur).
            </p>
          )}
        </section>
      )}
    </div>
  );
}

interface SideCardProps {
  readonly side: MatchupSideRow;
  readonly label: "Home" | "Away";
  readonly isWinner: boolean;
}

function SideCard({ side, label, isWinner }: SideCardProps): JSX.Element {
  const [openBreakdown, setOpenBreakdown] = useState<string | null>(null);
  return (
    <div
      className={`rounded-md border bg-white p-4 shadow-sm ${
        isWinner ? "border-emerald-400" : "border-gray-200"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {label} · {side.teamName}
          {isWinner && (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Winner
            </span>
          )}
        </h2>
        <div className="font-mono text-xl text-gray-900">
          {side.score ?? "—"}
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {side.bbRace ?? "—"} · user <code>{side.userId}</code>
      </p>

      {side.lineupId ? (
        <p className="mt-2 text-xs text-gray-500">
          Lineup {side.lineupId}
          {side.lineupLockedAt && (
            <>
              {" · "}
              locked {new Date(side.lineupLockedAt).toLocaleString("fr-FR")}
            </>
          )}
          {side.lineupTotalSpp !== null && (
            <> · totalSpp {side.lineupTotalSpp}</>
          )}
        </p>
      ) : (
        <p className="mt-2 text-xs text-amber-600">
          Aucun lineup posé pour cette week.
        </p>
      )}

      {side.starters.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-2 py-1">Joueur</th>
                <th className="px-2 py-1">Pos</th>
                <th className="px-2 py-1 text-right">Raw</th>
                <th className="px-2 py-1 text-right">Final</th>
                <th className="px-2 py-1">Mult</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {side.starters.map((s) => {
                const rowKey = s.playerId;
                const isOpen = openBreakdown === rowKey;
                return (
                  <Fragment key={rowKey}>
                    <tr
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setOpenBreakdown(isOpen ? null : rowKey)}
                    >
                      <td className="px-2 py-1">
                        <Link
                          href={`/admin/nfl-fantasy/players/${s.playerId}`}
                          className="text-nuffle-bronze hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {s.playerPseudonym}
                        </Link>
                        {s.teamCode && (
                          <span className="ml-1 text-xs text-gray-400">
                            ({s.teamCode})
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-xs">
                        <span className="text-gray-700">{s.bbPosition}</span>
                        <span className="ml-1 text-gray-400">
                          / {s.nflPosition}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-gray-600">
                        {s.rawSpp ?? "—"}
                      </td>
                      <td className="px-2 py-1 text-right font-mono font-semibold text-gray-900">
                        {s.finalSpp ?? "—"}
                      </td>
                      <td className="px-2 py-1 text-xs">
                        {s.isCaptain && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                            C ×1.5
                          </span>
                        )}
                        {s.isViceCaptain && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">
                            V ×1.2
                          </span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="px-3 py-2">
                          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-gray-700">
                            {JSON.stringify(s.sppBreakdown, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
