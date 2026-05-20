"use client";

/**
 * Dropdown de selection de saison NFL pour les pages admin. Lit l'etat
 * depuis le SeasonContext. Affiche les compteurs derives (weeks, games,
 * players) en sous-label pour debug rapide.
 *
 * Phase 3.C — C.0.
 */

import { useNflFantasySeason } from "./SeasonContext";

export default function SeasonPicker(): JSX.Element {
  const { seasons, selectedSeasonId, setSelectedSeasonId, loading, error } =
    useNflFantasySeason();

  if (loading) {
    return (
      <div className="text-xs text-gray-500">Chargement des saisons…</div>
    );
  }
  if (error) {
    return (
      <div className="text-xs text-red-600" title={error}>
        Erreur saisons : {error}
      </div>
    );
  }
  if (seasons.length === 0) {
    return (
      <div className="text-xs text-amber-600">
        Aucune saison seedee — utilise « Seed d’une saison » dans Actions.
      </div>
    );
  }

  const current = seasons.find((s) => s.id === selectedSeasonId);

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="nfl-fantasy-season-picker"
        className="text-xs font-semibold uppercase tracking-wider text-gray-500"
      >
        Saison
      </label>
      <select
        id="nfl-fantasy-season-picker"
        data-testid="nfl-fantasy-season-picker"
        value={selectedSeasonId ?? ""}
        onChange={(e) => setSelectedSeasonId(e.target.value || null)}
        className="rounded-md border-gray-300 text-sm shadow-sm focus:border-nuffle-gold focus:ring-nuffle-gold"
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.id}
            {s.status === "in_progress" ? " · en cours" : ""}
            {s.status === "completed" ? " · terminée" : ""}
            {s.status === "upcoming" ? " · à venir" : ""}
          </option>
        ))}
      </select>
      {current && (
        <span className="text-[11px] text-gray-500">
          {current.gamesCount} games · {current.playersCount} joueurs ·{" "}
          {current.weeksCount} weeks
        </span>
      )}
    </div>
  );
}
