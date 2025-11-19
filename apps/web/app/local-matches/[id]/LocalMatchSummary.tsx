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
  const [teamFilter, setTeamFilter] = useState<"all" | "A" | "B">("all");
  const [actionTypeFilter, setActionTypeFilter] = useState<ActionType | "all">("all");
  const [expandedHalves, setExpandedHalves] = useState<Record<number, boolean>>({
    1: false,
    2: false,
  });
  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>({});

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

  // Compter les joueurs éliminés/exclus par équipe (sur l'ensemble du match)
  const eliminatedA = actions.filter(a => 
    (a.playerTeam === "A" && a.playerState === "elimine") ||
    (a.playerTeam === "B" && a.opponentState === "elimine" && a.opponentId && a.opponentName)
  ).length;
  const eliminatedB = actions.filter(a => 
    (a.playerTeam === "B" && a.playerState === "elimine") ||
    (a.playerTeam === "A" && a.opponentState === "elimine" && a.opponentId && a.opponentName)
  ).length;

  // Filtres UI
  const filteredActions = actions.filter((action) => {
    if (teamFilter !== "all" && action.playerTeam !== teamFilter) return false;
    if (actionTypeFilter !== "all" && action.actionType !== actionTypeFilter) return false;
    return true;
  });

  const totalActions = actions.length;
  const visibleActions = filteredActions.length;

  // Statistiques par équipe (simples, dérivées des actions)
  type TeamKey = "A" | "B";
  const makeEmptyTeamStats = () => ({
    totalActions: 0,
    passes: 0,
    receptions: 0,
    touchdowns: 0,
    blitzes: 0,
    blocks: 0,
    fouls: 0,
    sprints: 0,
    dodges: 0,
    interceptions: 0,
    armorBreaks: 0,
    casualties: 0,
    kos: 0,
    stuns: 0,
    fumbles: 0,
  });

  const teamStats: Record<TeamKey, ReturnType<typeof makeEmptyTeamStats>> = {
    A: makeEmptyTeamStats(),
    B: makeEmptyTeamStats(),
  };

  type PlayerKey = string;
  type PlayerStats = {
    playerId: string;
    playerName: string;
    team: TeamKey;
    score: number;
    touchdowns: number;
    passes: number;
    receptions: number;
    blitzes: number;
    blocks: number;
    fouls: number;
    interceptions: number;
    casualties: number;
  };

  const playerStats: Record<PlayerKey, PlayerStats> = {};

  const registerPlayer = (action: LocalMatchAction): PlayerStats => {
    const key: PlayerKey = `${action.playerTeam}-${action.playerId}`;
    if (!playerStats[key]) {
      playerStats[key] = {
        playerId: action.playerId,
        playerName: action.playerName,
        team: action.playerTeam,
        score: 0,
        touchdowns: 0,
        passes: 0,
        receptions: 0,
        blitzes: 0,
        blocks: 0,
        fouls: 0,
        interceptions: 0,
        casualties: 0,
      };
    }
    return playerStats[key];
  };

  actions.forEach((action) => {
    const teamKey = action.playerTeam;
    const stats = teamStats[teamKey];
    stats.totalActions += 1;

    const pStats = registerPlayer(action);
    let scoreDelta = 0;

    switch (action.actionType) {
      case "passe":
        stats.passes += 1;
        pStats.passes += 1;
        scoreDelta += 2; // une passe réussie est précieuse
        break;
      case "reception":
        stats.receptions += 1;
        pStats.receptions += 1;
        scoreDelta += 1;
        break;
      case "td":
        stats.touchdowns += 1;
        pStats.touchdowns += 1;
        scoreDelta += 6; // fort poids pour un touchdown
        break;
      case "blitz":
        stats.blitzes += 1;
        pStats.blitzes += 1;
        scoreDelta += 2;
        break;
      case "blocage":
        stats.blocks += 1;
        pStats.blocks += 1;
        scoreDelta += 1;
        break;
      case "aggression":
        stats.fouls += 1;
        pStats.fouls += 1;
        scoreDelta += 1;
        break;
      case "sprint":
        stats.sprints += 1;
        break;
      case "esquive":
        stats.dodges += 1;
        scoreDelta += action.fumble ? 0 : 1;
        break;
      case "interception":
        stats.interceptions += 1;
        pStats.interceptions += 1;
        scoreDelta += 3;
        break;
      case "apothicaire":
      case "transmission":
        break;
    }

    if (action.armorBroken) {
      stats.armorBreaks += 1;
      // bonus léger pour les actions qui cassent l'armure
      if (
        action.actionType === "blocage" ||
        action.actionType === "blitz" ||
        action.actionType === "aggression"
      ) {
        scoreDelta += 1;
      }
    }

    if (action.opponentState === "elimine") {
      stats.casualties += 1;
      // gros bonus pour les sorties
      if (
        action.actionType === "blocage" ||
        action.actionType === "blitz" ||
        action.actionType === "aggression"
      ) {
        pStats.casualties += 1;
        scoreDelta += 4;
      }
    } else if (action.opponentState === "ko") {
      stats.kos += 1;
      scoreDelta += 2;
    } else if (action.opponentState === "sonne") {
      stats.stuns += 1;
      scoreDelta += 1;
    }

    if (action.fumble) {
      stats.fumbles += 1;
      // petit malus, sans descendre en dessous de 0
      scoreDelta -= 1;
    }

    if (scoreDelta !== 0) {
      pStats.score += scoreDelta;
    }
  });

  const allPlayers = Object.values(playerStats);
  const mvp =
    allPlayers.length > 0
      ? allPlayers.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.touchdowns !== a.touchdowns) return b.touchdowns - a.touchdowns;
          if (b.casualties !== a.casualties) return b.casualties - a.casualties;
          if (b.passes !== a.passes) return b.passes - a.passes;
          return a.playerName.localeCompare(b.playerName);
        })[0]
      : null;

  // Grouper les actions (après filtrage) par mi-temps et tour pour l'affichage
  const filteredActionsByHalf = filteredActions.reduce((acc, action) => {
    if (!acc[action.half]) {
      acc[action.half] = {};
    }
    if (!acc[action.half][action.turn]) {
      acc[action.half][action.turn] = [];
    }
    acc[action.half][action.turn].push(action);
    return acc;
  }, {} as Record<number, Record<number, LocalMatchAction[]>>);

  const toggleHalf = (half: number) => {
    setExpandedHalves((prev) => ({
      ...prev,
      [half]: !prev[half],
    }));
  };

  const toggleTurn = (half: number, turn: number) => {
    const key = `${half}-${turn}`;
    setExpandedTurns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isTurnExpanded = (half: number, turn: number) => {
    const key = `${half}-${turn}`;
    return expandedTurns[key] ?? false;
  };

  const collapseAll = () => {
    setExpandedHalves({ 1: false, 2: false });
    setExpandedTurns({});
  };

  const expandAll = () => {
    const newHalves: Record<number, boolean> = {};
    const newTurns: Record<string, boolean> = {};

    actions.forEach((action) => {
      newHalves[action.half] = true;
      newTurns[`${action.half}-${action.turn}`] = true;
    });

    setExpandedHalves(newHalves);
    setExpandedTurns(newTurns);
  };

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
      <div className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-300 rounded-xl p-6 sm:p-8 shadow-lg">
        <h2 className="text-lg sm:text-xl font-bold text-gray-600 mb-4 sm:mb-6 text-center uppercase tracking-wide">
          Score Final
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Équipe A */}
          <div className="flex-1 sm:text-right text-center max-w-full break-words leading-snug">
            <div className="inline-flex items-center justify-center sm:justify-end max-w-full">
              <span className="text-[11px] sm:text-xs font-semibold text-red-800 bg-red-50 border border-red-200 rounded-full px-3 py-1 truncate max-w-full">
                {match.teamA.name}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              {eliminatedA} Éliminé{eliminatedA > 1 ? 's' : ''}
            </div>
          </div>
          
          {/* Score central */}
          <div className="flex items-center gap-3 px-4 sm:px-6">
            <div className="px-3 sm:px-4 py-1 sm:py-2 rounded-xl bg-red-100 text-red-900 border border-red-300 shadow-sm text-4xl sm:text-5xl font-extrabold">
              {match.scoreTeamA || 0}
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-gray-400">-</div>
            <div className="px-3 sm:px-4 py-1 sm:py-2 rounded-xl bg-blue-100 text-blue-900 border border-blue-300 shadow-sm text-4xl sm:text-5xl font-extrabold">
              {match.scoreTeamB || 0}
            </div>
          </div>
          
          {/* Équipe B */}
          <div className="flex-1 sm:text-left text-center max-w-full break-words leading-snug">
            <div className="inline-flex items-center justify-center sm:justify-start max-w-full">
              <span className="text-[11px] sm:text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 truncate max-w-full">
                {match.teamB.name}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
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

      {/* Statistiques du match + MVP */}
      {totalActions > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-2xl font-bold text-nuffle-anthracite">
              Statistiques du match
            </h2>
            <div className="text-xs sm:text-sm text-gray-600">
              Basé sur les actions enregistrées en mode offline.
            </div>
          </div>

          {mvp && (
            <div className="bg-gradient-to-r from-nuffle-gold/10 via-white to-nuffle-gold/10 border border-nuffle-gold/60 rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-nuffle-gold flex items-center justify-center shadow-md">
                  <span className="text-xl sm:text-2xl">⭐</span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Joueur du match (MVP automatique)
                  </p>
                  <p className="text-base sm:text-lg font-bold text-nuffle-anthracite">
                    {mvp.playerName}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {mvp.team === "A" ? match.teamA.name : match.teamB.name} • Score de performance&nbsp;
                    <span className="font-semibold">{mvp.score}</span>
                  </p>
                </div>
              </div>
              <div className="flex-1" />
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm text-gray-700">
                <div>
                  <p>
                    <span className="font-semibold">TD :</span> {mvp.touchdowns}
                  </p>
                  <p>
                    <span className="font-semibold">Passes :</span> {mvp.passes}
                  </p>
                  <p>
                    <span className="font-semibold">Réceptions :</span> {mvp.receptions}
                  </p>
                </div>
                <div>
                  <p>
                    <span className="font-semibold">Blitz / Blocages :</span>{" "}
                    {mvp.blitzes + mvp.blocks}
                  </p>
                  <p>
                    <span className="font-semibold">Sorties :</span> {mvp.casualties}
                  </p>
                  <p>
                    <span className="font-semibold">Interceptions :</span>{" "}
                    {mvp.interceptions}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Stats équipe A */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
                <span className="break-words">{match.teamA.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-300 text-gray-700">
                  {teamStats.A.totalActions} actions
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                <p>
                  <span className="font-semibold">TD :</span>{" "}
                  {teamStats.A.touchdowns}
                </p>
                <p>
                  <span className="font-semibold">Passes :</span>{" "}
                  {teamStats.A.passes}
                </p>
                <p>
                  <span className="font-semibold">Réceptions :</span>{" "}
                  {teamStats.A.receptions}
                </p>
                <p>
                  <span className="font-semibold">Blitz :</span>{" "}
                  {teamStats.A.blitzes}
                </p>
                <p>
                  <span className="font-semibold">Blocages :</span>{" "}
                  {teamStats.A.blocks}
                </p>
                <p>
                  <span className="font-semibold">Aggressions :</span>{" "}
                  {teamStats.A.fouls}
                </p>
                <p>
                  <span className="font-semibold">Esquives :</span>{" "}
                  {teamStats.A.dodges}
                </p>
                <p>
                  <span className="font-semibold">Interceptions :</span>{" "}
                  {teamStats.A.interceptions}
                </p>
                <p>
                  <span className="font-semibold">Armures passées :</span>{" "}
                  {teamStats.A.armorBreaks}
                </p>
                <p>
                  <span className="font-semibold">Sorties :</span>{" "}
                  {teamStats.A.casualties}
                </p>
                <p>
                  <span className="font-semibold">KO :</span> {teamStats.A.kos}
                </p>
                <p>
                  <span className="font-semibold">Sonnés :</span>{" "}
                  {teamStats.A.stuns}
                </p>
                <p>
                  <span className="font-semibold">Fumbles :</span>{" "}
                  {teamStats.A.fumbles}
                </p>
              </div>
            </div>

            {/* Stats équipe B */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
                <span className="break-words">{match.teamB.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-300 text-gray-700">
                  {teamStats.B.totalActions} actions
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                <p>
                  <span className="font-semibold">TD :</span>{" "}
                  {teamStats.B.touchdowns}
                </p>
                <p>
                  <span className="font-semibold">Passes :</span>{" "}
                  {teamStats.B.passes}
                </p>
                <p>
                  <span className="font-semibold">Réceptions :</span>{" "}
                  {teamStats.B.receptions}
                </p>
                <p>
                  <span className="font-semibold">Blitz :</span>{" "}
                  {teamStats.B.blitzes}
                </p>
                <p>
                  <span className="font-semibold">Blocages :</span>{" "}
                  {teamStats.B.blocks}
                </p>
                <p>
                  <span className="font-semibold">Aggressions :</span>{" "}
                  {teamStats.B.fouls}
                </p>
                <p>
                  <span className="font-semibold">Esquives :</span>{" "}
                  {teamStats.B.dodges}
                </p>
                <p>
                  <span className="font-semibold">Interceptions :</span>{" "}
                  {teamStats.B.interceptions}
                </p>
                <p>
                  <span className="font-semibold">Armures passées :</span>{" "}
                  {teamStats.B.armorBreaks}
                </p>
                <p>
                  <span className="font-semibold">Sorties :</span>{" "}
                  {teamStats.B.casualties}
                </p>
                <p>
                  <span className="font-semibold">KO :</span> {teamStats.B.kos}
                </p>
                <p>
                  <span className="font-semibold">Sonnés :</span>{" "}
                  {teamStats.B.stuns}
                </p>
                <p>
                  <span className="font-semibold">Fumbles :</span>{" "}
                  {teamStats.B.fumbles}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div className="flex flex-col gap-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-2xl font-bold text-nuffle-anthracite">
              Récapitulatif des Actions
            </h2>
            {totalActions > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="px-3 py-1 rounded-full bg-nuffle-gold/10 text-nuffle-anthracite border border-nuffle-gold/40 font-semibold">
                  {visibleActions} action{visibleActions > 1 ? "s" : ""} affichée
                  {visibleActions !== totalActions && ` sur ${totalActions}`}
                </span>
              </div>
            )}
          </div>

          {totalActions > 0 && (
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              {/* Filtres par équipe */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Filtrer par équipe :
                </span>
                <div className="inline-flex rounded-full bg-gray-100 p-1">
                  {[
                    { value: "all" as const, label: "Toutes" },
                    { value: "A" as const, label: match.teamA.name },
                    { value: "B" as const, label: match.teamB.name },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTeamFilter(option.value)}
                      className={`px-3 py-1 text-xs sm:text-sm rounded-full font-medium transition-colors ${
                        teamFilter === option.value
                          ? "bg-nuffle-gold text-nuffle-anthracite"
                          : "text-gray-600 hover:text-nuffle-anthracite"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtre par type + boutons repli/dépli */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={actionTypeFilter}
                  onChange={(e) =>
                    setActionTypeFilter(
                      e.target.value === "all"
                        ? "all"
                        : (e.target.value as ActionType),
                    )
                  }
                  className="px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold"
                >
                  <option value="all">Tous les types d'action</option>
                  {(Object.keys(ActionLabels) as ActionType[]).map((type) => (
                    <option key={type} value={type}>
                      {ActionLabels[type]}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={expandAll}
                  className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-300 text-gray-700 hover:border-nuffle-gold hover:text-nuffle-anthracite"
                >
                  Tout développer
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-300 text-gray-700 hover:border-nuffle-gold hover:text-nuffle-anthracite"
                >
                  Tout réduire
                </button>
              </div>
            </div>
          )}
        </div>

        {totalActions === 0 ? (
          <p className="text-gray-600 text-center py-8">
            Aucune action enregistrée pour ce match
          </p>
        ) : visibleActions === 0 ? (
          <p className="text-gray-600 text-center py-8">
            Aucune action ne correspond aux filtres sélectionnés.
          </p>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            {[1, 2].map((half) => {
              const halfActions = filteredActionsByHalf[half];
              if (!halfActions || Object.keys(halfActions).length === 0)
                return null;

              const turnKeys = Object.keys(halfActions)
                .map(Number)
                .sort((a, b) => a - b);
              const halfActionsCount = turnKeys.reduce(
                (sum, turn) => sum + halfActions[turn].length,
                0,
              );

              return (
                <div
                  key={half}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleHalf(half)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm sm:text-base font-semibold text-nuffle-anthracite">
                        Mi-temps {half}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white border border-gray-300 text-xs text-gray-700">
                        {halfActionsCount} action
                        {halfActionsCount > 1 ? "s" : ""}
                      </span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${
                        expandedHalves[half] ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {expandedHalves[half] && (
                    <div className="px-4 pb-4 pt-3 space-y-3">
                      {turnKeys.map((turn) => {
                        const turnActions = halfActions[turn];
                        const turnKey = `${half}-${turn}`;
                        const expanded = isTurnExpanded(half, turn);

                        const teamACount = turnActions.filter(
                          (a) => a.playerTeam === "A",
                        ).length;
                        const teamBCount = turnActions.filter(
                          (a) => a.playerTeam === "B",
                        ).length;

                        return (
                          <div
                            key={turnKey}
                            className="border-l-2 border-gray-200 pl-3 sm:pl-4"
                          >
                            <button
                              type="button"
                              onClick={() => toggleTurn(half, turn)}
                              className="w-full flex items-center justify-between py-2 pr-1 text-left group"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Tour {turn}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] text-gray-700">
                                    {turnActions.length} action
                                    {turnActions.length > 1 ? "s" : ""}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                                  {teamACount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                                      {match.teamA.name}: {teamACount}
                                    </span>
                                  )}
                                  {teamBCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-800 border border-red-200">
                                      {match.teamB.name}: {teamBCount}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <svg
                                className={`w-4 h-4 text-gray-400 transition-transform group-hover:text-gray-600 ${
                                  expanded ? "rotate-180" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>

                            {expanded && (
                              <div className="mt-2 space-y-2">
                                {turnActions.map((action) => (
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
                                          {ActionLabels[action.actionType]} -{" "}
                                          {action.playerName}
                                          {action.playerTeam === "A"
                                            ? ` (${match.teamA.name})`
                                            : ` (${match.teamB.name})`}
                                        </div>
                                        {action.opponentName && (
                                          <div className="text-xs text-gray-600 mt-1">
                                            vs {action.opponentName}
                                            {action.playerTeam === "A"
                                              ? ` (${match.teamB.name})`
                                              : ` (${match.teamA.name})`}
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
                                          {!action.fumble &&
                                            (action.actionType === "blocage" ||
                                              action.actionType === "blitz") && (
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
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

