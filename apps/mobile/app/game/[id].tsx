import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiGet, apiPost, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { PixiBoardNative } from "@bb/ui";
import { getLegalMoves, type GameState, type Position, type Move } from "@bb/game-engine";

function normalizeState(state: any): GameState {
  if (!state) return state;
  if (!state.playerActions) state.playerActions = {};
  if (!state.teamBlitzCount) state.teamBlitzCount = {};
  if (!state.teamFoulCount) state.teamFoulCount = {};
  if (!state.matchStats) state.matchStats = {};
  if (typeof state.width !== "number") state.width = 26;
  if (typeof state.height !== "number") state.height = 15;
  return state as GameState;
}

export default function GameScreen() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { logout } = useAuth();

  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myTeamSide, setMyTeamSide] = useState<"A" | "B" | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch game state
  const fetchState = useCallback(async () => {
    try {
      const data = await apiGet(`/match/${matchId}/state`);
      if (data?.gameState) {
        setState(normalizeState(data.gameState));
        if (data.myTeamSide) setMyTeamSide(data.myTeamSide);
        if (typeof data.isMyTurn === "boolean") setIsMyTurn(data.isMyTurn);
      }
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await logout();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    }
  }, [matchId, router, logout]);

  // Initial load
  useEffect(() => {
    fetchState().finally(() => setLoading(false));
  }, [fetchState]);

  // Polling for opponent moves
  useEffect(() => {
    const interval = setInterval(() => {
      if (!submitting) fetchState();
    }, isMyTurn ? 10000 : 3000);
    pollRef.current = interval;
    return () => clearInterval(interval);
  }, [fetchState, isMyTurn, submitting]);

  // Compute legal moves
  const legal = useMemo(() => {
    if (!state) return [];
    return getLegalMoves(state);
  }, [state]);

  // Legal move positions for the selected player
  const movesForSelected = useMemo(() => {
    if (!state?.selectedPlayerId) return [];
    return legal
      .filter(
        (m): m is Extract<Move, { type: "MOVE" }> =>
          m.type === "MOVE" && (m as any).playerId === state.selectedPlayerId,
      )
      .map((m) => m.to);
  }, [legal, state?.selectedPlayerId]);

  // Block targets for the selected player
  const blockTargetsForSelected = useMemo(() => {
    if (!state?.selectedPlayerId) return [];
    return legal
      .filter(
        (m): m is Extract<Move, { type: "BLOCK" }> =>
          m.type === "BLOCK" && (m as any).playerId === state.selectedPlayerId,
      )
      .map((m) => {
        const target = state.players.find((p) => p.id === (m as any).targetId);
        return target?.pos;
      })
      .filter(Boolean) as Position[];
  }, [legal, state?.selectedPlayerId, state?.players]);

  // Submit a move to the server
  const submitMove = useCallback(
    async (move: Move) => {
      setSubmitting(true);
      try {
        const result = await apiPost(`/match/${matchId}/move`, { move });
        if (result?.success && result.gameState) {
          const ns = normalizeState(result.gameState);
          // Auto-deselect if player has no more movement points
          if (move.type === "MOVE") {
            const p = ns.players.find((pl) => pl.id === (move as any).playerId);
            if (!p || p.pm <= 0) ns.selectedPlayerId = null;
          }
          setState(ns);
          if (typeof result.isMyTurn === "boolean") setIsMyTurn(result.isMyTurn);
        }
      } catch (err: unknown) {
        // Refresh state on error to resync
        await fetchState();
      } finally {
        setSubmitting(false);
      }
    },
    [matchId, fetchState],
  );

  // Handle cell tap
  const onCellClick = useCallback(
    (pos: Position) => {
      if (!state || !isMyTurn || submitting) return;

      // Check if a player of current team is at this position
      const playerAtPos = state.players.find(
        (p) => p.pos.x === pos.x && p.pos.y === pos.y,
      );

      if (playerAtPos && playerAtPos.team === state.currentPlayer) {
        // Select/toggle player
        if (state.selectedPlayerId === playerAtPos.id) {
          // Tap same player again → deselect
          setState((s) => (s ? { ...s, selectedPlayerId: null } : null));
        } else {
          setState((s) => (s ? { ...s, selectedPlayerId: playerAtPos.id } : null));
        }
        return;
      }

      // If a player is selected and we tap a legal move cell → execute move
      if (state.selectedPlayerId) {
        const candidate = legal.find(
          (m) =>
            m.type === "MOVE" &&
            (m as any).playerId === state.selectedPlayerId &&
            m.to.x === pos.x &&
            m.to.y === pos.y,
        );
        if (candidate) {
          submitMove(candidate);
          return;
        }

        // Check if tapping a block target
        const blockCandidate = legal.find(
          (m) =>
            m.type === "BLOCK" &&
            (m as any).playerId === state.selectedPlayerId &&
            (() => {
              const target = state.players.find((p) => p.id === (m as any).targetId);
              return target && target.pos.x === pos.x && target.pos.y === pos.y;
            })(),
        );
        if (blockCandidate) {
          submitMove(blockCandidate);
          return;
        }

        // Tap empty non-legal cell → deselect
        setState((s) => (s ? { ...s, selectedPlayerId: null } : null));
      }
    },
    [state, isMyTurn, submitting, legal, submitMove],
  );

  // End turn
  const handleEndTurn = useCallback(() => {
    if (!isMyTurn || submitting) return;
    submitMove({ type: "END_TURN" });
    setState((s) => (s ? { ...s, selectedPlayerId: null } : null));
  }, [isMyTurn, submitting, submitMove]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Chargement du match...</Text>
      </View>
    );
  }

  if (error || !state) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || "Etat introuvable"}</Text>
        <Pressable onPress={() => fetchState().finally(() => setLoading(false))} style={styles.retryButton}>
          <Text style={styles.retryText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  const selectedPlayer = state.selectedPlayerId
    ? state.players.find((p) => p.id === state.selectedPlayerId)
    : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Retour</Text>
        </Pressable>
        <Text style={styles.score}>
          {state.score.teamA} - {state.score.teamB}
        </Text>
        <Text style={styles.turnInfo}>
          MT {state.half} T{state.turn}
        </Text>
      </View>

      {/* Turn banner */}
      <View style={[styles.turnBanner, isMyTurn ? styles.turnBannerMyTurn : styles.turnBannerWaiting]}>
        <Text style={styles.turnBannerText}>
          {submitting
            ? "Envoi..."
            : isMyTurn
              ? "C'est votre tour !"
              : "En attente de l'adversaire..."}
        </Text>
      </View>

      {/* Selected player info */}
      {selectedPlayer && (
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedText}>
            {selectedPlayer.name || selectedPlayer.id} — PM: {selectedPlayer.pm} | MA: {selectedPlayer.ma}
          </Text>
          {movesForSelected.length > 0 && (
            <Text style={styles.hintText}>
              {movesForSelected.length} case{movesForSelected.length > 1 ? "s" : ""} disponible{movesForSelected.length > 1 ? "s" : ""}
            </Text>
          )}
        </View>
      )}

      {/* Board */}
      <View style={styles.boardContainer}>
        <PixiBoardNative
          state={state}
          onCellClick={onCellClick}
          legalMoves={movesForSelected}
          blockTargets={blockTargetsForSelected}
          selectedPlayerId={state.selectedPlayerId}
        />
      </View>

      {/* End turn button */}
      {isMyTurn && state.half > 0 && (
        <View style={styles.footer}>
          <Pressable
            style={[styles.endTurnButton, submitting && styles.buttonDisabled]}
            onPress={handleEndTurn}
            disabled={submitting}
          >
            <Text style={styles.endTurnText}>Fin de tour</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    padding: 24,
  },
  loadingText: {
    color: "#9CA3AF",
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#16213e",
  },
  backButton: {
    paddingVertical: 4,
  },
  backText: {
    color: "#60A5FA",
    fontSize: 14,
    fontWeight: "500",
  },
  score: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  turnInfo: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  turnBanner: {
    paddingVertical: 6,
    alignItems: "center",
  },
  turnBannerMyTurn: {
    backgroundColor: "#166534",
  },
  turnBannerWaiting: {
    backgroundColor: "#92400E",
  },
  turnBannerText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  selectedInfo: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedText: {
    color: "#facc15",
    fontSize: 13,
    fontWeight: "600",
  },
  hintText: {
    color: "#22c55e",
    fontSize: 12,
  },
  boardContainer: {
    flex: 1,
  },
  footer: {
    padding: 12,
    backgroundColor: "#16213e",
  },
  endTurnButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  endTurnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
