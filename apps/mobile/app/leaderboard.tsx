import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { apiGet, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import {
  LEADERBOARD_PAGE_SIZE,
  computeLeaderboardStats,
  formatEloRating,
  getCurrentPage,
  getTotalPages,
  isFirstPage,
  isLastPage,
  parseLeaderboardResponse,
  type LeaderboardEntry,
  type LeaderboardMeta,
} from "../lib/leaderboard";

const EMPTY_META: LeaderboardMeta = {
  total: 0,
  limit: LEADERBOARD_PAGE_SIZE,
  offset: 0,
};

export default function LeaderboardScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [meta, setMeta] = useState<LeaderboardMeta>(EMPTY_META);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(
    async (nextOffset: number) => {
      try {
        const response = await apiGet(
          `/leaderboard?limit=${LEADERBOARD_PAGE_SIZE}&offset=${nextOffset}`,
        );
        const parsed = parseLeaderboardResponse(response);
        setEntries(parsed.entries);
        setMeta(parsed.meta);
        setError(null);
      } catch (err: unknown) {
        if (
          err instanceof ApiError &&
          (err.status === 401 || err.status === 403)
        ) {
          await logout();
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      }
    },
    [logout, router],
  );

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard(offset).finally(() => setLoading(false));
  }, [fetchLeaderboard, offset]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeaderboard(offset);
    setRefreshing(false);
  }, [fetchLeaderboard, offset]);

  const stats = computeLeaderboardStats(entries);
  const firstPage = isFirstPage(offset);
  const lastPage = isLastPage(offset, LEADERBOARD_PAGE_SIZE, meta.total);
  const currentPage = getCurrentPage(offset, LEADERBOARD_PAGE_SIZE);
  const totalPages = getTotalPages(meta.total, LEADERBOARD_PAGE_SIZE);

  function goPrev() {
    if (firstPage) return;
    setOffset(Math.max(0, offset - LEADERBOARD_PAGE_SIZE));
  }

  function goNext() {
    if (lastPage) return;
    setOffset(offset + LEADERBOARD_PAGE_SIZE);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Classement ELO</Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Joueurs" value={String(meta.total)} testID="stats-total" />
        <StatCard
          label="Meilleur"
          value={formatEloRating(stats.top)}
          testID="stats-top"
        />
        <StatCard
          label="Moyen"
          value={formatEloRating(stats.average)}
          testID="stats-average"
        />
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      )}

      {error && !loading && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Erreur : {error}</Text>
          <Pressable onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Reessayer</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => <EntryRow entry={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                Aucun coach classe pour l'instant.
              </Text>
            </View>
          }
          ListFooterComponent={
            meta.total > LEADERBOARD_PAGE_SIZE ? (
              <View style={styles.pagination}>
                <Pressable
                  accessibilityRole="button"
                  onPress={goPrev}
                  disabled={firstPage}
                  style={[
                    styles.pageButton,
                    firstPage && styles.pageButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.pageButtonText,
                      firstPage && styles.pageButtonTextDisabled,
                    ]}
                  >
                    Precedent
                  </Text>
                </Pressable>
                <Text style={styles.pageIndicator}>
                  Page {currentPage} / {totalPages}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={goNext}
                  disabled={lastPage}
                  style={[
                    styles.pageButton,
                    lastPage && styles.pageButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.pageButtonText,
                      lastPage && styles.pageButtonTextDisabled,
                    ]}
                  >
                    Suivant
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

function StatCard({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID?: string;
}) {
  return (
    <View style={styles.statCard} testID={testID}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function EntryRow({ entry }: { entry: LeaderboardEntry }) {
  const podium = entry.rank <= 3;
  return (
    <View style={[styles.row, podium && styles.rowPodium]}>
      <View style={[styles.rankBadge, podium && styles.rankBadgePodium]}>
        <Text
          style={[styles.rankText, podium && styles.rankTextPodium]}
          numberOfLines={1}
        >
          {entry.rank}
        </Text>
      </View>
      <Text style={styles.coachName} numberOfLines={1}>
        {entry.coachName}
      </Text>
      <Text style={styles.eloText}>{formatEloRating(entry.eloRating)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rowPodium: {
    backgroundColor: "#FEF9C3",
    borderColor: "#FACC15",
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankBadgePodium: {
    backgroundColor: "#EAB308",
  },
  rankText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  rankTextPodium: {
    color: "#fff",
  },
  coachName: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  eloText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    fontVariant: ["tabular-nums"],
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
  emptyText: {
    color: "#6B7280",
    fontSize: 15,
    textAlign: "center",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 16,
  },
  pageButton: {
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  pageButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  pageButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  pageButtonTextDisabled: {
    color: "#9CA3AF",
  },
  pageIndicator: {
    fontSize: 13,
    color: "#4B5563",
  },
});
