"use client";

/**
 * Console admin — cross-version baseline comparator (Lot 4.F).
 *
 * Wrappe le CLI `pnpm sim:compare-versions` (PR #722) en HTML : 2
 * inputs file pour les snapshots `bench-baseline.json`, render
 * du `VersionComparisonResult` avec table per-pairing colorée par
 * severity (warn / critical).
 *
 * Workflow recommandé :
 *   1. git checkout v0.15.0 ; pnpm sim:bench:snapshot > /tmp/v0.15.0.json
 *   2. git checkout v0.16.0 ; pnpm sim:bench:snapshot > /tmp/v0.16.0.json
 *   3. Drop les 2 fichiers ici → rapport instantané.
 */

import Link from "next/link";
import { useState } from "react";
import { API_BASE } from "../../../auth-client";

interface ExpectedMetrics {
  tdMean: number;
  tdStd: number;
  casualtyMean: number;
  turnoverMean: number;
  homeWinRate: number;
  awayWinRate: number;
  drawRate: number;
}

interface PairingDelta {
  homeId: string;
  awayId: string;
  base: ExpectedMetrics;
  head: ExpectedMetrics;
  deltas: ExpectedMetrics;
  severity: "normal" | "warn" | "critical";
  maxAbsRelativeDelta: number;
}

interface ComparisonResult {
  base: { engineVer: string; snapshotAt: string };
  head: { engineVer: string; snapshotAt: string };
  pairings: PairingDelta[];
  summary: {
    maxAbsDeltaByMetric: ExpectedMetrics;
    missingInBase: Array<{ homeId: string; awayId: string }>;
    missingInHead: Array<{ homeId: string; awayId: string }>;
    matchedPairings: number;
    warnCount: number;
    criticalCount: number;
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

function readFileAsJson(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result ?? "")));
      } catch (err) {
        reject(new Error(`JSON parse failed: ${(err as Error).message}`));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function fmtSigned(n: number, digits = 2): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}`;
}

function severityColor(s: PairingDelta["severity"]): string {
  if (s === "critical") return "bg-red-100 text-red-900";
  if (s === "warn") return "bg-yellow-100 text-yellow-900";
  return "";
}

export default function AdminCompareVersionsPage() {
  const [baseRaw, setBaseRaw] = useState<unknown>(null);
  const [headRaw, setHeadRaw] = useState<unknown>(null);
  const [baseName, setBaseName] = useState<string>("");
  const [headName, setHeadName] = useState<string>("");
  const [warnPct, setWarnPct] = useState<number>(10);
  const [criticalPct, setCriticalPct] = useState<number>(25);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleBaseUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const json = await readFileAsJson(f);
      setBaseRaw(json);
      setBaseName(f.name);
      setError(null);
    } catch (err) {
      setError(`base: ${(err as Error).message}`);
    }
  };

  const handleHeadUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const json = await readFileAsJson(f);
      setHeadRaw(json);
      setHeadName(f.name);
      setError(null);
    } catch (err) {
      setError(`head: ${(err as Error).message}`);
    }
  };

  const compare = async (): Promise<void> => {
    if (!baseRaw || !headRaw) {
      setError("Charge les 2 baselines (base + head).");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await postJSON<ComparisonResult>(
        "/admin/sim/compare-versions",
        {
          baseRaw,
          headRaw,
          warnThreshold: warnPct / 100,
          criticalThreshold: criticalPct / 100,
        },
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
      <h1 className="text-2xl font-bold mb-2">
        Sim engine — cross-version comparator
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        Compare deux snapshots <code>bench-baseline.json</code> produits sur
        des <code>engineVer</code> différents et visualise la drift par
        pairing. Workflow : <code>pnpm sim:bench:snapshot</code> sur 2
        versions, charge les fichiers, click compare.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4 p-4 border rounded bg-white">
        <label className="text-sm">
          <div className="mb-1 font-medium">Base baseline (ancienne version)</div>
          <input
            type="file"
            accept=".json"
            onChange={(e) => void handleBaseUpload(e)}
            className="w-full"
          />
          {baseName && (
            <div className="mt-1 text-xs text-gray-500">{baseName}</div>
          )}
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Head baseline (nouvelle version)</div>
          <input
            type="file"
            accept=".json"
            onChange={(e) => void handleHeadUpload(e)}
            className="w-full"
          />
          {headName && (
            <div className="mt-1 text-xs text-gray-500">{headName}</div>
          )}
        </label>

        <label className="text-sm">
          <div className="mb-1">Warn threshold (% relatif)</div>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={warnPct}
            onChange={(e) => setWarnPct(Number(e.target.value))}
            className="w-full border rounded p-2"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1">Critical threshold (% relatif)</div>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={criticalPct}
            onChange={(e) => setCriticalPct(Number(e.target.value))}
            className="w-full border rounded p-2"
          />
        </label>

        <div className="col-span-2 flex justify-end">
          <button
            onClick={() => void compare()}
            disabled={loading || !baseRaw || !headRaw}
            className="px-4 py-2 rounded bg-nuffle-gold text-white font-medium disabled:opacity-50"
          >
            {loading ? "Compute…" : "Compare"}
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
          <div className="mb-4 p-3 border rounded bg-gray-50 text-sm">
            <div>
              base: <code>{result.base.engineVer}</code> (snapshot{" "}
              {result.base.snapshotAt})
            </div>
            <div>
              head: <code>{result.head.engineVer}</code> (snapshot{" "}
              {result.head.snapshotAt})
            </div>
            <div>
              matched pairings :{" "}
              <strong>{result.summary.matchedPairings}</strong> · warn :{" "}
              <strong className="text-yellow-700">
                {result.summary.warnCount}
              </strong>{" "}
              · critical :{" "}
              <strong className="text-red-700">
                {result.summary.criticalCount}
              </strong>
            </div>
          </div>

          {result.pairings.length > 0 && (
            <table className="w-full border-collapse text-sm mb-4">
              <thead>
                <tr className="border-b bg-gray-100">
                  <th className="text-left p-2">Pairing</th>
                  <th className="text-right p-2">tdMean Δ</th>
                  <th className="text-right p-2">casMean Δ</th>
                  <th className="text-right p-2">homeWin Δ</th>
                  <th className="text-right p-2">awayWin Δ</th>
                  <th className="text-right p-2">max abs (rel)</th>
                  <th className="text-right p-2">severity</th>
                </tr>
              </thead>
              <tbody>
                {result.pairings.map((p) => (
                  <tr
                    key={`${p.homeId}__${p.awayId}`}
                    className={`border-b ${severityColor(p.severity)}`}
                  >
                    <td className="p-2">
                      {p.homeId} vs {p.awayId}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {fmtSigned(p.deltas.tdMean)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {fmtSigned(p.deltas.casualtyMean)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {fmtSigned(p.deltas.homeWinRate, 3)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {fmtSigned(p.deltas.awayWinRate, 3)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {(p.maxAbsRelativeDelta * 100).toFixed(1)}%
                    </td>
                    <td className="p-2 text-right uppercase">{p.severity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {result.summary.missingInBase.length > 0 && (
            <div className="mb-2 text-sm">
              <strong>Nouveaux pairings dans head :</strong>{" "}
              {result.summary.missingInBase
                .map((p) => `${p.homeId} vs ${p.awayId}`)
                .join(", ")}
            </div>
          )}
          {result.summary.missingInHead.length > 0 && (
            <div className="mb-2 text-sm">
              <strong>Pairings retirés de head :</strong>{" "}
              {result.summary.missingInHead
                .map((p) => `${p.homeId} vs ${p.awayId}`)
                .join(", ")}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 text-xs text-gray-500">
        <Link
          href={"/admin/sim/diff-replays" as never}
          className="underline mr-3"
        >
          → Replay diff
        </Link>
        <Link href={"/admin/sim/health" as never} className="underline">
          → Sim health dashboard
        </Link>
      </div>
    </div>
  );
}
