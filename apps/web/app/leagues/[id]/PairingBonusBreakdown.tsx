"use client";
import { useLanguage } from "../../contexts/LanguageContext";
import { parseBonusBreakdown } from "../_components/bonus-rules";

// E3 — Affiche le détail des points bonus appliqués à un pairing joué
// (snapshot Lot E). Composant présentational autonome (pas de router) :
// rendu uniquement quand le pairing est `played` et qu'un bonus existe.

interface PairingBonusBreakdownProps {
  pairingId: string;
  status: string;
  homeName: string;
  awayName: string;
  bonusPointsHome?: number;
  bonusPointsAway?: number;
  /** Snapshot brut (array PG ou string sqlite). */
  bonusBreakdown?: unknown;
}

export function PairingBonusBreakdown({
  pairingId,
  status,
  homeName,
  awayName,
  bonusPointsHome,
  bonusPointsAway,
  bonusBreakdown,
}: PairingBonusBreakdownProps) {
  const { t } = useLanguage();

  if (status !== "played") return null;

  const breakdown = parseBonusBreakdown(bonusBreakdown);
  const homeLabels = breakdown
    .filter((e) => e.side === "home")
    .map((e) => e.label)
    .filter(Boolean);
  const awayLabels = breakdown
    .filter((e) => e.side === "away")
    .map((e) => e.label)
    .filter(Boolean);
  const homeBonus = bonusPointsHome ?? 0;
  const awayBonus = bonusPointsAway ?? 0;
  const showHome = homeBonus !== 0 || homeLabels.length > 0;
  const showAway = awayBonus !== 0 || awayLabels.length > 0;

  if (!showHome && !showAway) return null;

  return (
    <div
      data-testid={`pairing-bonus-${pairingId}`}
      className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
    >
      <span className="text-gray-400">{t.leagues.pairingBonusLabel}</span>
      {showHome ? (
        <span
          data-testid={`pairing-bonus-${pairingId}-home`}
          className="text-sky-700"
        >
          {homeName} {formatPoints(homeBonus)}
          {homeLabels.length > 0 ? ` (${homeLabels.join(", ")})` : ""}
        </span>
      ) : null}
      {showAway ? (
        <span
          data-testid={`pairing-bonus-${pairingId}-away`}
          className="text-violet-700"
        >
          {awayName} {formatPoints(awayBonus)}
          {awayLabels.length > 0 ? ` (${awayLabels.join(", ")})` : ""}
        </span>
      ) : null}
    </div>
  );
}

function formatPoints(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
