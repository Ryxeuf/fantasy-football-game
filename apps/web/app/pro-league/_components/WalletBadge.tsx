"use client";

import Link from "next/link";
import { useState } from "react";

import { useLanguage } from "../../contexts/LanguageContext";
import { useWallet } from "../../lib/use-wallet";

/**
 * Pastille wallet affichée sur la page hub / autres pages Pro League
 * — sprint 1.D.7. Affiche :
 *  - le solde courant en Crowns
 *  - un bouton "Bonus quotidien" si dispo
 *  - un toast inline après claim ("+50 ✓")
 *
 * Masquée si `wallet.authed === false`.
 */

export function WalletBadge(): JSX.Element | null {
  const { t } = useLanguage();
  const wallet = useWallet();
  const [toast, setToast] = useState<string | null>(null);

  if (!wallet.authed && !wallet.loading) return null;

  const handleClaim = async (): Promise<void> => {
    const out = await wallet.claimDaily();
    if (out.granted) {
      setToast(
        t.proLeague.wallet.toastClaim.replace("{amount}", String(out.amount)),
      );
      window.setTimeout(() => setToast(null), 2_500);
    }
  };

  return (
    <div
      data-testid="wallet-badge"
      className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs"
    >
      <Link
        href="/pro-league/me/bets"
        className="flex items-center gap-1 text-slate-300 hover:text-slate-100"
      >
        <span aria-hidden>👑</span>
        <span className="font-mono font-bold text-emerald-300">
          {wallet.loading ? "…" : wallet.balance}
        </span>
        <span className="text-slate-500">{t.proLeague.wallet.crowns}</span>
      </Link>
      {wallet.dailyAvailable ? (
        <button
          type="button"
          data-testid="claim-daily"
          onClick={() => {
            void handleClaim();
          }}
          className="rounded bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-600"
        >
          {t.proLeague.wallet.claimDaily}
        </button>
      ) : null}
      {toast ? (
        <span
          role="status"
          data-testid="claim-toast"
          className="rounded bg-emerald-800 px-2 py-0.5 text-emerald-100"
        >
          {toast}
        </span>
      ) : null}
    </div>
  );
}
