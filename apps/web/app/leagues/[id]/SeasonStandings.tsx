"use client";
import { useMemo, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import type { StandingRow } from "./types";
import RosterBadge from "../../components/RosterBadge";
import TeamLogo from "../../components/TeamLogo";

/**
 * F1 — Classement de saison.
 *
 * Retour coach (Ombrelame, 07/2026) : l'ordre des colonnes suit
 * desormais la lecture "resultat d'abord, detail ensuite", et le
 * tableau s'ouvre en version synthetique, depliable a la demande.
 *
 *   synthetique : Pts | Bo | MJ | For | TD+ | TD- | Diff TD |
 *                 Sor+ | Sor- | Diff Sor
 *   deplie      : + P | Agr | SP | Exclu | V | N | D  (+ ELO si classant)
 */

interface SeasonStandingsProps {
  rows: StandingRow[];
  /** Affiche la colonne ELO. Masquee par defaut (ELO neutralise en ligue). */
  showSeasonElo?: boolean;
  /** Ouvre le tableau deja deplie (utile pour les pages recap / export). */
  defaultExpanded?: boolean;
}

interface StandingsColumn {
  /** Suffixe des `data-testid` : `standings-cell-<pid>-<key>`. */
  readonly key: string;
  readonly label: string;
  readonly hint?: string;
  /** true = colonne du bloc "detail", masquee en vue synthetique. */
  readonly detail?: boolean;
  readonly value: (row: StandingRow) => number;
  readonly className?: string;
  /** Override du testid d'en-tete (retro-compat sur la colonne bonus). */
  readonly headerTestId?: string;
}

function casualtyDifference(row: StandingRow): number {
  // Retro-compat pre-F1 : l'API pouvait ne pas renvoyer le differentiel.
  return row.casualtyDifference ?? row.casualtiesFor - row.casualtiesAgainst;
}

function buildColumns(
  t: ReturnType<typeof useLanguage>["t"],
  showSeasonElo: boolean,
): StandingsColumn[] {
  const columns: StandingsColumn[] = [
    {
      key: "points",
      label: t.leagues.standingsPoints,
      value: (r) => r.points,
      className: "font-semibold text-nuffle-anthracite",
    },
    {
      key: "bonus",
      label: t.leagues.standingsBonus,
      hint: t.leagues.standingsBonusHint,
      value: (r) => r.bonusPoints ?? 0,
      className: "text-gray-600",
      headerTestId: "standings-bonus-header",
    },
    {
      key: "played",
      label: t.leagues.standingsPlayed,
      hint: t.leagues.standingsPlayedHint,
      value: (r) => r.played,
    },
    {
      key: "forfeit",
      label: t.leagues.standingsForfeit,
      hint: t.leagues.standingsForfeitHint,
      value: (r) => r.forfeitPoints ?? 0,
      className: "text-gray-600",
    },
    {
      key: "td-for",
      label: t.leagues.standingsTdFor,
      value: (r) => r.touchdownsFor,
    },
    {
      key: "td-against",
      label: t.leagues.standingsTdAgainst,
      value: (r) => r.touchdownsAgainst,
    },
    {
      key: "td-diff",
      label: t.leagues.standingsTdDiff,
      value: (r) => r.touchdownDifference,
    },
    {
      key: "cas-for",
      label: t.leagues.standingsCasFor,
      hint: t.leagues.standingsCasForHint,
      value: (r) => r.casualtiesFor,
    },
    {
      key: "cas-against",
      label: t.leagues.standingsCasAgainst,
      hint: t.leagues.standingsCasAgainstHint,
      value: (r) => r.casualtiesAgainst,
    },
    {
      key: "cas-diff",
      label: t.leagues.standingsCasDiff,
      hint: t.leagues.standingsCasDiffHint,
      value: casualtyDifference,
    },
    {
      key: "passes",
      label: t.leagues.standingsPasses,
      hint: t.leagues.standingsPassesHint,
      detail: true,
      value: (r) => r.passes ?? 0,
    },
    {
      key: "aggressions",
      label: t.leagues.standingsAggressions,
      hint: t.leagues.standingsAggressionsHint,
      detail: true,
      value: (r) => r.aggressions ?? 0,
    },
    {
      key: "crowd-surges",
      label: t.leagues.standingsCrowdSurges,
      hint: t.leagues.standingsCrowdSurgesHint,
      detail: true,
      value: (r) => r.crowdSurges ?? 0,
    },
    {
      key: "expulsions",
      label: t.leagues.standingsExpulsions,
      hint: t.leagues.standingsExpulsionsHint,
      detail: true,
      value: (r) => r.expulsions ?? 0,
    },
    {
      key: "wins",
      label: t.leagues.standingsWins,
      hint: t.leagues.standingsWinsHint,
      detail: true,
      value: (r) => r.wins,
    },
    {
      key: "draws",
      label: t.leagues.standingsDraws,
      hint: t.leagues.standingsDrawsHint,
      detail: true,
      value: (r) => r.draws,
    },
    {
      key: "losses",
      label: t.leagues.standingsLosses,
      hint: t.leagues.standingsLossesHint,
      detail: true,
      value: (r) => r.losses,
    },
  ];

  if (showSeasonElo) {
    columns.push({
      key: "elo",
      label: t.leagues.standingsElo,
      detail: true,
      value: (r) => r.seasonElo,
    });
  }

  return columns;
}

export function SeasonStandings({
  rows,
  showSeasonElo = false,
  defaultExpanded = false,
}: SeasonStandingsProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const allColumns = useMemo(
    () => buildColumns(t, showSeasonElo),
    [t, showSeasonElo],
  );
  const columns = expanded
    ? allColumns
    : allColumns.filter((c) => !c.detail);

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
    <div>
      <div className="flex justify-end mb-2">
        <button
          type="button"
          data-testid="standings-toggle-details"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-nuffle-anthracite underline underline-offset-2 hover:opacity-80"
        >
          {expanded
            ? t.leagues.standingsHideDetails
            : t.leagues.standingsShowDetails}
        </button>
      </div>
      <div className="overflow-x-auto -mx-2 sm:mx-0">
        <table data-testid="league-standings" className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="px-2 py-2 text-left font-semibold">
                {t.leagues.standingsRank}
              </th>
              <th className="px-2 py-2 text-left font-semibold">
                {t.leagues.standingsTeam}
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  data-testid={col.headerTestId ?? `standings-header-${col.key}`}
                  title={col.hint}
                  className="px-2 py-2 text-center font-semibold"
                >
                  {col.label}
                </th>
              ))}
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
                  <span className="inline-flex items-center gap-1.5">
                    <TeamLogo
                      slug={row.roster}
                      logoUrl={row.logoUrl ?? null}
                      size={18}
                      title={row.teamName}
                    />
                    <span>{row.teamName}</span>
                  </span>
                  <RosterBadge slug={row.roster} className="ml-2" />
                </td>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    data-testid={`standings-cell-${row.participantId}-${col.key}`}
                    className={`px-2 py-1 text-center${
                      col.className ? ` ${col.className}` : ""
                    }`}
                  >
                    {col.value(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
