"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  teamRosterHref,
  type CompetitionKind,
} from "../../lib/competition-links";
import { dynamicRoute } from "../../lib/typed-route";

interface TeamRosterLinkProps {
  /** Compétition de consultation. `null`/absent => pas de lien (rendu neutre). */
  leagueId?: string | null;
  /**
   * Ligue (défaut) ou coupe : la fiche d'une coupe montre le roster
   * d'INSCRIPTION, celui que rejoue chaque rencontre.
   */
  competition?: CompetitionKind;
  teamId: string;
  /**
   * Consultation du roster autorisée. Ligue : commissaire ou coach inscrit,
   * même porte que le bouton « Voir le roster » de SeasonParticipants.
   * Coupe : tout visiteur de la coupe (même porte que `GET /cup/:id`).
   */
  canViewRoster?: boolean;
  /** Suffixe du `data-testid` : `team-roster-link-<testIdSuffix>`. */
  testIdSuffix?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Rend un nom d'équipe cliquable vers sa fiche de roster (ligue ou coupe).
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
  competition = "league",
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
      href={dynamicRoute(teamRosterHref(competition, leagueId, teamId))}
      data-testid={`team-roster-link-${testIdSuffix ?? teamId}`}
      title="Voir le roster de cette équipe"
      className={`hover:underline underline-offset-2${className ? ` ${className}` : ""}`}
    >
      {children}
    </Link>
  );
}
