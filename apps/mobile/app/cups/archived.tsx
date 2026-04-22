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
import { apiGet, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  formatCupStatusLabel,
  parseCupListResponse,
  sortCupsByRecent,
  type Cup,
} from "../../lib/cups";

export default function ArchivedCupsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [cups, setCups] = useState<Cup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCups = useCallback(async () => {
    try {
      setError(null);
      const response = await apiGet("/cup/archived");
      setCups(sortCupsByRecent(parseCupListResponse(response)));
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
  }, [logout, router]);

  useEffect(() => {
    setLoading(true);
    fetchCups().finally(() => setLoading(false));
  }, [fetchCups]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCups();
    setRefreshing(false);
  }, [fetchCups]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coupes archivees</Text>

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
          data={cups}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/cups/${item.id}`)}
              testID={`archived-cup-${item.id}`}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.cardStatus}>
                {formatCupStatusLabel(item.status)}
              </Text>
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                Aucune coupe archivee.
              </Text>
            </View>
          }
        />
      )}
    </View>
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
  listContent: { padding: 16, flexGrow: 1 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { flex: 1, fontSize: 14, color: "#111827", fontWeight: "500" },
  cardStatus: {
    fontSize: 12,
    color: "#1F2937",
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
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
