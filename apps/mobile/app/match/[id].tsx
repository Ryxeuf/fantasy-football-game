import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiGet, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useTranslation } from "../../lib/i18n-context";
import type { TranslationFn } from "../../lib/i18n-context";
import type { TranslationKey } from "../../lib/i18n";

interface TurnSummary {
  id: string;
  number: number;
  createdAt: string;
  type: string;
  userId: string | null;
  half: number | null;
  turn: number | null;
  score: { teamA: number; teamB: number } | null;
  moveType: string | null;
}

function getTurnTypeLabelKey(
  type: string,
  moveType: string | null,
): TranslationKey | null {
  switch (type) {
    case "start":
      return "match.history.turnTypes.start";
    case "accept":
      return "match.history.turnTypes.accept";
    case "coin-toss":
      return "match.history.turnTypes.coinToss";
    case "select-kick-team":
      return "match.history.turnTypes.selectKickTeam";
    case "validate-setup":
      return "match.history.turnTypes.validateSetup";
    case "kickoff-sequence":
      return "match.history.turnTypes.kickoffSequence";
    case "kickoff-scatter":
      return "match.history.turnTypes.kickoffScatter";
    case "kickoff-event-resolved":
      return "match.history.turnTypes.kickoffEventResolved";
    case "gameplay-move":
      return getMoveLabelKey(moveType);
    default:
      return null;
  }
}

function getMoveLabelKey(moveType: string | null): TranslationKey | null {
  switch (moveType) {
    case "move":
      return "match.history.moveTypes.move";
    case "block":
      return "match.history.moveTypes.block";
    case "blitz":
      return "match.history.moveTypes.blitz";
    case "pass":
      return "match.history.moveTypes.pass";
    case "handoff":
      return "match.history.moveTypes.handoff";
    case "foul":
      return "match.history.moveTypes.foul";
    case "end-turn":
      return "match.history.moveTypes.endTurn";
    case "select":
      return "match.history.moveTypes.select";
    case "choose-block-result":
      return "match.history.moveTypes.chooseBlockResult";
    case "choose-push-direction":
      return "match.history.moveTypes.choosePushDirection";
    case "follow-up":
      return "match.history.moveTypes.followUp";
    default:
      return null;
  }
}

function resolveTurnLabel(
  type: string,
  moveType: string | null,
  t: TranslationFn,
): string {
  const key = getTurnTypeLabelKey(type, moveType);
  if (key !== null) return t(key);
  if (type === "gameplay-move") {
    return moveType ?? t("match.history.actionFallback");
  }
  return type;
}

function getTurnIcon(type: string, moveType: string | null): string {
  switch (type) {
    case "start":
      return "⚽";
    case "gameplay-move":
      switch (moveType) {
        case "move":
          return "🏃";
        case "block":
          return "💥";
        case "blitz":
          return "⚡";
        case "pass":
          return "🏈";
        case "end-turn":
          return "⏭";
        case "foul":
          return "🦶";
        default:
          return "🎯";
      }
    default:
      return "📋";
  }
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TurnCard({ turn, t }: { turn: TurnSummary; t: TranslationFn }) {
  const icon = getTurnIcon(turn.type, turn.moveType);
  const label = resolveTurnLabel(turn.type, turn.moveType, t);

  return (
    <View style={styles.turnCard}>
      <View style={styles.turnLeft}>
        <Text style={styles.turnIcon}>{icon}</Text>
        <View style={styles.turnLine} />
      </View>
      <View style={styles.turnContent}>
        <View style={styles.turnHeader}>
          <Text style={styles.turnLabel}>{label}</Text>
          <Text style={styles.turnTime}>{formatTime(turn.createdAt)}</Text>
        </View>
        <View style={styles.turnMeta}>
          {turn.half != null && turn.turn != null && (
            <Text style={styles.turnMetaText}>
              {t("match.history.turnRound", {
                half: turn.half,
                turn: turn.turn,
              })}
            </Text>
          )}
          {turn.score && (
            <Text style={styles.turnScore}>
              {turn.score.teamA} - {turn.score.teamB}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function MatchHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useTranslation();
  const [turns, setTurns] = useState<TurnSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchDate, setMatchDate] = useState<string | null>(null);

  const fetchTurns = useCallback(async () => {
    try {
      const data = await apiGet(`/match/${id}/turns`);
      setTurns(data.turns || []);
      if (data.turns?.length > 0) {
        setMatchDate(data.turns[0].createdAt);
      }
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await logout();
        router.replace("/login");
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : t("match.history.errors.loadError"),
      );
    }
  }, [id, router, logout, t]);

  useEffect(() => {
    fetchTurns().finally(() => setLoading(false));
  }, [fetchTurns]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTurns();
    setRefreshing(false);
  }, [fetchTurns]);

  // Filter to show only meaningful gameplay turns
  const gameplayTurns = turns.filter(
    (t) => t.type === "gameplay-move" || t.type === "start",
  );

  const lastTurn = turns[turns.length - 1];
  const finalScore = lastTurn?.score;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{t("match.history.back")}</Text>
        </Pressable>
        <Text style={styles.title}>{t("match.history.title")}</Text>
        <View style={styles.backButton} />
      </View>

      {matchDate && (
        <Text style={styles.dateHeader}>{formatDate(matchDate)}</Text>
      )}

      {finalScore && (
        <View style={styles.scoreBanner}>
          <Text style={styles.scoreBannerText}>
            {t("match.history.scoreFinal", {
              teamA: finalScore.teamA,
              teamB: finalScore.teamB,
            })}
          </Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{turns.length}</Text>
          <Text style={styles.statLabel}>
            {t("match.history.stats.actions")}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{gameplayTurns.length}</Text>
          <Text style={styles.statLabel}>
            {t("match.history.stats.movesPlayed")}
          </Text>
        </View>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {t("match.history.errors.prefix", { message: error })}
          </Text>
          <Pressable onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={gameplayTurns}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TurnCard turn={item} t={t} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {t("match.history.empty")}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 80,
  },
  backText: {
    color: "#2563EB",
    fontSize: 15,
    fontWeight: "500",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
  },
  dateHeader: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 13,
    marginBottom: 8,
  },
  scoreBanner: {
    backgroundColor: "#1E40AF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  scoreBannerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  turnCard: {
    flexDirection: "row",
    marginBottom: 0,
  },
  turnLeft: {
    alignItems: "center",
    width: 40,
  },
  turnIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  turnLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#D1D5DB",
  },
  turnContent: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  turnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  turnLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  turnTime: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  turnMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  turnMetaText: {
    fontSize: 12,
    color: "#6B7280",
  },
  turnScore: {
    fontSize: 12,
    fontWeight: "600",
    color: "#D97706",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    color: "#DC2626",
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
  emptyText: {
    color: "#6B7280",
    fontSize: 16,
  },
});
