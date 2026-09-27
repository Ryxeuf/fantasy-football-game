"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../../../../../lib/api-client";
import { PredictionPairingCard } from "../../../../_components/PredictionPairingCard";
import { PredictionLeaderboard } from "../../../../_components/PredictionLeaderboard";
import {
  GROUP_LABELS,
  PREDICTION_SCOPE_OPTIONS,
  roundLabel,
  seasonPredictionLeaderboardPath,
  seasonPredictionsPath,
  type RoundPredictionsView,
  type SeasonPredictionLeaderboardView,
  type SeasonPredictionsView,
} from "../../../../_components/predictions";

/**
 * Pronostics d'une saison : toutes les journées, les pronostics des autres
 * une fois chaque rencontre CLOSE (jamais avant — le serveur ne les envoie
 * pas), le classement complet en deux onglets et les clôtures manuelles.
 * Lecture ouverte (`optionalAuthUser`) : une ligue publique se consulte sans
 * compte, une ligue privée reste introuvable pour qui ne la voit pas.
 */

function RoundCloseButton({
  round,
  onChanged,
}: {
  round: RoundPredictionsView;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/leagues/rounds/${round.id}/predictions/close`, {
        method: "POST",
      });
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Clôture impossible");
    } finally {
      setBusy(false);
    }
  }, [round.id, onChanged]);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        data-testid={`prediction-round-close-${round.id}`}
        disabled={busy}
        onClick={handleClose}
        className="text-xs text-gray-600 underline hover:text-gray-800 disabled:opacity-50"
      >
        Clore les pronostics de la journée
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}

export default function SeasonPredictionsPage() {
  const params = useParams<{ id: string; sid: string }>();
  const leagueId = params?.id ?? "";
  const seasonId = params?.sid ?? "";

  const [view, setView] = useState<SeasonPredictionsView | null>(null);
  const [board, setBoard] = useState<SeasonPredictionLeaderboardView | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!seasonId) return;
    const request = ++requestRef.current;
    try {
      const [v, b] = await Promise.all([
        apiRequest<SeasonPredictionsView>(seasonPredictionsPath(seasonId)),
        apiRequest<SeasonPredictionLeaderboardView>(
          seasonPredictionLeaderboardPath(seasonId),
        ).catch(() => null),
      ]);
      if (request !== requestRef.current) return;
      setView(v);
      setBoard(b);
      setError(null);
    } catch (e: unknown) {
      if (request !== requestRef.current) return;
      setError(e instanceof Error ? e.message : "Pronostics indisponibles");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [seasonId]);

  // Changer de saison sans remonter la page (navigation client sur le seul
  // segment `[sid]`) ne doit jamais laisser la saison précédente à l'écran,
  // étiquetée comme la nouvelle. `load` seul (rechargement après un
  // pronostic) garde l'affichage, pour ne pas clignoter.
  useEffect(() => {
    setLoading(true);
    setView(null);
    setBoard(null);
    setError(null);
    load();
  }, [load]);

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
                  {round.canClose && round.pairings.some((p) => !p.closed) ? (
                    <RoundCloseButton round={round} onChanged={load} />
                  ) : null}
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
