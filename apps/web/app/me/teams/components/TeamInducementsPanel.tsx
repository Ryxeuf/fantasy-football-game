"use client";

/**
 * Coups de pouce achetés À LA CRÉATION d'une équipe (coupe en mode `build`,
 * règlement de tournoi), sur la fiche `/me/teams/[id]`.
 *
 * Comme les Star Players, ce ne sont pas des `TeamPlayer` : ils sont payés
 * sur le budget de construction, hors valeur d'équipe, et valent pour chaque
 * rencontre de la coupe d'inscription. Le panneau est masqué quand l'équipe
 * n'en porte aucun.
 */

import { useLanguage } from "../../../contexts/LanguageContext";

export interface TeamInducementView {
  readonly slug: string;
  /** Nom servi par le serveur (catalogue), le slug à défaut. */
  readonly name?: string | null;
  readonly quantity: number;
  /** Prix unitaire payé au build (po). */
  readonly unitCost: number;
}

interface TeamInducementsPanelProps {
  readonly inducements: readonly TeamInducementView[];
}

export default function TeamInducementsPanel({ inducements }: TeamInducementsPanelProps) {
  const { t } = useLanguage();

  if (inducements.length === 0) return null;

  const totalCost = inducements.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);
  const kpo = (value: number): string =>
    `${Math.round(value / 1000).toLocaleString("fr-FR")}${t.teams.kpo}`;

  return (
    <div data-testid="team-inducements" className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base sm:text-lg font-semibold">🎁 {t.teams.teamInducementsTitle}</h2>
        <span
          className="font-mono font-semibold text-gray-900 text-xs sm:text-sm"
          data-testid="team-inducements-total"
        >
          {kpo(totalCost)}
        </span>
      </div>
      <ul className="divide-y divide-gray-200" role="list">
        {inducements.map((i) => (
          <li
            key={i.slug}
            data-testid={`team-inducement-${i.slug}`}
            className="px-4 sm:px-6 py-2 flex items-baseline justify-between gap-2 text-sm"
          >
            <span className="text-gray-900">
              {i.name || i.slug} <span className="text-gray-500">×{i.quantity}</span>
            </span>
            <span className="font-mono text-gray-700">{kpo(i.unitCost * i.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="px-4 sm:px-6 py-2 text-[11px] text-gray-500 border-t">
        {t.teams.teamInducementsHint}
      </p>
    </div>
  );
}
