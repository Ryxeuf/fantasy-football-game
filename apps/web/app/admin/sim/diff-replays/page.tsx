"use client";

/**
 * Console admin — replay diff event-by-event (Lot 4.F).
 *
 * Wrappe le CLI `pnpm sim:diff-replays` (PR #725) en HTML : 2 inputs
 * matchId, le serveur charge les Replay.payload, decompresse, runne
 * `diffReplayEvents`. Render des metadonnees match + listing des
 * divergences avec colorisation par kind.
 */

import Link from "next/link";
import { useState } from "react";
import { API_BASE } from "../../../auth-client";

type DivergenceKind = "mismatch" | "missing_a" | "missing_b";

interface MatchEventLite {
  type: string;
  displayAtMs: number;
  meta?: Record<string, unknown>;
}

interface ReplayDivergence {
  index: number;
  kind: DivergenceKind;
  a: MatchEventLite | null;
  b: MatchEventLite | null;
}

interface ReplayDiffSummary {
  totalA: number;
  totalB: number;
  matchedCount: number;
  divergenceCount: number;
  firstDivergenceIndex: number | null;
}

interface MatchMeta {
  id: string;
  engineVer: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
}

interface ReplayDiffResult {
  matchA: MatchMeta;
  matchB: MatchMeta;
  diff: {
    divergences: ReplayDivergence[];
    summary: ReplayDiffSummary;
  };
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function describeEvent(e: MatchEventLite | null): string {
  if (!e) return "(none)";
  const metaStr = JSON.stringify(e.meta ?? {});
  const trimmed = metaStr.length > 60 ? `${metaStr.slice(0, 60)}…` : metaStr;
  return `${e.type} @${e.displayAtMs}ms ${trimmed}`;
}

function kindColor(k: DivergenceKind): string {
  if (k === "mismatch") return "bg-yellow-50 text-yellow-900";
  if (k === "missing_a") return "bg-blue-50 text-blue-900";
  return "bg-purple-50 text-purple-900"; // missing_b
}

export default function AdminDiffReplaysPage() {
  const [matchIdA, setMatchIdA] = useState<string>("");
  const [matchIdB, setMatchIdB] = useState<string>("");
  const [maxDivergences, setMaxDivergences] = useState<number>(50);
  const [result, setResult] = useState<ReplayDiffResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const diff = async (): Promise<void> => {
    if (!matchIdA || !matchIdB) {
      setError("Renseigne 2 matchIds.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await postJSON<ReplayDiffResult>(
        "/admin/sim/diff-replays",
        { matchIdA, matchIdB, maxDivergences },
      );
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Sim engine — replay diff</h1>
      <p className="text-sm text-gray-600 mb-4">
        Diff event-par-event entre 2 replays produits avec le même seed sur
        2 versions / 2 refacto. Sert à pointer précisément où la simulation
        diverge.
      </p>

      <div className="grid grid-cols-3 gap-3 items-end mb-4 p-4 border rounded bg-white">
        <label className="text-sm">
          <div className="mb-1">Match ID A</div>
          <input
            type="text"
            value={matchIdA}
            onChange={(e) => setMatchIdA(e.target.value.trim())}
            placeholder="cuid…"
            className="w-full border rounded p-2 font-mono text-xs"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1">Match ID B</div>
          <input
            type="text"
            value={matchIdB}
            onChange={(e) => setMatchIdB(e.target.value.trim())}
            placeholder="cuid…"
            className="w-full border rounded p-2 font-mono text-xs"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1">Max divergences à charger</div>
          <input
            type="number"
            min={1}
            max={1000}
            step={10}
            value={maxDivergences}
            onChange={(e) => setMaxDivergences(Number(e.target.value))}
            className="w-full border rounded p-2"
          />
        </label>
        <div className="col-span-3 flex justify-end">
          <button
            onClick={() => void diff()}
            disabled={loading || matchIdA === matchIdB}
            className="px-4 py-2 rounded bg-nuffle-gold text-white font-medium disabled:opacity-50"
          >
            {loading ? "Compute…" : "Diff replays"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 border border-red-300 bg-red-50 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="p-3 border rounded bg-gray-50 text-sm">
              <div className="font-medium">Match A</div>
              <div>id: <code className="text-xs">{result.matchA.id}</code></div>
              <div>engineVer: <code>{result.matchA.engineVer ?? "—"}</code></div>
              <div>
                score: {result.matchA.scoreHome ?? "—"} -{" "}
                {result.matchA.scoreAway ?? "—"}
              </div>
            </div>
            <div className="p-3 border rounded bg-gray-50 text-sm">
              <div className="font-medium">Match B</div>
              <div>id: <code className="text-xs">{result.matchB.id}</code></div>
              <div>engineVer: <code>{result.matchB.engineVer ?? "—"}</code></div>
              <div>
                score: {result.matchB.scoreHome ?? "—"} -{" "}
                {result.matchB.scoreAway ?? "—"}
              </div>
            </div>
          </div>

          <div className="mb-4 p-3 border rounded bg-gray-50 text-sm">
            totalA = <strong>{result.diff.summary.totalA}</strong> · totalB ={" "}
            <strong>{result.diff.summary.totalB}</strong> · matched ={" "}
            <strong>{result.diff.summary.matchedCount}</strong> · divergences ={" "}
            <strong className="text-red-700">
              {result.diff.summary.divergenceCount}
            </strong>{" "}
            · first divergence index ={" "}
            <strong>
              {result.diff.summary.firstDivergenceIndex ?? "none"}
            </strong>
          </div>

          {result.diff.divergences.length === 0 ? (
            <div className="text-sm text-green-700">
              Pas de divergence détectée. Replays identiques.
            </div>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b bg-gray-100">
                  <th className="text-left p-2">idx</th>
                  <th className="text-left p-2">kind</th>
                  <th className="text-left p-2">A</th>
                  <th className="text-left p-2">B</th>
                </tr>
              </thead>
              <tbody>
                {result.diff.divergences.map((d) => (
                  <tr
                    key={`${d.index}-${d.kind}`}
                    className={`border-b ${kindColor(d.kind)}`}
                  >
                    <td className="p-2 font-mono">{d.index}</td>
                    <td className="p-2 uppercase">{d.kind}</td>
                    <td className="p-2 font-mono">{describeEvent(d.a)}</td>
                    <td className="p-2 font-mono">{describeEvent(d.b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {result.diff.divergences.length <
            result.diff.summary.divergenceCount && (
            <div className="mt-2 text-xs text-gray-500">
              … {result.diff.summary.divergenceCount -
                result.diff.divergences.length}{" "}
              autres divergences cappées (augmente Max divergences).
            </div>
          )}
        </div>
      )}

      <div className="mt-6 text-xs text-gray-500">
        <Link
          href={"/admin/sim/compare-versions" as never}
          className="underline mr-3"
        >
          → Cross-version compare
        </Link>
        <Link href={"/admin/sim/health" as never} className="underline">
          → Sim health dashboard
        </Link>
      </div>
    </div>
  );
}
