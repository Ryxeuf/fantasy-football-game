"use client";

/**
 * Page wallet utilisateur Pro League — Lot N.
 *
 * Surface l'API `GET /pro-league/me/wallet` :
 *  - Solde courant (Crowns)
 *  - Daily bonus claim (delegé au WalletBadge)
 *  - Ledger des 20 dernières transactions (BET/WIN/REWARD/DAILY/BADGE)
 *
 * Ferme le gap UX laissé par les sprints 1.D.* : la route et le service
 * `pro-wallet` sont prêts depuis Lot 1.D.6 mais aucune UI ne consomme
 * la liste des transactions. Le coach voit maintenant ses débits
 * (BET) et crédits (WIN/REWARD/BADGE) avec date + référence.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../../lib/api-client";
import { useWallet } from "../../../lib/use-wallet";

import { WalletBadge } from "../../_components/WalletBadge";

type ProTxType = "BET" | "WIN" | "REWARD" | "DAILY" | "BADGE";

interface TxRow {
  id: string;
  type: ProTxType;
  amount: number;
  ref: string | null;
  createdAt: string;
}

interface WalletSnapshotResponse {
  balance: number;
  transactions: TxRow[];
}

/**
 * Lot N — couleurs par type de transaction. Le BET est rouge (débit
 * volontaire), le WIN vert vif (crédit gagné), REWARD/DAILY/BADGE
 * en doré/bleu pour distinguer la nature.
 */
const TX_TYPE_STYLES: Record<ProTxType, { label: string; row: string }> = {
  BET: { label: "Pari", row: "text-rose-300" },
  WIN: { label: "Gain", row: "text-emerald-300" },
  REWARD: { label: "Récompense", row: "text-amber-300" },
  DAILY: { label: "Bonus quotidien", row: "text-sky-300" },
  BADGE: { label: "Badge", row: "text-fuchsia-300" },
};

function formatAmount(type: ProTxType, amount: number): string {
  // BET stocke `amount > 0` mais représente un débit. WIN/REWARD/DAILY/BADGE
  // sont des crédits. On signe pour la lisibilité.
  const sign = type === "BET" ? "−" : "+";
  return `${sign}${amount.toLocaleString("fr-FR")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Lien dérivé du `ref` de transaction quand on peut deviner le type. */
function refLink(type: ProTxType, ref: string | null): JSX.Element | null {
  if (!ref) return null;
  if (type === "BET" || type === "WIN") {
    // Le ref pour BET/WIN est le betId. Pas de page bet directe, on
    // pointe vers la liste de paris.
    return (
      <Link
        href="/pro-league/me/bets"
        className="text-xs text-slate-500 hover:text-slate-300"
      >
        bet#{ref.slice(0, 6)}
      </Link>
    );
  }
  return (
    <span className="text-xs text-slate-500" title={ref}>
      {ref.slice(0, 16)}
      {ref.length > 16 ? "…" : ""}
    </span>
  );
}

export default function ProLeagueWalletPage(): JSX.Element {
  const wallet = useWallet();
  const [data, setData] = useState<WalletSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<WalletSnapshotResponse>("/pro-league/me/wallet")
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiClientError && e.status === 401) {
          setError("Connecte-toi pour voir ton wallet.");
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
  }, [wallet.balance]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-wide text-slate-50">
            Mon wallet
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Solde Crowns + 20 dernières transactions.
          </p>
        </div>
        <WalletBadge />
      </header>

      <nav className="mb-6 flex flex-wrap gap-3 text-xs text-slate-500">
        <Link
          href="/pro-league"
          className="rounded border border-slate-700 px-3 py-1 hover:bg-slate-800"
        >
          ← Hub Pro League
        </Link>
        <Link
          href="/pro-league/me/bets"
          className="rounded border border-slate-700 px-3 py-1 hover:bg-slate-800"
        >
          → Mes paris
        </Link>
      </nav>

      {loading ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : error ? (
        <p
          role="alert"
          className="rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : !data ? null : (
        <>
          <section
            data-testid="wallet-balance"
            className="mb-6 rounded border border-amber-700 bg-amber-950/30 px-4 py-4"
          >
            <div className="text-xs uppercase text-amber-400">Solde</div>
            <div className="mt-1 font-mono text-4xl text-amber-100">
              {data.balance.toLocaleString("fr-FR")}{" "}
              <span className="text-base text-amber-300">Crowns</span>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-100">
              Transactions récentes
            </h2>
            {data.transactions.length === 0 ? (
              <p
                data-testid="wallet-empty"
                className="rounded border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-400"
              >
                Aucune transaction. Les paris et bonus apparaîtront ici.
              </p>
            ) : (
              <ul
                data-testid="wallet-transactions"
                className="divide-y divide-slate-800 rounded border border-slate-800"
              >
                {data.transactions.map((tx) => {
                  const meta = TX_TYPE_STYLES[tx.type] ?? {
                    label: tx.type,
                    row: "text-slate-300",
                  };
                  return (
                    <li
                      key={tx.id}
                      data-testid={`wallet-tx-${tx.type.toLowerCase()}`}
                      className="flex items-center justify-between bg-slate-900 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-28 font-medium ${meta.row}`}
                          title={tx.type}
                        >
                          {meta.label}
                        </span>
                        {refLink(tx.type, tx.ref)}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">
                          {formatDate(tx.createdAt)}
                        </span>
                        <span
                          className={`w-20 text-right font-mono ${meta.row}`}
                        >
                          {formatAmount(tx.type, tx.amount)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
