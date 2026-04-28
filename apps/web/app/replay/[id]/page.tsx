"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { buildReplayFrames, type ReplayFrame, type ReplayTurnPayload } from "@bb/game-engine";
import { GameScoreboard, GameLog } from "@bb/ui";
import { API_BASE } from "../../auth-client";
import { useReplayControls } from "./hooks/useReplayControls";

// S25.7 — GameBoardWithDugouts pulls in Pixi.js + @pixi/react bundle
// (>500KB). Same pattern as `play/[id]/page.tsx` : on lazy-load via
// next/dynamic + ssr:false pour qu'il n'apparaisse pas dans le bundle
// principal de l'app, et seulement dans le chunk /replay.
const GameBoardWithDugouts = dynamic(
  () => import("@bb/ui").then((m) => m.GameBoardWithDugouts),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[2/1] bg-gray-900 text-gray-400 flex items-center justify-center rounded-lg">
        Chargement du plateau…
      </div>
    ),
  },
);

interface TeamMeta {
  coachName: string;
  teamName: string;
  roster: string;
}

interface ReplayResponse {
  matchId: string;
  status: string;
  turns: ReplayTurnPayload[];
  teams: { teamA: TeamMeta | null; teamB: TeamMeta | null };
  createdAt: string;
}

const SPEED_OPTIONS = [
  { label: "0.5x", value: 2000 },
  { label: "1x", value: 1000 },
  { label: "2x", value: 500 },
  { label: "4x", value: 250 },
];

export default function ReplayPage() {
  const params = useParams();
  const matchId = params?.id as string;

  const [replayData, setReplayData] = useState<ReplayResponse | null>(null);
  const [frames, setFrames] = useState<ReplayFrame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch replay data
  useEffect(() => {
    if (!matchId) return;

    const token = localStorage.getItem("auth_token");
    if (!token) {
      setError("Authentification requise");
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/match/${matchId}/replay`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Replay non disponible");
        return res.json();
      })
      .then((data: ReplayResponse) => {
        setReplayData(data);
        const builtFrames = buildReplayFrames(data.turns);
        setFrames(builtFrames);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [matchId]);

  const controls = useReplayControls(frames);
  const currentState = controls.currentFrame?.gameState ?? null;

  const handleSpeedChange = useCallback(
    (value: number) => {
      controls.setSpeed(value);
    },
    [controls],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-lg">Chargement du replay...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 max-w-md">
          <h2 className="text-red-300 text-xl font-bold mb-2">Erreur</h2>
          <p className="text-red-200">{error}</p>
          <a href="/" className="mt-4 inline-block text-blue-400 hover:underline">
            Retour a l'accueil
          </a>
        </div>
      </div>
    );
  }

  if (frames.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-gray-400 text-lg">Aucune donnee de replay disponible</div>
      </div>
    );
  }

  const teams = replayData?.teams;
  const teamALabel = teams?.teamA ? `${teams.teamA.teamName} (${teams.teamA.coachName})` : "Equipe A";
  const teamBLabel = teams?.teamB ? `${teams.teamB.teamName} (${teams.teamB.coachName})` : "Equipe B";

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-gray-400 hover:text-white text-sm">
              &larr; Retour
            </a>
            <h1 className="text-lg font-bold">
              Replay: {teamALabel} vs {teamBLabel}
            </h1>
          </div>
          <div className="text-sm text-gray-400">
            {controls.currentFrame?.gameState
              ? `Mi-temps ${controls.currentFrame.gameState.half} - Tour ${controls.currentFrame.gameState.turn}`
              : ""}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto p-4">
        {/* Scoreboard */}
        {currentState && (
          <div className="mb-4">
            <GameScoreboard
              state={currentState}
              leftTeamName={teams?.teamA?.teamName}
              rightTeamName={teams?.teamB?.teamName}
              leftCoachName={teams?.teamA?.coachName}
              rightCoachName={teams?.teamB?.coachName}
            />
          </div>
        )}

        {/* Board */}
        <div className="mb-4">
          <GameBoardWithDugouts state={currentState} />
        </div>

        {/* Replay Controls */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Transport controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={controls.goToStart}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                title="Debut"
              >
                &#x23EE;
              </button>
              <button
                onClick={controls.stepBackward}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                title="Image precedente"
              >
                &#x23F4;
              </button>
              {controls.isPlaying ? (
                <button
                  onClick={controls.pause}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded text-sm font-bold"
                  title="Pause"
                >
                  &#x23F8;
                </button>
              ) : (
                <button
                  onClick={controls.play}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-bold"
                  title="Lecture"
                >
                  &#x25B6;
                </button>
              )}
              <button
                onClick={controls.stepForward}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                title="Image suivante"
              >
                &#x23F5;
              </button>
              <button
                onClick={controls.goToEnd}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                title="Fin"
              >
                &#x23ED;
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex-1 min-w-48">
              <input
                type="range"
                min={0}
                max={controls.totalFrames - 1}
                value={controls.currentIndex}
                onChange={(e) => controls.goToFrame(Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="text-center text-xs text-gray-400 mt-1">
                {controls.currentIndex + 1} / {controls.totalFrames}
              </div>
            </div>

            {/* Speed selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Vitesse:</span>
              {SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSpeedChange(opt.value)}
                  className={`px-2 py-1 rounded text-xs ${
                    controls.speed === opt.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Move info */}
          {controls.currentFrame?.moveType && (
            <div className="mt-3 text-sm text-gray-400">
              Action: <span className="text-white font-medium">{controls.currentFrame.moveType}</span>
            </div>
          )}
        </div>

        {/* Game Log */}
        {currentState && currentState.gameLog.length > 0 && (
          <GameLog logEntries={currentState.gameLog} maxEntries={20} />
        )}
      </div>
    </div>
  );
}
