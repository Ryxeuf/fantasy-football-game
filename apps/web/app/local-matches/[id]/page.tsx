"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { API_BASE } from "../../auth-client";
import LocalMatchActions from "./LocalMatchActions";
import LocalMatchSummary from "./LocalMatchSummary";

// Types de météo (copie locale pour éviter les problèmes d'import)
const WEATHER_TYPES = [
  { id: 'classique', name: 'Classique' },
  { id: 'printaniere', name: 'Printanière' },
  { id: 'estivale', name: 'Estivale' },
  { id: 'automnale', name: 'Automnale' },
  { id: 'hivernale', name: 'Hivernale' },
  { id: 'souterraine', name: 'Souterraine' },
  { id: 'foret-primordiale', name: 'Forêt Primordiale' },
  { id: 'cimetiere', name: 'Cimetière' },
  { id: 'terres-gastes', name: 'Terres Gâtes' },
  { id: 'montagnard', name: 'Montagnard' },
  { id: 'cotiere', name: 'Côtière' },
  { id: 'desertique', name: 'Désertique' },
];

type LocalMatch = {
  id: string;
  name: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  shareToken: string | null;
  teamAOwnerValidated: boolean;
  teamBOwnerValidated: boolean;
  creator: {
    id: string;
    coachName: string;
    email: string;
  };
  teamA: {
    id: string;
    name: string;
    roster: string;
    players: Array<{
      id: string;
      name: string;
      position: string;
      number: number;
      ma: number;
      st: number;
      ag: number;
      pa: number;
      av: number;
      skills: string;
    }>;
    owner: {
      id: string;
      coachName: string;
    };
  };
  teamB: {
    id: string;
    name: string;
    roster: string;
    players: Array<{
      id: string;
      name: string;
      position: string;
      number: number;
      ma: number;
      st: number;
      ag: number;
      pa: number;
      av: number;
      skills: string;
    }>;
    owner: {
      id: string;
      coachName: string;
    };
  } | null;
  cup: {
    id: string;
    name: string;
    status: string;
  } | null;
  scoreTeamA: number | null;
  scoreTeamB: number | null;
  gameState?: {
    preMatch?: {
      phase: string;
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
    teamNames?: {
      teamA: string;
      teamB: string;
    };
  };
};

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

async function postJSON(path: string, data: any) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

async function putJSON(path: string, data: any) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}


export default function LocalMatchPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.id as string;

  const [localMatch, setLocalMatch] = useState<LocalMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useManualFans, setUseManualFans] = useState(false);
  const [manualD3A, setManualD3A] = useState<number | null>(null);
  const [manualD3B, setManualD3B] = useState<number | null>(null);
  const [weatherType, setWeatherType] = useState<string>('classique');
  const [useManualWeather, setUseManualWeather] = useState(false);
  const [manualWeatherTotal, setManualWeatherTotal] = useState<number | ''>(2);

  useEffect(() => {
    loadLocalMatch();
  }, [matchId]);

  // Recharger si les joueurs ne sont pas disponibles
  useEffect(() => {
    if (localMatch && localMatch.status === "in_progress") {
      const hasPlayers = 
        localMatch.teamA?.players !== undefined && 
        localMatch.teamB?.players !== undefined &&
        Array.isArray(localMatch.teamA.players) &&
        Array.isArray(localMatch.teamB.players);
      
      if (!hasPlayers) {
        // Recharger après un court délai pour laisser le temps à l'API de répondre
        const timer = setTimeout(() => {
          loadLocalMatch();
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [localMatch]);

  const loadLocalMatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const { localMatch: data } = await fetchJSON(`/local-match/${matchId}`);
      console.log("Match chargé:", {
        teamA: data?.teamA?.name,
        teamB: data?.teamB?.name || null,
        status: data?.status,
        gameState: data?.gameState ? 'présent' : 'absent',
        preMatchPhase: data?.gameState?.preMatch?.phase || 'non défini',
        hasFanFactor: !!data?.gameState?.preMatch?.fanFactor,
        hasWeather: !!data?.gameState?.preMatch?.weather,
        preMatch: data?.gameState?.preMatch,
        teamAPlayers: data?.teamA?.players?.length || 0,
        teamBPlayers: data?.teamB?.players?.length || 0,
      });
      setLocalMatch(data);
    } catch (e: any) {
      console.error("Erreur lors du chargement:", e);
      setError(e.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setError(null);
    try {
      // Préparer les paramètres pour la saisie manuelle
      const body: any = {
        weatherType, // Toujours envoyer le type de météo
      };
      
      if (useManualFans) {
        if (manualD3A !== null && manualD3A >= 1 && manualD3A <= 3) {
          body.manualD3A = manualD3A;
        }
        if (manualD3B !== null && manualD3B >= 1 && manualD3B <= 3) {
          body.manualD3B = manualD3B;
        }
      }
      
      if (useManualWeather) {
        if (manualWeatherTotal !== '' && manualWeatherTotal >= 2 && manualWeatherTotal <= 12) {
          body.manualWeatherTotal = manualWeatherTotal;
        }
      }
      
      const response = await postJSON(
        `/local-match/${matchId}/start`,
        body,
      );
      // L'API retourne { localMatch, gameState }
      const updated = response.localMatch || response;
      setLocalMatch(updated);
      
      // Recharger le match pour s'assurer d'avoir toutes les données à jour
      await loadLocalMatch();
    } catch (e: any) {
      console.error("Erreur lors du démarrage:", e);
      setError(e.message || "Erreur lors du démarrage");
    }
  };

  const handleComplete = async () => {
    const scoreTeamAStr = prompt("Score de l'équipe A :", "0");
    const scoreTeamBStr = prompt("Score de l'équipe B :", "0");
    
    if (scoreTeamAStr === null || scoreTeamBStr === null) {
      return; // L'utilisateur a annulé
    }
    
    const scoreTeamA = parseInt(scoreTeamAStr, 10);
    const scoreTeamB = parseInt(scoreTeamBStr, 10);
    
    if (isNaN(scoreTeamA) || isNaN(scoreTeamB)) {
      alert("Les scores doivent être des nombres valides");
      return;
    }
    
    if (!confirm(`Terminer la partie avec le score ${scoreTeamA} - ${scoreTeamB} ?`)) {
      return;
    }

    try {
      const { localMatch: updated } = await postJSON(
        `/local-match/${matchId}/complete`,
        {
          scoreTeamA,
          scoreTeamB,
        },
      );
      setLocalMatch(updated);
      alert("Partie terminée avec succès");
    } catch (e: any) {
      console.error("Erreur lors de la finalisation:", e);
      setError(e.message || "Erreur lors de la finalisation");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-nuffle-anthracite">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!localMatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-nuffle-anthracite">Partie introuvable</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-nuffle-anthracite">
              {localMatch.name || "Partie offline"}
            </h1>
            <p className="text-gray-600 mt-1">
              {localMatch.teamA.name}
              {localMatch.teamB ? ` vs ${localMatch.teamB.name}` : " (en attente d'une équipe adverse)"}
            </p>
            {localMatch.cup && (
              <p className="text-sm text-gray-600">
                Coupe: {localMatch.cup.name}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {localMatch.status === "pending" && 
             (!localMatch.gameState?.preMatch || localMatch.gameState.preMatch.phase === 'idle') && (
              <button
                onClick={handleStart}
                className="px-6 py-3 bg-gradient-to-r from-nuffle-gold to-nuffle-bronze text-nuffle-anthracite rounded-lg font-bold hover:from-nuffle-bronze hover:to-nuffle-gold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Démarrer la partie
              </button>
            )}
            {localMatch.status === "in_progress" && (
              <button
                onClick={handleComplete}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Terminer la partie
              </button>
            )}
            {localMatch.status === "completed" && (
              <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-semibold">
                Partie terminée
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {localMatch.status === "pending" && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-lg">
            {!localMatch.gameState?.preMatch || 
             localMatch.gameState.preMatch.phase === 'idle' ? (
              // Formulaire pour démarrer la partie avec choix automatique/manuel
              <div className="space-y-8">
                <div className="text-center mb-6">
                  <h2 className="text-3xl font-bold text-nuffle-anthracite mb-2 font-heading">
                    Configuration de l'avant-match
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Configurez les paramètres de début de partie ou laissez-les être générés automatiquement
                  </p>
                </div>
                
                {/* Section Fans */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-2 border-blue-300 rounded-xl p-6 shadow-md">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-nuffle-anthracite">
                          Fans dévoués
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Fan Factor = D3 + Fans dévoués de l'équipe
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={useManualFans}
                          onChange={(e) => setUseManualFans(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-14 h-7 rounded-full transition-colors duration-200 ${
                          useManualFans ? 'bg-nuffle-gold' : 'bg-gray-300'
                        }`}>
                          <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 mt-0.5 ${
                            useManualFans ? 'translate-x-7' : 'translate-x-0.5'
                          }`} />
                        </div>
                      </div>
                      <span className={`text-sm font-medium transition-colors ${
                        useManualFans ? 'text-nuffle-anthracite' : 'text-gray-600'
                      }`}>
                        {useManualFans ? 'Manuel' : 'Auto'}
                      </span>
                    </label>
                  </div>
                  
                  {useManualFans ? (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-white rounded-lg p-5 shadow-sm border-2 border-blue-200">
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          <span className="text-blue-600">D3</span> {localMatch.teamA.name}
                        </label>
                        <div className="flex gap-2">
                          {[1, 2, 3].map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setManualD3A(value)}
                              className={`flex-1 py-3 text-2xl font-bold rounded-lg transition-all ${
                                manualD3A === value
                                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
                              }`}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                        {manualD3A !== null && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500">Fan Factor prévu:</p>
                            <p className="text-lg font-bold text-nuffle-anthracite">
                              {manualD3A + 1}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">(D3: {manualD3A} + Fans: 1)</p>
                          </div>
                        )}
                      </div>
                      <div className="bg-white rounded-lg p-5 shadow-sm border-2 border-blue-200">
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          <span className="text-blue-600">D3</span> {localMatch.teamB?.name || "Équipe B"}
                        </label>
                        <div className="flex gap-2">
                          {[1, 2, 3].map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setManualD3B(value)}
                              className={`flex-1 py-3 text-2xl font-bold rounded-lg transition-all ${
                                manualD3B === value
                                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
                              }`}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                        {manualD3B !== null && localMatch.teamB && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500">Fan Factor prévu:</p>
                            <p className="text-lg font-bold text-nuffle-anthracite">
                              {manualD3B + 1}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">(D3: {manualD3B} + Fans: 1)</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/60 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-gray-700">
                          Les valeurs D3 seront générées <strong>automatiquement</strong> (1-3) lors du démarrage
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Section Météo */}
                <div className="bg-gradient-to-br from-green-50 to-green-100/50 border-2 border-green-300 rounded-xl p-6 shadow-md">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-nuffle-anthracite">
                          Conditions météorologiques
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Choisissez le type de météo, puis déterminez le résultat (2D6)
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={useManualWeather}
                          onChange={(e) => setUseManualWeather(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-14 h-7 rounded-full transition-colors duration-200 ${
                          useManualWeather ? 'bg-nuffle-gold' : 'bg-gray-300'
                        }`}>
                          <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 mt-0.5 ${
                            useManualWeather ? 'translate-x-7' : 'translate-x-0.5'
                          }`} />
                        </div>
                      </div>
                      <span className={`text-sm font-medium transition-colors ${
                        useManualWeather ? 'text-nuffle-anthracite' : 'text-gray-600'
                      }`}>
                        {useManualWeather ? 'Manuel' : 'Auto'}
                      </span>
                    </label>
                  </div>
                  
                  {/* Sélecteur de type de météo */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      <span className="text-green-600">Type de météo</span>
                    </label>
                    <select
                      value={weatherType}
                      onChange={(e) => setWeatherType(e.target.value)}
                      className="w-full px-4 py-3 text-base font-medium border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold transition-all bg-white"
                    >
                      {WEATHER_TYPES.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {useManualWeather ? (
                    <div className="mt-4">
                      <div className="bg-white rounded-lg p-5 shadow-sm border-2 border-green-200">
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          <span className="text-green-600">Total 2D6</span> (2-12)
                        </label>
                        <input
                          type="number"
                          min="2"
                          max="12"
                          value={manualWeatherTotal}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                            if (val === '' || (val >= 2 && val <= 12)) {
                              setManualWeatherTotal(val as number | '');
                            }
                          }}
                          className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Saisissez le résultat total du jet de 2D6
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/60 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-gray-700">
                          Le résultat sera déterminé <strong>automatiquement</strong> par un jet de 2D6 (2-12) lors du démarrage
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : localMatch.gameState?.preMatch && 
             localMatch.gameState.preMatch.phase !== 'idle' ? (
              // Afficher la phase pré-match
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-nuffle-anthracite mb-4">
                  Phase d'avant-match
                </h2>
                
                {/* Phase Fans */}
                {localMatch.gameState.preMatch.fanFactor && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-nuffle-anthracite mb-4">
                      Fans dévoués
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">
                          {localMatch.teamA.name}
                        </p>
                        <p className="text-2xl font-bold text-nuffle-anthracite">
                          Fan Factor: {localMatch.gameState.preMatch.fanFactor.teamA.total}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          D3: {localMatch.gameState.preMatch.fanFactor.teamA.d3} + 
                          Fans: {localMatch.gameState.preMatch.fanFactor.teamA.dedicatedFans}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">
                          {localMatch.teamB?.name || "Équipe B"}
                        </p>
                        <p className="text-2xl font-bold text-nuffle-anthracite">
                          Fan Factor: {localMatch.gameState.preMatch.fanFactor.teamB.total}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          D3: {localMatch.gameState.preMatch.fanFactor.teamB.d3} + 
                          Fans: {localMatch.gameState.preMatch.fanFactor.teamB.dedicatedFans}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Phase Météo */}
                {localMatch.gameState.preMatch.weather && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-nuffle-anthracite mb-4">
                      Conditions météorologiques
                    </h3>
                    <div className="bg-white rounded-lg p-4">
                      <p className="text-lg font-semibold text-nuffle-anthracite mb-2">
                        {localMatch.gameState.preMatch.weather.condition}
                      </p>
                      <p className="text-sm text-gray-600 mb-3">
                        {localMatch.gameState.preMatch.weather.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        Type: {localMatch.gameState.preMatch.weatherType || 'classique'} | Total 2D6: {localMatch.gameState.preMatch.weather.total}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Afficher un bouton pour continuer si on est en phase setup */}
                {localMatch.gameState.preMatch.phase === 'setup' ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-nuffle-anthracite mb-4">
                      Phase de placement des joueurs
                    </h3>
                    <p className="text-sm text-gray-700 mb-4">
                      Vous pouvez maintenant placer vos joueurs sur le terrain et commencer la partie.
                    </p>
                    <button
                      onClick={() => router.push(`/play/${matchId}` as any)}
                      className="px-6 py-3 bg-gradient-to-r from-nuffle-gold to-nuffle-bronze text-nuffle-anthracite rounded-lg font-bold hover:from-nuffle-bronze hover:to-nuffle-gold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Commencer la partie
                    </button>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      Phase actuelle: <strong>{localMatch.gameState.preMatch.phase}</strong>
                    </p>
                    <p className="text-sm text-yellow-700 mt-2">
                      La séquence d'avant-match est en cours. Les phases suivantes (joueurs de passage, incitations, prières, etc.) seront traitées automatiquement.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Afficher le message par défaut si pas encore démarré
              <div className="text-center">
                <p className="text-nuffle-anthracite text-lg mb-4">
                  La partie n'a pas encore été démarrée
                </p>
                <p className="text-gray-600 mb-4">
                  Cliquez sur "Démarrer la partie" pour commencer
                </p>
              </div>
            )}
          </div>
        )}

        {localMatch.status === "waiting_for_player" && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-nuffle-anthracite mb-4">
                En attente de validation des joueurs
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Équipe A</p>
                  <p className="font-semibold text-nuffle-anthracite">
                    {localMatch.teamA.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {localMatch.teamA.owner.coachName}
                  </p>
                  {localMatch.teamAOwnerValidated ? (
                    <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      ✓ Validé
                    </span>
                  ) : (
                    <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                      En attente
                    </span>
                  )}
                </div>
                {localMatch.teamB ? (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Équipe B</p>
                    <p className="font-semibold text-nuffle-anthracite">
                      {localMatch.teamB.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {localMatch.teamB.owner.coachName}
                    </p>
                    {localMatch.teamBOwnerValidated ? (
                      <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                        ✓ Validé
                      </span>
                    ) : (
                      <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                        En attente
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Équipe B</p>
                    <p className="font-semibold text-gray-400 italic">
                      En attente d'une équipe
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Partagez le lien ci-dessous pour inviter un joueur
                    </p>
                  </div>
                )}
              </div>
            </div>
            {localMatch.shareToken && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-nuffle-anthracite mb-3">
                  Lien de partage
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Partagez ce lien avec le second joueur pour qu'il puisse valider sa participation :
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/local-matches/share/${localMatch.shareToken}`}
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/local-matches/share/${localMatch.shareToken}`;
                      navigator.clipboard.writeText(url);
                      alert("Lien copié dans le presse-papiers !");
                    }}
                    className="px-4 py-2 bg-nuffle-gold text-nuffle-anthracite rounded-lg font-semibold hover:bg-nuffle-bronze transition-colors"
                  >
                    Copier
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {localMatch.status === "in_progress" && (
          <div className="space-y-4">
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded">
              <p className="font-semibold mb-2">Mode Offline</p>
              <p className="text-sm">
                Cette partie se joue en mode offline. Enregistrez manuellement toutes les actions effectuées pendant la partie.
              </p>
            </div>
            {localMatch.teamA?.players !== undefined && localMatch.teamB?.players !== undefined && localMatch.teamB ? (
              <LocalMatchActions
                matchId={matchId}
                teamA={{
                  id: localMatch.teamA.id,
                  name: localMatch.teamA.name,
                  players: Array.isArray(localMatch.teamA.players) ? localMatch.teamA.players : [],
                }}
                teamB={{
                  id: localMatch.teamB.id,
                  name: localMatch.teamB.name,
                  players: Array.isArray(localMatch.teamB.players) ? localMatch.teamB.players : [],
                }}
                preMatch={localMatch.gameState?.preMatch}
              />
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
                <p className="text-nuffle-anthracite">
                  {!localMatch.teamB ? "En attente d'une équipe adverse..." : "Chargement des joueurs..."}
                </p>
              </div>
            )}
          </div>
        )}

        {localMatch.status === "completed" && localMatch.teamB && (
          <LocalMatchSummary
            matchId={matchId}
            match={{
              id: localMatch.id,
              name: localMatch.name,
              teamA: {
                id: localMatch.teamA.id,
                name: localMatch.teamA.name,
              },
              teamB: {
                id: localMatch.teamB.id,
                name: localMatch.teamB.name,
              },
              scoreTeamA: localMatch.scoreTeamA,
              scoreTeamB: localMatch.scoreTeamB,
              startedAt: localMatch.startedAt,
              completedAt: localMatch.completedAt,
              cup: localMatch.cup,
              gameState: localMatch.gameState,
            }}
          />
        )}
        {localMatch.status === "completed" && !localMatch.teamB && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
            <p className="text-nuffle-anthracite">Le match ne peut pas être terminé sans équipe adverse.</p>
          </div>
        )}
      </div>
    </div>
  );
}

