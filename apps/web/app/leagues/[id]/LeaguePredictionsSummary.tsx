"use client";
import Link from "next/link";
import { dynamicRoute } from "../../lib/typed-route";
import {
  GROUP_LABELS,
  pointsLabel,
  type SeasonPredictionLeaderboardView,
  type SeasonPredictionsView,
} from "../_components/predictions";
import {
  predictionsDigest,
  rankLabel,
  roundPredictionsPagePath,
  seasonPredictionsPagePath,
} from "../_components/prediction-rounds";

/**
 * « Pronostics » sur la fiche de ligue, réduit à UNE ligne : ce qui reste à
 * pronostiquer (avec le lien direct vers la journée) et la place du lecteur
 * au classement. La saisie vit sur la page de chaque journée, ouverte depuis
 * le bouton 🔮 du calendrier — la fiche ne la répète plus.
 *
 * Rien à faire et pas classé : la ligne disparaît. Sur une ligue ANTÉRIEURE
 * à la fonctionnalité (portée jamais réglée), le commissaire — et lui seul —
 * est invité à l'activer.
 */

interface LeaguePredictionsSummaryProps {
  leagueId: string;
  seasonId: string;
  view: SeasonPredictionsView | null;
  board: SeasonPredictionLeaderboardView | null;
  error: string | null;
}

export function LeaguePredictionsSummary({
  leagueId,
  seasonId,
  view,
  board,
  error,
}: LeaguePredictionsSummaryProps) {
  if (error) {
    return (
      <p data-testid="league-predictions-error" className="text-sm text-red-700">
        Pronostics : {error}
      </p>
    );
  }
  if (!view) return null;

  if (view.scope === "off") {
    if (!view.viewer.isCommissioner || view.scopeConfigured) return null;
    return (
      <p
        data-testid="league-predictions-cta"
        className="rounded-lg border border-dashed border-nuffle-gold/60 bg-nuffle-gold/5 px-3 py-2 text-sm text-gray-700"
      >
        🔮 Nouveau : laissez les coachs — voire les tribunes — pronostiquer les
        rencontres, avec un classement et un Oracle de la saison.{" "}
        <Link
          href={`/leagues/${leagueId}/edit`}
          data-testid="league-predictions-enable"
          className="font-medium text-nuffle-bronze underline"
        >
          Activer les pronostics
        </Link>
      </p>
    );
  }

  const digest = predictionsDigest(view, board);
  if (!digest.nextRound && !digest.standing) return null;

  return (
    <p
      data-testid="league-predictions-summary"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
    >
      <span className="font-semibold text-nuffle-anthracite">🔮 Pronostics</span>
      {digest.nextRound ? (
        <span data-testid="league-predictions-todo">
          {digest.nextRoundLabel} : {digest.todo} rencontre
          {digest.todo > 1 ? "s" : ""} à pronostiquer —{" "}
          <Link
            href={dynamicRoute(
              roundPredictionsPagePath(leagueId, seasonId, digest.nextRound.id),
            )}
            data-testid="league-predictions-todo-link"
            className="font-medium text-nuffle-bronze underline"
          >
            Pronostiquer
          </Link>
        </span>
      ) : null}
      {digest.standing ? (
        <span data-testid="league-predictions-standing" className="text-gray-600">
          Tu es {rankLabel(digest.standing.rank)} (
          {pointsLabel(digest.standing.points)}) chez les{" "}
          {GROUP_LABELS[digest.group]}
        </span>
      ) : null}
      <Link
        href={dynamicRoute(seasonPredictionsPagePath(leagueId, seasonId))}
        data-testid="league-predictions-link"
        className="ml-auto text-nuffle-bronze underline"
      >
        Classement →
      </Link>
    </p>
  );
}
