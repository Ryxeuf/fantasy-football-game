"use client";
import { useState } from "react";
import { apiRequest, ApiClientError } from "../../lib/api-client";
import {
  isValidNafNumberInput,
  nafCoachPageUrl,
  nafNumberStatus,
  type NafNumberState,
} from "./naf-number";

interface NafNumberCardProps {
  readonly initial: NafNumberState;
}

interface NafNumberResponse {
  readonly nafNumber: number | null;
  readonly nafName: string | null;
  readonly nafVerifiedAt: string | null;
  readonly verified: boolean;
}

/** Messages des refus métier servis par `PUT /user/naf-number`. */
function errorMessage(e: unknown): string {
  if (e instanceof ApiClientError) {
    if (e.code === "naf_not_found") return "Numéro introuvable sur thenaf.net";
    if (e.code === "naf_number_taken") {
      return "Ce numéro NAF est déjà associé à un autre compte";
    }
    return e.message;
  }
  return e instanceof Error ? e.message : "Erreur lors de l'enregistrement";
}

/**
 * Carte « Numéro NAF » du profil : saisie, vérification automatique auprès
 * de thenaf.net (par le serveur), badge de statut et lien vers la fiche
 * coach NAF.
 */
export default function NafNumberCard({ initial }: NafNumberCardProps) {
  const [state, setState] = useState<NafNumberState>(initial);
  const [input, setInput] = useState(
    initial.nafNumber !== null ? String(initial.nafNumber) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = nafNumberStatus(state);
  const inputValid = isValidNafNumberInput(input);
  const unchanged =
    input.trim() === (state.nafNumber !== null ? String(state.nafNumber) : "");

  const apply = (res: NafNumberResponse) => {
    setState({
      nafNumber: res.nafNumber,
      nafName: res.nafName,
      nafVerifiedAt: res.nafVerifiedAt,
    });
    setInput(res.nafNumber !== null ? String(res.nafNumber) : "");
  };

  const save = async () => {
    if (!inputValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = input.trim();
      apply(
        await apiRequest<NafNumberResponse>("/user/naf-number", {
          method: "PUT",
          body: JSON.stringify({ nafNumber: trimmed === "" ? null : trimmed }),
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      apply(
        await apiRequest<NafNumberResponse>("/user/naf-number/verify", {
          method: "POST",
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6" data-testid="naf-number-card">
      <h3 className="text-xl font-bold mb-2">Numéro NAF</h3>
      <p className="text-sm text-gray-600 mb-4">
        Votre numéro de membre de la NAF (tournois officiels). Il est vérifié
        automatiquement sur l&apos;annuaire public thenaf.net.
      </p>

      <label htmlFor="naf-number-input" className="block text-sm font-medium text-gray-700 mb-1">
        Numéro NAF
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="naf-number-input"
          data-testid="naf-number-input"
          inputMode="numeric"
          autoComplete="off"
          maxLength={7}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-invalid={!inputValid}
          placeholder="Ex. 7221"
          className={`w-40 px-3 py-2 border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-nuffle-bronze ${
            inputValid ? "border-gray-300" : "border-red-400"
          }`}
        />
        <button
          type="button"
          data-testid="naf-number-save"
          onClick={save}
          disabled={busy || !inputValid || unchanged}
          className="px-4 py-2 bg-nuffle-bronze text-white rounded hover:bg-nuffle-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Vérification…" : "Enregistrer"}
        </button>
      </div>
      {!inputValid && (
        <p className="text-xs text-red-600 mt-1">Le numéro NAF compte 1 à 7 chiffres.</p>
      )}

      {status === "verified" && state.nafNumber !== null && (
        <p
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-sm text-green-800"
          data-testid="naf-number-verified"
        >
          <span aria-hidden="true">✓</span>
          Vérifié{state.nafName ? ` — ${state.nafName}` : ""}
        </p>
      )}
      {status === "pending" && (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="naf-number-pending">
          <span className="inline-flex rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-sm text-amber-800">
            En attente de vérification
          </span>
          <button
            type="button"
            data-testid="naf-number-retry"
            onClick={retry}
            disabled={busy}
            className="text-sm text-nuffle-bronze underline underline-offset-2 disabled:opacity-50"
          >
            Réessayer
          </button>
        </div>
      )}
      {state.nafNumber !== null && (
        <p className="mt-2 text-sm">
          <a
            href={nafCoachPageUrl(state.nafNumber)}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="naf-number-link"
            className="text-nuffle-bronze underline underline-offset-2"
          >
            Voir la fiche coach sur thenaf.net
          </a>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700" data-testid="naf-number-error">
          {error}
        </p>
      )}
    </div>
  );
}
