"use client";
import { useEffect, useMemo, useState } from "react";
import { PlayerDetails, DiceResultPopup, GameScoreboard, ActionPickerPopup, GameBoardWithDugouts } from "@bb/ui";
import { setup, getLegalMoves, applyMove, makeRNG, clearDiceResult, hasPlayerActed, type GameState, type Position, type Move, setupPreMatch, setupPreMatchWithTeams, startMatchFromPreMatch, enterSetupPhase, placePlayerInSetup, type ExtendedGameState } from "@bb/game-engine";
import { API_BASE } from "../../auth-client";

// Ajouter fonction normalize après imports
function normalizeState(state: any): ExtendedGameState {
  if (state && typeof state.playerActions === 'object' && state.playerActions !== null && typeof state.playerActions.has !== 'function') {
    state.playerActions = new Map(Object.entries(state.playerActions || {}));
  }
  if (state && typeof state.teamBlitzCount === 'object' && state.teamBlitzCount !== null && typeof state.teamBlitzCount.has !== 'function') {
    state.teamBlitzCount = new Map(Object.entries(state.teamBlitzCount || {}));
  }
  return state as ExtendedGameState;
}

export default function PlayByIdPage({ params }: { params: { id: string } }) {
  const matchId = params.id;

  useEffect(() => {
    (async () => {
      const matchToken = localStorage.getItem("match_token");
      if (matchToken) return;
      try {
        const authToken = localStorage.getItem("auth_token");
        if (!authToken) { window.location.href = "/lobby"; return; }
        const res = await fetch(`${API_BASE}/match/join`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ matchId }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data?.matchToken) {
          localStorage.setItem("match_token", data.matchToken as string);
        } else {
          window.location.href = "/lobby";
        }
      } catch {
        window.location.href = "/lobby";
      }
    })();
  }, []);

  // Bloquer l'accès si le match n'est pas encore actif
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) { window.location.href = "/lobby"; return; }
      const res = await fetch(`${API_BASE}/match/${matchId}/summary`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({} as any));
      if (!res.ok) { window.location.href = "/lobby"; return; }
      const status = data?.status;
      // Autoriser 'active', 'prematch' et 'prematch-setup'. Sinon, renvoyer vers la salle d'attente de ce match
      if (status !== 'active' && status !== 'prematch' && status !== 'prematch-setup') {
        window.location.href = `/waiting/${matchId}`;
        return;
      }
      } catch {
        window.location.href = "/lobby";
      }
    })();
  }, [matchId]);

  const [state, setState] = useState<GameState | null>(null);
  const [showDicePopup, setShowDicePopup] = useState(false);
  const [currentAction, setCurrentAction] = useState<"MOVE" | "BLOCK" | "BLITZ" | "PASS" | "HANDOFF" | "FOUL" | null>(null);
  const createRNG = () => makeRNG(`ui-seed-${Date.now()}-${Math.random()}`);
  const [teamNameA, setTeamNameA] = useState<string | null>(null); // local
  const [teamNameB, setTeamNameB] = useState<string | null>(null); // visiteur

  // Ajouter state pour selectedFromReserve (pour setup)
  const [selectedFromReserve, setSelectedFromReserve] = useState<string | null>(null);

  // useEffect pour charger les noms d'équipes et coaches via /details (prioritaire, indépendant)
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        // 1) Tenter avec match_token d'abord
        const matchToken = localStorage.getItem("match_token");
        let data: any = {};
        if (matchToken) {
          const res = await fetch(`${API_BASE}/match/details`, { headers: { "X-Match-Token": matchToken } });
          data = await res.json().catch(() => ({} as any));
          if (res.ok && data) {
            setTeamNameA(data?.local?.teamName || null);
            setTeamNameB(data?.visitor?.teamName || null);
            return;
          }
        }
        // 2) Fallback auth
        const res = await fetch(`${API_BASE}/match/${matchId}/details`, { headers: { Authorization: `Bearer ${token}` } });
        data = await res.json().catch(() => ({} as any));
        if (res.ok && data) {
          setTeamNameA(data?.local?.teamName || null);
          setTeamNameB(data?.visitor?.teamName || null);
        }
      } catch (e) {
        console.error('Failed to load team names:', e);
        // Fallback démo si échec total
        setTeamNameA('Équipe Locale');
        setTeamNameB('Équipe Visiteuse');
      }
    })();
  }, [matchId]); // Seulement matchId, pas de teamNames dans deps

  // Nouveau useEffect pour charger l'état du jeu (dépend des teamNames pour fallback)
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/match/${matchId}/state`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data?.gameState) {
          const normalized = normalizeState(data.gameState);
          setState(normalized);
          console.log('State players length:', normalized.players.length);
          // Ne pas override teamNames si déjà set
          return;
        }
      } catch (e) {
        console.error('Failed to load game state:', e);
      }
      // Fallback: charger les équipes et setup prematch avec vrais data
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          setState(setupPreMatch());
          return;
        }
        const teamsRes = await fetch(`${API_BASE}/match/${matchId}/teams`, { headers: { Authorization: `Bearer ${token}` } });
        const teamsData = await teamsRes.json().catch(() => ({} as any));
        if (teamsRes.ok && teamsData.local && teamsData.visitor) {
          // Utiliser teamNameA/B déjà chargés, ou fallback aux data
          const teamAName = teamNameA || teamsData.local.teamName || 'Équipe Locale';
          const teamBName = teamNameB || teamsData.visitor.teamName || 'Équipe Visiteuse';
          setState(normalizeState(setupPreMatchWithTeams(teamsData.local.players || [], teamsData.visitor.players || [], teamAName, teamBName)));
          console.log('Fallback players length:', (teamsData.local.players || []).length + (teamsData.visitor.players || []).length);
          return;
        }
      } catch (e) {
        console.error('Failed to load teams for prematch:', e);
      }
      // Dernier fallback: démo, mais avec teamNames si disponibles
      const demoState = setupPreMatch();
      if (teamNameA) demoState.teamNames.teamA = teamNameA;
      if (teamNameB) demoState.teamNames.teamB = teamNameB;
      setState(demoState);
    })();
  }, [matchId, teamNameA, teamNameB]); // Dépend des teamNames pour utiliser les bons noms dans fallback

  // Charger le résumé (tour/mi-temps/score) depuis l'API pour refléter l'état en base
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/match/${matchId}/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || !data) return;

        // Ne pas écraser half/turn si en phase pré-match (half=0)
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            half: prev.half === 0 ? 0 : (typeof data.half === "number" ? data.half : prev.half),
            turn: prev.half === 0 ? 0 : (typeof data.turn === "number" ? data.turn : prev.turn),
            score: {
              teamA: typeof data?.score?.teamA === "number" ? data.score.teamA : prev.score.teamA,
              teamB: typeof data?.score?.teamB === "number" ? data.score.teamB : prev.score.teamB,
            },
            // Ne pas override teamNames du state si déjà bons
            teamNames: {
              teamA: prev.teamNames.teamA || teamNameA || data?.teams?.local?.name || prev.teamNames.teamA,
              teamB: prev.teamNames.teamB || teamNameB || data?.teams?.visitor?.name || prev.teamNames.teamB,
            },
          };
        });
      } catch {
        // noop: on garde l'état courant (démo) si l'API échoue
      }
    })();
  }, [matchId]); // Retiré teamNameA/B des deps pour éviter loops

  const legal = useMemo(() => {
    if (!state) return [];
    const extState = state as ExtendedGameState;
    if (extState.preMatch?.phase === 'setup') {
      // En setup, legal moves = positions pour placer selectedFromReserve
      if (selectedFromReserve) {
        return extState.preMatch.legalSetupPositions.map(p => ({ type: 'PLACE' as const, playerId: selectedFromReserve, to: p } as any));
      }
      return []; // Pas de moves sans sélection
    }
    return getLegalMoves(state);
  }, [state, selectedFromReserve]);
  const isMove = (m: Move, pid: string): m is Extract<Move, { type: "MOVE" }> => m.type === "MOVE" && (m as any).playerId === pid;
  const movesForSelected = useMemo(() => {
    if (!state || !state.selectedPlayerId) return [];
    return legal.filter((m) => isMove(m, state.selectedPlayerId!)).map((m) => m.to);
  }, [legal, state?.selectedPlayerId]);

  // Modifier onCellClick pour gérer setup
  function onCellClick(pos: Position) {
    if (!state) return;
    const extState = state as ExtendedGameState;
    if (extState.preMatch?.phase === 'setup') {
      // Mode setup : placer selectedFromReserve sur pos si légal
      if (selectedFromReserve) {
        const newState = placePlayerInSetup(extState, selectedFromReserve, pos);
        setState(newState);
        if (newState.preMatch.placedPlayers.length === 11) {
          // TODO: Switch coach ou kickoff
          setSelectedFromReserve(null);
        }
        setSelectedFromReserve(null); // Deselect après placement
        return;
      }
      // Sinon, clic sur terrain vide : ignore ou deselect
      setSelectedFromReserve(null);
      return;
    }
    // Logique normale pour match en cours
    const player = state.players.find((p) => p.pos.x === pos.x && p.pos.y === pos.y);
    if (player && player.team === state.currentPlayer) {
      setState((s) => s ? ({ ...s, selectedPlayerId: player.id }) : null);
      setCurrentAction(null);
      setSelectedFromReserve(null);
      return;
    }
    if (state.selectedPlayerId) {
      const candidate = legal.find((m) => m.type === "MOVE" && m.playerId === state.selectedPlayerId && m.to.x === pos.x && m.to.y === pos.y);
      if (candidate && candidate.type === "MOVE" && (currentAction === "MOVE" || currentAction === "BLITZ" || currentAction === null)) {
        setState((s) => {
          if (!s) return null;
          const s2 = applyMove(s, candidate, createRNG());
          const p = s2.players.find((pl) => pl.id === candidate.playerId);
          if (!p || p.pm <= 0) s2.selectedPlayerId = null;
          if (s2.lastDiceResult) setShowDicePopup(true);
          setSelectedFromReserve(null);
          return s2;
        });
      }
    }
  }

  // Modifier onPlayerClick pour sélection en setup
  const handleEndTurn = useMemo(() => {
    if (!state || state.half <= 0) return undefined; // Changé <= 0 pour cacher en prematch
    return () => setState((s) => s ? applyMove(s, { type: "END_TURN" }, createRNG()) : null);
  }, [state]);

  // Modifier handleStartSetup pour entrer en setup
  const handleStartSetup = useMemo(() => {
    if (state?.half !== 0) return undefined;
    return () => {
      setState((s) => {
        if (!s || s.half !== 0) return s;
        // Déterminer receivingTeam (placeholder 'A' pour local)
        const receivingTeam = 'A' as const;
        const setupState = enterSetupPhase(s as ExtendedGameState, receivingTeam);
        return setupState;
      });
    };
  }, [state]);

  // Afficher compteur en setup
  {state && ((state as ExtendedGameState).preMatch?.phase === 'setup') && (
    <div className="flex justify-center mt-2">
      <span className="text-sm text-gray-600">
        Joueurs placés: {((state as ExtendedGameState).preMatch?.placedPlayers?.length || 0)} / 11
      </span>
    </div>
  )}

  // Si setup fini, bouton passer
  {state && ((state as ExtendedGameState).preMatch?.phase === 'setup' && (state as ExtendedGameState).preMatch?.placedPlayers?.length === 11) && (
    <div className="flex justify-center mt-4">
      <button 
        onClick={() => {
          // TODO: Appel API pour switch coach ou kickoff
          setState((s) => {
            if (!s) return s;
            // Placeholder: passe à kickoff
            const kickoffState = { ...s, preMatch: { ...s.preMatch, phase: 'kickoff' } };
            kickoffState.half = 1;
            kickoffState.turn = 1;
            return kickoffState;
          });
        }} 
        className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
      >
        Lancer le kick-off
      </button>
    </div>
  )}

  if (!state) {
    return <div className="flex items-center justify-center min-h-screen">Chargement de la partie...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <GameScoreboard
        state={state}
        leftTeamName={teamNameA}
        rightTeamName={teamNameB}
        {...(state?.half > 0 ? { onEndTurn: handleEndTurn } : {})}
      />
      {/* Wrapper pour éléments pré-match, à l'intérieur du container principal */}
      <div className="pt-32"> {/* Augmenté de pt-24 à pt-32 pour espace bouton */}
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center space-y-4 mb-6"> {/* Wrapper centralisé pour pré-match */}
            {/* Statut pré-match (si half=0) */}
            {state && state.half === 0 && (
              <div className="text-center text-sm text-gray-600 bg-gray-100 p-2 rounded w-full max-w-md">
                <div>Phase pré-match</div>
                <div>Receveuse : {state.preMatch?.receivingTeam === 'A' ? teamNameA : teamNameB} ({state.preMatch?.receivingTeam})</div>
                <div>Au tour de {state.preMatch?.currentCoach === 'A' ? teamNameA : teamNameB} de placer ses joueurs</div>
              </div>
            )}
            
            {/* Bouton débuter si idle */}
            {state?.half === 0 && state.preMatch?.phase === 'idle' && handleStartSetup && (
              <div className="flex justify-center">
                <button 
                  onClick={handleStartSetup} 
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  Débuter la configuration des joueurs
                </button>
              </div>
            )}
            
            {/* Compteur si setup */}
            {state && state.preMatch?.phase === 'setup' && (
              <div className="text-sm text-gray-600">
                Joueurs placés: {state.preMatch.placedPlayers.length} / 11
              </div>
            )}
            
            {/* Bouton kick-off si 11 placés */}
            {state && state.preMatch?.phase === 'setup' && state.preMatch.placedPlayers.length === 11 && (
              <div className="flex justify-center">
                <button 
                  onClick={() => {
                    // TODO: Appel API pour switch coach ou kickoff
                    setState((s) => {
                      if (!s) return s;
                      // Placeholder: passe à kickoff
                      const kickoffState = { ...s, preMatch: { ...s.preMatch, phase: 'kickoff' } };
                      kickoffState.half = 1;
                      kickoffState.turn = 1;
                      return kickoffState;
                    });
                  }} 
                  className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
                >
                  Lancer le kick-off
                </button>
              </div>
            )}
          </div>
          
          <div className="flex flex-col lg:flex-row items-start gap-6 mb-6">
            {/* Board et sidebar */}
            <div className="flex-1 flex justify-center">
              <GameBoardWithDugouts state={state} onCellClick={onCellClick} legalMoves={movesForSelected} blockTargets={[]} selectedPlayerId={state.selectedPlayerId} onPlayerClick={(playerId) => {
                if (!state) return;
                const extState = state as ExtendedGameState;
                if (extState.preMatch?.phase === 'setup') {
                  const player = state.players.find((p) => p.id === playerId);
                  if (player && player.team === extState.preMatch.currentCoach && player.pos.x === -1 && !player.stunned && !extState.preMatch.placedPlayers.includes(playerId)) {
                    setSelectedFromReserve(playerId);
                    setState((s) => s ? ({ ...s, selectedPlayerId: null }) : null); // Deselect field player
                    return;
                  }
                  return; // Ignore autres clics en setup
                }
                // Logique normale
                const player = state.players.find((p) => p.id === playerId);
                if (player && player.team === state.currentPlayer) {
                  setState((s) => s ? ({ ...s, selectedPlayerId: player.id }) : null);
                  setCurrentAction(null);
                  setSelectedFromReserve(null);
                }
              }} />
            </div>
            <div className="w-full lg:w-auto">
              {state.selectedPlayerId && (
                <PlayerDetails variant="sidebar" player={state.players.find((p) => p.id === state.selectedPlayerId) || null} onClose={() => setState((s) => s ? ({ ...s, selectedPlayerId: null }) : null)} />
              )}
            </div>
          </div>
        </div>
      </div>
      {showDicePopup && state.lastDiceResult && (
        <DiceResultPopup result={state.lastDiceResult} onClose={() => { setShowDicePopup(false); setState((s) => s ? clearDiceResult(s) : null); }} />
      )}
      {state.selectedPlayerId && currentAction === null && !hasPlayerActed(state, state.selectedPlayerId) && (
        <ActionPickerPopup playerName={state.players.find(p => p.id === state.selectedPlayerId)?.name || 'Joueur'} available={["MOVE", "BLOCK", "BLITZ", "PASS", "HANDOFF", "FOUL"]} onPick={(a) => setCurrentAction(a)} onClose={() => setCurrentAction("MOVE")} />
      )}
    </div>
  );
}


