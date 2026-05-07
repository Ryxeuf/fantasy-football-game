"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";

import { WalletBadge } from "../_components/WalletBadge";

/**
 * Leaderboard parieurs Pro League — sprint 1.D.8.
 *
 * 3 périodes (weekly / season / all-time) sélectionnées via tabs.
 * Affichage table : rang, coach, profit, accuracy, streak, biggest win.
 */

type Period = "weekly" | "season" | "all-time";

interface LeaderboardEntry {
  readonly rank: number;
  readonly userId: string;
  readonly coachName: string;
  readonly betsCount: number;
  readonly settledCount: number;
  readonly wonCount: number;
  readonly accuracy: number;
  readonly profit: number;
  readonly longestStreak: number;
  readonly biggestWin: number;
}

interface LeaderboardData {
  readonly period: Period;
  readonly fromAt: string | null;
  readonly entries: readonly LeaderboardEntry[];
  readonly limit: number;
  readonly offset: number;
}

const PERIODS: readonly Period[] = ["weekly", "season", "all-time"];

function profitColorClass(p: number): string {
  if (p > 0) return "text-emerald-300";
  if (p < 0) return "text-rose-300";
  return "text-slate-400";
}

function formatProfit(p: number): string {
  if (p > 0) return `+${p}`;
  return `${p}`;
}

export default function LeaderboardPage(): JSX.Element {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("season");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const periodLabel = (p: Period): string => {
    if (p === "weekly") return t.proLeague.leaderboard.periodWeekly;
    if (p === "season") return t.proLeague.leaderboard.periodSeason;
    return t.proLeague.leaderboard.periodAllTime;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<LeaderboardData>(
      `/pro-league/leaderboard?period=${period}&limit=20`,
    )
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "fetch error";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wide text-slate-50">
          {t.proLeague.leaderboard.title}
        </h1>
        <div className="flex items-center gap-2">
          <WalletBadge />
          <Link
            href="/pro-league"
            className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t.proLeague.common.backToHub}
          </Link>
        </div>
      </header>

      <div
        data-testid="period-tabs"
        className="mb-4 flex gap-1 rounded border border-slate-800 bg-slate-900 p-1"
      >
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            data-testid={`period-${p}`}
            className={`flex-1 rounded px-3 py-1.5 text-sm ${
              period === p
                ? "bg-emerald-700 text-emerald-50 font-semibold"
                : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            {periodLabel(p)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">{t.proLeague.common.loading}</p>
      ) : error ? (
        <p
          role="alert"
          className="rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : !data || data.entries.length === 0 ? (
        <p
          data-testid="empty-leaderboard"
          className="rounded border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-400"
        >
          {t.proLeague.leaderboard.emptyState}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-800">
          <table data-testid="leaderboard-table" className="w-full text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="w-12 px-2 py-2 text-left">
                  {t.proLeague.leaderboard.thRank}
                </th>
                <th className="px-2 py-2 text-left">
                  {t.proLeague.leaderboard.thCoach}
                </th>
                <th className="w-16 px-2 py-2 text-center">
                  {t.proLeague.leaderboard.thBets}
                </th>
                <th className="w-20 px-2 py-2 text-center">
                  {t.proLeague.leaderboard.thProfit}
                </th>
                <th className="w-16 px-2 py-2 text-center">
                  {t.proLeague.leaderboard.thAccuracy}
                </th>
                <th className="w-16 px-2 py-2 text-center">
                  {t.proLeague.leaderboard.thStreak}
                </th>
                <th className="w-20 px-2 py-2 text-center">
                  {t.proLeague.leaderboard.thBiggest}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr
                  key={e.userId}
                  className="border-t border-slate-800 hover:bg-slate-900"
                >
                  <td className="px-2 py-2 font-mono text-slate-400">
                    {e.rank}
                  </td>
                  <td className="px-2 py-2 font-medium text-slate-100">
                    {e.coachName}
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-slate-400">
                    {e.betsCount}
                  </td>
                  <td
                    className={`px-2 py-2 text-center font-mono font-bold ${profitColorClass(e.profit)}`}
                  >
                    {formatProfit(e.profit)}
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-slate-300">
                    {e.accuracy}%
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-emerald-300">
                    {e.longestStreak}
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-emerald-300">
                    {e.biggestWin > 0 ? `+${e.biggestWin}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
