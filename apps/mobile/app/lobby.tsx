import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { apiGet, apiPost, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";

interface MatchTeamInfo {
  coachName: string;
  teamName: string;
  rosterName?: string;
}

interface MatchSummary {
  id: string;
  status: string;
  createdAt: string;
  lastMoveAt: string | null;
  isMyTurn: boolean;
  score: { teamA: number; teamB: number };
  myScore: number;
  opponentScore: number;
  half: number;
  turn: number;
  myTeam: MatchTeamInfo | null;
  opponent: MatchTeamInfo | null;
}

type Filter = "all" | "my-turn" | "active" | "ended";

function getStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "En cours";
    case "pending":
      return "En attente";
    case "prematch":
      return "Pre-match";
    case "prematch-setup":
      return "Configuration";
    case "ended":
      return "Termine";
    default:
      return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "#22C55E";
    case "pending":
      return "#EAB308";
    case "prematch":
    case "prematch-setup":
      return "#3B82F6";
    case "ended":
      return "#6B7280";
    default:
      return "#9CA3AF";
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MatchCard({
  match,
  onPress,
  onReplay,
}: {
  match: MatchSummary;
  onPress: () => void;
  onReplay?: () => void;
}) {
  const isMyTurn = match.isMyTurn && match.status === "active";
  const isEnded = match.status === "ended";

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, isMyTurn && styles.cardMyTurn]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(match.status) },
            ]}
          />
          <Text style={styles.statusText}>{getStatusLabel(match.status)}</Text>
          {isMyTurn && (
            <View style={styles.myTurnBadge}>
              <Text style={styles.myTurnText}>Votre tour</Text>
            </View>
          )}
        </View>
        <Text style={styles.dateText}>{formatDate(match.createdAt)}</Text>
      </View>

      <View style={styles.teamsRow}>
        <Text style={styles.teamName} numberOfLines={1}>
          {match.myTeam?.teamName || "Mon equipe"}
        </Text>
        {match.status !== "pending" && (
          <Text style={styles.score}>
            {match.myScore} - {match.opponentScore}
          </Text>
        )}
        <Text style={styles.teamName} numberOfLines={1}>
          {match.opponent?.teamName || "En attente..."}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        {match.opponent?.coachName ? (
          <Text style={styles.footerText}>
            vs Coach {match.opponent.coachName}
          </Text>
        ) : (
          <Text style={styles.footerText} />
        )}
        {match.half > 0 && (
          <Text style={styles.footerText}>
            MT {match.half}, Tour {match.turn}
          </Text>
        )}
      </View>

      {isEnded && onReplay && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onReplay();
          }}
          style={styles.replayButton}
          accessibilityLabel="Voir le replay"
        >
          <Text style={styles.replayButtonText}>▶ Voir le replay</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

export default function LobbyScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinMatchId, setJoinMatchId] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchMatches = useCallback(async () => {
    try {
      const data = await apiGet("/match/my-matches");
      setMatches(data.matches || []);
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
    fetchMatches().finally(() => setLoading(false));
  }, [fetchMatches]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  }, [fetchMatches]);

  const filtered = matches.filter((m) => {
    if (filter === "my-turn") return m.isMyTurn && m.status === "active";
    if (filter === "active")
      return (
        m.status === "active" ||
        m.status === "prematch" ||
        m.status === "prematch-setup"
      );
    if (filter === "ended") return m.status === "ended";
    return true;
  });

  const myTurnCount = matches.filter(
    (m) => m.isMyTurn && m.status === "active",
  ).length;

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "my-turn", label: `Mon tour (${myTurnCount})` },
    { key: "active", label: "En cours" },
    { key: "ended", label: "Termines" },
  ];

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  async function handleCreate() {
    setCreateLoading(true);
    try {
      const data = await apiPost("/match/create", {});
      await fetchMatches();
      Alert.alert("Match cree", `ID du match : ${data.match?.id || "OK"}`);
    } catch (err: unknown) {
      Alert.alert(
        "Erreur",
        err instanceof Error ? err.message : "Impossible de creer le match",
      );
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoin() {
    const id = joinMatchId.trim();
    if (!id) return;
    setJoinLoading(true);
    try {
      await apiPost("/match/join", { matchId: id });
      setJoinModalVisible(false);
      setJoinMatchId("");
      await fetchMatches();
      Alert.alert("Succes", "Vous avez rejoint le match !");
    } catch (err: unknown) {
      Alert.alert(
        "Erreur",
        err instanceof Error ? err.message : "Impossible de rejoindre le match",
      );
    } finally {
      setJoinLoading(false);
    }
  }

  function navigateToMatch(match: MatchSummary) {
    // Active/prematch matches → gameplay screen, others → history
    const playableStatuses = ["active", "prematch", "prematch-setup"];
    if (playableStatuses.includes(match.status)) {
      router.push(`/play/${match.id}`);
    } else {
      router.push(`/match/${match.id}`);
    }
  }

  function navigateToReplay(match: MatchSummary) {
    router.push(`/replay/${match.id}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {user?.coachName ? `Salut, ${user.coachName} !` : "Mes matchs"}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/teams")}
            style={styles.teamsButton}
          >
            <Text style={styles.teamsButtonText}>Mes equipes</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/leaderboard")}
            style={styles.leaderboardButton}
          >
            <Text style={styles.leaderboardButtonText}>Classement</Text>
          </Pressable>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Deconnexion</Text>
          </Pressable>
        </View>
      </View>

      {myTurnCount > 0 && (
        <View style={styles.turnBanner}>
          <Text style={styles.turnBannerText}>
            {myTurnCount} match{myTurnCount > 1 ? "s" : ""} en attente de votre
            tour
          </Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <Pressable
          style={styles.matchmakingButton}
          onPress={() => router.push("/matchmaking")}
        >
          <Text style={styles.actionButtonText}>Chercher un match</Text>
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={styles.cupsButton}
          onPress={() => router.push("/cups")}
          testID="lobby-cups-button"
        >
          <Text style={styles.actionButtonText}>Coupes</Text>
        </Pressable>
        <Pressable
          style={styles.leaguesButton}
          onPress={() => router.push("/leagues")}
          testID="lobby-leagues-button"
        >
          <Text style={styles.actionButtonText}>Ligues</Text>
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.createButton, createLoading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={createLoading}
        >
          {createLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>Creer un match</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.joinButton}
          onPress={() => setJoinModalVisible(true)}
        >
          <Text style={styles.actionButtonText}>Rejoindre</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[
              styles.filterButton,
              filter === f.key && styles.filterButtonActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.key && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Erreur : {error}</Text>
          <Pressable onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Reessayer</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MatchCard
              match={item}
              onPress={() => navigateToMatch(item)}
              onReplay={() => navigateToReplay(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Aucun match trouve.</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={joinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setJoinModalVisible(false)}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>Rejoindre un match</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="ID du match"
              placeholderTextColor="#9CA3AF"
              value={joinMatchId}
              onChangeText={setJoinMatchId}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setJoinModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalConfirm,
                  !joinMatchId.trim() && styles.buttonDisabled,
                ]}
                onPress={handleJoin}
                disabled={!joinMatchId.trim() || joinLoading}
              >
                {joinLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Rejoindre</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  teamsButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
  },
  teamsButtonText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "600",
  },
  leaderboardButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
  },
  leaderboardButtonText: {
    color: "#92400E",
    fontSize: 13,
    fontWeight: "600",
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  logoutText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "500",
  },
  turnBanner: {
    backgroundColor: "#166534",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  turnBannerText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  createButton: {
    flex: 1,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  matchmakingButton: {
    flex: 1,
    backgroundColor: "#16A34A",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  joinButton: {
    flex: 1,
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cupsButton: {
    flex: 1,
    backgroundColor: "#B45309",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  leaguesButton: {
    flex: 1,
    backgroundColor: "#0E7490",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
  },
  filterButtonActive: {
    backgroundColor: "#2563EB",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
  },
  filterTextActive: {
    color: "#fff",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardMyTurn: {
    borderColor: "#22C55E",
    backgroundColor: "#F0FDF4",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: "#6B7280",
  },
  myTurnBadge: {
    backgroundColor: "#22C55E",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  myTurnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  teamName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  score: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#D97706",
    marginHorizontal: 10,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  replayButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#0F172A",
    borderRadius: 6,
    alignItems: "center",
  },
  replayButtonText: {
    color: "#93C5FD",
    fontSize: 13,
    fontWeight: "600",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#F9FAFB",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#E5E7EB",
  },
  modalCancelText: {
    color: "#374151",
    fontWeight: "600",
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#2563EB",
  },
  modalConfirmText: {
    color: "#fff",
    fontWeight: "600",
  },
});
