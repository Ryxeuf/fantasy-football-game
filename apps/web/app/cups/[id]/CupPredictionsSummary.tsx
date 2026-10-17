"use client";
import Link from "next/link";
import { dynamicRoute } from "../../lib/typed-route";
import {
  GROUP_LABELS,
  pointsLabel,
  type CupPredictionLeaderboardView,
  type CupPredictionsView,
} from "../../leagues/_components/predictions";
import {
  cupPredictionsPagePath,
  cupRoundPredictionsAnchor,
  predictionsDigest,
  rankLabel,
} from "../../leagues/_components/prediction-rounds";

/**
 * « Pronostics » sur la page d'une coupe, réduit à UNE ligne — même posture
 * que la fiche de ligue : ce qui reste à pronostiquer (lien direct vers la
 * ronde) et la place du lecteur au classement.
 *
 * Rien à faire et pas classé : un simple lien vers la page. Sur une coupe
 * ANTÉRIEURE à la fonctionnalité (portée jamais réglée), le commissaire — et
 * lui seul — est invité à l'activer.
 */

interface CupPredictionsSummaryProps {
  cupId: string;
  view: CupPredictionsView | null;
  board: CupPredictionLeaderboardView | null;
  error: string | null;
}

export function CupPredictionsSummary({
  cupId,
  view,
  board,
  error,
}: CupPredictionsSummaryProps) {
  if (error) {
    return (
      <p data-testid="cup-predictions-error" className="text-sm text-red-700">
        Pronostics : {error}
      </p>
    );
  }
  if (!view) return null;

  if (view.scope === "off") {
    if (!view.viewer.isCommissioner || view.scopeConfigured) return null;
    return (
      <p
        data-testid="cup-predictions-cta"
        className="rounded-lg border border-dashed border-nuffle-gold/60 bg-nuffle-gold/5 px-3 py-2 text-sm text-gray-700"
      >
        🔮 Nouveau : laissez les coachs — voire les tribunes — pronostiquer les
        rencontres de la coupe, avec leur propre classement.{" "}
        <Link
          href={dynamicRoute(`/cups/${cupId}/edit`)}
          data-testid="cup-predictions-enable"
          className="font-medium text-nuffle-bronze underline"
        >
          Activer les pronostics
        </Link>
      </p>
    );
  }

  const digest = predictionsDigest(view, board, "cup");
  const pagePath = cupPredictionsPagePath(cupId);

  return (
    <p
      data-testid="cup-predictions-summary"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
    >
      <span className="font-semibold text-nuffle-anthracite">🔮 Pronostics</span>
      {digest.nextRound ? (
        <span data-testid="cup-predictions-todo">
          {digest.nextRoundLabel} : {digest.todo} rencontre
          {digest.todo > 1 ? "s" : ""} à pronostiquer —{" "}
          <Link
            href={dynamicRoute(
              `${pagePath}#${cupRoundPredictionsAnchor(digest.nextRound.roundNumber)}`,
            )}
            data-testid="cup-predictions-todo-link"
            className="font-medium text-nuffle-bronze underline"
          >
            Pronostiquer
          </Link>
        </span>
      ) : null}
      {digest.standing ? (
        <span data-testid="cup-predictions-standing" className="text-gray-600">
          Tu es {rankLabel(digest.standing.rank)} (
          {pointsLabel(digest.standing.points)}) chez les{" "}
          {GROUP_LABELS[digest.group]}
        </span>
      ) : null}
      <Link
        href={dynamicRoute(pagePath)}
        data-testid="cup-predictions-link"
        className="ml-auto text-nuffle-bronze underline"
      >
        {digest.nextRound || digest.standing ? "Classement →" : "Voir les pronostics →"}
      </Link>
    </p>
  );
}
