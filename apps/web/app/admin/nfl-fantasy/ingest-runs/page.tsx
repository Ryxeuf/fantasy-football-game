"use client";

/**
 * Page admin Phase 3.D — audit log des NflIngestRun (nflverse + ESPN).
 * Trie DESC par startedAt. Filtres par source + status.
 */

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";

import { ApiClientError, apiRequest } from "../../../lib/api-client";

interface IngestRunRow {
  readonly id: string;
  readonly source: string;
  readonly weekId: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly status: string;
  readonly durationMs: number | null;
  readonly result: unknown;
}

interface IngestRunsResponse {
  readonly runs: ReadonlyArray<IngestRunRow>;
}

function statusBadge(status: string): JSX.Element {
  const color =
    status === "success"
      ? "bg-emerald-100 text-emerald-700"
      : status === "partial"
        ? "bg-amber-100 text-amber-700"
        : status === "failed"
          ? "bg-red-100 text-red-700"
          : status === "in_progress"
            ? "bg-sky-100 text-sky-700"
            : "bg-gray-100 text-gray-600";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${color}`}
    >
      {status}
    </span>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const min = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${min}m${String(sec).padStart(2, "0")}s`;
}

function summarizeResult(result: unknown): string {
  if (result === null || typeof result !== "object") return "—";
  const r = result as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.gamesUpdated === "number") parts.push(`${r.gamesUpdated} games`);
  if (typeof r.playersUpdated === "number")
    parts.push(`${r.playersUpdated} players`);
  if (typeof r.statsUpdated === "number") parts.push(`${r.statsUpdated} stats`);
  if (typeof r.snapshotsCreated === "number")
    parts.push(`${r.snapshotsCreated} snapshots`);
  if (Array.isArray(r.errors) && r.errors.length > 0)
    parts.push(`${r.errors.length} errs`);
  if (typeof r.error === "string") parts.push(`err: ${r.error}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default function AdminNflFantasyIngestRunsPage(): JSX.Element {
  const [runs, setRuns] = useState<ReadonlyArray<IngestRunRow>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [limit, setLimit] = useState(100);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (sourceFilter) qs.set("source", sourceFilter);
    if (statusFilter) qs.set("status", statusFilter);
    qs.set("limit", String(limit));

    apiRequest<IngestRunsResponse>(
      `/admin/nfl-fantasy/explore/ingest-runs?${qs}`,
    )
      .then((d) => {
        if (cancelled) return;
        setRuns(d.runs);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiClientError) {
          setError(`${e.message}${e.status ? ` (HTTP ${e.status})` : ""}`);
        } else {
          setError(e instanceof Error ? e.message : "Erreur");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceFilter, statusFilter, limit]);

  function toggle(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of runs) map.set(r.status, (map.get(r.status) ?? 0) + 1);
    return map;
  }, [runs]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nuffle-anthracite">
            📥 Audit ingest runs
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Journal des appels d'ingestion nflverse + ESPN (NflIngestRun
            Q.A.2). Click sur une ligne pour voir le JSON complet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {Array.from(counts.entries()).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1">
              {statusBadge(s)}
              <span className="font-mono">{c}</span>
            </span>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap gap-3 rounded-md border border-gray-200 bg-white p-3 shadow-sm">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
          data-testid="nfl-fantasy-ingest-source-filter"
        >
          <option value="">Toutes sources</option>
          <option value="nflverse">nflverse</option>
          <option value="espn">espn</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
          data-testid="nfl-fantasy-ingest-status-filter"
        >
          <option value="">Tous statuts</option>
          <option value="success">success</option>
          <option value="partial">partial</option>
          <option value="failed">failed</option>
          <option value="in_progress">in_progress</option>
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
        >
          {[50, 100, 200, 500].map((n) => (
            <option key={n} value={n}>
              {n} runs
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm"
        data-testid="nfl-fantasy-ingest-runs-table"
      >
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Week</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Durée</th>
              <th className="px-3 py-2">Résumé</th>
              <th className="px-3 py-2 text-right">JSON</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && runs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  Aucun NflIngestRun pour ces filtres.
                </td>
              </tr>
            )}
            {!loading &&
              runs.map((r) => {
                const open = expanded.has(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr
                      className="hover:bg-nuffle-gold/5"
                      data-testid={`nfl-fantasy-ingest-run-row-${r.id}`}
                    >
                      <td className="px-3 py-2 text-gray-500">
                        {new Date(r.startedAt).toLocaleString("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-700">
                        {r.source}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-700">
                        {r.weekId ?? "—"}
                      </td>
                      <td className="px-3 py-2">{statusBadge(r.status)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">
                        {formatDuration(r.durationMs)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {summarizeResult(r.result)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => toggle(r.id)}
                          className="text-xs text-nuffle-bronze hover:underline"
                        >
                          {open ? "▼" : "▶"}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-3 py-3">
                          <pre className="max-h-80 overflow-auto rounded bg-white p-3 text-[10px] text-gray-700">
                            {JSON.stringify(r.result, null, 2)}
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

      <p className="text-xs text-gray-500">
        💡 Pour relancer une ingestion ratée, utilise l'onglet{" "}
        <Link
          href="/admin/nfl-fantasy"
          className="text-nuffle-bronze hover:underline"
        >
          Actions
        </Link>{" "}
        (« Ingest nflverse W
        {"{n}"} » ou « ESPN gameday »).
      </p>
    </div>
  );
}
