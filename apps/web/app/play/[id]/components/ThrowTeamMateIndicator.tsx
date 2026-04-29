"use client";

/**
 * Indicateur fixe en haut de l'ecran qui explique l'etape courante
 * du flow THROW_TEAM_MATE (selectionner le coequipier a lancer puis
 * la case d'arrivee). Inclut un bouton Annuler.
 *
 * Extrait de `play/[id]/page.tsx` dans le cadre du refactor S26.0i.
 */

interface ThrowTeamMateIndicatorProps {
  thrownPlayerId: string | null;
  onCancel: () => void;
}

export function ThrowTeamMateIndicator({
  thrownPlayerId,
  onCancel,
}: ThrowTeamMateIndicatorProps) {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-3">
      <span>
        {thrownPlayerId
          ? "Cliquez sur la case d'arrivée"
          : "Cliquez sur le coéquipier à lancer"}
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="px-2 py-0.5 bg-purple-900 rounded text-xs hover:bg-purple-950"
      >
        Annuler
      </button>
    </div>
  );
}
