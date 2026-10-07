"use client";

import { useEffect, useState } from "react";
import { adminGetCoachCrownsRewards, type AdminCrownsReward } from "../../../lib/admin-dice-themes";
import { describeRewardPeriod, describeRewardSource, formatCrowns } from "../../../lib/crowns";

/**
 * Admin — registre des récompenses en Couronnes d'un coach (`crowns-earning`) :
 * d'où viennent ses Couronnes, période du plafond, récompenses plafonnées.
 * Chargé à part : son échec ne bloque pas le reste de l'écran.
 */
export function CoachCrownsRewards({ userId }: { readonly userId: string }) {
  const [rewards, setRewards] = useState<AdminCrownsReward[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminGetCoachCrownsRewards(userId)
      .then((rows) => {
        if (!cancelled) setRewards(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur de chargement");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" data-testid="coach-crowns-rewards">
      <h2 className="text-lg font-bold">🏅 Récompenses</h2>
      <p className="mt-1 text-sm text-gray-600">
        Couronnes gagnées en jouant (50 plus récentes). Une récompense plafonnée n&apos;est jamais retentée.
      </p>
      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {!error && rewards === null && <p className="mt-3 text-sm text-gray-500">Chargement…</p>}
      {rewards && rewards.length === 0 && <p className="mt-3 text-sm text-gray-500">Aucune récompense.</p>}
      {rewards && rewards.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {rewards.map((r) => (
            <li key={r.id} className="flex justify-between gap-3 py-1.5" data-testid={`coach-crowns-reward-${r.id}`}>
              <span>
                {describeRewardSource(r.kind, r.sourceKey)}
                <span className="ml-2 text-xs text-gray-500">{describeRewardPeriod(r.periodKey)}</span>
                <span className="ml-2 text-xs text-gray-400">{new Date(r.createdAt).toLocaleString("fr-FR")}</span>
              </span>
              <span className="font-mono">
                +{formatCrowns(r.amount)}
                {r.amount < r.baseAmount && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    plafonnée (barème {formatCrowns(r.baseAmount)})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
