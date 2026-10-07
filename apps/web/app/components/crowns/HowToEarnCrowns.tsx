import { formatCrowns, type CrownsRewardSchedule } from "../../lib/crowns";

interface HowToEarnCrownsProps {
  /** Barème servi par `GET /crowns/me` ; sans lui, le texte reste sans montants. */
  readonly schedule: CrownsRewardSchedule | null;
  readonly className?: string;
}

function amount(value: number | undefined): string {
  return value === undefined ? "" : ` : +${formatCrowns(value)}`;
}

/**
 * « Comment gagner des Couronnes » (change `crowns-earning`). Les montants
 * viennent du serveur — jamais recopiés ici, ils divergeraient au premier
 * calibrage du barème.
 */
export function HowToEarnCrowns({ schedule, className = "" }: HowToEarnCrownsProps) {
  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 ${className}`}
      data-testid="crowns-how-to-earn"
    >
      <p className="font-semibold">Comment gagner des Couronnes ?</p>
      <ul className="mt-2 space-y-1">
        <li>
          📜 Chaque feuille de match validée, en ligue comme en coupe
          {amount(schedule?.sheet)} par coach — gagnant comme perdant : c&apos;est
          le fait de jouer qui paie.
        </li>
        <li>🏅 Chaque succès débloqué{amount(schedule?.achievement)}, une fois.</li>
        <li>👋 Le bonus de bienvenue{amount(schedule?.signup)}, une fois.</li>
      </ul>
      <p className="mt-2 text-xs text-amber-900">
        {schedule
          ? `Les feuilles de match rapportent au plus ${formatCrowns(schedule.seasonSheetCap)} Couronnes par saison de ligue (une coupe compte comme une saison).`
          : "Les gains de feuilles de match sont plafonnés par saison de ligue (une coupe compte comme une saison)."}{" "}
        Les Couronnes gagnées sont créditées à la consultation de ton solde.
      </p>
    </div>
  );
}
