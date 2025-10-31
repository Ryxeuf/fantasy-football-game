"use client";

import { getRerollCost } from "@bb/game-engine";
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
}

interface TeamInfoDisplayProps {
  info: TeamInfo;
}

export default function TeamInfoDisplay({ info }: TeamInfoDisplayProps) {
  const { t } = useLanguage();
  const rerollCost = getRerollCost(info.roster || '');

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-gray-50 px-6 py-3 border-b">
        <h3 className="text-lg font-semibold">{t.teams.teamInfo}</h3>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trésorerie */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">{t.teams.treasury}</span>
            <span className="text-sm text-gray-900 font-mono">
              {info.treasury.toLocaleString()} {t.teams.po}
            </span>
          </div>

          {/* VE - Valeur d'Équipe */}
          {info.teamValue && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">{t.teams.teamValue}</span>
              <span className="text-sm text-gray-900 font-mono">
                {info.teamValue.toLocaleString()} {t.teams.po}
              </span>
            </div>
          )}

          {/* VEA - Valeur d'Équipe Actuelle */}
          {info.currentValue && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">{t.teams.currentValue}</span>
              <span className="text-sm text-gray-900 font-mono">
                {info.currentValue.toLocaleString()} {t.teams.po}
              </span>
            </div>
          )}

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
              {info.cheerleaders}
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
              <span className="text-gray-600">{t.teams.rerollsCost.replace("{count}", info.rerolls.toString()).replace("{cost}", rerollCost.toLocaleString())}</span>
              <span className="font-mono">{(info.rerolls * rerollCost).toLocaleString()} {t.teams.po}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t.teams.cheerleadersCost.replace("{count}", info.cheerleaders.toString())}</span>
              <span className="font-mono">{(info.cheerleaders * 10000).toLocaleString()} {t.teams.po}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t.teams.assistantsCost.replace("{count}", info.assistants.toString())}</span>
              <span className="font-mono">{(info.assistants * 10000).toLocaleString()} {t.teams.po}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t.teams.apothecary}</span>
              <span className="font-mono">{info.apothecary ? `50,000 ${t.teams.po}` : `0 ${t.teams.po}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t.teams.dedicatedFansCost.replace("{count}", info.dedicatedFans.toString())}</span>
              <span className="font-mono">{((info.dedicatedFans - 1) * 10000).toLocaleString()} {t.teams.po}</span>
            </div>
            <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
              <span className="text-gray-700">{t.teams.totalStaffRerolls}</span>
              <span className="font-mono">
                {(info.rerolls * rerollCost + info.cheerleaders * 10000 + info.assistants * 10000 + (info.apothecary ? 50000 : 0) + (info.dedicatedFans - 1) * 10000).toLocaleString()} {t.teams.po}
              </span>
            </div>
          </div>
        </div>

        {/* Coût total de l'équipe */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-800 mb-3">{t.teams.totalTeamCost}</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">{t.teams.teamValue}</span>
              <span className="font-mono font-semibold text-blue-900">
                {info.teamValue ? info.teamValue.toLocaleString() : '0'} {t.teams.po}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">{t.teams.currentValue}</span>
              <span className="font-mono font-semibold text-blue-900">
                {info.currentValue ? info.currentValue.toLocaleString() : '0'} {t.teams.po}
              </span>
            </div>
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
              const staffRerollsCost = info.rerolls * rerollCost + info.cheerleaders * 10000 + info.assistants * 10000 + (info.apothecary ? 50000 : 0) + (info.dedicatedFans - 1) * 10000;
              const playersCost = (info.teamValue || 0) - staffRerollsCost;
              
              return (
                <>
                  <div className="flex justify-between">
                    <span className="text-green-700">{t.teams.playersCostLabel}</span>
                    <span className="font-mono font-semibold text-green-900">
                      {playersCost.toLocaleString()} {t.teams.po}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">{t.teams.staffRerollsLabel}</span>
                    <span className="font-mono font-semibold text-green-900">
                      {staffRerollsCost.toLocaleString()} {t.teams.po}
                    </span>
                  </div>
                  <div className="border-t border-green-300 pt-2 mt-2">
                    <div className="flex justify-between font-bold">
                      <span className="text-green-800">{t.teams.veTotal}</span>
                      <span className="font-mono text-green-900">
                        {info.teamValue ? info.teamValue.toLocaleString() : '0'} {t.teams.po}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-green-800">{t.teams.veaTotal}</span>
                      <span className="font-mono text-green-900">
                        {info.currentValue ? info.currentValue.toLocaleString() : '0'} {t.teams.po}
                      </span>
                    </div>
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
