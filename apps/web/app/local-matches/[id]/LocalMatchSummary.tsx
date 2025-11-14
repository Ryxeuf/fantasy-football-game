"use client";
import { useState, useEffect } from "react";
import { API_BASE } from "../../auth-client";

type ActionType = "passe" | "reception" | "td" | "blocage" | "blitz" | "transmission" | "aggression" | "sprint" | "esquive" | "apothicaire" | "interception";

const ActionIcons: Record<ActionType, string> = {
  passe: "🏈",
  reception: "✋",
  td: "🏆",
  blocage: "💥",
  blitz: "⚡",
  transmission: "🔄",
  aggression: "👊",
  sprint: "💨",
  esquive: "🌀",
  apothicaire: "💉",
  interception: "🛡️",
};

const ActionLabels: Record<ActionType, string> = {
  passe: "Passe",
  reception: "Réception",
  td: "Touchdown",
  blocage: "Blocage",
  blitz: "Blitz",
  transmission: "Transmission",
  aggression: "Agression",
  sprint: "Sprint",
  esquive: "Esquive",
  apothicaire: "Apothicaire",
  interception: "Interception",
};

type LocalMatchAction = {
  id: string;
  half: number;
  turn: number;
  actionType: ActionType;
  playerId: string;
  playerName: string;
  playerTeam: "A" | "B";
  opponentId: string | null;
  opponentName: string | null;
  diceResult: number | null;
  fumble: boolean;
  playerState: string | null;
  armorBroken: boolean;
  opponentState: string | null;
  passType: string | null;
  createdAt: string;
};

type LocalMatch = {
  id: string;
  name: string | null;
  teamA: {
    id: string;
    name: string;
  };
  teamB: {
    id: string;
    name: string;
  };
  scoreTeamA: number | null;
  scoreTeamB: number | null;
  startedAt: string | null;
  completedAt: string | null;
  cup: {
    id: string;
    name: string;
  } | null;
  gameState?: {
    preMatch?: {
      fanFactor?: {
        teamA: { d3: number; dedicatedFans: number; total: number };
        teamB: { d3: number; dedicatedFans: number; total: number };
      };
      weatherType?: string;
      weather?: {
        total: number;
        condition: string;
        description: string;
      };
    };
  };
};

interface LocalMatchSummaryProps {
  matchId: string;
  match: LocalMatch;
}

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

function formatActionDescription(action: LocalMatchAction, teamAName: string, teamBName: string): string {
  const teamName = action.playerTeam === "A" ? teamAName : teamBName;
  const opponentTeamName = action.playerTeam === "A" ? teamBName : teamAName;
  
  let desc = `${ActionIcons[action.actionType]} ${ActionLabels[action.actionType]} - ${action.playerName} (${teamName})`;
  
  if (action.opponentName) {
    desc += ` vs ${action.opponentName} (${opponentTeamName})`;
  }
  
  if (action.diceResult !== null) {
    desc += ` - Dé: ${action.diceResult}`;
  }
  
  if (action.fumble) {
    desc += " ❌ Échec";
    if (action.playerState) {
      desc += ` (${action.playerState})`;
    }
  } else if (action.actionType === "blocage" || action.actionType === "blitz") {
    if (action.armorBroken) {
      desc += " ✅ Armure cassée";
      if (action.opponentState) {
        desc += ` (${action.opponentState})`;
      }
    } else {
      desc += " ⚪ Armure non cassée";
    }
  } else if (action.actionType === "passe" && action.passType) {
    desc += ` - ${action.passType}`;
  }
  
  return desc;
}

// Fonction pour formater les actions pour le PDF (sans emojis)
function formatActionDescriptionForPDF(action: LocalMatchAction, teamAName: string, teamBName: string): string {
  const teamName = action.playerTeam === "A" ? teamAName : teamBName;
  const opponentTeamName = action.playerTeam === "A" ? teamBName : teamAName;
  
  // Utiliser des symboles texte au lieu d'emojis
  const actionSymbols: Record<ActionType, string> = {
    passe: "[P]",
    reception: "[R]",
    td: "[TD]",
    blocage: "[B]",
    blitz: "[BL]",
    transmission: "[T]",
    aggression: "[A]",
    sprint: "[S]",
    esquive: "[E]",
    apothicaire: "[AP]",
    interception: "[I]",
  };
  
  let desc = `${actionSymbols[action.actionType]} ${ActionLabels[action.actionType]} - ${action.playerName} (${teamName})`;
  
  if (action.opponentName) {
    desc += ` vs ${action.opponentName} (${opponentTeamName})`;
  }
  
  if (action.diceResult !== null) {
    desc += ` - Dé: ${action.diceResult}`;
  }
  
  if (action.fumble) {
    desc += " [ECHEC]";
    if (action.playerState) {
      desc += ` (${action.playerState})`;
    }
  } else if (action.actionType === "blocage" || action.actionType === "blitz") {
    if (action.armorBroken) {
      desc += " [ARMURE CASSEE]";
      if (action.opponentState) {
        desc += ` (${action.opponentState})`;
      }
    } else {
      desc += " [ARMURE NON CASSEE]";
    }
  } else if (action.actionType === "passe" && action.passType) {
    desc += ` - ${action.passType}`;
  }
  
  return desc;
}

export default function LocalMatchSummary({ matchId, match }: LocalMatchSummaryProps) {
  const [actions, setActions] = useState<LocalMatchAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActions();
  }, [matchId]);

  // Debug: vérifier les données de pré-match
  useEffect(() => {
    console.log("LocalMatchSummary - match data:", {
      hasGameState: !!match.gameState,
      hasPreMatch: !!match.gameState?.preMatch,
      hasFanFactor: !!match.gameState?.preMatch?.fanFactor,
      hasWeather: !!match.gameState?.preMatch?.weather,
      preMatch: match.gameState?.preMatch,
    });
  }, [match]);

  const loadActions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { actions: data } = await fetchJSON(`/local-match/${matchId}/actions`);
      setActions(data);
    } catch (e: any) {
      console.error("Erreur lors du chargement des actions:", e);
      setError(e.message || "Erreur lors du chargement des actions");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Titre
      doc.setFontSize(20);
      doc.text('Récapitulatif du Match', 105, 20, { align: 'center' });

      // Informations du match
      doc.setFontSize(14);
      doc.text(match.name || 'Partie offline', 105, 30, { align: 'center' });
      
      doc.setFontSize(12);
      const yStart = 40;
      let yPos = yStart;
      
      doc.text(`${match.teamA.name} vs ${match.teamB.name}`, 105, yPos, { align: 'center' });
      yPos += 10;
      
      if (match.cup) {
        doc.text(`Coupe: ${match.cup.name}`, 105, yPos, { align: 'center' });
        yPos += 10;
      }

      // Score façon football US
      const scoreTeamA = match.scoreTeamA || 0;
      const scoreTeamB = match.scoreTeamB || 0;
      
      // Compter les joueurs éliminés/exclus par équipe
      const eliminatedA = actions.filter(a => 
        (a.playerTeam === "A" && a.playerState === "elimine") ||
        (a.playerTeam === "B" && a.opponentState === "elimine" && a.opponentId && a.opponentName)
      ).length;
      const eliminatedB = actions.filter(a => 
        (a.playerTeam === "B" && a.playerState === "elimine") ||
        (a.playerTeam === "A" && a.opponentState === "elimine" && a.opponentId && a.opponentName)
      ).length;
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('SCORE FINAL', 105, yPos + 5, { align: 'center' });
      yPos += 12;
      
      // Score en grand
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      const scoreText = `${scoreTeamA} - ${scoreTeamB}`;
      doc.text(scoreText, 105, yPos, { align: 'center' });
      yPos += 12;
      
      // Équipes et éliminations
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const teamAText = `${match.teamA.name}: ${eliminatedA} Éliminé${eliminatedA > 1 ? 's' : ''}`;
      const teamBText = `${match.teamB.name}: ${eliminatedB} Éliminé${eliminatedB > 1 ? 's' : ''}`;
      doc.text(teamAText, 105, yPos, { align: 'center' });
      yPos += 6;
      doc.text(teamBText, 105, yPos, { align: 'center' });
      yPos += 15;

      // Dates
      if (match.startedAt) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Début: ${new Date(match.startedAt).toLocaleString('fr-FR')}`, 20, yPos);
        yPos += 6;
      }
      if (match.completedAt) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fin: ${new Date(match.completedAt).toLocaleString('fr-FR')}`, 20, yPos);
        yPos += 12;
      }

      // Informations de pré-match
      if (match.gameState?.preMatch && (match.gameState.preMatch.fanFactor || match.gameState.preMatch.weather)) {
        // Nouvelle page si nécessaire
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORMATIONS D\'AVANT-MATCH', 105, yPos, { align: 'center' });
        yPos += 12;

        // Fans dévoués
        if (match.gameState.preMatch.fanFactor) {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Fans dévoués', 20, yPos);
          yPos += 8;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          const fanFactorA = match.gameState.preMatch.fanFactor.teamA;
          const fanFactorB = match.gameState.preMatch.fanFactor.teamB;
          doc.text(`${match.teamA.name}: Fan Factor ${fanFactorA.total} (D3: ${fanFactorA.d3} + Fans: ${fanFactorA.dedicatedFans})`, 25, yPos);
          yPos += 6;
          doc.text(`${match.teamB.name}: Fan Factor ${fanFactorB.total} (D3: ${fanFactorB.d3} + Fans: ${fanFactorB.dedicatedFans})`, 25, yPos);
          yPos += 10;
        }

        // Conditions météorologiques
        if (match.gameState.preMatch.weather) {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('Conditions météorologiques', 20, yPos);
          yPos += 8;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          const weather = match.gameState.preMatch.weather;
          doc.text(`Type: ${match.gameState.preMatch.weatherType || 'classique'}`, 25, yPos);
          yPos += 6;
          doc.text(`Total 2D6: ${weather.total}`, 25, yPos);
          yPos += 6;
          doc.setFont('helvetica', 'bold');
          doc.text(weather.condition, 25, yPos);
          yPos += 6;
          doc.setFont('helvetica', 'normal');
          const descLines = doc.splitTextToSize(weather.description, 160);
          doc.text(descLines, 25, yPos);
          yPos += descLines.length * 5 + 10;
        }
      }

      // Liste des actions par mi-temps
      const actionsByHalf = actions.reduce((acc, action) => {
        if (!acc[action.half]) {
          acc[action.half] = [];
        }
        acc[action.half].push(action);
        return acc;
      }, {} as Record<number, LocalMatchAction[]>);

      for (const half of [1, 2]) {
        const halfActions = actionsByHalf[half] || [];
        if (halfActions.length === 0) continue;

        // Nouvelle page si nécessaire
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.text(`MI-TEMPS ${half}`, 20, yPos);
        yPos += 10;

        // Grouper par tour
        const actionsByTurn = halfActions.reduce((acc, action) => {
          if (!acc[action.turn]) {
            acc[action.turn] = [];
          }
          acc[action.turn].push(action);
          return acc;
        }, {} as Record<number, LocalMatchAction[]>);

        for (const turn of Object.keys(actionsByTurn).map(Number).sort((a, b) => a - b)) {
          const turnActions = actionsByTurn[turn];
          
          // Vérifier si on a besoin d'une nouvelle page avant d'ajouter le tour
          // Laisser plus d'espace pour éviter les superpositions
          if (yPos > 240) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(`Tour ${turn}`, 25, yPos);
          yPos += 8;

          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          for (const action of turnActions) {
            // Vérifier si on a besoin d'une nouvelle page avant chaque action
            // Laisser plus d'espace pour éviter les superpositions
            if (yPos > 270) {
              doc.addPage();
              yPos = 20;
            }
            
            // Utiliser la fonction sans emojis pour le PDF
            const desc = formatActionDescriptionForPDF(action, match.teamA.name, match.teamB.name);
            // Largeur réduite pour éviter les coupures et permettre les retours à la ligne
            const lines = doc.splitTextToSize(desc, 160);
            
            // Vérifier qu'on a assez d'espace pour toutes les lignes
            const neededSpace = lines.length * 5 + 3;
            if (yPos + neededSpace > 280) {
              doc.addPage();
              yPos = 20;
            }
            
            doc.text(lines, 30, yPos);
            // Espacement dynamique selon le nombre de lignes avec marge supplémentaire
            yPos += neededSpace;
          }
          yPos += 6; // Espacement entre les tours
        }
        yPos += 5;
      }

      // Sauvegarder le PDF
      const fileName = `${(match.name || 'match').replace(/[^a-z0-9]/gi, '_')}_recap.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Erreur lors de la génération du PDF');
    }
  };

  // Compter les joueurs éliminés/exclus par équipe
  const eliminatedA = actions.filter(a => 
    (a.playerTeam === "A" && a.playerState === "elimine") ||
    (a.playerTeam === "B" && a.opponentState === "elimine" && a.opponentId && a.opponentName)
  ).length;
  const eliminatedB = actions.filter(a => 
    (a.playerTeam === "B" && a.playerState === "elimine") ||
    (a.playerTeam === "A" && a.opponentState === "elimine" && a.opponentId && a.opponentName)
  ).length;

  // Grouper les actions par mi-temps et tour
  const actionsByHalf = actions.reduce((acc, action) => {
    if (!acc[action.half]) {
      acc[action.half] = {};
    }
    if (!acc[action.half][action.turn]) {
      acc[action.half][action.turn] = [];
    }
    acc[action.half][action.turn].push(action);
    return acc;
  }, {} as Record<number, Record<number, LocalMatchAction[]>>);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
        <p className="text-nuffle-anthracite">Chargement du récapitulatif...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-8 text-center shadow-sm">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score façon match sportif */}
      <div className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-300 rounded-xl p-8 shadow-lg">
        <h2 className="text-xl font-bold text-gray-600 mb-6 text-center uppercase tracking-wide">
          Score Final
        </h2>
        <div className="flex items-center justify-center gap-4 mb-6">
          {/* Équipe A */}
          <div className="flex-1 text-right">
            <div className="text-lg font-semibold text-gray-700 mb-2">
              {match.teamA.name}
            </div>
            <div className="text-sm text-gray-500">
              {eliminatedA} Éliminé{eliminatedA > 1 ? 's' : ''}
            </div>
          </div>
          
          {/* Score central */}
          <div className="flex items-center gap-3 px-6">
            <div className="text-6xl font-bold text-nuffle-anthracite">
              {match.scoreTeamA || 0}
            </div>
            <div className="text-4xl font-bold text-gray-400">-</div>
            <div className="text-6xl font-bold text-nuffle-anthracite">
              {match.scoreTeamB || 0}
            </div>
          </div>
          
          {/* Équipe B */}
          <div className="flex-1 text-left">
            <div className="text-lg font-semibold text-gray-700 mb-2">
              {match.teamB.name}
            </div>
            <div className="text-sm text-gray-500">
              {eliminatedB} Éliminé{eliminatedB > 1 ? 's' : ''}
            </div>
          </div>
        </div>
        
        {/* Ligne de séparation */}
        <div className="border-t border-gray-300 pt-4 mt-4">
          {match.completedAt && (
            <p className="text-sm text-gray-500 text-center">
              Terminé le {new Date(match.completedAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Informations de pré-match */}
      {match.gameState?.preMatch && (match.gameState.preMatch.fanFactor || match.gameState.preMatch.weather) && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-nuffle-anthracite border-b-2 border-nuffle-gold pb-2">
            Informations d'avant-match
          </h2>
          
          {/* Fans dévoués */}
          {match.gameState.preMatch.fanFactor && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-nuffle-anthracite mb-4">
                Fans dévoués
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">
                    {match.teamA.name}
                  </p>
                  <p className="text-2xl font-bold text-nuffle-anthracite">
                    Fan Factor: {match.gameState.preMatch.fanFactor.teamA.total}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    D3: {match.gameState.preMatch.fanFactor.teamA.d3} + Fans: {match.gameState.preMatch.fanFactor.teamA.dedicatedFans}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">
                    {match.teamB.name}
                  </p>
                  <p className="text-2xl font-bold text-nuffle-anthracite">
                    Fan Factor: {match.gameState.preMatch.fanFactor.teamB.total}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    D3: {match.gameState.preMatch.fanFactor.teamB.d3} + Fans: {match.gameState.preMatch.fanFactor.teamB.dedicatedFans}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Conditions météorologiques */}
          {match.gameState.preMatch.weather && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-nuffle-anthracite mb-4">
                Conditions météorologiques
              </h3>
              <div className="bg-white rounded-lg p-4">
                <p className="text-lg font-semibold text-nuffle-anthracite mb-2">
                  {match.gameState.preMatch.weather.condition}
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  {match.gameState.preMatch.weather.description}
                </p>
                <p className="text-xs text-gray-500">
                  Type: {match.gameState.preMatch.weatherType || 'classique'} | Total 2D6: {match.gameState.preMatch.weather.total}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bouton d'export PDF */}
      <div className="flex justify-center">
        <button
          onClick={exportToPDF}
          className="px-6 py-3 bg-nuffle-gold text-nuffle-anthracite rounded-lg font-semibold hover:bg-nuffle-bronze transition-colors flex items-center gap-2"
        >
          <span>📄</span>
          <span>Exporter le récapitulatif en PDF</span>
        </button>
      </div>

      {/* Liste des actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-nuffle-anthracite mb-4">
          Récapitulatif des Actions
        </h2>
        {actions.length === 0 ? (
          <p className="text-gray-600 text-center py-8">
            Aucune action enregistrée pour ce match
          </p>
        ) : (
          <div className="space-y-6">
            {[1, 2].map((half) => {
              const halfActions = actionsByHalf[half];
              if (!halfActions || Object.keys(halfActions).length === 0) return null;

              return (
                <div key={half} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                  <h3 className="text-xl font-semibold text-nuffle-anthracite mb-3">
                    Mi-temps {half}
                  </h3>
                  <div className="space-y-4">
                    {Object.keys(halfActions)
                      .map(Number)
                      .sort((a, b) => a - b)
                      .map((turn) => (
                        <div key={turn} className="ml-4">
                          <h4 className="text-lg font-medium text-gray-700 mb-2">
                            Tour {turn}
                          </h4>
                          <div className="space-y-2">
                            {halfActions[turn].map((action) => (
                              <div
                                key={action.id}
                                className={`p-3 rounded-lg border ${
                                  action.playerTeam === "A"
                                    ? "bg-blue-50 border-blue-200"
                                    : "bg-red-50 border-red-200"
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <span className="text-xl">
                                    {ActionIcons[action.actionType]}
                                  </span>
                                  <div className="flex-1">
                                    <div className="font-semibold text-sm text-gray-900">
                                      {ActionLabels[action.actionType]} - {action.playerName}
                                      {action.playerTeam === "A" ? ` (${match.teamA.name})` : ` (${match.teamB.name})`}
                                    </div>
                                    {action.opponentName && (
                                      <div className="text-xs text-gray-600 mt-1">
                                        vs {action.opponentName}
                                        {action.playerTeam === "A" ? ` (${match.teamB.name})` : ` (${match.teamA.name})`}
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                      {action.diceResult !== null && (
                                        <span className="px-2 py-1 bg-gray-200 rounded">
                                          Dé: {action.diceResult}
                                        </span>
                                      )}
                                      {action.fumble && (
                                        <span className="px-2 py-1 bg-red-200 text-red-800 rounded">
                                          ❌ Échec
                                        </span>
                                      )}
                                      {!action.fumble && (action.actionType === "blocage" || action.actionType === "blitz") && (
                                        <>
                                          {action.armorBroken ? (
                                            <span className="px-2 py-1 bg-green-200 text-green-800 rounded">
                                              ✅ Armure cassée
                                            </span>
                                          ) : (
                                            <span className="px-2 py-1 bg-gray-200 rounded">
                                              ⚪ Armure non cassée
                                            </span>
                                          )}
                                          {action.opponentState && (
                                            <span className="px-2 py-1 bg-orange-200 text-orange-800 rounded">
                                              {action.opponentState}
                                            </span>
                                          )}
                                        </>
                                      )}
                                      {action.playerState && (
                                        <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded">
                                          {action.playerState}
                                        </span>
                                      )}
                                      {action.passType && (
                                        <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded">
                                          {action.passType}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

