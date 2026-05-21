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

interface PlayerBio {
  readonly heightInches: number | null;
  readonly weightLbs: number | null;
  readonly birthDate: string | null;
  readonly ageYears: number | null;
  readonly college: string | null;
  readonly headshotUrl: string | null;
  readonly draftYear: number | null;
  readonly draftRound: number | null;
  readonly draftPick: number | null;
  readonly draftClub: string | null;
  readonly rookieYear: number | null;
  readonly yearsExp: number | null;
}

interface PassingStats {
  readonly completions: number;
  readonly attempts: number;
  readonly passingYards: number;
  readonly passingTds: number;
  readonly interceptions: number;
  readonly sacks: number;
}
interface RushingStats {
  readonly carries: number;
  readonly rushingYards: number;
  readonly rushingTds: number;
  readonly rushingFumblesLost: number;
}
interface ReceivingStats {
  readonly targets: number;
  readonly receptions: number;
  readonly receivingYards: number;
  readonly receivingTds: number;
  readonly receivingFumblesLost: number;
}
interface DefenseStats {
  readonly tacklesSolo: number;
  readonly tackleAssists: number;
  readonly sacks: number;
  readonly interceptions: number;
  readonly fumblesForced: number;
  readonly fumblesRecovered: number;
  readonly defTds: number;
  readonly passesDefended: number;
}
interface CategoryStats {
  readonly passing: PassingStats;
  readonly rushing: RushingStats;
  readonly receiving: ReceivingStats;
  readonly defense: DefenseStats;
}

interface SeasonAggregate {
  readonly seasonId: string;
  readonly gamesPlayed: number;
  readonly totalSpp: number;
  readonly categoryStats: CategoryStats;
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
  readonly bio: PlayerBio;
  readonly team: {
    readonly code: string;
    readonly city: string;
    readonly raceLabel: string;
    readonly bbRace: string;
  } | null;
  readonly totalSpp: number;
  readonly gamesPlayed: number;
  readonly categoryStats: CategoryStats;
  readonly seasons: ReadonlyArray<SeasonAggregate>;
  readonly stats: ReadonlyArray<StatRow>;
}

function formatHeight(inches: number | null): string {
  if (inches === null) return "—";
  const feet = Math.floor(inches / 12);
  const rest = inches % 12;
  return `${feet}'${rest}" (${inches} in)`;
}

function formatDraft(bio: PlayerBio): string {
  if (!bio.draftYear) return "Undrafted";
  const parts: string[] = [`${bio.draftYear}`];
  if (bio.draftRound) parts.push(`R${bio.draftRound}`);
  if (bio.draftPick) parts.push(`#${bio.draftPick} overall`);
  if (bio.draftClub) parts.push(`by ${bio.draftClub}`);
  return parts.join(" · ");
}

function hasAnyStats(c: CategoryStats): {
  hasPassing: boolean;
  hasRushing: boolean;
  hasReceiving: boolean;
  hasDefense: boolean;
} {
  return {
    hasPassing: c.passing.attempts > 0 || c.passing.passingYards > 0,
    hasRushing: c.rushing.carries > 0 || c.rushing.rushingYards > 0,
    hasReceiving: c.receiving.targets > 0 || c.receiving.receivingYards > 0,
    hasDefense:
      c.defense.tacklesSolo > 0 ||
      c.defense.tackleAssists > 0 ||
      c.defense.sacks > 0 ||
      c.defense.interceptions > 0,
  };
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
        <div className="mt-2 flex flex-wrap items-start gap-4">
          {player.bio.headshotUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.bio.headshotUrl}
              alt={player.realName}
              className="h-24 w-24 rounded-md border border-gray-200 bg-gray-50 object-cover"
              title="ADMIN UNIQUEMENT — headshot non exposée publiquement (Q8)"
            />
          )}
          <div className="flex-1">
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
            <p className="mt-1 text-xs text-gray-500">
              {player.team
                ? `${player.team.code} · ${player.team.city}`
                : "FA"}
              {player.jerseyNumber !== null && ` · #${player.jerseyNumber}`}
              {" · "}
              {player.nflPosition}
              {player.bio.ageYears !== null && ` · ${player.bio.ageYears} ans`}
              {player.bio.yearsExp !== null && ` · ${player.bio.yearsExp} ans NFL`}
            </p>
            <p className="mt-1 text-xs font-mono text-gray-400">
              gsis_id : {player.id}
            </p>
          </div>
        </div>
      </div>

      <PublicProfilePreview player={player} />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <InfoCard title="Bio">
          <InfoRow label="Taille">
            <span className="font-mono">{formatHeight(player.bio.heightInches)}</span>
          </InfoRow>
          <InfoRow label="Poids">
            <span className="font-mono">
              {player.bio.weightLbs ? `${player.bio.weightLbs} lbs` : "—"}
            </span>
          </InfoRow>
          <InfoRow label="Né le">
            <span className="text-gray-700">
              {player.bio.birthDate
                ? new Date(player.bio.birthDate).toLocaleDateString("fr-FR")
                : "—"}
              {player.bio.ageYears !== null && ` (${player.bio.ageYears} ans)`}
            </span>
          </InfoRow>
          <InfoRow label="College">
            <span className="text-gray-700">{player.bio.college ?? "—"}</span>
          </InfoRow>
          <InfoRow label="Draft">
            <span className="text-xs text-gray-700">{formatDraft(player.bio)}</span>
          </InfoRow>
          <InfoRow label="Rookie year">
            <span className="font-mono">{player.bio.rookieYear ?? "—"}</span>
          </InfoRow>
        </InfoCard>

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
          Statistiques NFL (
          {selectedSeasonId ? `saison ${selectedSeasonId}` : "carrière"})
        </h2>
        <CategoryStatsCards stats={player.categoryStats} />
      </section>

      {player.seasons.length > 1 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            Carrière par saison
          </h2>
          <SeasonsTable seasons={player.seasons} />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Game log (
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

// ────────────────────────────────────────────────────────────────────
// CategoryStatsCards (Phase 5.C)
// ────────────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | string;
}): JSX.Element {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="font-mono text-lg font-semibold text-gray-900">
        {value}
      </span>
    </div>
  );
}

function CategoryStatsCards({
  stats,
}: {
  readonly stats: CategoryStats;
}): JSX.Element {
  const flags = hasAnyStats(stats);
  const any = flags.hasPassing || flags.hasRushing || flags.hasReceiving || flags.hasDefense;
  if (!any) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-500">
        Aucune stat ingérée pour cette plage.
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {flags.hasPassing && (
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            🎯 Passing
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCell
              label="Cmp / Att"
              value={`${stats.passing.completions} / ${stats.passing.attempts}`}
            />
            <StatCell label="Yds" value={stats.passing.passingYards} />
            <StatCell label="TD" value={stats.passing.passingTds} />
            <StatCell label="INT" value={stats.passing.interceptions} />
            <StatCell label="Sacks pris" value={stats.passing.sacks} />
            <StatCell
              label="Comp %"
              value={
                stats.passing.attempts > 0
                  ? `${((stats.passing.completions / stats.passing.attempts) * 100).toFixed(1)}%`
                  : "—"
              }
            />
          </div>
        </div>
      )}
      {flags.hasRushing && (
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            🏃 Rushing
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCell label="Att" value={stats.rushing.carries} />
            <StatCell label="Yds" value={stats.rushing.rushingYards} />
            <StatCell label="TD" value={stats.rushing.rushingTds} />
            <StatCell label="Fum perdus" value={stats.rushing.rushingFumblesLost} />
            <StatCell
              label="Avg"
              value={
                stats.rushing.carries > 0
                  ? (stats.rushing.rushingYards / stats.rushing.carries).toFixed(1)
                  : "—"
              }
            />
          </div>
        </div>
      )}
      {flags.hasReceiving && (
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            🙌 Receiving
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCell label="Rec / Tgt" value={`${stats.receiving.receptions} / ${stats.receiving.targets}`} />
            <StatCell label="Yds" value={stats.receiving.receivingYards} />
            <StatCell label="TD" value={stats.receiving.receivingTds} />
            <StatCell label="Fum perdus" value={stats.receiving.receivingFumblesLost} />
            <StatCell
              label="Avg"
              value={
                stats.receiving.receptions > 0
                  ? (stats.receiving.receivingYards / stats.receiving.receptions).toFixed(1)
                  : "—"
              }
            />
          </div>
        </div>
      )}
      {flags.hasDefense && (
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            🛡 Defense
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCell label="Tkl solo" value={stats.defense.tacklesSolo} />
            <StatCell label="Tkl assists" value={stats.defense.tackleAssists} />
            <StatCell label="Sacks" value={stats.defense.sacks} />
            <StatCell label="INT" value={stats.defense.interceptions} />
            <StatCell label="FF" value={stats.defense.fumblesForced} />
            <StatCell label="FR" value={stats.defense.fumblesRecovered} />
            <StatCell label="TD def" value={stats.defense.defTds} />
            <StatCell label="PD" value={stats.defense.passesDefended} />
          </div>
        </div>
      )}
    </div>
  );
}

function SeasonsTable({
  seasons,
}: {
  readonly seasons: ReadonlyArray<SeasonAggregate>;
}): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Saison</th>
            <th className="px-3 py-2 text-right">G</th>
            <th className="px-3 py-2 text-right">SPP</th>
            <th className="px-3 py-2 text-right">Pass Yds</th>
            <th className="px-3 py-2 text-right">Pass TD</th>
            <th className="px-3 py-2 text-right">Rush Yds</th>
            <th className="px-3 py-2 text-right">Rush TD</th>
            <th className="px-3 py-2 text-right">Rec</th>
            <th className="px-3 py-2 text-right">Rec Yds</th>
            <th className="px-3 py-2 text-right">Rec TD</th>
            <th className="px-3 py-2 text-right">Tkl</th>
            <th className="px-3 py-2 text-right">Sacks</th>
            <th className="px-3 py-2 text-right">INT def</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {seasons.map((s) => (
            <tr key={s.seasonId}>
              <td className="px-3 py-2 font-mono font-semibold text-gray-700">
                {s.seasonId}
              </td>
              <td className="px-3 py-2 text-right font-mono">{s.gamesPlayed}</td>
              <td className="px-3 py-2 text-right font-mono font-bold text-nuffle-bronze">
                {s.totalSpp}
              </td>
              <td className="px-3 py-2 text-right font-mono">{s.categoryStats.passing.passingYards}</td>
              <td className="px-3 py-2 text-right font-mono">{s.categoryStats.passing.passingTds}</td>
              <td className="px-3 py-2 text-right font-mono">{s.categoryStats.rushing.rushingYards}</td>
              <td className="px-3 py-2 text-right font-mono">{s.categoryStats.rushing.rushingTds}</td>
              <td className="px-3 py-2 text-right font-mono">{s.categoryStats.receiving.receptions}</td>
              <td className="px-3 py-2 text-right font-mono">{s.categoryStats.receiving.receivingYards}</td>
              <td className="px-3 py-2 text-right font-mono">{s.categoryStats.receiving.receivingTds}</td>
              <td className="px-3 py-2 text-right font-mono">
                {s.categoryStats.defense.tacklesSolo + s.categoryStats.defense.tackleAssists}
              </td>
              <td className="px-3 py-2 text-right font-mono">{s.categoryStats.defense.sacks}</td>
              <td className="px-3 py-2 text-right font-mono">{s.categoryStats.defense.interceptions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// PublicProfilePreview (Phase 5.D)
// Visualise ce qui sera expose publiquement (V1 pseudo full, Q8).
// Tout ce qui touche aux IP NFL (headshot, realName) est masque.
// Faits factuels publics (height, weight, college, draft) sont OK.
// ────────────────────────────────────────────────────────────────────

function PublicProfilePreview({
  player,
}: {
  readonly player: PlayerDetail;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const recentGames = player.stats.slice(0, 5);
  return (
    <section className="rounded-md border-2 border-dashed border-violet-300 bg-violet-50/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-700">
            👁 Aperçu profil public
          </h2>
          <p className="mt-0.5 text-xs text-violet-600">
            Ce que les autres utilisateurs verront. Pas de realName, pas de
            headshot (Q8). Faits factuels publics OK.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-violet-300 bg-white px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100"
          data-testid="nfl-fantasy-player-public-preview-toggle"
        >
          {open ? "▼ Masquer" : "▶ Afficher"}
        </button>
      </div>

      {open && (
        <div className="mt-4 rounded-md border border-gray-200 bg-white p-4 shadow-inner">
          <div className="mb-4 flex flex-wrap items-start gap-3 border-b border-gray-100 pb-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-md bg-gradient-to-br from-violet-200 to-orange-200 text-3xl">
              {bbPositionEmoji(player.bbPosition)}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">
                {player.pseudonym}
              </h3>
              <p className="mt-0.5 text-sm text-gray-600">
                {player.team
                  ? `${player.team.city} · ${player.team.raceLabel}`
                  : "Free agent"}
                {" · "}
                <span className="font-mono">{player.bbPosition}</span>
                {player.jerseyNumber !== null && (
                  <> · #{player.jerseyNumber}</>
                )}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Position NFL : <span className="font-mono">{player.nflPosition}</span>
                {" · "}
                <PublicStatusBadge status={player.status} />
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Profil
              </h4>
              <dl className="space-y-1 text-sm">
                <PublicRow
                  label="Taille / Poids"
                  value={
                    player.bio.heightInches || player.bio.weightLbs
                      ? `${formatHeight(player.bio.heightInches)} ${player.bio.weightLbs ? `· ${player.bio.weightLbs} lbs` : ""}`
                      : "—"
                  }
                />
                <PublicRow
                  label="Âge"
                  value={
                    player.bio.ageYears !== null
                      ? `${player.bio.ageYears} ans`
                      : "—"
                  }
                />
                <PublicRow label="College" value={player.bio.college ?? "—"} />
                <PublicRow label="Draft" value={formatDraft(player.bio)} />
                <PublicRow
                  label="Saison rookie"
                  value={player.bio.rookieYear?.toString() ?? "—"}
                />
              </dl>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Carrière {player.seasons.length > 0 && `(${player.seasons.length} saison${player.seasons.length > 1 ? "s" : ""})`}
              </h4>
              <dl className="space-y-1 text-sm">
                <PublicRow label="Games joués" value={player.gamesPlayed.toString()} />
                <PublicRow
                  label="Total SPP"
                  value={
                    <span className="font-mono font-bold text-nuffle-bronze">
                      {player.totalSpp}
                    </span>
                  }
                />
                <PublicRow
                  label="Moy. SPP/game"
                  value={
                    player.gamesPlayed > 0
                      ? (player.totalSpp / player.gamesPlayed).toFixed(2)
                      : "—"
                  }
                />
                <PublicRow
                  label="Saisons jouées"
                  value={player.seasons.map((s) => s.seasonId).join(", ") || "—"}
                />
              </dl>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                5 derniers games
              </h4>
              {recentGames.length === 0 ? (
                <p className="text-xs text-gray-400">Aucune stat disponible.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {recentGames.map((s) => (
                    <li key={s.gameId} className="flex justify-between gap-2">
                      <span className="font-mono text-xs text-gray-600">
                        {s.weekId} {s.isHome ? "vs" : "@"} {s.opponent}
                      </span>
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {s.computedSpp ?? "—"} SPP
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="mt-4 border-t border-gray-100 pt-3 text-[10px] text-gray-400">
            Masqué publiquement : realName ({player.realName}), headshot URL,
            gsis_id, sppBreakdown, ingestSource. Cf. doc 01-legal.md § Q8.
          </p>
        </div>
      )}
    </section>
  );
}

function PublicRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs uppercase text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  );
}

function PublicStatusBadge({ status }: { readonly status: string }): JSX.Element {
  const label =
    status === "active"
      ? "Actif"
      : status === "ir"
        ? "Injured Reserve"
        : status === "retired"
          ? "Retraité"
          : status === "suspended"
            ? "Suspendu"
            : status;
  const color =
    status === "active"
      ? "text-emerald-700"
      : status === "ir"
        ? "text-amber-700"
        : "text-gray-500";
  return <span className={color}>{label}</span>;
}

function bbPositionEmoji(bb: string): string {
  // Mapping rapide pour donner du visuel a la card pseudonymee.
  if (["Thrower"].includes(bb)) return "🎯";
  if (["Catcher", "GutterRunner", "Wardancer"].includes(bb)) return "🏃";
  if (["Blitzer", "StormVermin", "Berserker", "Khorngor"].includes(bb)) return "⚔️";
  if (["Lineman", "BlackOrc", "Blocker", "Wight"].includes(bb)) return "🛡";
  if (["RatOgre", "Ogre", "Troll", "Treeman", "Bloodspawn"].includes(bb)) return "👹";
  if (["Runner"].includes(bb)) return "💨";
  return "🏈";
}
