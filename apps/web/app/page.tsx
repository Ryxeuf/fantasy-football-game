"use client";

import { useMemo, useState } from "react";
import { PixiBoard, PlayerDetails, DiceResultPopup, GameScoreboard, GameLog, BlockChoicePopup, ActionPickerPopup, DiceTestComponent, PushChoicePopup, FollowUpChoicePopup, GameBoardWithDugouts } from "@bb/ui";
import {
  setup,
  getLegalMoves,
  applyMove,
  makeRNG,
  clearDiceResult,
  hasPlayerActed,
  type GameState,
  type Position,
  type Move,
  type DiceResult,
} from "@bb/game-engine";

export default function HomePage() {
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
      // ouvrir le sélecteur d'action seulement si le joueur n'a pas encore agi
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
        return; // le choix des dés sera géré par la popup dédiée
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
          
          // Afficher la popup si un jet de dés a été effectué
          if (s2.lastDiceResult) {
            setShowDicePopup(true);
          }
          
          return s2;
        });
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Tableau de bord moderne - fixe en haut */}
      <GameScoreboard
        state={state}
        onEndTurn={() => setState((s) => applyMove(s, { type: "END_TURN" }, createRNG()))}
      />
      
      {/* Contenu principal - avec padding pour compenser le header fixe */}
      <div className="pt-24">
        <div className="container mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Blood Bowl Fantasy Football</h1>
          <p className="text-gray-600">
            Cliquez sur un joueur pour le sélectionner, puis sur une case surbrillée pour le déplacer.
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
            {/* Encart des détails du joueur en sidebar (à droite du terrain) */}
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
        
        {state.selectedPlayerId && (
          <div className="text-center text-sm text-gray-600 mb-4">
            Joueur sélectionné:{" "}
            <span className="font-mono font-semibold">{state.selectedPlayerId}</span>
          </div>
        )}
        </div>
      </div>

      {/* Log du match */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Actions du Match</h2>
            <GameLog logEntries={state.gameLog} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Statistiques</h2>
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tour actuel:</span>
                  <span className="font-semibold">{state.turn}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Mi-temps:</span>
                  <span className="font-semibold">{state.half}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Équipe active:</span>
                  <span className="font-semibold">
                    {state.currentPlayer === "A" ? state.teamNames.teamA : state.teamNames.teamB}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Actions enregistrées:</span>
                  <span className="font-semibold">{state.gameLog.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Composant de test des dés de blocage - temporaire */}
        <div className="mt-8">
          <DiceTestComponent />
        </div>
      </div>

      {/* L'encart des détails est désormais rendu à côté du terrain ci-dessus */}

      {/* Popup des résultats de jets */}
      {showDicePopup && state.lastDiceResult && (
        <DiceResultPopup
          result={state.lastDiceResult}
          onClose={() => {
            setShowDicePopup(false);
            // Réinitialiser le résultat de dés
            setState((s) => clearDiceResult(s));
            // Si c'est un échec d'esquive ou de pickup, forcer la fin du tour
            if (state.lastDiceResult && !state.lastDiceResult.success && (state.lastDiceResult.type === "dodge" || state.lastDiceResult.type === "pickup")) {
              setState((s) => applyMove(s, { type: "END_TURN" }, createRNG()));
            }
          }}
        />
      )}

      {/* Popup de choix de dé de blocage (règles officielles) */}
      {state.pendingBlock && (
        <BlockChoicePopup
          attackerName={state.players.find(p => p.id === state.pendingBlock!.attackerId)?.name || 'Attaquant'}
          defenderName={state.players.find(p => p.id === state.pendingBlock!.targetId)?.name || 'Défenseur'}
          chooser={state.pendingBlock.chooser}
          options={state.pendingBlock.options}
          onChoose={(result) => {
            setState((s) => applyMove(s, { type: 'BLOCK_CHOOSE', playerId: s.pendingBlock!.attackerId, targetId: s.pendingBlock!.targetId, result } as any, createRNG()));
            // Afficher la popup de dés uniquement pour les jets d'armure consécutifs; ici on laisse le log faire foi
          }}
          onClose={() => {
            // Permettre d'annuler (rare en règle, mais utile en UI) : on vide le pendingBlock
            setState((s) => ({ ...s, pendingBlock: undefined } as any));
          }}
        />
      )}

      {/* Popup de choix de direction de poussée */}
      {state.pendingPushChoice && (
        <PushChoicePopup
          attackerName={state.players.find(p => p.id === state.pendingPushChoice!.attackerId)?.name || 'Attaquant'}
          targetName={state.players.find(p => p.id === state.pendingPushChoice!.targetId)?.name || 'Cible'}
          availableDirections={state.pendingPushChoice.availableDirections}
          onChoose={(direction) => {
            setState((s) => applyMove(s, { 
              type: 'PUSH_CHOOSE', 
              playerId: s.pendingPushChoice!.attackerId, 
              targetId: s.pendingPushChoice!.targetId, 
              direction 
            } as any, createRNG()));
          }}
          onClose={() => {
            // Annuler le choix de poussée - on ne peut pas vraiment annuler en règle, mais on peut au moins fermer la popup
            setState((s) => ({ ...s, pendingPushChoice: undefined }));
          }}
        />
      )}

      {/* Popup de choix de follow-up */}
      {state.pendingFollowUpChoice && (
        <FollowUpChoicePopup
          attackerName={state.players.find(p => p.id === state.pendingFollowUpChoice!.attackerId)?.name || 'Attaquant'}
          targetName={state.players.find(p => p.id === state.pendingFollowUpChoice!.targetId)?.name || 'Cible'}
          targetNewPosition={state.pendingFollowUpChoice.targetNewPosition}
          targetOldPosition={state.pendingFollowUpChoice.targetOldPosition}
          onChoose={(followUp) => {
            setState((s) => applyMove(s, { 
              type: 'FOLLOW_UP_CHOOSE', 
              playerId: s.pendingFollowUpChoice!.attackerId, 
              targetId: s.pendingFollowUpChoice!.targetId, 
              followUp 
            } as any, createRNG()));
          }}
          onClose={() => {
            // Annuler le choix de follow-up - on ne peut pas vraiment annuler en règle, mais on peut au moins fermer la popup
            setState((s) => ({ ...s, pendingFollowUpChoice: undefined }));
          }}
        />
      )}

      {/* Popup de sélection d'action à la sélection d'un joueur */}
      {state.selectedPlayerId && currentAction === null && !hasPlayerActed(state, state.selectedPlayerId) && (
        <ActionPickerPopup
          playerName={state.players.find(p => p.id === state.selectedPlayerId)?.name || 'Joueur'}
          available={["MOVE", "BLOCK", "BLITZ", "PASS", "HANDOFF", "FOUL"]}
          onPick={(a) => setCurrentAction(a)}
          onClose={() => setCurrentAction("MOVE")}
        />
      )}
    </div>
  );
}
