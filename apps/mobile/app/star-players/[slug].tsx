import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiGet, ApiError, API_BASE } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  DEFAULT_RULESET,
  formatHirableBy,
  formatStarCost,
  formatStarStat,
  getStarSkillList,
  resolveStarImageUrl,
  type StarPlayerSummary,
  type StarRuleset,
} from "../../lib/star-players";

function parseStarDetailResponse(
  response: unknown,
): StarPlayerSummary | null {
  const raw = (response ?? {}) as Record<string, unknown>;
  const payload = (raw.data ?? raw) as Record<string, unknown>;
  if (
    typeof payload.slug !== "string" ||
    typeof payload.displayName !== "string" ||
    typeof payload.cost !== "number" ||
    typeof payload.ma !== "number" ||
    typeof payload.st !== "number" ||
    typeof payload.ag !== "number" ||
    (payload.pa !== null && typeof payload.pa !== "number") ||
    typeof payload.av !== "number" ||
    typeof payload.skills !== "string" ||
    !Array.isArray(payload.hirableBy)
  ) {
    return null;
  }
  return payload as unknown as StarPlayerSummary;
}

export default function StarPlayerDetailScreen() {
  const params = useLocalSearchParams<{ slug: string; ruleset?: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const ruleset: StarRuleset =
    params.ruleset === "season_2" ? "season_2" : DEFAULT_RULESET;

  const router = useRouter();
  const { logout } = useAuth();
  const [player, setPlayer] = useState<StarPlayerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!slug) return;
    try {
      setError(null);
      const response = await apiGet(
        `/star-players/${encodeURIComponent(slug)}?ruleset=${ruleset}`,
      );
      const parsed = parseStarDetailResponse(response);
      if (!parsed) {
        throw new Error("Star Player introuvable");
      }
      setPlayer(parsed);
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
  }, [slug, ruleset, logout, router]);

  useEffect(() => {
    setLoading(true);
    fetchDetail().finally(() => setLoading(false));
  }, [fetchDetail]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDetail();
    setRefreshing(false);
  }, [fetchDetail]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (error || !player) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {error ?? "Star Player introuvable"}
        </Text>
        <Pressable onPress={onRefresh} style={styles.retryButton}>
          <Text style={styles.retryText}>Reessayer</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonSecondaryText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const imageUrl = resolveStarImageUrl(player.imageUrl, API_BASE);
  const skills = getStarSkillList(player.skills);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.headerCard}>
        {imageUrl && (
          <Image
            source={{ uri: imageUrl }}
            style={styles.playerImage}
            resizeMode="contain"
            accessibilityLabel={`Illustration de ${player.displayName}`}
          />
        )}
        <Text style={styles.playerName}>{player.displayName}</Text>
        <Text style={styles.playerCost}>{formatStarCost(player.cost)}</Text>
        {player.isMegaStar && (
          <View style={styles.megaBadge}>
            <Text style={styles.megaBadgeText}>Mega Star</Text>
          </View>
        )}
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.sectionTitle}>Caracteristiques</Text>
        <View style={styles.statsGrid}>
          <StatBlock label="MA" value={formatStarStat("ma", player.ma)} />
          <StatBlock label="ST" value={formatStarStat("st", player.st)} />
          <StatBlock label="AG" value={formatStarStat("ag", player.ag)} />
          <StatBlock label="PA" value={formatStarStat("pa", player.pa)} />
          <StatBlock label="AV" value={formatStarStat("av", player.av)} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Competences</Text>
        {skills.length === 0 ? (
          <Text style={styles.emptyText}>Aucune competence</Text>
        ) : (
          <View style={styles.skillChips}>
            {skills.map((skill) => (
              <View key={skill} style={styles.skillChip}>
                <Text style={styles.skillChipText}>{skill}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recrutable par</Text>
        <Text style={styles.bodyText}>{formatHirableBy(player.hirableBy)}</Text>
      </View>

      {player.specialRule && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Regle speciale</Text>
          <Text style={styles.bodyText}>{player.specialRule}</Text>
        </View>
      )}

      <Pressable
        onPress={() => router.back()}
        style={styles.backButtonFull}
        testID="star-detail-back"
      >
        <Text style={styles.backButtonText}>Retour au catalogue</Text>
      </Pressable>
    </ScrollView>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  playerImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#F3F4F6",
  },
  playerName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  playerCost: {
    fontSize: 16,
    fontWeight: "600",
    color: "#D97706",
    marginTop: 4,
  },
  megaBadge: {
    marginTop: 10,
    backgroundColor: "#D97706",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  megaBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  statBlock: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    marginHorizontal: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  skillChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  skillChip: {
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  skillChipText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "600",
  },
  bodyText: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 13,
    fontStyle: "italic",
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
    marginBottom: 10,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonSecondaryText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
  },
  backButtonFull: {
    marginTop: 8,
    backgroundColor: "#1F2937",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  backButtonText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
  },
});
