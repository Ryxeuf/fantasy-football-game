"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../../lib/api-client";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useWallet } from "../../../lib/use-wallet";

import { WalletBadge } from "../../_components/WalletBadge";

/**
 * Historique des paris utilisateur — sprint 1.D.7.
 *
 * Affiche les paris passés (status pending/won/lost) avec :
 *  - Match + selection + cote figée
 *  - Mise + payout (si gagné)
 *  - Badge couleur selon status
 *  - Lien vers la page match
 */

interface BetRow {
  readonly id: string;
  readonly userId: string;
  readonly marketId: string;
  readonly marketType: string;
  readonly matchId: string;
  readonly selection: string;
  readonly stake: number;
  readonly oddsAtPlace: number;
  readonly status: string;
  readonly payoutAmount: number | null;
  readonly clientToken: string;
  readonly createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-slate-700 text-slate-100",
  won: "bg-emerald-700 text-emerald-50",
  lost: "bg-rose-700 text-rose-50",
  void: "bg-amber-700 text-amber-50",
};

interface MyBetsT {
  selectionHome: string;
  selectionDraw: string;
  selectionAway: string;
  selectionOver: string;
  selectionUnder: string;
  selectionYes: string;
  selectionNo: string;
  labelMarketOneXTwo: string;
  labelMarketOverUnderTd: string;
  labelMarketCasCount: string;
  labelMarketNuffleOccurs: string;
}

function selectionLabel(
  marketType: string,
  selection: string,
  m: MyBetsT,
): string {
  if (marketType === "ONE_X_TWO") {
    if (selection === "home") return m.selectionHome;
    if (selection === "draw") return m.selectionDraw;
    if (selection === "away") return m.selectionAway;
  }
  if (marketType === "OVER_UNDER_TD" || marketType === "CAS_COUNT") {
    if (selection === "over") return m.selectionOver;
    if (selection === "under") return m.selectionUnder;
  }
  if (marketType === "NUFFLE_OCCURS") {
    if (selection === "yes") return m.selectionYes;
    if (selection === "no") return m.selectionNo;
  }
  return selection;
}

function marketLabel(marketType: string, m: MyBetsT): string {
  switch (marketType) {
    case "ONE_X_TWO":
      return m.labelMarketOneXTwo;
    case "OVER_UNDER_TD":
      return m.labelMarketOverUnderTd;
    case "CAS_COUNT":
      return m.labelMarketCasCount;
    case "NUFFLE_OCCURS":
      return m.labelMarketNuffleOccurs;
    default:
      return marketType;
  }
}

export default function MyBetsPage(): JSX.Element {
  const { t, language } = useLanguage();
  const localeTag = language === "fr" ? "fr-FR" : "en-US";
  const wallet = useWallet();
  const [bets, setBets] = useState<readonly BetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    apiRequest<{ bets: readonly BetRow[] }>("/pro-league/me/bets?limit=50")
      .then((d) => {
        if (cancelled) return;
        setBets(d.bets);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiClientError && e.status === 401) {
          setNeedsAuth(true);
          return;
        }
        const msg = e instanceof Error ? e.message : "fetch error";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wide text-slate-50">
          {t.proLeague.myBets.title}
        </h1>
        <div className="flex items-center gap-2">
          <WalletBadge />
          <Link
            href="/pro-league/me/wallet"
            className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
          >
            Wallet →
          </Link>
          <Link
            href="/pro-league"
            className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t.proLeague.common.backToHub}
          </Link>
        </div>
      </header>

      {wallet.authed ? (
        <section className="mb-6 rounded border border-slate-800 bg-slate-900 px-4 py-3">
          <p className="text-xs uppercase text-slate-500">
            {t.proLeague.myBets.balanceLabel}
          </p>
          <p className="font-mono text-2xl font-bold text-emerald-300">
            {wallet.balance}{" "}
            <span className="text-sm text-slate-400">
              {t.proLeague.wallet.crowns}
            </span>
          </p>
        </section>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">{t.proLeague.common.loading}</p>
      ) : needsAuth ? (
        <p
          data-testid="auth-required"
          className="rounded border border-amber-700 bg-amber-950 px-3 py-2 text-sm text-amber-200"
        >
          {t.proLeague.myBets.authRequired}
        </p>
      ) : error ? (
        <p
          role="alert"
          className="rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : bets.length === 0 ? (
        <p
          data-testid="empty-bets"
          className="rounded border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-400"
        >
          {t.proLeague.myBets.empty}
        </p>
      ) : (
        <ol data-testid="bets-list" className="flex flex-col gap-2">
          {bets.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
            >
              <div className="flex flex-col">
                <Link
                  href={`/pro-league/matches/${b.matchId}`}
                  className="text-slate-100 hover:text-emerald-300"
                >
                  {marketLabel(b.marketType, t.proLeague.myBets)} ·{" "}
                  {selectionLabel(
                    b.marketType,
                    b.selection,
                    t.proLeague.myBets,
                  )}
                </Link>
                <span className="text-xs text-slate-500">
                  {t.proLeague.myBets.oddsMise
                    .replace("{odds}", b.oddsAtPlace.toFixed(2))
                    .replace("{stake}", String(b.stake))}{" "}
                  ·{" "}
                  {new Date(b.createdAt).toLocaleString(localeTag, {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-mono uppercase ${STATUS_BADGE[b.status] ?? STATUS_BADGE.pending}`}
                >
                  {b.status}
                </span>
                {b.status === "won" && b.payoutAmount !== null ? (
                  <span className="font-mono text-sm font-bold text-emerald-300">
                    +{b.payoutAmount}
                  </span>
                ) : null}
                {b.status === "lost" ? (
                  <span className="font-mono text-sm text-rose-300">
                    -{b.stake}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
