"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { PredictionPairingCard } from "../../../../../_components/PredictionPairingCard";
import { RoundPredictionsCloseButton } from "../../../../../_components/RoundPredictionsCloseButton";
import { useSeasonPredictions } from "../../../../../_components/useSeasonPredictions";
import {
  adjacentRounds,
  rankLabel,
  roundPredictionsPagePath,
  seasonPredictionsPagePath,
} from "../../../../../_components/prediction-rounds";
import {
  GROUP_LABELS,
  pointsLabel,
  roundLabel,
  viewerEntry,
  type RoundPredictionsView,
} from "../../../../../_components/predictions";

/**
 * Pronostics d'UNE journée : on y arrive depuis le bouton 🔮 de la journée
 * dans le calendrier de la ligue. Saisie des rencontres ouvertes, résultats
 * et pronostics des autres une fois closes, clôture de la journée pour le
 * commissaire, et navigation vers les journées voisines.
 *
 * La vue vient du même endpoint que la page de saison : le serveur reste la
 * seule source de l'éligibilité et de la clôture.
 */

function RoundNavLink({
  leagueId,
  seasonId,
  round,
  direction,
}: {
  leagueId: string;
  seasonId: string;
  round: RoundPredictionsView | null;
  direction: "previous" | "next";
}) {
  if (!round) return <span aria-hidden />;
  const label = roundLabel(round);
  return (
    <Link
      href={roundPredictionsPagePath(leagueId, seasonId, round.id)}
      data-testid={`prediction-round-nav-${direction}`}
      className="text-sm text-nuffle-bronze underline"
    >
      {direction === "previous" ? `← ${label}` : `${label} →`}
    </Link>
  );
}

export default function RoundPredictionsPage() {
  const params = useParams<{ id: string; sid: string; roundId: string }>();
  const leagueId = params?.id ?? "";
  const seasonId = params?.sid ?? "";
  const roundId = params?.roundId ?? "";

  const { view, board, loading, error, reload } =
    useSeasonPredictions(seasonId);

  const { previous, current, next } = view
    ? adjacentRounds(view.rounds, roundId)
    : { previous: null, current: null, next: null };
  const group = view?.viewer.group ?? null;
  const standing = board && group ? viewerEntry(board[group]) : null;

  return (
    <main
      data-testid="round-predictions-page"
      className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link
            href={`/leagues/${leagueId}`}
            className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-800"
          >
            ← Retour à la ligue
          </Link>
          <Link
            href={seasonPredictionsPagePath(leagueId, seasonId)}
            data-testid="round-predictions-season-link"
            className="text-nuffle-bronze underline"
          >
            Classement et toutes les journées
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-nuffle-anthracite sm:text-3xl">
          🔮 Pronostics{current ? ` — ${roundLabel(current)}` : ""}
        </h1>
        {view && view.scope !== "off" ? (
          <p
            data-testid="round-predictions-rules"
            className="text-sm text-gray-600"
          >
            3 pts le bon résultat (nul compris), +2 pour le score exact.
            {standing ? (
              <>
                {" "}
                Tu es{" "}
                <span
                  data-testid="round-predictions-standing"
                  className="font-medium"
                >
                  {rankLabel(standing.rank)} ({pointsLabel(standing.points)})
                </span>{" "}
                chez les {GROUP_LABELS[standing.group]}.
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-gray-500">Chargement…</p> : null}

      {error ? (
        <p
          data-testid="round-predictions-error"
          className="text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {view && view.scope === "off" ? (
        <p
          data-testid="round-predictions-off"
          className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"
        >
          Les pronostics sont désactivés sur cette ligue.
        </p>
      ) : null}

      {view && view.scope !== "off" && !current ? (
        <p
          data-testid="round-predictions-not-found"
          className="text-sm text-gray-600"
        >
          Cette journée n&apos;existe pas (ou plus) dans la saison.
        </p>
      ) : null}

      {view && view.scope !== "off" && current ? (
        <section className="space-y-3">
          {current.canClose && current.pairings.some((p) => !p.closed) ? (
            <div className="flex justify-end">
              <RoundPredictionsCloseButton round={current} onChanged={reload} />
            </div>
          ) : null}
          {current.pairings.length === 0 ? (
            <p className="text-sm text-gray-500">
              Aucune rencontre dans cette journée.
            </p>
          ) : (
            <ul className="space-y-2">
              {current.pairings.map((pairing) => (
                <PredictionPairingCard
                  key={pairing.id}
                  pairing={pairing}
                  onChanged={reload}
                  showOthers
                />
              ))}
            </ul>
          )}
          <nav
            aria-label="Journées voisines"
            className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3"
          >
            <RoundNavLink
              leagueId={leagueId}
              seasonId={seasonId}
              round={previous}
              direction="previous"
            />
            <RoundNavLink
              leagueId={leagueId}
              seasonId={seasonId}
              round={next}
              direction="next"
            />
          </nav>
        </section>
      ) : null}
    </main>
  );
}
