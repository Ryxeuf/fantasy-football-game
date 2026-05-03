"use client";
import { useCallback, useState } from "react";
import { exportCoachCardPDF } from "./exportCoachCardPDF";
import type { CoachEloSnapshot, CoachPublicProfile } from "./types";

export type CoachCardExporter = (
  profile: CoachPublicProfile,
  snapshots: CoachEloSnapshot[],
) => Promise<void>;

interface CoachExportPdfButtonProps {
  profile: CoachPublicProfile;
  eloSnapshots: CoachEloSnapshot[];
  /**
   * Injectable for tests so the click handler can be exercised without
   * loading jspdf in jsdom. Defaults to the real `exportCoachCardPDF`.
   */
  exporter?: CoachCardExporter;
}

/**
 * S26.3o — Bouton "Telecharger en PDF" sur `/coach/{slug}`.
 *
 * Composant client (jspdf est cote browser uniquement). Etat `loading`
 * desactive le bouton pendant l'export, message d'erreur affiche si
 * jspdf throw — pas de bouclage silencieux.
 */
export default function CoachExportPdfButton({
  profile,
  eloSnapshots,
  exporter = exportCoachCardPDF,
}: CoachExportPdfButtonProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await exporter(profile, eloSnapshots);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur export PDF");
    } finally {
      setLoading(false);
    }
  }, [exporter, profile, eloSnapshots]);

  return (
    <div data-testid="coach-export-pdf">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-nuffle-gold bg-nuffle-gold/10 text-nuffle-anthracite font-semibold text-sm hover:bg-nuffle-gold/20 disabled:opacity-50"
      >
        {loading ? "Generation..." : "Telecharger le profil en PDF"}
      </button>
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
