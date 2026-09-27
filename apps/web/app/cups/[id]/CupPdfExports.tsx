"use client";

import { useMemo } from "react";
import { apiRequest } from "../../lib/api-client";
import { useFeatureFlagOrOff } from "../../hooks/useFeatureFlag";
import { COMPETITION_PDF_EXPORTS_FLAG } from "../../lib/featureFlagKeys";
import CompetitionPdfMenu, {
  type CompetitionPdfMenuItem,
} from "../../components/CompetitionPdfMenu";
import { pdfFilename } from "../../lib/competition-pdf/download";
import {
  cupBracketToPdf,
  cupCalendarToPdf,
  cupLeaderboardsToPdf,
  cupMatchdayToPdf,
  cupStandingsToPdf,
  cupStatsToPdf,
  selectNextCupRound,
  type CupBracketInput,
  type CupPdfInput,
} from "../../lib/competition-pdf/adapters/cup";

/**
 * Exports PDF d'une coupe — les mêmes que ceux d'une ligue : ronde en cours,
 * classement (par poule), tops, calendrier, play-offs, statistiques. Tout
 * vient de `GET /cup/:id` déjà chargé, sauf le bracket (chargé au clic).
 */
export default function CupPdfExports({ cup }: { cup: CupPdfInput & { id: string } }) {
  // En recette : masqué tant que le flag n'est pas actif pour ce compte.
  const enabled = useFeatureFlagOrOff(COMPETITION_PDF_EXPORTS_FLAG);
  const items = useMemo<CompetitionPdfMenuItem[]>(() => {
    const ctx = () => ({ now: new Date() });
    const file = (kind: Parameters<typeof pdfFilename>[0], suffix?: string) =>
      pdfFilename(kind, cup.name, suffix);
    const next = selectNextCupRound(cup);
    const hasStandings = (cup.standings ?? []).length > 0;
    return [
      {
        key: "matchday",
        label: "Ronde en cours",
        hint: next ? `Ronde ${next.roundNumber}, cases de score à remplir` : "Aucune ronde générée",
        disabled: !next,
        build: async () => ({
          request: { kind: "matchday", data: cupMatchdayToPdf(cup, next!, ctx()) },
          filename: file("matchday", `ronde-${next!.roundNumber}`),
        }),
      },
      {
        key: "standings",
        label: "Classement",
        hint: (cup.poolStandings ?? []).length > 0 ? "Un tableau par poule" : "Classement général",
        disabled: !hasStandings,
        build: async () => ({
          request: { kind: "standings", data: cupStandingsToPdf(cup, ctx()) },
          filename: file("standings"),
        }),
      },
      {
        key: "leaderboards",
        label: "Tops joueurs et équipes",
        hint: "Classements individuels et podiums",
        build: async () => ({
          request: { kind: "leaderboards", data: cupLeaderboardsToPdf(cup, ctx()) },
          filename: file("leaderboards"),
        }),
      },
      {
        key: "calendar",
        label: "Calendrier complet",
        hint: `${(cup.rounds ?? []).length} ronde(s), scores connus`,
        build: async () => ({
          request: { kind: "calendar", data: cupCalendarToPdf(cup, ctx()) },
          filename: file("calendar"),
        }),
      },
      {
        key: "bracket",
        label: "Play-offs",
        hint: "Tableau à élimination directe",
        disabled: (cup.playoffSize ?? 0) === 0,
        build: async () => {
          const bracket = await apiRequest<CupBracketInput>(`/cup/${cup.id}/playoffs`);
          return {
            request: { kind: "bracket", data: cupBracketToPdf(cup, bracket, ctx()) },
            filename: file("bracket"),
          };
        },
      },
      {
        key: "stats",
        label: "Statistiques de la coupe",
        hint: "Chiffres clés, palmarès, totaux par équipe",
        disabled: !hasStandings,
        build: async () => ({
          request: { kind: "stats", data: cupStatsToPdf(cup, ctx()) },
          filename: file("stats"),
        }),
      },
    ];
  }, [cup]);

  if (!enabled) return null;
  return <CompetitionPdfMenu items={items} testId="cup-pdf-menu" />;
}
