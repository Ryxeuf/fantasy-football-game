"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { dynamicRoute } from "../../../../../lib/typed-route";
import { PredictionPairingCard } from "../../../../_components/PredictionPairingCard";
import { PredictionLeaderboard } from "../../../../_components/PredictionLeaderboard";
import { RoundPredictionsCloseButton } from "../../../../_components/RoundPredictionsCloseButton";
import { useSeasonPredictions } from "../../../../_components/useSeasonPredictions";
import {
  roundPredictionLabel,
  roundPredictionStatus,
  roundPredictionsPagePath,
} from "../../../../_components/prediction-rounds";
import {
  GROUP_LABELS,
  PREDICTION_SCOPE_OPTIONS,
  roundLabel,
  type RoundPredictionsView,
} from "../../../../_components/predictions";

/**
 * Pronostics d'une saison : le classement complet en deux onglets, puis
 * toutes les journées, chacune avec un lien vers SA page (la saisie au
 * quotidien se fait journée par journée, depuis le calendrier). Les
 * pronostics des autres n'apparaissent qu'une fois chaque rencontre CLOSE
 * (jamais avant — le serveur ne les envoie pas).
 * Lecture ouverte (`optionalAuthUser`) : une ligue publique se consulte sans
 * compte, une ligue privée reste introuvable pour qui ne la voit pas.
 */

function RoundPageLink({
  leagueId,
  seasonId,
  round,
}: {
  leagueId: string;
  seasonId: string;
  round: RoundPredictionsView;
}) {
  const status = roundPredictionStatus(round);
  if (!status) return null;
  return (
    <Link
      href={dynamicRoute(roundPredictionsPagePath(leagueId, seasonId, round.id))}
      data-testid={`prediction-round-link-${round.id}`}
      className="text-sm text-nuffle-bronze underline"
    >
      {roundPredictionLabel(status)} →
    </Link>
  );
}

export default function SeasonPredictionsPage() {
  const params = useParams<{ id: string; sid: string }>();
  const leagueId = params?.id ?? "";
  const seasonId = params?.sid ?? "";

  const { view, board, loading, error, reload: load } =
    useSeasonPredictions(seasonId);

  const scopeLabel = view
    ? PREDICTION_SCOPE_OPTIONS.find((o) => o.value === view.scope)?.label
    : null;

  return (
    <main
      data-testid="season-predictions-page"
      className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6"
    >
      <div>
        <Link
          href={`/leagues/${leagueId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
        >
          ← Retour à la ligue
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-nuffle-anthracite sm:text-3xl">
          🔮 Pronostics de la saison
        </h1>
        {view && view.scope !== "off" ? (
          <p
            data-testid="season-predictions-summary"
            className="mt-1 text-sm text-gray-600"
          >
            Ouverts à : {scopeLabel}.{" "}
            {view.viewer.group
              ? `Tu pronostiques dans le groupe ${GROUP_LABELS[view.viewer.group]}.`
              : null}{" "}
            3 pts le bon résultat (nul compris), +2 pour le score exact ; un
            forfait annule les pronostics de la rencontre.
          </p>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-gray-500">Chargement…</p> : null}

      {error ? (
        <p
          data-testid="season-predictions-error"
          className="text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {view && view.scope === "off" ? (
        <div
          data-testid="season-predictions-off"
          className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"
        >
          Les pronostics sont désactivés sur cette ligue.
          {view.viewer.isCommissioner ? (
            <>
              {" "}
              <Link
                href={`/leagues/${leagueId}/edit`}
                className="text-nuffle-bronze underline"
              >
                Les activer dans les réglages
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      {view && view.scope !== "off" ? (
        <>
          {board ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-nuffle-anthracite">
                Classement
              </h2>
              <PredictionLeaderboard
                board={board}
                initialTab={view.viewer.group ?? "coach"}
              />
            </section>
          ) : null}

          {view.rounds.length === 0 ? (
            <p
              data-testid="season-predictions-empty"
              className="text-sm text-gray-500"
            >
              Aucune journée au calendrier pour le moment.
            </p>
          ) : (
            view.rounds.map((round) => (
              <section
                key={round.id}
                data-testid={`prediction-round-${round.id}`}
                className="space-y-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-md font-semibold text-nuffle-anthracite">
                    {roundLabel(round)}
                  </h2>
                  <span className="flex flex-wrap items-center gap-3">
                    {round.canClose && round.pairings.some((p) => !p.closed) ? (
                      <RoundPredictionsCloseButton round={round} onChanged={load} />
                    ) : null}
                    <RoundPageLink
                      leagueId={leagueId}
                      seasonId={seasonId}
                      round={round}
                    />
                  </span>
                </div>
                <ul className="space-y-2">
                  {round.pairings.map((pairing) => (
                    <PredictionPairingCard
                      key={pairing.id}
                      pairing={pairing}
                      onChanged={load}
                      showOthers
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      ) : null}
    </main>
  );
}
