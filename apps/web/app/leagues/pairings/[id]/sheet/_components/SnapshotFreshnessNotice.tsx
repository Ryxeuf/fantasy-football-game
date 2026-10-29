"use client";

import type { FreshnessBanner } from "../freshness";

/**
 * Fraîcheur de la « version du match » : alerte quand une autre feuille
 * d'une des deux équipes a été validée (ou invalidée) après l'ouverture de
 * celle-ci, et bouton « Mettre à jour la feuille ». Gel à jour, le bouton
 * reste disponible, en discret : une correction de roster par le
 * commissaire, par exemple, ne se détecte pas.
 */
export function SnapshotFreshnessNotice({
  banner,
  busy,
  onRefresh,
}: {
  banner: FreshnessBanner;
  busy: boolean;
  onRefresh: () => void;
}) {
  const button = banner.canRefresh ? (
    <button
      type="button"
      onClick={onRefresh}
      disabled={busy}
      data-testid="sheet-refresh"
      className={
        banner.stale
          ? "rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          : "rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 disabled:opacity-50"
      }
      title="Refige les deux équipes dans leur état actuel (PSP, blessures, trésorerie, fans…), en gardant ce qui est déjà saisi."
    >
      Mettre à jour la feuille
    </button>
  ) : null;

  if (!banner.stale) {
    return button ? (
      <div className="flex justify-end" data-testid="sheet-refresh-idle">
        {button}
      </div>
    ) : null;
  }

  return (
    <div
      data-testid="sheet-snapshot-stale"
      className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
    >
      <p>
        <strong>Feuille à mettre à jour.</strong> Elle a figé les équipes à
        son ouverture, et une rencontre a changé depuis :
      </p>
      <ul className="list-disc pl-5">
        {banner.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {banner.blockedHint && <p>{banner.blockedHint}</p>}
      {button}
    </div>
  );
}
