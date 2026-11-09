"use client";
/**
 * « Retirer l'équipe » en cours de saison, côté commissaire. Avant le
 * démarrage, la suppression d'inscription suffit (bouton « Supprimer ») ;
 * une fois la saison lancée, l'équipe a des rencontres restantes dont le
 * commissaire choisit le sort : forfait (l'adversaire gagne et avance en
 * play-off) ou annulation (personne ne marque). Une rencontre de bracket
 * est toujours perdue par forfait.
 */

import { useState } from "react";
import { apiRequest } from "../../lib/api-client";

export type RemainingPolicy = "forfeit" | "cancel";

interface WithdrawOutcome {
  forfeited?: string[];
  cancelled?: string[];
  placeholders?: string[];
}

interface Props {
  seasonId: string;
  participantId: string;
  teamName: string;
  /** Déjà retirée : rien à proposer (le résultat d'un retrait reste lu). */
  withdrawn?: boolean;
  onDone: () => void;
}

/** Résumé lisible du résultat (pur, testé). */
export function describeWithdrawOutcome(out: WithdrawOutcome): string {
  const parts: string[] = [];
  const f = out.forfeited?.length ?? 0;
  const c = out.cancelled?.length ?? 0;
  const ph = out.placeholders?.length ?? 0;
  if (f > 0) parts.push(`${f} rencontre(s) perdue(s) par forfait`);
  if (c > 0) parts.push(`${c} rencontre(s) annulée(s)`);
  if (ph > 0) {
    parts.push(
      `${ph} place(s) de play-off à réattribuer (« Remplacer une équipe » dans le bracket)`,
    );
  }
  return parts.length > 0
    ? `Équipe retirée : ${parts.join(", ")}.`
    : "Équipe retirée : aucune rencontre restante.";
}

export function CommissionerWithdrawControl({
  seasonId,
  participantId,
  teamName,
  withdrawn = false,
  onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [policy, setPolicy] = useState<RemainingPolicy>("forfeit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const out = await apiRequest<WithdrawOutcome>(
        `/leagues/seasons/${seasonId}/participants/${participantId}/withdraw`,
        { method: "POST", body: JSON.stringify({ remaining: policy }) },
      );
      setResult(describeWithdrawOutcome(out));
      setOpen(false);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <p
        data-testid={`withdraw-result-${participantId}`}
        className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1"
      >
        {result}
      </p>
    );
  }

  if (withdrawn) return null;

  if (!open) {
    return (
      <button
        type="button"
        data-testid={`withdraw-team-${participantId}`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
      >
        🚪 Retirer l'équipe
      </button>
    );
  }

  return (
    <div
      data-testid={`withdraw-form-${participantId}`}
      className="w-full space-y-1 rounded border border-red-200 bg-red-50/60 p-2 text-xs text-red-900"
    >
      <p className="font-medium">
        Retirer « {teamName} » de la saison. Ses rencontres restantes :
      </p>
      <label className="flex items-center gap-1">
        <input
          type="radio"
          name={`withdraw-policy-${participantId}`}
          data-testid={`withdraw-policy-forfeit-${participantId}`}
          checked={policy === "forfeit"}
          disabled={busy}
          onChange={() => setPolicy("forfeit")}
        />
        perdues par forfait (l'adversaire gagne)
      </label>
      <label className="flex items-center gap-1">
        <input
          type="radio"
          name={`withdraw-policy-${participantId}`}
          data-testid={`withdraw-policy-cancel-${participantId}`}
          checked={policy === "cancel"}
          disabled={busy}
          onChange={() => setPolicy("cancel")}
        />
        annulées (personne ne marque)
      </label>
      <p className="text-red-800/80">
        Les rencontres de play-off sont toujours perdues par forfait.
      </p>
      {error ? (
        <p data-testid={`withdraw-error-${participantId}`} className="text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex gap-1">
        <button
          type="button"
          data-testid={`withdraw-confirm-${participantId}`}
          onClick={submit}
          disabled={busy}
          className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? "Retrait…" : "Confirmer le retrait"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-700"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
