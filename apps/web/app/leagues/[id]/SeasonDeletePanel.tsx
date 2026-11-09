"use client";
import { useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { nameMatches } from "../../components/CompetitionLifecyclePanel";
import type { LeagueRoundDetail } from "./types";

/**
 * Zone de danger « Supprimer la saison » (commissaire ou admin).
 *
 * Le serveur n'accepte la suppression que d'une saison SANS AUCUN effet joué
 * (`league-season-deletion-rules`) : une feuille validée, un résultat saisi
 * ou un match reporté ont écrit sur les équipes, et la cascade ne le
 * déferait pas. L'écran lit le même signal dans le calendrier pour annoncer
 * le refus AVANT la saisie (le serveur reste seul juge : il voit aussi les
 * matchs en ligne déjà reportés) et renvoie vers clôturer / archiver.
 *
 * Confirmation par saisie du nom exact, comme la suppression d'une ligue.
 */

const RESULT_STATUSES = new Set(["played", "forfeit_home", "forfeit_away"]);
const EFFECTFUL_SHEET_STATUSES = new Set(["validated", "invalidated"]);

/** Vrai si le calendrier montre déjà un effet joué (refus serveur certain). */
export function seasonHasPlayedEffects(
  rounds: ReadonlyArray<Pick<LeagueRoundDetail, "pairings">>,
): boolean {
  return rounds.some((r) =>
    (r.pairings ?? []).some(
      (p) =>
        RESULT_STATUSES.has(String(p.status)) ||
        (p.matchSheet != null &&
          EFFECTFUL_SHEET_STATUSES.has(String(p.matchSheet.status))),
    ),
  );
}

interface SeasonDeletePanelProps {
  season: {
    id: string;
    name: string;
    rounds: ReadonlyArray<Pick<LeagueRoundDetail, "pairings">>;
    participantsCount: number;
  };
  /** Commissaire ou admin ; sinon rien n'est rendu. */
  canManage: boolean;
  onDeleted: () => void;
}

export function SeasonDeletePanel({
  season,
  canManage,
  onDeleted,
}: SeasonDeletePanelProps) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  const played = seasonHasPlayedEffects(season.rounds);
  const ready = nameMatches(confirmName, season.name);
  const pairingsCount = season.rounds.reduce(
    (sum, r) => sum + (r.pairings?.length ?? 0),
    0,
  );

  async function remove() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/leagues/seasons/${season.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Suppression impossible");
      setBusy(false);
    }
  }

  return (
    <section
      data-testid="season-delete-panel"
      className="rounded-lg border border-red-200 bg-white p-4 space-y-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-gray-900">🗑️ Supprimer la saison</p>
        {!played && !open ? (
          <button
            type="button"
            data-testid="season-delete-open"
            onClick={() => setOpen(true)}
            className="px-3 py-1.5 rounded-md bg-white border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50"
          >
            Supprimer « {season.name} »…
          </button>
        ) : null}
      </div>

      {played ? (
        <p data-testid="season-delete-played" className="text-sm text-gray-600">
          Cette saison a des résultats enregistrés : elle ne peut plus être
          supprimée, ses effets sur les équipes (PSP, trésorerie, blessures)
          resteraient sans source. Clôturez-la, ou archivez la ligue.
        </p>
      ) : open ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Suppression définitive : {season.participantsCount} inscription(s),
            {" "}
            {season.rounds.length} journée(s), {pairingsCount} rencontre(s) à
            jouer, leurs feuilles en brouillon et leurs pronostics. Le fan
            offert par l&apos;inscription est repris, les coachs inscrits sont
            prévenus.
          </p>
          <label className="block text-xs text-gray-500">
            Tapez « {season.name} » pour confirmer
            <input
              type="text"
              data-testid="season-delete-confirm-input"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
              className="mt-1 block w-full max-w-md rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-red-400 focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="season-delete-button"
              onClick={() => void remove()}
              disabled={!ready || busy}
              className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Suppression…" : "Supprimer définitivement la saison"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmName("");
                setError(null);
              }}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          Possible tant qu&apos;aucun résultat n&apos;est enregistré (erreur de
          création, saison abandonnée avant le premier match).
        </p>
      )}

      {error ? (
        <p
          data-testid="season-delete-error"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
