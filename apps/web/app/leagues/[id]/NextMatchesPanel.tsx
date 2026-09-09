"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useLanguage } from "../../contexts/LanguageContext";
import { formatPlannedDate } from "./pairing-status";
import { selectUpcomingMatches, NEXT_MATCHES_COUNT } from "./next-matches";
import type { LeagueRoundDetail } from "./types";

/**
 * « Vos prochains matchs » — les 3 prochaines rencontres non jouées du
 * coach connecté, avec leur numéro de journée.
 *
 * Le calendrier complet dit qui joue quand ; il ne dit pas au coach ce
 * qu'IL joue ensuite, ce qui l'obligeait à balayer les journées une à une.
 * La zone se masque entièrement pour un visiteur non inscrit (aucune
 * rencontre sélectionnée).
 */

interface NextMatchesPanelProps {
  rounds: LeagueRoundDetail[];
  /** userId du coach connecté (null si non authentifié). */
  currentUserId: string | null;
  /** Nombre de rencontres affichées (3 par défaut). */
  limit?: number;
}

export function NextMatchesPanel({
  rounds,
  currentUserId,
  limit = NEXT_MATCHES_COUNT,
}: NextMatchesPanelProps) {
  const { t, language } = useLanguage();
  const matches = useMemo(
    () => selectUpcomingMatches(rounds, currentUserId, limit),
    [rounds, currentUserId, limit],
  );

  // Un visiteur non inscrit n'a pas de « prochains matchs » : la zone
  // n'a rien à dire, elle disparaît plutôt que d'afficher un vide.
  if (!currentUserId) return null;

  return (
    <section data-testid="league-next-matches" className="space-y-2">
      <h3 className="text-md font-semibold text-nuffle-anthracite">
        {t.leagues.nextMatchesSection}
      </h3>
      {matches.length === 0 ? (
        <p
          data-testid="league-next-matches-empty"
          className="text-sm text-gray-500"
        >
          {t.leagues.nextMatchesEmpty}
        </p>
      ) : (
        <ul className="space-y-2">
          {matches.map(({ pairing, roundNumber, side, opponent }) => {
            const planned = formatPlannedDate(pairing.scheduledAt, language);
            return (
              <li
                key={pairing.id}
                data-testid={`next-match-${pairing.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm"
              >
                <Link
                  href={`#journee-${roundNumber}`}
                  data-testid={`next-match-round-${pairing.id}`}
                  className="inline-flex h-8 min-w-[2.25rem] items-center justify-center rounded-md bg-nuffle-anthracite px-2 font-score text-sm tracking-wider text-white"
                  title={`${t.leagues.roundLabel} ${roundNumber}`}
                >
                  J{roundNumber}
                </Link>
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="text-gray-500">
                    {t.leagues.nextMatchesVersus}{" "}
                  </span>
                  <span className="font-medium text-nuffle-anthracite">
                    {opponent.team.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {" "}
                    (
                    {side === "home"
                      ? t.leagues.nextMatchesHome
                      : t.leagues.nextMatchesAway}
                    )
                  </span>
                </span>
                <span
                  data-testid={`next-match-date-${pairing.id}`}
                  className="text-xs tabular-nums text-gray-500"
                >
                  {planned ?? t.leagues.nextMatchesNoDate}
                </span>
                <Link
                  href={`/leagues/pairings/${pairing.id}/sheet`}
                  data-testid={`next-match-sheet-${pairing.id}`}
                  className="rounded border border-nuffle-gold px-2 py-1 text-xs font-medium text-nuffle-anthracite hover:bg-nuffle-gold/10"
                >
                  {t.leagues.pairingSheetOpen}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
