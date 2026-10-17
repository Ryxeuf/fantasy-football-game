"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { dynamicRoute } from "../../../lib/typed-route";
import { PredictionPairingCard } from "../../../leagues/_components/PredictionPairingCard";
import { PredictionLeaderboard } from "../../../leagues/_components/PredictionLeaderboard";
import { RoundPredictionsCloseButton } from "../../../leagues/_components/RoundPredictionsCloseButton";
import { useCupPredictions } from "../../../leagues/_components/useSeasonPredictions";
import { cupRoundPredictionsAnchor } from "../../../leagues/_components/prediction-rounds";
import {
  GROUP_LABELS,
  predictionScopeOptions,
  roundLabel,
} from "../../../leagues/_components/predictions";

/**
 * Pronostics d'une coupe : le classement en deux onglets (Coachs /
 * Tribunes), puis chaque ronde avec ses rencontres. Mêmes cartes, mêmes
 * règles qu'une saison de ligue ; une coupe ayant peu de rondes, elles
 * tiennent toutes sur UNE page, chacune avec son ancre (cible du bouton 🔮
 * du calendrier et de la notification de bilan).
 *
 * Les pronostics des autres n'apparaissent qu'une fois la rencontre CLOSE —
 * le serveur ne les envoie pas avant.
 */
export default function CupPredictionsPage() {
  const params = useParams<{ id: string }>();
  const cupId = params?.id ?? "";

  const { view, board, loading, error, reload: load } = useCupPredictions(cupId);

  const scopeLabel = view
    ? predictionScopeOptions("cup").find((o) => o.value === view.scope)?.label
    : null;

  return (
    <main
      data-testid="cup-predictions-page"
      className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6"
    >
      <div>
        <Link
          href={dynamicRoute(`/cups/${cupId}`)}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
        >
          ← Retour à la coupe
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-nuffle-anthracite sm:text-3xl">
          🔮 Pronostics{view ? ` — ${view.cupName}` : ""}
        </h1>
        {view && view.scope !== "off" ? (
          <p
            data-testid="cup-predictions-summary"
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
        <p data-testid="cup-predictions-error" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {view && view.scope === "off" ? (
        <div
          data-testid="cup-predictions-off"
          className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"
        >
          Les pronostics sont désactivés sur cette coupe.
          {view.viewer.isCommissioner ? (
            <>
              {" "}
              <Link
                href={dynamicRoute(`/cups/${cupId}/edit`)}
                data-testid="cup-predictions-enable"
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
              data-testid="cup-predictions-empty"
              className="text-sm text-gray-500"
            >
              Aucune ronde au calendrier pour le moment.
            </p>
          ) : (
            view.rounds.map((round) => (
              <section
                key={round.id}
                id={cupRoundPredictionsAnchor(round.roundNumber)}
                data-testid={`prediction-round-${round.id}`}
                className="scroll-mt-20 space-y-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-md font-semibold text-nuffle-anthracite">
                    {roundLabel(round, "cup")}
                  </h2>
                  {round.canClose && round.pairings.some((p) => !p.closed) ? (
                    <RoundPredictionsCloseButton
                      round={round}
                      onChanged={load}
                      competition="cup"
                    />
                  ) : null}
                </div>
                <ul className="space-y-2">
                  {round.pairings.map((pairing) => (
                    <PredictionPairingCard
                      key={pairing.id}
                      pairing={pairing}
                      onChanged={load}
                      competition="cup"
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
