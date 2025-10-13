"use client";

import { getRerollCost } from "@bb/game-engine";

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
  const rerollCost = getRerollCost(info.roster || '');

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-gray-50 px-6 py-3 border-b">
        <h3 className="text-lg font-semibold">Informations d'équipe</h3>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trésorerie */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Trésorerie</span>
            <span className="text-sm text-gray-900 font-mono">
              {info.treasury.toLocaleString()} po
            </span>
          </div>

          {/* VE - Valeur d'Équipe */}
          {info.teamValue && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">VE (Valeur d'Équipe)</span>
              <span className="text-sm text-gray-900 font-mono">
                {info.teamValue.toLocaleString()} po
              </span>
            </div>
          )}

          {/* VEA - Valeur d'Équipe Actuelle */}
          {info.currentValue && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">VEA (Valeur Actuelle)</span>
              <span className="text-sm text-gray-900 font-mono">
                {info.currentValue.toLocaleString()} po
              </span>
            </div>
          )}

          {/* Relances */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Relances</span>
            <span className="text-sm text-gray-900 font-mono">
              {info.rerolls}
            </span>
          </div>

          {/* Cheerleaders */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Cheerleaders</span>
            <span className="text-sm text-gray-900 font-mono">
              {info.cheerleaders}
            </span>
          </div>

          {/* Assistants */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Assistants</span>
            <span className="text-sm text-gray-900 font-mono">
              {info.assistants}
            </span>
          </div>

          {/* Apothicaire */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Apothicaire</span>
            <span className={`text-sm font-medium ${info.apothecary ? 'text-green-600' : 'text-gray-500'}`}>
              {info.apothecary ? 'Présent' : 'Absent'}
            </span>
          </div>

          {/* Fans Dévoués */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Fans Dévoués</span>
            <span className="text-sm text-gray-900 font-mono">
              {info.dedicatedFans}
            </span>
          </div>
        </div>

        {/* Calcul des coûts */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Coûts détaillés</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Relances ({info.rerolls} × {rerollCost.toLocaleString()} po)</span>
              <span className="font-mono">{(info.rerolls * rerollCost).toLocaleString()} po</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cheerleaders ({info.cheerleaders})</span>
              <span className="font-mono">{(info.cheerleaders * 10000).toLocaleString()} po</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Assistants ({info.assistants})</span>
              <span className="font-mono">{(info.assistants * 10000).toLocaleString()} po</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Apothicaire</span>
              <span className="font-mono">{info.apothecary ? '50,000 po' : '0 po'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fans Dévoués ({info.dedicatedFans})</span>
              <span className="font-mono">{((info.dedicatedFans - 1) * 10000).toLocaleString()} po</span>
            </div>
            <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
              <span className="text-gray-700">Total Staff + Relances</span>
              <span className="font-mono">
                {(info.rerolls * rerollCost + info.cheerleaders * 10000 + info.assistants * 10000 + (info.apothecary ? 50000 : 0) + (info.dedicatedFans - 1) * 10000).toLocaleString()} po
              </span>
            </div>
          </div>
        </div>

        {/* Coût total de l'équipe */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-800 mb-3">💰 Coût total de l'équipe</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">VE (Valeur d'Équipe)</span>
              <span className="font-mono font-semibold text-blue-900">
                {info.teamValue ? info.teamValue.toLocaleString() : '0'} po
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">VEA (Valeur Actuelle)</span>
              <span className="font-mono font-semibold text-blue-900">
                {info.currentValue ? info.currentValue.toLocaleString() : '0'} po
              </span>
            </div>
            <div className="mt-3 pt-2 border-t border-blue-300">
              <div className="text-xs text-blue-600">
                <p><strong>VE</strong> : Tous les joueurs engagés + Staff + Relances</p>
                <p><strong>VEA</strong> : Joueurs disponibles + Staff + Relances</p>
              </div>
            </div>
          </div>
        </div>

        {/* Résumé global des coûts */}
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="text-sm font-semibold text-green-800 mb-3">📊 Résumé global des coûts</h4>
          <div className="space-y-2 text-sm">
            {(() => {
              const staffRerollsCost = info.rerolls * rerollCost + info.cheerleaders * 10000 + info.assistants * 10000 + (info.apothecary ? 50000 : 0) + (info.dedicatedFans - 1) * 10000;
              const playersCost = (info.teamValue || 0) - staffRerollsCost;
              
              return (
                <>
                  <div className="flex justify-between">
                    <span className="text-green-700">👥 Coût des joueurs</span>
                    <span className="font-mono font-semibold text-green-900">
                      {playersCost.toLocaleString()} po
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">⚙️ Staff + Relances</span>
                    <span className="font-mono font-semibold text-green-900">
                      {staffRerollsCost.toLocaleString()} po
                    </span>
                  </div>
                  <div className="border-t border-green-300 pt-2 mt-2">
                    <div className="flex justify-between font-bold">
                      <span className="text-green-800">VE (Total)</span>
                      <span className="font-mono text-green-900">
                        {info.teamValue ? info.teamValue.toLocaleString() : '0'} po
                      </span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-green-800">VEA (Total)</span>
                      <span className="font-mono text-green-900">
                        {info.currentValue ? info.currentValue.toLocaleString() : '0'} po
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
