"use client";

import Link from "next/link";
import { useCrowns } from "../../contexts/CrownsContext";
import { useDiceTheme } from "../../contexts/DiceThemeContext";
import { describeCrownsTransaction, formatCrowns, formatCrownsDelta } from "../../lib/crowns";
import { HowToEarnCrowns } from "../../components/crowns/HowToEarnCrowns";

/** Nombre d'opérations montrées sur le profil (le serveur en sert 20). */
const RECENT_COUNT = 5;

/**
 * « Mes Couronnes » : solde et dernières opérations du coach.
 * Masquée quand le flag `crowns` est OFF.
 */
export default function CrownsCard() {
  const { enabled, loading, balance, transactions, schedule } = useCrowns();
  const { enabled: diceThemesEnabled, themes } = useDiceTheme();
  if (!enabled) return null;

  const themeName = (id: string) => themes.find((t) => t.id === id)?.name.fr;
  const recent = transactions.slice(0, RECENT_COUNT);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6" data-testid="crowns-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-bold">👑 Mes Couronnes</h3>
        <span className="text-2xl font-heading font-bold text-nuffle-bronze" data-testid="crowns-card-balance">
          {balance === null ? (loading ? "…" : "—") : `${formatCrowns(balance)} Crowns`}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        La monnaie de Nuffle Arena : elle se gagne en jouant et sert à acheter des thèmes de dés.
      </p>
      <HowToEarnCrowns schedule={schedule ?? null} className="mt-4" />

      {recent.length > 0 ? (
        <ul className="mt-4 divide-y divide-gray-100" data-testid="crowns-card-history">
          {recent.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-gray-700">
                {describeCrownsTransaction(tx, themeName)}
                <span className="ml-2 text-xs text-gray-400">
                  {new Date(tx.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </span>
              <span className={`font-mono font-semibold ${tx.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>
                {formatCrownsDelta(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        !loading && <p className="mt-4 text-sm text-gray-500">Aucune opération pour l&apos;instant.</p>
      )}

      {diceThemesEnabled && (
        <Link
          href="/me/shop"
          className="mt-4 inline-block rounded bg-nuffle-bronze px-4 py-2 text-sm font-medium text-white hover:bg-nuffle-gold"
          data-testid="crowns-shop-link"
        >
          🛒 Dépenser mes Couronnes
        </Link>
      )}
    </div>
  );
}
