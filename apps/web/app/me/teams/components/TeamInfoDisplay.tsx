"use client";

interface TeamInfo {
  treasury: number;
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
  teamValue?: number;
}

interface TeamInfoDisplayProps {
  info: TeamInfo;
}

export default function TeamInfoDisplay({ info }: TeamInfoDisplayProps) {
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

          {/* Valeur d'équipe */}
          {info.teamValue && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Valeur d'équipe</span>
              <span className="text-sm text-gray-900 font-mono">
                {info.teamValue.toLocaleString()} po
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
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Coûts du staff</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Cheerleaders ({info.cheerleaders})</span>
              <span className="font-mono">{(info.cheerleaders * 10).toLocaleString()} po</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Assistants ({info.assistants})</span>
              <span className="font-mono">{(info.assistants * 10).toLocaleString()} po</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Apothicaire</span>
              <span className="font-mono">{info.apothecary ? '50,000 po' : '0 po'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fans Dévoués ({info.dedicatedFans})</span>
              <span className="font-mono">{((info.dedicatedFans - 1) * 10).toLocaleString()} po</span>
            </div>
            <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
              <span className="text-gray-700">Total Staff</span>
              <span className="font-mono">
                {(info.cheerleaders * 10 + info.assistants * 10 + (info.apothecary ? 50 : 0) + (info.dedicatedFans - 1) * 10).toLocaleString()} po
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
