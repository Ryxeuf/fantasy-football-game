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
  type TeamSummary,
  summarizeTeamRoster,
} from "../../lib/teams";

export default function TeamsListScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      const data = await apiGet("/team/mine");
      setTeams(data.teams || []);
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
  }, [router, logout]);

  useEffect(() => {
    fetchTeams().finally(() => setLoading(false));
  }, [fetchTeams]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTeams();
    setRefreshing(false);
  }, [fetchTeams]);

  function navigateToTeam(team: TeamSummary) {
    router.push(`/teams/${team.id}`);
  }

  function navigateToCreate() {
    router.push("/teams/new");
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes equipes</Text>
        <Pressable onPress={navigateToCreate} style={styles.createButton}>
          <Text style={styles.createButtonText}>+ Creer</Text>
        </Pressable>
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
          data={teams}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigateToTeam(item)}
              style={styles.card}
            >
              <Text style={styles.teamName}>{item.name}</Text>
              <Text style={styles.teamMeta}>{summarizeTeamRoster(item)}</Text>
              <Text style={styles.teamRuleset}>{item.ruleset}</Text>
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                Aucune equipe pour l'instant.
              </Text>
              <Pressable
                onPress={navigateToCreate}
                style={styles.emptyCreateButton}
              >
                <Text style={styles.emptyCreateText}>Creer ma premiere equipe</Text>
              </Pressable>
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
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  createButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  teamName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  teamMeta: {
    fontSize: 13,
    color: "#6B7280",
  },
  teamRuleset: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
    textTransform: "uppercase",
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
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  emptyCreateButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 8,
  },
  emptyCreateText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
