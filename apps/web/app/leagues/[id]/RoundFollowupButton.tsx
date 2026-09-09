"use client";

import { useCallback, useState } from "react";
import { apiRequest } from "../../lib/api-client";

/**
 * Bouton « Relancer » d'une journée, réservé au commissaire.
 *
 * Le commissaire court après deux choses, et n'avait pour cela qu'un fil de
 * discussion hors application : les rencontres que personne n'a planifiées,
 * et celles dont la date est passée sans qu'une feuille lui soit parvenue.
 * Un clic écrit aux deux coachs de chaque rencontre concernée (notification
 * interne + push + e-mail) ; le serveur choisit les destinataires et rédige
 * les messages (`services/league-round-followup`), il n'y a rien à saisir.
 *
 * Le compte rendu reste affiché jusqu'au prochain clic : une relance sans
 * destinataire (« Aucune relance nécessaire ») est une information utile,
 * pas un échec — sans ça, le commissaire ne saurait pas si le clic a servi.
 */

/** Une relance envoyée, telle que rendue par `POST /rounds/:id/remind`. */
interface SentReminder {
  readonly pairingId: string;
  readonly reason: "not_scheduled" | "sheet_overdue";
  readonly matchLabel: string;
  readonly coaches: string[];
}

interface ReminderRunResult {
  readonly reminders: SentReminder[];
  readonly coachesNotified: number;
  readonly pairingsChecked: number;
}

const REASON_LABELS: Readonly<Record<SentReminder["reason"], string>> = {
  not_scheduled: "Match non planifié",
  sheet_overdue: "Feuille de match attendue",
};

export interface RoundFollowupButtonProps {
  readonly roundId: string;
  /** Numéro de journée, pour le libellé accessible du bouton. */
  readonly roundNumber: number;
}

export function RoundFollowupButton({
  roundId,
  roundNumber,
}: RoundFollowupButtonProps) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ReminderRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const body = await apiRequest<ReminderRunResult>(
        `/leagues/rounds/${roundId}/remind`,
        { method: "POST" },
      );
      setResult(body);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "La relance n'a pas pu être envoyée",
      );
    } finally {
      setSending(false);
    }
  }, [roundId]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={send}
        disabled={sending}
        data-testid={`round-followup-${roundId}`}
        aria-label={`Relancer les coachs de la journée ${roundNumber}`}
        title="Écrire aux coachs dont le match n'est pas planifié, ou dont la feuille n'est pas arrivée"
        className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? "⏳ Envoi…" : "⏰ Relancer"}
      </button>

      {error ? (
        <p
          data-testid={`round-followup-error-${roundId}`}
          className="max-w-[16rem] text-right text-[11px] text-red-600"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        result.reminders.length === 0 ? (
          <p
            data-testid={`round-followup-empty-${roundId}`}
            className="max-w-[16rem] text-right text-[11px] text-gray-500"
          >
            Aucune relance nécessaire ({result.pairingsChecked} rencontre
            {result.pairingsChecked > 1 ? "s" : ""} à jour).
          </p>
        ) : (
          <div
            data-testid={`round-followup-result-${roundId}`}
            className="max-w-[18rem] text-right text-[11px] text-emerald-700"
          >
            <p className="font-medium">
              {result.reminders.length} relance
              {result.reminders.length > 1 ? "s" : ""} envoyée
              {result.reminders.length > 1 ? "s" : ""} — {result.coachesNotified}{" "}
              coach{result.coachesNotified > 1 ? "s" : ""} prévenu
              {result.coachesNotified > 1 ? "s" : ""}
            </p>
            <ul className="mt-0.5 space-y-0.5 text-gray-600">
              {result.reminders.map((r) => (
                <li key={r.pairingId}>
                  {r.matchLabel} — {REASON_LABELS[r.reason]}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}
    </div>
  );
}

export default RoundFollowupButton;
