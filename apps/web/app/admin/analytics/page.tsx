"use client";

/**
 * Page admin Analytics — Sprint P (Lot P.C.3).
 *
 * Affiche 4 metriques business :
 *   - DAU last 24h + delta jour-jour.
 *   - MAU rolling 30j + delta mois-mois.
 *   - Funnel signups → equipe → premier match (conversion %).
 *   - Crowns IN / OUT / net inflation + total supply.
 *
 * Surface admin-only (gating via `/admin/*` middleware serveur). Pas
 * de chart lib pour rester leger — affichage en cards lisibles.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../lib/api-client";

interface AnalyticsSnapshot {
  computedAt: string;
  dau: { count: number; prevCount: number; deltaPct: number };
  mau: { count: number; prevCount: number; deltaPct: number };
  signupFunnel: {
    signups: number;
    windowDays: number;
    withTeam: number;
    withMatch: number;
    conversionTeam: number;
    conversionFirstMatch: number;
  };
  crowns: {
    windowDays: number;
    totalIn: number;
    totalOut: number;
    netInflation: number;
    currentSupply: number;
  };
}

function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR");
}

function formatDelta(pct: number): { label: string; tone: string } {
  if (pct > 0) {
    return { label: `+${pct}%`, tone: "text-emerald-600" };
  }
  if (pct < 0) {
    return { label: `${pct}%`, tone: "text-rose-600" };
  }
  return { label: "=", tone: "text-slate-500" };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface MetricCardProps {
  readonly label: string;
  readonly value: number;
  readonly deltaPct?: number;
  readonly subtitle?: string;
  readonly testId?: string;
}

function MetricCard({
  label,
  value,
  deltaPct,
  subtitle,
  testId,
}: MetricCardProps): JSX.Element {
  const delta = deltaPct === undefined ? null : formatDelta(deltaPct);
  return (
    <div
      data-testid={testId}
      className="rounded border bg-white p-4 shadow-sm"
    >
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 font-mono text-3xl font-bold text-gray-900">
        {formatNumber(value)}
      </div>
      {delta && (
        <div className={`mt-1 text-sm font-semibold ${delta.tone}`}>
          {delta.label} <span className="text-xs text-gray-400">vs précédent</span>
        </div>
      )}
      {subtitle && (
        <div className="mt-1 text-xs text-gray-500">{subtitle}</div>
      )}
    </div>
  );
}

export default function AdminAnalyticsPage(): JSX.Element {
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<AnalyticsSnapshot>("/admin/analytics")
      .then((s) => {
        if (cancelled) return;
        setData(s);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Analytics — Tableau de bord
          </h1>
          {data && (
            <p className="mt-1 text-xs text-gray-500">
              Calculé le {formatDate(data.computedAt)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRefreshTick((n) => n + 1)}
            disabled={loading}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "…" : "Rafraîchir"}
          </button>
          <Link
            href="/admin"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            ← Admin
          </Link>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      {loading && !data && (
        <p className="text-sm text-gray-500">Chargement…</p>
      )}

      {data && (
        <>
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">
              Activité utilisateurs
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                testId="metric-dau"
                label="Daily Active Users (24h)"
                value={data.dau.count}
                deltaPct={data.dau.deltaPct}
                subtitle={`vs ${formatNumber(data.dau.prevCount)} il y a 24h`}
              />
              <MetricCard
                testId="metric-mau"
                label="Monthly Active Users (30j)"
                value={data.mau.count}
                deltaPct={data.mau.deltaPct}
                subtitle={`vs ${formatNumber(data.mau.prevCount)} le mois précédent`}
              />
            </div>
          </section>

          <section className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">
              Funnel signups (
              {data.signupFunnel.windowDays} derniers jours)
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                testId="metric-signups"
                label="Signups"
                value={data.signupFunnel.signups}
                subtitle="Nouveaux comptes créés"
              />
              <MetricCard
                testId="metric-with-team"
                label="→ équipe créée"
                value={data.signupFunnel.withTeam}
                subtitle={`${data.signupFunnel.conversionTeam}% de conversion`}
              />
              <MetricCard
                testId="metric-with-match"
                label="→ premier match joué"
                value={data.signupFunnel.withMatch}
                subtitle={`${data.signupFunnel.conversionFirstMatch}% de conversion`}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-800">
              Économie Crowns ({data.crowns.windowDays} derniers jours)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                testId="metric-crowns-in"
                label="Crowns émis (IN)"
                value={data.crowns.totalIn}
                subtitle="REWARD + DAILY + WIN + BADGE"
              />
              <MetricCard
                testId="metric-crowns-out"
                label="Crowns dépensés (OUT)"
                value={data.crowns.totalOut}
                subtitle="BET + SINK"
              />
              <MetricCard
                testId="metric-crowns-net"
                label="Inflation nette"
                value={data.crowns.netInflation}
                subtitle={
                  data.crowns.netInflation > 0
                    ? "Inflation positive — surveiller"
                    : "Économie saine"
                }
              />
              <MetricCard
                testId="metric-crowns-supply"
                label="Supply totale"
                value={data.crowns.currentSupply}
                subtitle="Tous wallets confondus"
              />
            </div>
            {data.crowns.netInflation > 0 && (
              <p
                role="status"
                className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
              >
                ⚠ L&apos;inflation est positive sur la fenêtre. Considérer
                d&apos;ajouter des sinks (lot P.B.2 et suivants) ou
                réduire les bonus si la tendance persiste.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
