import { useCallback, useEffect, useMemo, useState } from "react";
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
import { apiGet, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  LEAGUE_STATUSES,
  filterLeaguesByStatus,
  formatLeagueRulesetLabel,
  formatLeagueStatusLabel,
  parseLeagueListResponse,
  type League,
  type LeagueStatusFilter,
} from "../../lib/leagues";

const FILTER_OPTIONS: ReadonlyArray<{ value: LeagueStatusFilter; label: string }> = [
  { value: "all", label: "Toutes" },
  ...LEAGUE_STATUSES.map((s) => ({
    value: s as LeagueStatusFilter,
    label: formatLeagueStatusLabel(s),
  })),
];

export default function LeaguesListScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [filter, setFilter] = useState<LeagueStatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeagues = useCallback(async () => {
    try {
      setError(null);
      const path =
        filter === "all" ? "/league" : `/league?status=${encodeURIComponent(filter)}`;
      const response = await apiGet(path);
      setLeagues(parseLeagueListResponse(response));
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
  }, [filter, logout, router]);

  useEffect(() => {
    setLoading(true);
    fetchLeagues().finally(() => setLoading(false));
  }, [fetchLeagues]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeagues();
    setRefreshing(false);
  }, [fetchLeagues]);

  // Local filter mirrors the server-side filter for safety and test determinism.
  const visible = useMemo(
    () => filterLeaguesByStatus(leagues, filter),
    [leagues, filter],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ligues</Text>

      <View style={styles.filters} testID="leagues-filters">
        {FILTER_OPTIONS.map((opt) => {
          const active = opt.value === filter;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setFilter(opt.value)}
              style={[styles.filterChip, active && styles.filterChipActive]}
              testID={`leagues-filter-${opt.value}`}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
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
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LeagueCard
              league={item}
              onPress={() => router.push(`/leagues/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText} testID="leagues-empty">
                Aucune ligue pour ce filtre.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function LeagueCard({
  league,
  onPress,
}: {
  league: League;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      testID={`league-card-${league.id}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {league.name}
        </Text>
        <Text style={styles.cardStatus}>
          {formatLeagueStatusLabel(league.status)}
        </Text>
      </View>
      {league.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {league.description}
        </Text>
      ) : null}
      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText}>
          {formatLeagueRulesetLabel(league.ruleset)}
        </Text>
        <Text style={styles.cardMetaText}>
          Max {league.maxParticipants} equipes
        </Text>
        <Text style={styles.cardMetaText}>
          {league.isPublic ? "Publique" : "Privee"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  filterChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  filterChipText: { fontSize: 13, color: "#374151" },
  filterChipTextActive: { color: "#fff", fontWeight: "600" },
  listContent: { padding: 16, flexGrow: 1 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  cardStatus: {
    fontSize: 12,
    color: "#1F2937",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cardDescription: { fontSize: 13, color: "#4B5563", marginBottom: 6 },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cardMetaText: { fontSize: 12, color: "#6B7280" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { color: "#DC2626", fontSize: 14, marginBottom: 12, textAlign: "center" },
  retryButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  emptyText: { color: "#6B7280", fontSize: 15, textAlign: "center" },
});
