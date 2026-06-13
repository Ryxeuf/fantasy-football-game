"use client";

import { useEmailDigestPreference } from "../hooks/useEmailDigestPreference";

/**
 * Réengagement — Phase B : opt-in au digest e-mail hebdomadaire (RGPD).
 * Composant autonome (indépendant du support push) : un coach peut
 * recevoir le digest même sans notifications push.
 */
export default function EmailDigestPreference() {
  const { enabled, loading, saving, error, setEnabled } =
    useEmailDigestPreference();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4">Digest e-mail hebdomadaire</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between py-2">
        <div>
          <div className="font-medium">Recevoir le digest hebdomadaire</div>
          <div className="text-sm text-gray-500">
            Un résumé par e-mail chaque semaine : vos matchs en attente, vos
            équipes et la une de la Gazette. Désinscription en un clic.
          </div>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          disabled={saving || loading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-nuffle-bronze focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            enabled ? "bg-nuffle-bronze" : "bg-gray-300"
          }`}
          role="switch"
          aria-checked={enabled}
          aria-label="Activer le digest e-mail hebdomadaire"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
