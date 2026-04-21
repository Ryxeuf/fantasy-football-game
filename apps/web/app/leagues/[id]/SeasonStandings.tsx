"use client";
import { useLanguage } from "../../contexts/LanguageContext";
import type { StandingRow } from "./types";

interface SeasonStandingsProps {
  rows: StandingRow[];
}

export function SeasonStandings({ rows }: SeasonStandingsProps) {
  const { t } = useLanguage();

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
            <th className="px-2 py-2 text-center font-semibold">
              {t.leagues.standingsElo}
            </th>
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
              <td className="px-2 py-1 text-center">{row.seasonElo}</td>
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
