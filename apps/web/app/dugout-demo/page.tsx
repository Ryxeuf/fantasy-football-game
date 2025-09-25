"use client";

import { useMemo, useState } from "react";
import { GameBoardWithDugouts, PlayerDetails } from "@bb/ui";
import {
  setup,
  getLegalMoves,
  applyMove,
  makeRNG,
  clearDiceResult,
  hasPlayerActed,
  movePlayerToDugoutZone,
  performInjuryRoll,
  type GameState,
  type Position,
  type Move,
} from "@bb/game-engine";

export default function DugoutDemoPage() {
  const [state, setState] = useState<GameState>(() => setup());
  const [showDicePopup, setShowDicePopup] = useState(false);
  const [currentAction, setCurrentAction] = useState<"MOVE" | "BLOCK" | "BLITZ" | "PASS" | "HANDOFF" | "FOUL" | null>(null);
  const createRNG = () => makeRNG(`ui-seed-${Date.now()}-${Math.random()}`);

  const legal = useMemo(() => getLegalMoves(state), [state]);
  const isMove = (m: Move, pid: string): m is Extract<Move, { type: "MOVE" }> =>
    m.type === "MOVE" && (m as any).playerId === pid;
  const movesForSelected = useMemo(
    () =>
      state.selectedPlayerId
        ? legal
            .filter((m) => isMove(m, state.selectedPlayerId!))
            .map((m) => m.to)
        : [],
    [legal, state.selectedPlayerId],
  );

  // Cibles de blocage adjacentes pour le joueur sélectionné
  const blockTargets = useMemo(() => {
    if (!state.selectedPlayerId) return [] as Position[];
    const attacker = state.players.find((p) => p.id === state.selectedPlayerId);
    if (!attacker) return [] as Position[];
    return legal
      .filter((m) => m.type === "BLOCK" && m.playerId === attacker.id)
      .map((m: any) => {
        const target = state.players.find((p) => p.id === m.targetId);
        return target ? target.pos : null;
      })
      .filter(Boolean) as Position[];
  }, [legal, state.selectedPlayerId, state.players]);

  function onCellClick(pos: Position) {
    const player = state.players.find(
      (p) => p.pos.x === pos.x && p.pos.y === pos.y,
    );
    if (player && player.team === state.currentPlayer) {
      setState((s) => ({ ...s, selectedPlayerId: player.id }));
      setCurrentAction(null);
      return;
    }
    if (state.selectedPlayerId) {
      // Si on clique sur un adversaire qui est une cible de blocage, lancer BLOCK
      const attackerId = state.selectedPlayerId;
      const target = state.players.find(
        (p) => p.team !== state.currentPlayer && p.pos.x === pos.x && p.pos.y === pos.y,
      );
      const blockMove = legal.find(
        (m) => m.type === "BLOCK" && (m as any).playerId === attackerId && target && (m as any).targetId === target.id,
      ) as any;
      if (blockMove && target && (currentAction === "BLOCK" || currentAction === "BLITZ")) {
        setState((s) => applyMove(s, { type: "BLOCK", playerId: attackerId, targetId: target.id } as any, createRNG()));
        return;
      }

      const candidate = legal.find(
        (m) =>
          m.type === "MOVE" &&
          m.playerId === state.selectedPlayerId &&
          m.to.x === pos.x &&
          m.to.y === pos.y,
      );
      if (candidate && candidate.type === "MOVE" && (currentAction === "MOVE" || currentAction === "BLITZ" || currentAction === null)) {
        setState((s) => {
          const s2 = applyMove(s, candidate, createRNG());
          const p = s2.players.find((pl) => pl.id === candidate.playerId);
          if (!p || p.pm <= 0) s2.selectedPlayerId = null;
          
          if (s2.lastDiceResult) {
            setShowDicePopup(true);
          }
          
          return s2;
        });
      }
    }
  }

  // Fonctions de démonstration pour les zones de dugout
  const simulateInjury = (playerId: string, injuryType: 'stunned' | 'ko' | 'casualty' | 'sent_off') => {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    let newState = { ...state };
    
    switch (injuryType) {
      case 'stunned':
        newState = movePlayerToDugoutZone(state, playerId, 'stunned', player.team);
        break;
      case 'ko':
        newState = movePlayerToDugoutZone(state, playerId, 'knockedOut', player.team);
        break;
      case 'casualty':
        newState = movePlayerToDugoutZone(state, playerId, 'casualty', player.team);
        break;
      case 'sent_off':
        newState = movePlayerToDugoutZone(state, playerId, 'sentOff', player.team);
        break;
    }
    
    setState(newState);
  };

  const simulateInjuryRoll = (playerId: string) => {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    const newState = performInjuryRoll(state, player, createRNG());
    setState(newState);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Démonstration des Zones de Dugout</h1>
          <p className="text-gray-600">
            Cliquez sur un joueur pour le sélectionner, puis utilisez les boutons pour simuler des blessures.
          </p>
        </div>
        
        <div className="flex flex-col lg:flex-row items-start gap-6 mb-6">
          <div className="flex-1 flex justify-center">
            <GameBoardWithDugouts
              state={state}
              onCellClick={onCellClick}
              legalMoves={movesForSelected}
              blockTargets={blockTargets}
              selectedPlayerId={state.selectedPlayerId}
              onPlayerClick={(playerId) => {
                const player = state.players.find(p => p.id === playerId);
                if (player && player.team === state.currentPlayer) {
                  setState((s) => ({ ...s, selectedPlayerId: player.id }));
                  setCurrentAction(null);
                }
              }}
            />
          </div>
          <div className="w-full lg:w-auto">
            {state.selectedPlayerId && (
              <PlayerDetails
                variant="sidebar"
                player={
                  state.players.find((p) => p.id === state.selectedPlayerId) || null
                }
                onClose={() => setState((s) => ({ ...s, selectedPlayerId: null }))}
              />
            )}
          </div>
        </div>

        {/* Contrôles de démonstration */}
        {state.selectedPlayerId && (
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Simuler des blessures pour {state.players.find(p => p.id === state.selectedPlayerId)?.name}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => simulateInjury(state.selectedPlayerId!, 'stunned')}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
              >
                Sonné (2-7)
              </button>
              <button
                onClick={() => simulateInjury(state.selectedPlayerId!, 'ko')}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                KO (8-9)
              </button>
              <button
                onClick={() => simulateInjury(state.selectedPlayerId!, 'casualty')}
                className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 transition-colors"
              >
                Blessé (10+)
              </button>
              <button
                onClick={() => simulateInjury(state.selectedPlayerId!, 'sent_off')}
                className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 transition-colors"
              >
                Exclu
              </button>
            </div>
            <div className="mt-4">
              <button
                onClick={() => simulateInjuryRoll(state.selectedPlayerId!)}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
              >
                Jet de blessure aléatoire
              </button>
            </div>
          </div>
        )}

        {/* Informations sur les zones */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Zones de Dugout</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Équipe A (Bleue)</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-200 rounded"></div>
                  <span>Réserves: {state.dugouts.teamA.zones.reserves.players.length} joueurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>Sonnés: {state.dugouts.teamA.zones.stunned.players.length} joueurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>KO: {state.dugouts.teamA.zones.knockedOut.players.length} joueurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-700 rounded"></div>
                  <span>Blessés: {state.dugouts.teamA.zones.casualty.players.length} joueurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-800 rounded"></div>
                  <span>Exclus: {state.dugouts.teamA.zones.sentOff.players.length} joueurs</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Équipe B (Rouge)</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-200 rounded"></div>
                  <span>Réserves: {state.dugouts.teamB.zones.reserves.players.length} joueurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>Sonnés: {state.dugouts.teamB.zones.stunned.players.length} joueurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>KO: {state.dugouts.teamB.zones.knockedOut.players.length} joueurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-700 rounded"></div>
                  <span>Blessés: {state.dugouts.teamB.zones.casualty.players.length} joueurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-800 rounded"></div>
                  <span>Exclus: {state.dugouts.teamB.zones.sentOff.players.length} joueurs</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
