"use client";

/**
 * Page admin Phase 3.C.2 — detail d'un NflPlayer : identite, mapping
 * NFL→BB, equipe, historique de NflGameStat (filtrable par saison).
 *
 * Actions de resync (idempotentes) :
 *   - Recompute SPP (relance computeSpp sur tous les NflGameStat)
 *   - Re-derive BB (relance getBbPosition(nflPosition, teamRace))
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { ApiClientError, apiRequest } from "../../../../lib/api-client";
import { useNflFantasySeason } from "../../_components/SeasonContext";

interface StatRow {
  readonly gameId: string;
  readonly weekId: string;
  readonly weekNumber: number;
  readonly seasonId: string;
  readonly opponent: string;
  readonly isHome: boolean;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly gameStatus: string;
  readonly computedSpp: number | null;
  readonly sppBreakdown: unknown;
  readonly rawStats: unknown;
  readonly ingestSource: string;
  readonly ingestedAt: string;
}

interface PlayerDetail {
  readonly id: string;
  readonly pseudonym: string;
  readonly realName: string;
  readonly realNameDisplay: boolean;
  readonly teamCode: string | null;
  readonly jerseyNumber: number | null;
  readonly nflPosition: string;
  readonly bbPosition: string;
  readonly status: string;
  readonly retiredAt: string | null;
  readonly bbStats: unknown;
  readonly bbSkills: unknown;
  readonly team: {
    readonly code: string;
    readonly city: string;
    readonly raceLabel: string;
    readonly bbRace: string;
  } | null;
  readonly totalSpp: number;
  readonly gamesPlayed: number;
  readonly stats: ReadonlyArray<StatRow>;
}

interface ActionFeedback {
  readonly ok: boolean;
  readonly message: string;
}

function StatusBadge({ status }: { readonly status: string }): JSX.Element {
  const color =
    status === "active"
      ? "bg-emerald-100 text-emerald-700"
      : status === "ir"
        ? "bg-amber-100 text-amber-700"
        : status === "retired"
          ? "bg-gray-200 text-gray-600"
          : "bg-red-100 text-red-700";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${color}`}
    >
      {status}
    </span>
  );
}

function InfoCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h2>
      <div className="mt-3 space-y-2 text-sm text-gray-700">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs uppercase text-gray-500">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export default function AdminNflFantasyPlayerDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const playerId = params?.id ?? "";
  const { selectedSeasonId } = useNflFantasySeason();

  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    if (!playerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (selectedSeasonId) qs.set("seasonId", selectedSeasonId);
    apiRequest<PlayerDetail>(
      `/admin/nfl-fantasy/explore/players/${playerId}${qs.toString() ? `?${qs}` : ""}`,
    )
      .then((d) => {
        if (cancelled) return;
        setPlayer(d);
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
  }, [playerId, selectedSeasonId]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  async function runAction(
    label: string,
    endpoint: string,
    successFormat: (out: unknown) => string,
  ): Promise<void> {
    setBusy(label);
    setFeedback(null);
    try {
      const out = await apiRequest<unknown>(endpoint, { method: "POST" });
      setFeedback({ ok: true, message: successFormat(out) });
      // Reload pour refleter les changements
      load();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setFeedback({
          ok: false,
          message: `${e.message}${e.status ? ` (HTTP ${e.status})` : ""}`,
        });
      } else {
        setFeedback({
          ok: false,
          message: e instanceof Error ? e.message : "Erreur",
        });
      }
    } finally {
      setBusy(null);
    }
  }

  function toggleExpand(gameId: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Chargement…</div>;
  }
  if (error?.status === 404) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">Joueur introuvable</h1>
        <p className="mt-2 text-sm text-gray-500">{error.message}</p>
        <Link
          href="/admin/nfl-fantasy/players"
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
  if (!player) return <></>;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/nfl-fantasy/players"
          className="text-sm text-gray-500 hover:text-nuffle-anthracite"
        >
          ← Tous les joueurs
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-nuffle-anthracite">
              <span>{player.pseudonym}</span>
              <StatusBadge status={player.status} />
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {player.realName}
              {!player.realNameDisplay && (
                <span
                  title="Q8 — realName non exposé publiquement"
                  className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-gray-500"
                >
                  privé (admin only)
                </span>
              )}
            </p>
            <p className="mt-1 text-xs font-mono text-gray-400">
              gsis_id : {player.id}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <InfoCard title="NFL">
          <InfoRow label="Team">
            {player.team ? (
              <Link
                href={`/admin/nfl-fantasy/teams/${player.team.code}` as never}
                className="font-mono text-nuffle-bronze hover:underline"
              >
                {player.team.code} · {player.team.city}
              </Link>
            ) : (
              <span className="text-gray-400">— FA / retired</span>
            )}
          </InfoRow>
          <InfoRow label="Jersey">
            <span className="font-mono">{player.jerseyNumber ?? "—"}</span>
          </InfoRow>
          <InfoRow label="Position">
            <span className="font-mono">{player.nflPosition}</span>
          </InfoRow>
          <InfoRow label="Retired at">
            <span className="text-gray-500">
              {player.retiredAt
                ? new Date(player.retiredAt).toLocaleDateString("fr-FR")
                : "—"}
            </span>
          </InfoRow>
        </InfoCard>

        <InfoCard title="Mapping BB">
          <InfoRow label="BB position">
            <span className="font-mono font-semibold text-nuffle-anthracite">
              {player.bbPosition}
            </span>
          </InfoRow>
          <InfoRow label="BB race">
            <span className="font-mono">{player.team?.bbRace ?? "—"}</span>
          </InfoRow>
          <InfoRow label="Race label">
            <span>{player.team?.raceLabel ?? "—"}</span>
          </InfoRow>
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-nuffle-bronze">
              bbStats / bbSkills bruts
            </summary>
            <pre className="mt-2 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-[10px] text-gray-700">
              {JSON.stringify(
                { bbStats: player.bbStats, bbSkills: player.bbSkills },
                null,
                2,
              )}
            </pre>
          </details>
        </InfoCard>

        <InfoCard
          title={`Carrière ${selectedSeasonId ? `(${selectedSeasonId})` : "(toutes saisons)"}`}
        >
          <InfoRow label="Games joués">
            <span className="font-mono text-gray-700">
              {player.gamesPlayed}
            </span>
          </InfoRow>
          <InfoRow label="Total SPP">
            <span className="font-mono text-lg font-bold text-nuffle-bronze">
              {player.totalSpp}
            </span>
          </InfoRow>
          <InfoRow label="Moy. SPP / game">
            <span className="font-mono text-gray-700">
              {player.gamesPlayed > 0
                ? (player.totalSpp / player.gamesPlayed).toFixed(2)
                : "—"}
            </span>
          </InfoRow>
        </InfoCard>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Actions de resync
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              runAction(
                "recompute",
                `/admin/nfl-fantasy/explore/players/${playerId}/recompute-spp`,
                (out) => {
                  const r = out as {
                    statsUpdated: number;
                    previousTotalSpp: number;
                    newTotalSpp: number;
                  };
                  const delta = r.newTotalSpp - r.previousTotalSpp;
                  return `Recompute OK : ${r.statsUpdated} games mis à jour, SPP ${r.previousTotalSpp} → ${r.newTotalSpp} (${delta >= 0 ? "+" : ""}${delta}).`;
                },
              )
            }
            disabled={busy !== null}
            className="rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-white hover:bg-nuffle-bronze disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="nfl-fantasy-player-recompute-spp"
          >
            {busy === "recompute" ? "En cours…" : "🔄 Recompute SPP"}
          </button>
          <button
            type="button"
            onClick={() =>
              runAction(
                "re-derive",
                `/admin/nfl-fantasy/explore/players/${playerId}/re-derive-bb`,
                (out) => {
                  const r = out as {
                    previousBbPosition: string;
                    newBbPosition: string;
                    changed: boolean;
                  };
                  return r.changed
                    ? `Re-derive OK : ${r.previousBbPosition} → ${r.newBbPosition}.`
                    : `Re-derive OK : aucune modification (${r.newBbPosition}).`;
                },
              )
            }
            disabled={busy !== null || !player.team}
            title={
              !player.team
                ? "Pas de teamCode — race BB indéterminable"
                : undefined
            }
            className="rounded-md border border-nuffle-gold px-3 py-1.5 text-sm font-medium text-nuffle-bronze hover:bg-nuffle-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="nfl-fantasy-player-rederive-bb"
          >
            {busy === "re-derive" ? "En cours…" : "🧬 Re-derive BB"}
          </button>
        </div>
        {feedback && (
          <div
            className={`mt-3 rounded-md border px-3 py-2 text-sm ${
              feedback.ok
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-red-300 bg-red-50 text-red-700"
            }`}
            data-testid="nfl-fantasy-player-action-feedback"
          >
            {feedback.message}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Stats par game (
          {selectedSeasonId ? `saison ${selectedSeasonId}` : "toutes saisons"})
        </h2>
        {player.stats.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Aucun NflGameStat ingéré pour ce joueur sur cette plage.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Week</th>
                  <th className="px-3 py-2">Adversaire</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 text-right">SPP</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2 text-right">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {player.stats.map((s) => (
                  <Fragment key={s.gameId}>
                    <tr>
                      <td className="px-3 py-2 font-mono text-gray-700">
                        {s.weekId}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono">
                          {s.isHome ? "vs" : "@"} {s.opponent}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">
                        {s.homeScore !== null && s.awayScore !== null
                          ? s.isHome
                            ? `${s.homeScore}-${s.awayScore}`
                            : `${s.awayScore}-${s.homeScore}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-nuffle-bronze">
                        {s.computedSpp ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs uppercase text-gray-500">
                        {s.ingestSource}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => toggleExpand(s.gameId)}
                          className="text-xs text-nuffle-bronze hover:underline"
                        >
                          {expanded.has(s.gameId) ? "▼ Masquer" : "▶ JSON"}
                        </button>
                      </td>
                    </tr>
                    {expanded.has(s.gameId) && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <h4 className="text-xs font-semibold uppercase text-gray-500">
                                SPP breakdown
                              </h4>
                              <pre className="mt-1 max-h-48 overflow-auto rounded bg-white p-2 text-[10px] text-gray-700">
                                {JSON.stringify(s.sppBreakdown, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold uppercase text-gray-500">
                                Raw stats (nflverse / espn)
                              </h4>
                              <pre className="mt-1 max-h-48 overflow-auto rounded bg-white p-2 text-[10px] text-gray-700">
                                {JSON.stringify(s.rawStats, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
