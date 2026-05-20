"use client";

/**
 * Bloc d'actions bulk au niveau saison (Phase 3.F+G) :
 * - Recompute SPP : relance computeSpp() sur tous les NflGameStat
 *   de la saison (bloquant ~30-60s pour 2024).
 * - Replay : creé une league fictive 8 teams × W1-W18 + auto-fill
 *   + finalize + bulk-settle. Ne touche pas les leagues reelles.
 *
 * Affiche les resultats JSON formates apres chaque action.
 */

import Link from "next/link";
import { useState } from "react";

import { ApiClientError, apiRequest } from "../../../lib/api-client";

interface SeasonActionsProps {
  readonly seasonId: string;
}

interface RecomputeResult {
  readonly seasonId: string;
  readonly statsUpdated: number;
  readonly previousTotalSpp: number;
  readonly newTotalSpp: number;
  readonly errors: ReadonlyArray<{ statId: string; error: string }>;
}

type ReplayLineupMode = "first11" | "optimal";

interface ReplayResult {
  readonly leagueId: string;
  readonly seasonId: string;
  readonly teamCount: number;
  readonly fromWeek: number;
  readonly toWeek: number;
  readonly lineupMode: ReplayLineupMode;
  readonly weeksSettled: number;
  readonly weeksFailed: number;
  readonly errors: ReadonlyArray<{ weekNumber: number; error: string }>;
}

interface CleanupResult {
  readonly deletedCount: number;
  readonly leagueIds: ReadonlyArray<string>;
}

type ActionFeedback =
  | { kind: "ok-recompute"; data: RecomputeResult }
  | { kind: "ok-replay"; data: ReplayResult }
  | { kind: "ok-cleanup"; data: CleanupResult }
  | { kind: "error"; message: string };

export default function SeasonActions({
  seasonId,
}: SeasonActionsProps): JSX.Element {
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  // Replay form state
  const [teamCount, setTeamCount] = useState(8);
  const [fromWeek, setFromWeek] = useState(1);
  const [toWeek, setToWeek] = useState(18);
  const [lineupMode, setLineupMode] = useState<ReplayLineupMode>("first11");

  async function recomputeSpp(): Promise<void> {
    if (
      !window.confirm(
        `Recompute SPP pour la saison ${seasonId} ? L'opération peut durer 30-60s et écrasera les SPP existants sur tous les NflGameStat de la saison.`,
      )
    ) {
      return;
    }
    setBusy("recompute");
    setFeedback(null);
    try {
      const out = await apiRequest<RecomputeResult>(
        `/admin/nfl-fantasy/explore/seasons/${seasonId}/recompute-spp`,
        { method: "POST" },
      );
      setFeedback({ kind: "ok-recompute", data: out });
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ""}`
          : e instanceof Error
            ? e.message
            : "Erreur";
      setFeedback({ kind: "error", message: msg });
    } finally {
      setBusy(null);
    }
  }

  async function cleanupReplays(): Promise<void> {
    if (
      !window.confirm(
        `Supprimer toutes les leagues replay (ownerId LIKE 'replay-%') ? Action irréversible : entries, rosters, lineups et matchups seront supprimés en cascade.`,
      )
    ) {
      return;
    }
    setBusy("cleanup");
    setFeedback(null);
    try {
      const out = await apiRequest<CleanupResult>(
        `/admin/nfl-fantasy/explore/leagues/replay-cleanup`,
        { method: "POST" },
      );
      setFeedback({ kind: "ok-cleanup", data: out });
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ""}`
          : e instanceof Error
            ? e.message
            : "Erreur";
      setFeedback({ kind: "error", message: msg });
    } finally {
      setBusy(null);
    }
  }

  async function replay(): Promise<void> {
    setBusy("replay");
    setFeedback(null);
    try {
      const out = await apiRequest<ReplayResult>(
        `/admin/nfl-fantasy/explore/seasons/${seasonId}/replay`,
        {
          method: "POST",
          body: JSON.stringify({
            teamCount: Number(teamCount),
            fromWeek: Number(fromWeek),
            toWeek: Number(toWeek),
            lineupMode,
          }),
        },
      );
      setFeedback({ kind: "ok-replay", data: out });
    } catch (e) {
      const msg =
        e instanceof ApiClientError
          ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ""}`
          : e instanceof Error
            ? e.message
            : "Erreur";
      setFeedback({ kind: "error", message: msg });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-md border border-orange-200 bg-orange-50/30 p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-nuffle-bronze">
        🎬 Actions saison {seasonId}
      </h2>
      <p className="mt-1 text-xs text-gray-600">
        Opérations bulk : recompute SPP (si formule scoring change) ou
        replay end-to-end (création d'une league fictive auto-jouée pour
        valider standings + matchups).
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {/* Recompute SPP */}
        <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">
            🔄 Recompute SPP
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Relance <code>computeSpp()</code> sur tous les NflGameStat de la
            saison. Idempotent, bloquant ~30-60s.
          </p>
          <button
            type="button"
            onClick={recomputeSpp}
            disabled={busy !== null}
            data-testid="nfl-fantasy-season-recompute-spp"
            className="mt-3 rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-white hover:bg-nuffle-bronze disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "recompute" ? "En cours…" : "Lancer recompute"}
          </button>
        </div>

        {/* Replay */}
        <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">
            🎮 Replay saison
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Crée une league fictive avec auto-fill + finalize + bulk-settle.
            Ne touche pas les leagues réelles. ~10s pour 18 weeks.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <label className="block">
              <span className="text-gray-500">Teams</span>
              <input
                type="number"
                min={2}
                max={16}
                value={teamCount}
                onChange={(e) => setTeamCount(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
                data-testid="nfl-fantasy-replay-team-count"
              />
            </label>
            <label className="block">
              <span className="text-gray-500">From</span>
              <input
                type="number"
                min={1}
                max={22}
                value={fromWeek}
                onChange={(e) => setFromWeek(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
            <label className="block">
              <span className="text-gray-500">To</span>
              <input
                type="number"
                min={1}
                max={22}
                value={toWeek}
                onChange={(e) => setToWeek(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
              />
            </label>
          </div>
          <label className="mt-2 block text-xs">
            <span className="text-gray-500">Lineup mode</span>
            <select
              value={lineupMode}
              onChange={(e) =>
                setLineupMode(e.target.value as ReplayLineupMode)
              }
              data-testid="nfl-fantasy-replay-lineup-mode"
              className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
            >
              <option value="first11">
                first11 — ordre roster (realiste)
              </option>
              <option value="optimal">
                optimal — top 11 SPP/week (hindsight, upper-bound)
              </option>
            </select>
          </label>
          <button
            type="button"
            onClick={replay}
            disabled={busy !== null}
            data-testid="nfl-fantasy-season-replay"
            className="mt-3 rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-white hover:bg-nuffle-bronze disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "replay" ? "En cours…" : "Lancer replay"}
          </button>
        </div>

        {/* Cleanup replay leagues */}
        <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">
            🧹 Cleanup leagues replay
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Supprime toutes les leagues <code>replay-*</code> (entries,
            rosters, lineups, matchups en cascade). Toutes saisons confondues.
          </p>
          <button
            type="button"
            onClick={cleanupReplays}
            disabled={busy !== null}
            data-testid="nfl-fantasy-season-cleanup-replays"
            className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "cleanup" ? "En cours…" : "Cleanup replays"}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            feedback.kind === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-emerald-300 bg-emerald-50 text-emerald-700"
          }`}
          data-testid="nfl-fantasy-season-action-feedback"
        >
          {feedback.kind === "error" && feedback.message}
          {feedback.kind === "ok-recompute" && (
            <span>
              ✓ {feedback.data.statsUpdated} stats recalculés : SPP{" "}
              {feedback.data.previousTotalSpp} → {feedback.data.newTotalSpp}
              {feedback.data.errors.length > 0 && (
                <span className="ml-2 text-amber-700">
                  ({feedback.data.errors.length} errors)
                </span>
              )}
            </span>
          )}
          {feedback.kind === "ok-replay" && (
            <span>
              ✓ Replay OK ({feedback.data.lineupMode}) :{" "}
              {feedback.data.weeksSettled} weeks settled,{" "}
              {feedback.data.weeksFailed} failed.{" "}
              <Link
                href={`/admin/nfl-fantasy/leagues/${feedback.data.leagueId}`}
                className="font-medium text-nuffle-bronze underline hover:text-nuffle-gold"
              >
                Voir la league
              </Link>
            </span>
          )}
          {feedback.kind === "ok-cleanup" && (
            <span>
              ✓ {feedback.data.deletedCount} league
              {feedback.data.deletedCount > 1 ? "s" : ""} replay supprimée
              {feedback.data.deletedCount > 1 ? "s" : ""}.
            </span>
          )}
        </div>
      )}
    </section>
  );
}
