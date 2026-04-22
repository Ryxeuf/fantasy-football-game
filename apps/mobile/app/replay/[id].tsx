import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  buildReplayFrames,
  type GameState,
  type ReplayFrame,
} from "@bb/game-engine";
import { apiGet, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  REPLAY_DEFAULT_SPEED_MS,
  REPLAY_SPEED_OPTIONS,
  clampFrameIndex,
  formatMatchDate,
  formatTeamsTitle,
  getMoveLabel,
  nextFrameIndex,
  parseReplayResponse,
  prevFrameIndex,
  type ReplayResponse,
} from "../../lib/replay";
import PixiBoardNative from "../../../../packages/ui/src/board/PixiBoard.native";

function normalizeState(state: GameState): GameState {
  const anyState = state as unknown as Record<string, unknown>;
  if (!anyState.playerActions) anyState.playerActions = {};
  if (!anyState.teamBlitzCount) anyState.teamBlitzCount = {};
  if (!anyState.teamFoulCount) anyState.teamFoulCount = {};
  if (!anyState.matchStats) anyState.matchStats = {};
  if (typeof anyState.width !== "number") anyState.width = 26;
  if (typeof anyState.height !== "number") anyState.height = 15;
  return state;
}

export default function ReplayScreen() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { logout } = useAuth();

  const [replay, setReplay] = useState<ReplayResponse | null>(null);
  const [frames, setFrames] = useState<ReplayFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(REPLAY_DEFAULT_SPEED_MS);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef = useRef<ReplayFrame[]>([]);
  framesRef.current = frames;

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;

    (async () => {
      try {
        const raw = await apiGet(`/match/${matchId}/replay`);
        if (cancelled) return;
        const parsed = parseReplayResponse(raw);
        const built = buildReplayFrames(parsed.turns).map((f) => ({
          ...f,
          gameState: normalizeState(f.gameState),
        }));
        setReplay(parsed);
        setFrames(built);
        setCurrentIndex(0);
        setError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        if (
          err instanceof ApiError &&
          (err.status === 401 || err.status === 403)
        ) {
          await logout();
          router.replace("/login");
          return;
        }
        setError(
          err instanceof Error ? err.message : "Erreur de chargement du replay",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId, router, logout]);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const len = framesRef.current.length;
        const next = prev + 1;
        if (next >= len) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, speed);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, speed]);

  const handlePlay = useCallback(() => {
    if (frames.length === 0) return;
    if (currentIndex >= frames.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(true);
  }, [frames.length, currentIndex]);

  const handlePause = useCallback(() => setIsPlaying(false), []);

  const handleStepForward = useCallback(() => {
    setCurrentIndex((prev) => nextFrameIndex(prev, framesRef.current.length));
  }, []);

  const handleStepBackward = useCallback(() => {
    setCurrentIndex((prev) => prevFrameIndex(prev));
  }, []);

  const handleGoToStart = useCallback(() => setCurrentIndex(0), []);

  const handleGoToEnd = useCallback(() => {
    setCurrentIndex(
      (prev) =>
        clampFrameIndex(
          framesRef.current.length - 1,
          framesRef.current.length,
        ) || prev,
    );
  }, []);

  const currentFrame = frames[currentIndex] ?? null;
  const currentState = currentFrame?.gameState ?? null;
  const totalFrames = frames.length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Chargement du replay...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Erreur</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  if (frames.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Aucune donnee de replay disponible</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const teams = replay?.teams ?? { teamA: null, teamB: null };
  const title = formatTeamsTitle(teams);
  const dateText = formatMatchDate(replay?.createdAt ?? null);
  const moveLabel = getMoveLabel(currentFrame?.moveType);

  const score = currentState?.score;
  const half = currentState?.half;
  const turn = currentState?.turn;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.backLinkSpacer} />
      </View>

      {dateText.length > 0 && <Text style={styles.dateText}>{dateText}</Text>}

      {score && (
        <View style={styles.scoreBanner}>
          <Text style={styles.scoreText}>
            {score.teamA} - {score.teamB}
          </Text>
          {typeof half === "number" && typeof turn === "number" && (
            <Text style={styles.halfTurn}>
              Mi-temps {half} • Tour {turn}
            </Text>
          )}
        </View>
      )}

      <ScrollView
        style={styles.boardScroll}
        contentContainerStyle={styles.boardScrollContent}
        horizontal
        bouncesZoom
      >
        {currentState && <PixiBoardNative state={currentState} cellSize={20} />}
      </ScrollView>

      <View style={styles.controls}>
        <View style={styles.transportRow}>
          <Pressable
            onPress={handleGoToStart}
            style={styles.transportButton}
            accessibilityLabel="Debut"
          >
            <Text style={styles.transportIcon}>|◀</Text>
          </Pressable>
          <Pressable
            onPress={handleStepBackward}
            style={styles.transportButton}
            accessibilityLabel="Image precedente"
          >
            <Text style={styles.transportIcon}>◀</Text>
          </Pressable>
          {isPlaying ? (
            <Pressable
              onPress={handlePause}
              style={[styles.transportButton, styles.playButton]}
              accessibilityLabel="Pause"
            >
              <Text style={styles.playIcon}>||</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handlePlay}
              style={[styles.transportButton, styles.playButton]}
              accessibilityLabel="Lecture"
            >
              <Text style={styles.playIcon}>▶</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleStepForward}
            style={styles.transportButton}
            accessibilityLabel="Image suivante"
          >
            <Text style={styles.transportIcon}>▶</Text>
          </Pressable>
          <Pressable
            onPress={handleGoToEnd}
            style={styles.transportButton}
            accessibilityLabel="Fin"
          >
            <Text style={styles.transportIcon}>▶|</Text>
          </Pressable>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    totalFrames > 1
                      ? `${(currentIndex / (totalFrames - 1)) * 100}%`
                      : "100%",
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {currentIndex + 1} / {totalFrames}
          </Text>
        </View>

        <View style={styles.speedRow}>
          <Text style={styles.speedLabel}>Vitesse</Text>
          {REPLAY_SPEED_OPTIONS.map((opt) => {
            const active = speed === opt.ms;
            return (
              <Pressable
                key={opt.ms}
                onPress={() => setSpeed(opt.ms)}
                style={[styles.speedButton, active && styles.speedButtonActive]}
                accessibilityLabel={`Vitesse ${opt.label}`}
              >
                <Text
                  style={[
                    styles.speedButtonText,
                    active && styles.speedButtonTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {moveLabel.length > 0 && (
          <Text style={styles.moveLabel}>Action : {moveLabel}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0F172A",
  },
  loadingText: {
    marginTop: 12,
    color: "#E2E8F0",
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F87171",
    marginBottom: 8,
  },
  errorText: {
    color: "#FCA5A5",
    marginBottom: 16,
    textAlign: "center",
  },
  emptyText: {
    color: "#CBD5F5",
    fontSize: 15,
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#2563EB",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    gap: 8,
  },
  backLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: 80,
  },
  backLinkSpacer: {
    width: 80,
  },
  backLinkText: {
    color: "#93C5FD",
    fontSize: 14,
    fontWeight: "500",
  },
  headerTitle: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  dateText: {
    color: "#94A3B8",
    textAlign: "center",
    fontSize: 12,
    marginBottom: 8,
  },
  scoreBanner: {
    alignItems: "center",
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: "#1E293B",
  },
  scoreText: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700",
  },
  halfTurn: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  boardScroll: {
    maxHeight: 320,
  },
  boardScrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  controls: {
    backgroundColor: "#1E293B",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    padding: 12,
    gap: 10,
  },
  transportRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  transportButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#334155",
    borderRadius: 6,
    minWidth: 44,
    alignItems: "center",
  },
  playButton: {
    backgroundColor: "#16A34A",
  },
  transportIcon: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "700",
  },
  playIcon: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: "#334155",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563EB",
  },
  progressLabel: {
    color: "#CBD5F5",
    fontSize: 12,
    minWidth: 56,
    textAlign: "right",
  },
  speedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  speedLabel: {
    color: "#94A3B8",
    fontSize: 12,
    marginRight: 4,
  },
  speedButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#334155",
    borderRadius: 6,
  },
  speedButtonActive: {
    backgroundColor: "#2563EB",
  },
  speedButtonText: {
    color: "#CBD5F5",
    fontSize: 12,
    fontWeight: "600",
  },
  speedButtonTextActive: {
    color: "#fff",
  },
  moveLabel: {
    color: "#E2E8F0",
    fontSize: 13,
  },
});
