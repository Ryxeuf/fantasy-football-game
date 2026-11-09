"use client";
/**
 * Rôle du lecteur sur une carte de compétition (commissaire, inscrit,
 * retiré, ancienne saison), tel que le serveur le tranche (`viewerRoles`).
 * L'écran ne recalcule rien ; un champ absent (API antérieure) ne rend rien.
 */

import { useLanguage } from "../contexts/LanguageContext";
import {
  viewerRoleBadges,
  type ViewerRoleBadge,
  type ViewerRoles,
} from "../lib/competition-scope";

const STYLES: Record<ViewerRoleBadge, string> = {
  commissioner: "bg-amber-100 text-amber-900 border-amber-300",
  active: "bg-emerald-50 text-emerald-800 border-emerald-200",
  withdrawn: "bg-red-50 text-red-700 border-red-200",
  former: "bg-gray-100 text-gray-600 border-gray-200",
};

interface Props {
  roles?: ViewerRoles | null;
  /** Préfixe des `data-testid` (`<prefix>-commissioner`…). */
  testIdPrefix?: string;
}

export default function ViewerRoleBadges({
  roles,
  testIdPrefix = "viewer-role",
}: Props) {
  const { t } = useLanguage();
  const badges = viewerRoleBadges(roles);
  if (badges.length === 0) return null;
  const labels: Record<ViewerRoleBadge, string> = {
    commissioner: t.myCompetitions.roleCommissioner,
    active: t.myCompetitions.roleActive,
    withdrawn: t.myCompetitions.roleWithdrawn,
    former: t.myCompetitions.roleFormer,
  };
  return (
    <span className="inline-flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b}
          data-testid={`${testIdPrefix}-${b}`}
          className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${STYLES[b]}`}
        >
          {labels[b]}
        </span>
      ))}
    </span>
  );
}
