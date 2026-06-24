"use client";
import { useLanguage } from "../../contexts/LanguageContext";
import type { StandingRow } from "./types";

interface SeasonStandingsProps {
  rows: StandingRow[];
  /** Affiche la colonne ELO. Masquee par defaut (ELO neutralise en ligue). */
  showSeasonElo?: boolean;
}

export function SeasonStandings({ rows, showSeasonElo = false }: SeasonStandingsProps) {
  const { t } = useLanguage();
  // E2 — n'affiche la colonne Bonus que si au moins une équipe a un
  // sous-total bonus non nul (table propre pour les ligues sans bonus).
  const hasBonus = rows.some((r) => (r.bonusPoints ?? 0) !== 0);

  if (rows.length === 0) {
    return (
      <div
        data-testid="league-standings-empty"
        className="text-sm text-gray-500 py-4"
      >
        {t.leagues.standingsEmpty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <table
        data-testid="league-standings"
        className="min-w-full text-sm"
      >
        <thead>
          <tr className="bg-gray-100 text-gray-700">
            <th className="px-2 py-2 text-left font-semibold">
              {t.leagues.standingsRank}
            </th>
            <th className="px-2 py-2 text-left font-semibold">
              {t.leagues.standingsTeam}
            </th>
            <th className="px-2 py-2 text-center font-semibold">
              {t.leagues.standingsPlayed}
            </th>
            <th className="px-2 py-2 text-center font-semibold">
              {t.leagues.standingsWins}
            </th>
            <th className="px-2 py-2 text-center font-semibold">
              {t.leagues.standingsDraws}
            </th>
            <th className="px-2 py-2 text-center font-semibold">
              {t.leagues.standingsLosses}
            </th>
            <th className="px-2 py-2 text-center font-semibold">
              {t.leagues.standingsTdFor}
            </th>
            <th className="px-2 py-2 text-center font-semibold">
              {t.leagues.standingsTdAgainst}
            </th>
            <th className="px-2 py-2 text-center font-semibold">
              {t.leagues.standingsTdDiff}
            </th>
            <th className="px-2 py-2 text-center font-semibold">
              {t.leagues.standingsCasFor}
            </th>
            <th className="px-2 py-2 text-center font-semibold">
              {t.leagues.standingsCasAgainst}
            </th>
            {showSeasonElo && (
              <th className="px-2 py-2 text-center font-semibold">
                {t.leagues.standingsElo}
              </th>
            )}
            {hasBonus && (
              <th
                data-testid="standings-bonus-header"
                title={t.leagues.standingsBonusHint}
                className="px-2 py-2 text-center font-semibold"
              >
                {t.leagues.standingsBonus}
              </th>
            )}
            <th className="px-2 py-2 text-center font-semibold">
              {t.leagues.standingsPoints}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.participantId}
              data-testid={`standings-row-${row.participantId}`}
              className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              <td className="px-2 py-1 text-center text-gray-700">
                {index + 1}
              </td>
              <td className="px-2 py-1 text-gray-900 font-medium">
                {row.teamName}
                <span className="ml-2 text-xs text-gray-500">
                  {row.roster}
                </span>
              </td>
              <td className="px-2 py-1 text-center">{row.played}</td>
              <td className="px-2 py-1 text-center">{row.wins}</td>
              <td className="px-2 py-1 text-center">{row.draws}</td>
              <td className="px-2 py-1 text-center">{row.losses}</td>
              <td className="px-2 py-1 text-center">{row.touchdownsFor}</td>
              <td className="px-2 py-1 text-center">
                {row.touchdownsAgainst}
              </td>
              <td className="px-2 py-1 text-center">
                {row.touchdownDifference}
              </td>
              <td className="px-2 py-1 text-center">{row.casualtiesFor}</td>
              <td className="px-2 py-1 text-center">
                {row.casualtiesAgainst}
              </td>
              {showSeasonElo && (
                <td className="px-2 py-1 text-center">{row.seasonElo}</td>
              )}
              {hasBonus && (
                <td
                  data-testid={`standings-row-${row.participantId}-bonus`}
                  className="px-2 py-1 text-center text-gray-600"
                >
                  {row.bonusPoints ?? 0}
                </td>
              )}
              <td className="px-2 py-1 text-center font-semibold text-nuffle-anthracite">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
