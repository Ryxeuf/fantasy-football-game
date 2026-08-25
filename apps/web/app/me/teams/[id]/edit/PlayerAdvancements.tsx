"use client";

/**
 * Améliorations acquises par un joueur, avec annulation.
 *
 * Les compétences ajoutées à la création n'apparaissaient que fondues dans
 * la liste `skills` du joueur, sans distinction ni moyen de revenir en
 * arrière. Chaque puce ici correspond à UNE amélioration achetée : la
 * retirer rend ses PSP à leur source (pool d'équipe ou SPP du joueur).
 */

import { useState } from "react";
import {
  advancementLabel,
  removeAdvancement,
  type PlayerAdvancementView,
} from "./psp-pool-client";

interface PlayerAdvancementsProps {
  readonly teamId: string;
  readonly playerId: string;
  readonly advancements: readonly PlayerAdvancementView[];
  /** slug -> nom affichable, depuis le catalogue de compétences. */
  readonly skillNames: ReadonlyMap<string, string>;
  /** Reçoit l'état du joueur renvoyé par le serveur après annulation. */
  readonly onRemoved: (player: {
    skills: string;
    advancements: string;
    spp: number;
  }) => void;
  readonly disabled?: boolean;
}

export default function PlayerAdvancements({
  teamId,
  playerId,
  advancements,
  skillNames,
  onRemoved,
  disabled = false,
}: PlayerAdvancementsProps) {
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (advancements.length === 0) return null;

  async function remove(index: number) {
    setBusyIndex(index);
    setError(null);
    try {
      const res = await removeAdvancement(teamId, playerId, index);
      onRemoved(res.player);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Échec de l'annulation");
    } finally {
      setBusyIndex(null);
    }
  }

  return (
    <div data-testid={`player-advancements-${playerId}`} className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {advancements.map((adv, index) => (
          <span
            key={`${adv.type}-${adv.skillSlug ?? adv.stat ?? ""}-${index}`}
            className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 py-0.5 pl-2 pr-1 text-[11px] text-indigo-900"
          >
            <span>
              {advancementLabel(
                adv,
                adv.skillSlug ? skillNames.get(adv.skillSlug) : undefined,
              )}
            </span>
            {typeof adv.pspCost === "number" && (
              <span className="font-mono text-indigo-600">
                {adv.pspCost} PSP
              </span>
            )}
            <button
              type="button"
              data-testid={`remove-advancement-${playerId}-${index}`}
              aria-label={`Annuler ${advancementLabel(
                adv,
                adv.skillSlug ? skillNames.get(adv.skillSlug) : undefined,
              )}`}
              title="Annuler cette amélioration"
              disabled={disabled || busyIndex !== null}
              onClick={() => remove(index)}
              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-indigo-500 transition-colors hover:bg-indigo-200 hover:text-indigo-900 disabled:opacity-40"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      {error && (
        <p
          data-testid={`advancement-error-${playerId}`}
          className="mt-1 text-[11px] text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
