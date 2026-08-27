"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface TeamRosterLinkProps {
  /** Ligue de consultation. `null`/absent => pas de lien (rendu neutre). */
  leagueId?: string | null;
  teamId: string;
  /**
   * Consultation du roster autorisée (commissaire ou coach inscrit) —
   * même porte que le bouton « Voir le roster » de SeasonParticipants.
   */
  canViewRoster?: boolean;
  /** Suffixe du `data-testid` : `team-roster-link-<testIdSuffix>`. */
  testIdSuffix?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Rend un nom d'équipe cliquable vers sa fiche de roster de ligue.
 *
 * Le roster n'était atteignable que depuis la liste des participants
 * (bouton « Voir le roster ») : depuis le calendrier ou le classement, il
 * fallait remonter la page pour retrouver l'équipe. Le nom devient donc le
 * même point d'entrée, vers exactement la même page.
 *
 * Sans autorisation (ou hors contexte de ligue), on retombe sur un simple
 * `<span>` : la gating reste celle du bouton d'origine, jamais un lien mort.
 */
export default function TeamRosterLink({
  leagueId,
  teamId,
  canViewRoster = false,
  testIdSuffix,
  className,
  children,
}: TeamRosterLinkProps) {
  if (!leagueId || !canViewRoster || !teamId) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link
      href={`/leagues/${leagueId}/teams/${teamId}`}
      data-testid={`team-roster-link-${testIdSuffix ?? teamId}`}
      title="Voir le roster de cette équipe"
      className={`hover:underline underline-offset-2${className ? ` ${className}` : ""}`}
    >
      {children}
    </Link>
  );
}
