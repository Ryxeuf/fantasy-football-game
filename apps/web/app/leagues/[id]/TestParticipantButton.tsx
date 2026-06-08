"use client";
import { useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";

// Dev only : bouton "Ajouter une équipe de test" visible par le
// commissaire. Inscrit une équipe de test (coach jetable) à la saison
// courante via POST /leagues/seasons/:seasonId/test-participant.
//
// Rendu uniquement en build de dev (`next dev` => NODE_ENV=development).
// En prod le composant ne rend rien ET la route serveur renvoie 404.

interface TestParticipantButtonProps {
  seasonId: string;
  onAdded: () => void;
}

export function TestParticipantButton({
  seasonId,
  onAdded,
}: TestParticipantButtonProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks au-dessus du early-return pour respecter les rules-of-hooks.
  if (process.env.NODE_ENV === "production") return null;

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiRequest(`/leagues/seasons/${seasonId}/test-participant`, {
        method: "POST",
      });
      onAdded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        data-testid="add-test-participant"
        onClick={handleClick}
        disabled={loading}
        title="Dev uniquement : inscrit une équipe de test à la saison"
        className="px-3 py-1.5 rounded-md bg-white border border-dashed border-gray-400 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        🧪 {loading ? "…" : t.leagues.addTestTeamButton}
      </button>
      {error ? (
        <span className="text-xs text-red-600" data-testid="add-test-error">
          {error}
        </span>
      ) : null}
    </span>
  );
}
