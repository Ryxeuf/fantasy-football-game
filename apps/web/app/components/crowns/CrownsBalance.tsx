"use client";

import { useCrowns } from "../../contexts/CrownsContext";
import { formatCrowns } from "../../lib/crowns";

/**
 * Pastille « 👑 1 250 Crowns ». Rien n'est rendu quand le flag `crowns` est
 * OFF ou que le solde n'est pas (encore) connu.
 */
export function CrownsBalance({ className = "" }: { readonly className?: string }) {
  const { enabled, balance } = useCrowns();
  if (!enabled || balance === null) return null;
  return (
    <span
      data-testid="crowns-balance"
      className={`inline-flex items-center gap-1 rounded-full bg-[#1B1610] px-2.5 py-0.5 text-xs font-bold text-nuffle-gold ring-1 ring-nuffle-gold/40 ${className}`}
      title="Vos Couronnes (Crowns)"
    >
      <span aria-hidden="true">👑</span>
      {formatCrowns(balance)}
      <span className="sr-only"> Crowns</span>
    </span>
  );
}
