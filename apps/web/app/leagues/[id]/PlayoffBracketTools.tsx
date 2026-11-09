"use client";
/**
 * Outils du commissaire sur un bracket de play-offs DÉJÀ généré (montés par
 * `PlayoffBracketView`) : réinitialiser le bracket tant que rien n'est joué,
 * remplacer un qualifié dans une rencontre encore à jouer.
 */

import { useCallback, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import {
  isPlaceholder,
  replacementCandidates,
  type BracketPairingLike,
  type BracketRoundLike,
} from "./playoff-bracket-edit";

interface NamedParticipant {
  id: string;
  name: string;
}

interface ReplaceProps {
  pairing: BracketPairingLike & {
    homeParticipant: { id: string; team: { name: string } };
    awayParticipant: { id: string; team: { name: string } };
  };
  rounds: readonly BracketRoundLike[];
  /** Équipes actives de la saison. */
  eligibleParticipants: readonly NamedParticipant[];
  onDone: () => void;
}

/**
 * « Remplacer » un qualifié dans UNE rencontre non jouée, même quand
 * d'autres rencontres du bracket le sont (le finaliste parti remplacé par le
 * 3e). Sur un placeholder (un seul qualifié connu), c'est ce qualifié qui
 * est remplacé.
 */
export function PlayoffReplaceControl({
  pairing,
  rounds,
  eligibleParticipants,
  onDone,
}: ReplaceProps) {
  const placeholder = isPlaceholder(pairing);
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"home" | "away">("home");
  const [participantId, setParticipantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(
    () => replacementCandidates(rounds, pairing, side, eligibleParticipants),
    [rounds, pairing, side, eligibleParticipants],
  );

  const submit = useCallback(async () => {
    if (!participantId) {
      setError("Choisis l'équipe qui entre dans le bracket.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/leagues/pairings/${pairing.id}/playoff-participant`, {
        method: "PATCH",
        body: JSON.stringify({ side, participantId }),
      });
      setOpen(false);
      setParticipantId("");
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }, [pairing.id, side, participantId, onDone]);

  if (!open) {
    return (
      <button
        type="button"
        data-testid={`playoff-replace-${pairing.id}`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="block w-full text-center text-xs text-nuffle-bronze hover:underline mt-1"
      >
        🔁 Remplacer une équipe
      </button>
    );
  }

  return (
    <div
      data-testid={`playoff-replace-form-${pairing.id}`}
      className="mt-1 space-y-1 rounded border border-amber-200 bg-amber-50/60 p-2 text-xs"
    >
      {placeholder ? (
        <p>
          Qualifié connu :{" "}
          <strong>{pairing.homeParticipant.team.name}</strong>
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {(["home", "away"] as const).map((s) => (
            <label key={s} className="flex items-center gap-1">
              <input
                type="radio"
                name={`replace-side-${pairing.id}`}
                data-testid={`playoff-replace-side-${s}`}
                checked={side === s}
                disabled={busy}
                onChange={() => {
                  setSide(s);
                  setParticipantId("");
                }}
              />
              Remplacer{" "}
              {s === "home"
                ? pairing.homeParticipant.team.name
                : pairing.awayParticipant.team.name}
            </label>
          ))}
        </div>
      )}
      <select
        data-testid={`playoff-replace-select-${pairing.id}`}
        value={participantId}
        disabled={busy}
        onChange={(e) => setParticipantId(e.target.value)}
        className="w-full rounded border border-gray-300 px-1 py-0.5"
      >
        <option value="">— Équipe entrante —</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {candidates.length === 0 ? (
        <p className="text-gray-500">
          Aucune équipe active disponible hors du bracket.
        </p>
      ) : null}
      {error ? (
        <p data-testid={`playoff-replace-error-${pairing.id}`} className="text-red-600">
          {error}
        </p>
      ) : null}
      <div className="flex gap-1">
        <button
          type="button"
          data-testid={`playoff-replace-submit-${pairing.id}`}
          onClick={submit}
          disabled={busy || !participantId}
          className="rounded bg-nuffle-gold px-2 py-0.5 font-medium text-white disabled:opacity-50"
        >
          Remplacer
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded border border-gray-300 bg-white px-2 py-0.5 text-gray-700"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

interface ResetProps {
  seasonId: string;
  /** Une rencontre est engagée : le serveur refuserait, on grise. */
  disabled: boolean;
  onDone: () => void;
}

/**
 * « Réinitialiser le bracket » : supprime tous les tours de play-off pour
 * rouvrir la taille du bracket et relancer. Confirmation en deux temps,
 * comme les retraits d'équipe de la liste des participants.
 */
export function PlayoffBracketResetButton({
  seasonId,
  disabled,
  onDone,
}: ResetProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/leagues/seasons/${seasonId}/playoff-bracket/reset`, {
        method: "POST",
      });
      setConfirming(false);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }, [seasonId, onDone]);

  return (
    <div data-testid="playoff-reset" className="space-y-1 text-sm">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-900">
          <span>
            Supprimer tout le bracket ? Tu pourras changer la taille des
            play-offs puis le relancer.
          </span>
          <button
            type="button"
            data-testid="playoff-reset-confirm"
            onClick={reset}
            disabled={busy}
            className="rounded-md bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Oui, réinitialiser
          </button>
          <button
            type="button"
            data-testid="playoff-reset-cancel"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid="playoff-reset-button"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          disabled={disabled}
          title={
            disabled
              ? "Une rencontre de play-off est déjà jouée ou en cours de saisie"
              : undefined
          }
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          ♻️ Réinitialiser le bracket
        </button>
      )}
      {error ? (
        <p data-testid="playoff-reset-error" className="text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
