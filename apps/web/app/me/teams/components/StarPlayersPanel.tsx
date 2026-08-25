"use client";

/**
 * Star Players recrutés par une équipe, sur la fiche `/me/teams/[id]`.
 *
 * Ils n'apparaissaient nulle part : la composition ne liste que les
 * `TeamPlayer`, or un Star Player est un `TeamStarPlayer` (Coup de Pouce payé
 * sur le budget de construction, hors valeur d'équipe et sans numéro de
 * maillot). Un coach qui en recrutait un à la création ne le retrouvait donc
 * pas sur sa feuille.
 *
 * Le panneau est masqué quand l'équipe n'en a aucun.
 */

import { formatPlusStat } from "../../../lib/format-stats";
import { useLanguage } from "../../../contexts/LanguageContext";
import KeywordChips from "../../../components/KeywordChips";
import SkillTooltip from "./SkillTooltip";

export interface TeamStarPlayerView {
  readonly id?: string;
  readonly slug: string;
  /** Coût payé au recrutement (po). */
  readonly cost: number;
  readonly displayName?: string | null;
  readonly ma?: number | null;
  readonly st?: number | null;
  readonly ag?: number | null;
  readonly pa?: number | null;
  readonly av?: number | null;
  readonly skills?: string | null;
  readonly specialRule?: string | null;
  readonly keywords?: string | null;
  readonly keywordsEn?: string | null;
}

interface StarPlayersPanelProps {
  readonly starPlayers: readonly TeamStarPlayerView[];
}

export default function StarPlayersPanel({ starPlayers }: StarPlayersPanelProps) {
  const { t, language } = useLanguage();

  if (starPlayers.length === 0) return null;

  const totalCost = starPlayers.reduce((sum, sp) => sum + (sp.cost ?? 0), 0);
  const kpo = (value: number): string =>
    `${Math.round(value / 1000).toLocaleString("fr-FR")}${t.teams.kpo}`;

  return (
    <div
      data-testid="team-star-players"
      className="bg-white rounded-lg border overflow-hidden"
    >
      <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base sm:text-lg font-semibold">
          ⭐ {t.teams.starPlayersHiredTitle ?? "Star Players recrutés"}
        </h2>
        <div className="text-xs sm:text-sm text-gray-600">
          {starPlayers.length} ·{" "}
          <span
            className="font-mono font-semibold text-gray-900"
            data-testid="team-star-players-total"
          >
            {kpo(totalCost)}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-gray-200" role="list">
        {starPlayers.map((sp) => (
          <li
            key={sp.id ?? sp.slug}
            data-testid={`team-star-player-${sp.slug}`}
            className="p-4 sm:px-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-semibold text-sm sm:text-base text-gray-900">
                {sp.displayName ?? sp.slug}
              </div>
              <div
                className="font-mono text-sm font-semibold text-emerald-700"
                data-testid={`team-star-player-cost-${sp.slug}`}
              >
                {kpo(sp.cost ?? 0)}
              </div>
            </div>

            <KeywordChips
              keywords={language === "fr" ? sp.keywords : sp.keywordsEn}
              className="mt-1"
            />

            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600 font-mono">
              <span>MA {sp.ma ?? "-"}</span>
              <span>ST {sp.st ?? "-"}</span>
              <span>AG {formatPlusStat(sp.ag ?? null)}</span>
              <span>PA {formatPlusStat(sp.pa ?? null)}</span>
              <span>AV {formatPlusStat(sp.av ?? null)}</span>
            </div>

            {sp.skills ? (
              <div className="mt-2">
                <SkillTooltip skillsString={sp.skills} className="text-xs" />
              </div>
            ) : null}

            {sp.specialRule ? (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-medium">{t.teams.specialRule}</span>{" "}
                {sp.specialRule}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="px-4 sm:px-6 py-3 border-t bg-gray-50 text-xs text-gray-600">
        Les Star Players sont des Coups de Pouce : payés sur le budget de
        construction, ils n&apos;entrent pas dans la Valeur d&apos;Équipe et ne
        portent pas de numéro de maillot.
      </p>
    </div>
  );
}
