"use client";

import { getRerollCost, type RosterStaffConfig } from "@bb/game-engine";
import { useLanguage } from "../../../contexts/LanguageContext";

interface TeamInfo {
  treasury: number;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
  teamValue?: number; // VE - Valeur d'Équipe (calculée)
  currentValue?: number; // VEA - Valeur d'Équipe Actuelle (calculée)
  roster?: string; // Roster pour calculer le coût des relances
  /** Config staff résolue (DB par roster × format). Coûts en po. */
  staffConfig?: RosterStaffConfig;
  /**
   * Coût réel des joueurs engagés (po), calculé par le serveur : coûts de
   * poste au ruleset de l'équipe + surcoûts d'avancement. Optionnel pour
   * rétro-compat avec un serveur pré-correctif — à défaut, on retombe sur
   * la dérivation `VE − staff` (juste seulement si la VE est fraîche).
   */
  playersCost?: number;
  /**
   * Coût des Star Players recrutés (po). Ils sont payés sur le budget de
   * construction mais restent HORS valeur d'équipe (Coups de Pouce) : d'où
   * une ligne à part dans le résumé, qui n'entre pas dans le total VE.
   */
  starPlayersCost?: number;
  /** Cheerleaders + assistants + apothicaire (po), calculés par le serveur. */
  staffCost?: number;
  /** Relances d'équipe (po), calculées par le serveur. */
  rerollsCost?: number;
  /**
   * Fans dévoués ACHETÉS (le premier est offert). Payés en or mais hors
   * VE/VEA : la carte les listait comme un effectif sans jamais dire ce
   * qu'ils avaient coûté, ni pourquoi ils manquaient au total staff.
   */
  dedicatedFansCost?: number;
  /** Valeur des joueurs indisponibles au prochain match (VE − VEA). */
  unavailablePlayersCost?: number;
  /**
   * Coût d'embauche annulé dans la VEA par « Trois-quarts à vil prix ».
   * C'est la seule explication possible d'une VEA inférieure à la VE sur une
   * équipe qui n'a joué aucun match — encore faut-il l'afficher.
   */
  cheapLinemenWaived?: number;
}

interface TeamInfoDisplayProps {
  info: TeamInfo;
}

export default function TeamInfoDisplay({ info }: TeamInfoDisplayProps) {
  const { t } = useLanguage();
  // Coût de relance : config DB résolue si fournie, sinon défaut historique.
  const rerollCost = info.staffConfig?.rerollCost ?? getRerollCost(info.roster || '');
  // Coûts staff : config DB résolue si fournie, sinon défauts édition 2025
  // (fan dévoué à 5 000 po).
  const cheerleaderCost = info.staffConfig?.cheerleaderCost ?? 10000;
  const assistantCost = info.staffConfig?.assistantCost ?? 10000;
  const apothecaryCost = info.staffConfig?.apothecaryCost ?? 50000;
  // Les Fans Dévoués ne comptent ni dans la VE ni dans la VEA : leur achat
  // coûte de la trésorerie mais leur valeur n'entre pas dans le total staff.
  //
  // Postes SERVIS par le serveur quand ils sont disponibles : la carte les
  // re-dérivait, et le moindre écart de config staff faisait mentir le
  // « Résumé global » (dont le total est censé être exactement la VE).
  const rerollsCost = info.rerollsCost ?? info.rerolls * rerollCost;
  const staffOnlyCost =
    info.staffCost ??
    info.cheerleaders * cheerleaderCost +
      info.assistants * assistantCost +
      (info.apothecary ? apothecaryCost : 0);
  const staffRerollsCost = staffOnlyCost + rerollsCost;
  const dedicatedFansCost = info.dedicatedFansCost ?? 0;
  const unavailablePlayersCost = info.unavailablePlayersCost ?? 0;
  const cheapLinemenWaived = info.cheapLinemenWaived ?? 0;

  // Tous les montants de la carte s'affichent en kpo (« 50K po ») pour
  // rester compacts — même convention que le reste de la fiche équipe.
  const formatKpo = (value: number | undefined | null): string => {
    const num = Math.round((value ?? 0) / 1000);
    return `${num.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}${t.teams.kpo}`;
  };

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-gray-50 px-6 py-3 border-b">
        <h3 className="text-lg font-semibold">{t.teams.teamStaff}</h3>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trésorerie */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{t.teams.treasury}</span>
            <span className="text-sm text-gray-900 font-mono">
              {formatKpo(info.treasury)}
            </span>
          </div>

          {/* VE - Valeur d'Équipe */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{t.teams.teamValue}</span>
            <span className="text-sm text-gray-900 font-mono">
              {formatKpo(info.teamValue)}
            </span>
          </div>

          {/* VEA - Valeur d'Équipe Actuelle */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{t.teams.currentValue}</span>
            <span className="text-sm text-gray-900 font-mono">
              {formatKpo(info.currentValue)}
            </span>
          </div>

          {/* Relances */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{t.teams.rerolls}</span>
            <span className="text-sm text-gray-900 font-mono">
              {info.rerolls}
            </span>
          </div>

          {/* Cheerleaders */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{t.teams.cheerleaders}</span>
            <span className="text-sm text-gray-900 font-mono">
              {info.cheerleaders ?? 0}
            </span>
          </div>

          {/* Assistants */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{t.teams.assistants}</span>
            <span className="text-sm text-gray-900 font-mono">
              {info.assistants}
            </span>
          </div>

          {/* Apothicaire */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{t.teams.apothecary}</span>
            <span className={`text-sm font-medium ${info.apothecary ? 'text-green-600' : 'text-gray-500'}`}>
              {info.apothecary ? t.teams.apothecaryPresent : t.teams.apothecaryAbsent}
            </span>
          </div>

          {/* Fans Dévoués */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{t.teams.dedicatedFans}</span>
            <span className="text-sm text-gray-900 font-mono">
              {info.dedicatedFans}
            </span>
          </div>
        </div>

        {/* Calcul des coûts */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">{t.teams.detailedCosts}</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t.teams.rerollsCost.replace("{count}", info.rerolls.toString()).replace("{cost}", formatKpo(rerollCost))}</span>
              <span className="font-mono">{formatKpo(rerollsCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t.teams.cheerleadersCost.replace("{count}", info.cheerleaders.toString())}</span>
              <span className="font-mono">{formatKpo(info.cheerleaders * cheerleaderCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t.teams.assistantsCost.replace("{count}", info.assistants.toString())}</span>
              <span className="font-mono">{formatKpo(info.assistants * assistantCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t.teams.apothecary}</span>
              <span className="font-mono">{info.apothecary ? formatKpo(apothecaryCost) : `0${t.teams.kpo}`}</span>
            </div>
            <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
              <span className="text-gray-700">{t.teams.totalStaffRerolls}</span>
              <span className="font-mono" data-testid="staff-rerolls-cost">
                {formatKpo(staffRerollsCost)}
              </span>
            </div>
            {/* Fans dévoués : payés en or, HORS VE/VEA. Affichés APRÈS le
                total (ils n'en font pas partie) — absents de ce bloc, ils
                creusaient un écart inexpliqué entre le budget dépensé et le
                total staff. */}
            {info.dedicatedFans > 1 ? (
              <>
                <div className="flex justify-between text-gray-500">
                  <span>
                    {t.teams.dedicatedFansCost.replace(
                      "{count}",
                      Math.max(0, info.dedicatedFans - 1).toString(),
                    )}
                  </span>
                  <span
                    className="font-mono"
                    data-testid="staff-dedicated-fans-cost"
                  >
                    {formatKpo(dedicatedFansCost)}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  {t.teams.dedicatedFansOutOfTvHint}
                </p>
              </>
            ) : null}
          </div>
        </div>

        {/* Coût total de l'équipe */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-800 mb-3">{t.teams.totalTeamCost}</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">{t.teams.teamValue}</span>
              <span className="font-mono font-semibold text-blue-900">
                {formatKpo(info.teamValue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">{t.teams.currentValue}</span>
              <span className="font-mono font-semibold text-blue-900">
                {formatKpo(info.currentValue)}
              </span>
            </div>
            {/* Écart VE → VEA, poste par poste.
                Une VEA inférieure à la VE sur une équipe qui n'a joué aucun
                match n'a que deux causes possibles : des joueurs
                indisponibles, ou « Trois-quarts à vil prix » qui annule leur
                coût d'embauche. Sans ces deux lignes, l'écart passe pour une
                erreur de calcul — c'est exactement ce qui a été remonté. */}
            {unavailablePlayersCost > 0 || cheapLinemenWaived > 0 ? (
              <div
                className="mt-2 space-y-1 rounded border border-blue-200 bg-white/60 p-2 text-xs text-blue-800"
                data-testid="tv-ctv-gap"
              >
                <p className="font-semibold">{t.teams.veaGapTitle}</p>
                {cheapLinemenWaived > 0 ? (
                  <div className="flex justify-between gap-2">
                    <span>{t.teams.veaGapCheapLinemen}</span>
                    <span
                      className="font-mono whitespace-nowrap"
                      data-testid="tv-ctv-cheap-linemen"
                    >
                      −{formatKpo(cheapLinemenWaived)}
                    </span>
                  </div>
                ) : null}
                {unavailablePlayersCost > 0 ? (
                  <div className="flex justify-between gap-2">
                    <span>{t.teams.veaGapUnavailable}</span>
                    <span
                      className="font-mono whitespace-nowrap"
                      data-testid="tv-ctv-unavailable"
                    >
                      −{formatKpo(unavailablePlayersCost)}
                    </span>
                  </div>
                ) : null}
                {cheapLinemenWaived > 0 ? (
                  <p className="pt-1 text-[11px] text-blue-700">
                    {t.teams.veaGapCheapLinemenHint}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-3 pt-2 border-t border-blue-300">
              <div className="text-xs text-blue-600">
                <p><strong>{t.teams.veShort}</strong> : {t.teams.veDescription}</p>
                <p><strong>{t.teams.veaShort}</strong> : {t.teams.veaDescription}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Résumé global des coûts */}
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="text-sm font-semibold text-green-800 mb-3">{t.teams.globalCostSummary}</h4>
          <div className="space-y-2 text-sm">
            {(() => {
              // Les Star Players sont des Coups de Pouce : payés au budget
              // de construction mais HORS valeur d'équipe. On les garde donc
              // en dehors de ce bloc, dont le total est la VE.
              const playersCost =
                info.playersCost ?? (info.teamValue || 0) - staffRerollsCost;
              const starPlayersCost = info.starPlayersCost ?? 0;

              return (
                <>
                  <div className="flex justify-between">
                    <span className="text-green-700">{t.teams.playersCostLabel}</span>
                    <span
                      className="font-mono font-semibold text-green-900"
                      data-testid="staff-players-cost"
                    >
                      {formatKpo(playersCost)}
                    </span>
                  </div>
                  {starPlayersCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-green-700">
                        {t.teams.starPlayersCostLabel ??
                          "⭐ Coût des Star Players"}
                      </span>
                      <span
                        className="font-mono font-semibold text-green-900"
                        data-testid="staff-star-players-cost"
                      >
                        {formatKpo(starPlayersCost)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-green-700">{t.teams.staffRerollsLabel}</span>
                    <span className="font-mono font-semibold text-green-900">
                      {formatKpo(staffRerollsCost)}
                    </span>
                  </div>
                  <div className="border-t border-green-300 pt-2 mt-2">
                    <div className="flex justify-between font-bold">
                      <span className="text-green-800">{t.teams.veTotal}</span>
                      <span
                        className="font-mono text-green-900"
                        data-testid="global-ve-total"
                      >
                        {formatKpo(info.teamValue)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-green-800">{t.teams.veaTotal}</span>
                      <span
                        className="font-mono text-green-900"
                        data-testid="global-vea-total"
                      >
                        {formatKpo(info.currentValue)}
                      </span>
                    </div>
                    {/* Ce bloc totalise la VE : les Star Players et les fans
                        dévoués sont payés en or mais n'y entrent pas. Le dire
                        ici évite de chercher pourquoi l'addition « ne tombe
                        pas juste ». */}
                    <p className="pt-2 text-[11px] text-green-700">
                      {t.teams.globalCostSummaryHint}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
