import { useEffect, useState, useCallback, useMemo } from "react";
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
import {
  getLegalMoves,
  type GameState,
  type Position,
  type Move,
} from "@bb/game-engine";
import PixiBoardNative from "../../../../packages/ui/src/board/PixiBoard.native";

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

export default function PlayScreen() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { logout } = useAuth();

  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch game state
  const fetchState = useCallback(async () => {
    try {
      const data = await apiGet(`/match/${matchId}/state`);
      if (data?.gameState) {
        setState(normalizeState(data.gameState));
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

  useEffect(() => {
    fetchState().finally(() => setLoading(false));
  }, [fetchState]);

  // Poll for state updates when it's not our turn
  useEffect(() => {
    if (!state || loading) return;
    const interval = setInterval(fetchState, isMyTurn ? 10000 : 3000);
    return () => clearInterval(interval);
  }, [fetchState, isMyTurn, state, loading]);

  // Compute legal moves
  const legal = useMemo(() => {
    if (!state || state.half <= 0) return [];
    try {
      return getLegalMoves(state);
    } catch {
      return [];
    }
  }, [state]);

  // Moves for selected player
  const movesForSelected = useMemo(() => {
    if (!state?.selectedPlayerId) return [] as Position[];
    return legal
      .filter(
        (m): m is Extract<Move, { type: "MOVE" }> =>
          m.type === "MOVE" && (m as any).playerId === state.selectedPlayerId,
      )
      .map((m) => m.to);
  }, [legal, state?.selectedPlayerId]);

  // Block targets for selected player
  const blockTargets = useMemo(() => {
    if (!state?.selectedPlayerId) return [] as Position[];
    const attacker = state.players.find((p) => p.id === state.selectedPlayerId);
    if (!attacker) return [] as Position[];
    return legal
      .filter(
        (m) => m.type === "BLOCK" && (m as any).playerId === attacker.id,
      )
      .map((m) => {
        const target = state.players.find((p) => p.id === (m as any).targetId);
        return target?.pos;
      })
      .filter((pos): pos is Position => !!pos);
  }, [legal, state?.selectedPlayerId, state?.players]);

  // Submit a move to the server
  const submitMove = useCallback(
    async (move: Move) => {
      setSubmitting(true);
      try {
        const data = await apiPost(`/match/${matchId}/move`, { move });
        if (data?.gameState) {
          setState(normalizeState(data.gameState));
          if (typeof data.isMyTurn === "boolean") setIsMyTurn(data.isMyTurn);
        }
      } catch (err: unknown) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          await logout();
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        setSubmitting(false);
      }
    },
    [matchId, router, logout],
  );

  // Handle cell tap
  const onCellClick = useCallback(
    (pos: Position) => {
      if (!state || !isMyTurn || submitting) return;

      // Check if tapped on own player -> select
      const player = state.players.find(
        (p) => p.pos.x === pos.x && p.pos.y === pos.y,
      );
      if (player && player.team === state.currentPlayer) {
        setState((s) => (s ? { ...s, selectedPlayerId: player.id } : null));
        return;
      }

      // Check if tapped on a block target -> block
      if (state.selectedPlayerId) {
        const blockMove = legal.find(
          (m) =>
            m.type === "BLOCK" &&
            (m as any).playerId === state.selectedPlayerId &&
            (() => {
              const target = state.players.find(
                (p) => p.id === (m as any).targetId,
              );
              return target?.pos.x === pos.x && target?.pos.y === pos.y;
            })(),
        );
        if (blockMove) {
          submitMove(blockMove);
          return;
        }
      }

      // Check if tapped on a legal move cell -> move
      if (state.selectedPlayerId) {
        const moveAction = legal.find(
          (m) =>
            m.type === "MOVE" &&
            (m as any).playerId === state.selectedPlayerId &&
            m.to.x === pos.x &&
            m.to.y === pos.y,
        );
        if (moveAction) {
          submitMove(moveAction);
          return;
        }
      }

      // Tapped on empty/opponent cell with no valid action -> deselect
      if (state.selectedPlayerId) {
        setState((s) => (s ? { ...s, selectedPlayerId: null } : null));
      }
    },
    [state, isMyTurn, submitting, legal, submitMove],
  );

  // Handle double-tap deselect
  const onDeselect = useCallback(() => {
    setState((s) => (s ? { ...s, selectedPlayerId: null } : null));
  }, []);

  // Handle end turn
  const handleEndTurn = useCallback(() => {
    if (!state || !isMyTurn || submitting) return;
    submitMove({ type: "END_TURN" });
  }, [state, isMyTurn, submitting, submitMove]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Chargement du match...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Erreur : {error}</Text>
        <Pressable onPress={() => fetchState()} style={styles.retryButton}>
          <Text style={styles.retryText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  if (!state) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Aucun etat de jeu disponible</Text>
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
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>
            {state.score?.teamA ?? 0} - {state.score?.teamB ?? 0}
          </Text>
          {state.half > 0 && (
            <Text style={styles.turnText}>
              MT{state.half} T{state.turn}
            </Text>
          )}
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Turn indicator */}
      <View
        style={[
          styles.turnBanner,
          { backgroundColor: isMyTurn ? "#16A34A" : "#6B7280" },
        ]}
      >
        <Text style={styles.turnBannerText}>
          {isMyTurn ? "Votre tour" : "Tour de l'adversaire"}
        </Text>
        {submitting && (
          <ActivityIndicator
            size="small"
            color="#fff"
            style={{ marginLeft: 8 }}
          />
        )}
      </View>

      {/* Selected player info */}
      {selectedPlayer && (
        <View style={styles.selectionBar}>
          <View
            style={[
              styles.selectionDot,
              {
                backgroundColor:
                  selectedPlayer.team === "A" ? "#3B82F6" : "#EF4444",
              },
            ]}
          />
          <Text style={styles.selectionText}>
            {selectedPlayer.name || selectedPlayer.id.slice(0, 8)} — PM:{" "}
            {selectedPlayer.pm}
          </Text>
          <Pressable onPress={onDeselect} style={styles.deselectButton}>
            <Text style={styles.deselectText}>Annuler</Text>
          </Pressable>
        </View>
      )}

      {/* Board */}
      <View style={styles.boardContainer}>
        <PixiBoardNative
          state={state}
          onCellClick={onCellClick}
          onDeselect={onDeselect}
          legalMoves={movesForSelected}
          blockTargets={blockTargets}
          selectedPlayerId={state.selectedPlayerId}
          cellSize={28}
        />
      </View>

      {/* Actions bar */}
      {isMyTurn && state.half > 0 && (
        <View style={styles.actionsBar}>
          <Pressable
            style={[styles.endTurnButton, submitting && styles.buttonDisabled]}
            onPress={handleEndTurn}
            disabled={submitting}
          >
            <Text style={styles.endTurnText}>Fin de tour</Text>
          </Pressable>
        </View>
      )}

      {/* Help hint */}
      <View style={styles.hintBar}>
        <Text style={styles.hintText}>
          Tap un joueur pour voir ses cases jouables. Double-tap pour annuler.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 70,
  },
  backText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "500",
  },
  scoreContainer: {
    alignItems: "center",
  },
  scoreText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  turnText: {
    fontSize: 11,
    color: "#6B7280",
  },
  turnBanner: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 6,
  },
  turnBannerText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  selectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  selectionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#92400E",
  },
  deselectButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#FDE68A",
    borderRadius: 4,
  },
  deselectText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
  },
  boardContainer: {
    flex: 1,
  },
  actionsBar: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  endTurnButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  endTurnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  hintBar: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    backgroundColor: "#E5E7EB",
  },
  hintText: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
  },
});
