"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useLanguage } from "../../contexts/LanguageContext";
import { formatPlannedDate } from "../../leagues/[id]/pairing-status";
import { matchSheetHref } from "../../lib/competition-links";
import { dynamicRoute } from "../../lib/typed-route";
import TeamRosterLink from "../../leagues/[id]/TeamRosterLink";
import type { CupRoundView } from "./CupRoundsView";
import { CUP_NEXT_MATCHES_COUNT, selectCupUpcomingMatches } from "./next-matches";

/**
 * « Vos prochains matchs » d'une coupe — même zone que sur une ligue : les
 * prochaines rencontres non jouées du coach connecté, avec leur ronde,
 * l'adversaire (lien vers son roster), la date prévue et la feuille.
 * Masquée pour un visiteur qui n'a aucune rencontre à jouer.
 */
export default function CupNextMatchesPanel({
  cupId,
  rounds,
  currentUserId,
  limit = CUP_NEXT_MATCHES_COUNT,
}: {
  cupId: string;
  rounds: CupRoundView[];
  currentUserId: string | null;
  limit?: number;
}) {
  const { t, language } = useLanguage();
  const matches = useMemo(
    () => selectCupUpcomingMatches(rounds, currentUserId, limit),
    [rounds, currentUserId, limit],
  );
  if (matches.length === 0) return null;

  return (
    <section data-testid="cup-next-matches" className="space-y-2">
      <h3 className="text-md font-semibold text-nuffle-anthracite">
        {t.leagues.nextMatchesSection}
      </h3>
      <ul className="space-y-2">
        {matches.map(({ pairing, roundNumber, side, opponent }) => {
          const planned = formatPlannedDate(pairing.scheduledAt, language);
          return (
            <li
              key={pairing.id}
              data-testid={`cup-next-match-${pairing.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm"
            >
              <Link
                href={`#ronde-${roundNumber}`}
                className="inline-flex h-8 min-w-[2.25rem] items-center justify-center rounded-md bg-nuffle-anthracite px-2 font-score text-sm tracking-wider text-white"
                title={`Ronde ${roundNumber}`}
              >
                R{roundNumber}
              </Link>
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="text-gray-500">{t.leagues.nextMatchesVersus} </span>
                <span className="font-medium text-nuffle-anthracite">
                  <TeamRosterLink
                    competition="cup"
                    leagueId={cupId}
                    teamId={opponent.id}
                    canViewRoster
                    testIdSuffix={`next-${pairing.id}`}
                  >
                    {opponent.name}
                  </TeamRosterLink>
                </span>
                <span className="text-xs text-gray-500">
                  {" "}
                  ({side === "home" ? t.leagues.nextMatchesHome : t.leagues.nextMatchesAway})
                </span>
              </span>
              <span
                data-testid={`cup-next-match-date-${pairing.id}`}
                className="text-xs tabular-nums text-gray-500"
              >
                {planned ?? t.leagues.nextMatchesNoDate}
              </span>
              <Link
                href={dynamicRoute(matchSheetHref("cup", pairing.id))}
                data-testid={`cup-next-match-sheet-${pairing.id}`}
                className="rounded border border-nuffle-gold px-2 py-1 text-xs font-medium text-nuffle-anthracite hover:bg-nuffle-gold/10"
              >
                {t.leagues.pairingSheetOpen}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
