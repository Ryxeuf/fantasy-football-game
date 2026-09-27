"use client";

import { useMemo } from "react";
import { apiRequest } from "../../lib/api-client";
import CompetitionPdfMenu, {
  type CompetitionPdfMenuItem,
} from "../../components/CompetitionPdfMenu";
import { pdfFilename } from "../../lib/competition-pdf/download";
import {
  leagueBracketToPdf,
  leagueCalendarToPdf,
  leagueLeaderboardsToPdf,
  leagueMatchdayToPdf,
  leagueStandingsToPdf,
  leagueStatsToPdf,
  selectNextLeagueRound,
  type LeagueAwardEntry,
  type LeagueBracketInput,
  type LeaguePdfContext,
  type PoolIndex,
} from "../../lib/competition-pdf/adapters/league";
import type {
  LeagueDetail,
  LeaguePool,
  LeagueSeasonDetail,
  PoolStandings,
  StandingRow,
} from "./types";

/**
 * Exports PDF d'une saison de ligue : prochaine journée, classement (par
 * poule), tops, calendrier complet, play-offs, statistiques. Les données
 * déjà chargées par la page sont réutilisées ; tops, palmarès et bracket se
 * chargent au clic.
 */

type Catalogue = { categories: Array<{ key: string; label: string; description: string }> } & Record<string, unknown>;

interface LeaguePdfExportsProps {
  league: LeagueDetail;
  season: LeagueSeasonDetail;
  standings: StandingRow[];
  poolStandings: PoolStandings[];
  pools: LeaguePool[];
  tieBreakRules: string[];
}

export default function LeaguePdfExports({
  league,
  season,
  standings,
  poolStandings,
  pools,
  tieBreakRules,
}: LeaguePdfExportsProps) {
  const items = useMemo<CompetitionPdfMenuItem[]>(() => {
    const ctx = (): LeaguePdfContext => ({
      leagueName: league.name,
      seasonName: season.name,
      now: new Date(),
    });
    const poolIndex: PoolIndex | null =
      pools.length > 1
        ? {
            poolIdByParticipantId: Object.fromEntries(
              season.participants.map((p) => [p.id, p.poolId ?? null]),
            ),
            poolNamesById: Object.fromEntries(pools.map((p) => [p.id, p.name])),
            poolOrder: [...pools].sort((a, b) => a.order - b.order).map((p) => p.id),
          }
        : null;
    const file = (kind: Parameters<typeof pdfFilename>[0], suffix?: string) =>
      pdfFilename(kind, league.name, suffix ?? season.name);
    const next = selectNextLeagueRound(season.rounds);

    return [
      {
        key: "matchday",
        label: "Prochaine journée",
        hint: next ? `Journée ${next.roundNumber}, cases de score à remplir` : "Aucune journée",
        disabled: !next,
        build: async () => ({
          request: { kind: "matchday", data: leagueMatchdayToPdf(next!, poolIndex, ctx()) },
          filename: file("matchday", `j${next!.roundNumber}`),
        }),
      },
      {
        key: "standings",
        label: "Classement",
        hint: poolStandings.length > 0 ? "Un tableau par poule" : "Classement général",
        build: async () => ({
          request: {
            kind: "standings",
            data: leagueStandingsToPdf(
              { standings, pools: poolStandings, scoring: league, tieBreakRules },
              ctx(),
            ),
          },
          filename: file("standings"),
        }),
      },
      {
        key: "leaderboards",
        label: "Tops joueurs et équipes",
        hint: "Top 5 de chaque catégorie",
        build: async () => {
          const [players, teams] = await Promise.all([
            apiRequest<Catalogue>(`/leagues/seasons/${season.id}/leaderboards?topN=5`).catch(() => null),
            apiRequest<Catalogue>(`/leagues/seasons/${season.id}/leaderboards/teams?topN=5`).catch(() => null),
          ]);
          return {
            request: { kind: "leaderboards", data: leagueLeaderboardsToPdf({ players, teams }, ctx()) },
            filename: file("leaderboards"),
          };
        },
      },
      {
        key: "calendar",
        label: "Calendrier complet",
        hint: `${season.rounds.length} journée(s), scores connus`,
        build: async () => ({
          request: { kind: "calendar", data: leagueCalendarToPdf(season.rounds, poolIndex, ctx()) },
          filename: file("calendar"),
        }),
      },
      {
        key: "bracket",
        label: "Play-offs",
        hint: "Tableau à élimination directe",
        build: async () => {
          const bracket = await apiRequest<LeagueBracketInput>(
            `/leagues/seasons/${season.id}/playoff-bracket`,
          );
          return {
            request: { kind: "bracket", data: leagueBracketToPdf(bracket, ctx()) },
            filename: file("bracket"),
          };
        },
      },
      {
        key: "stats",
        label: "Statistiques de la ligue",
        hint: "Chiffres clés, palmarès, totaux par équipe",
        build: async () => {
          const recap = await apiRequest<{ awards?: Record<string, LeagueAwardEntry[]> }>(
            `/leagues/seasons/${season.id}/awards`,
          ).catch(() => null);
          return {
            request: { kind: "stats", data: leagueStatsToPdf({ standings, awards: recap?.awards ?? null }, ctx()) },
            filename: file("stats"),
          };
        },
      },
    ];
  }, [league, season, standings, poolStandings, pools, tieBreakRules]);

  return <CompetitionPdfMenu items={items} testId="league-pdf-menu" />;
}
