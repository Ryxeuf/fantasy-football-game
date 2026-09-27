"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import { PredictionPairingCard } from "../_components/PredictionPairingCard";
import { PredictionLeaderboard } from "../_components/PredictionLeaderboard";
import {
  featuredRound,
  roundLabel,
  seasonPredictionLeaderboardPath,
  seasonPredictionsPath,
  type SeasonPredictionLeaderboardView,
  type SeasonPredictionsView,
} from "../_components/predictions";

/**
 * « Pronostics » sur la fiche de ligue : la journée à pronostiquer (ou la
 * dernière jouée), le haut du classement, et le lien vers la page complète.
 *
 * Tout vient du serveur, lecteur compris (`optionalAuthUser`) : éligibilité,
 * clôture, rien des autres avant la clôture. Sur une ligue ANTÉRIEURE à la
 * fonctionnalité (portée jamais réglée), le commissaire — et lui seul — est
 * invité à l'activer ; les autres ne voient rien.
 */

interface LeaguePredictionsPanelProps {
  leagueId: string;
  seasonId: string;
}

export function LeaguePredictionsPanel({
  leagueId,
  seasonId,
}: LeaguePredictionsPanelProps) {
  const [view, setView] = useState<SeasonPredictionsView | null>(null);
  const [board, setBoard] = useState<SeasonPredictionLeaderboardView | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Seule la DERNIÈRE requête écrit : un rechargement lent ne doit pas
  // écraser un état plus récent.
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      // Le classement est secondaire : son échec n'empêche pas de
      // pronostiquer.
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
      setError(
        e instanceof Error ? e.message : "Pronostics indisponibles",
      );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    setLoading(true);
    setView(null);
    setBoard(null);
    load();
  }, [load]);

  if (loading) return null;
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
      <section
        data-testid="league-predictions-cta"
        className="rounded-lg border border-dashed border-nuffle-gold/60 bg-nuffle-gold/5 p-3 text-sm space-y-1"
      >
        <h3 className="font-semibold text-nuffle-anthracite">🔮 Pronostics</h3>
        <p className="text-gray-700">
          Nouveau : laissez les coachs — voire les tribunes — pronostiquer les
          rencontres de la ligue, avec un classement et un Oracle de la saison.
        </p>
        <Link
          href={`/leagues/${leagueId}/edit`}
          data-testid="league-predictions-enable"
          className="inline-block text-nuffle-bronze font-medium underline"
        >
          Activer les pronostics dans les réglages
        </Link>
      </section>
    );
  }

  const round = featuredRound(view.rounds);

  return (
    <section data-testid="league-predictions-panel" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-md font-semibold text-nuffle-anthracite">
          🔮 Pronostics
        </h3>
        <Link
          href={`/leagues/${leagueId}/seasons/${seasonId}/predictions`}
          data-testid="league-predictions-link"
          className="text-sm text-nuffle-bronze underline"
        >
          Tous les pronostics →
        </Link>
      </div>

      {round ? (
        <div className="space-y-2">
          <h4
            data-testid="league-predictions-round"
            className="text-sm font-medium text-gray-700"
          >
            {roundLabel(round)}
          </h4>
          <ul className="space-y-2">
            {round.pairings.map((pairing) => (
              <PredictionPairingCard
                key={pairing.id}
                pairing={pairing}
                onChanged={load}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p
          data-testid="league-predictions-empty"
          className="text-sm text-gray-500"
        >
          Aucune rencontre à pronostiquer pour le moment.
        </p>
      )}

      {board ? (
        <PredictionLeaderboard
          board={board}
          initialTab={view.viewer.group ?? "coach"}
          limit={3}
        />
      ) : null}
    </section>
  );
}
