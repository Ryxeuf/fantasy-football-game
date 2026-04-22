import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { apiGet, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  DEFAULT_RULESET,
  filterStarPlayers,
  formatHirableBy,
  formatStarCost,
  formatStarStat,
  getStarSkillList,
  parseStarPlayersResponse,
  type StarPlayerSummary,
  type StarRuleset,
} from "../../lib/star-players";

const RULESET_OPTIONS: { key: StarRuleset; label: string }[] = [
  { key: "season_3", label: "Saison 3" },
  { key: "season_2", label: "Saison 2" },
];

export default function StarPlayersIndexScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [ruleset, setRuleset] = useState<StarRuleset>(DEFAULT_RULESET);
  const [players, setPlayers] = useState<StarPlayerSummary[]>([]);
  const [search, setSearch] = useState("");
  const [megaStarOnly, setMegaStarOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStars = useCallback(
    async (nextRuleset: StarRuleset) => {
      try {
        const response = await apiGet(
          `/star-players?ruleset=${nextRuleset}`,
        );
        setPlayers(parseStarPlayersResponse(response));
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
    fetchStars(ruleset).finally(() => setLoading(false));
  }, [fetchStars, ruleset]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStars(ruleset);
    setRefreshing(false);
  }, [fetchStars, ruleset]);

  const filtered = useMemo(
    () => filterStarPlayers(players, { search, megaStarOnly }),
    [players, search, megaStarOnly],
  );

  const megaCount = useMemo(
    () => players.filter((p) => p.isMegaStar).length,
    [players],
  );

  function navigateToDetail(player: StarPlayerSummary) {
    router.push(`/star-players/${player.slug}?ruleset=${ruleset}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Catalogue Star Players</Text>
        <Text style={styles.subtitle}>
          {filtered.length} joueur{filtered.length > 1 ? "s" : ""}
          {filtered.length !== players.length
            ? ` sur ${players.length}`
            : ""}
        </Text>
      </View>

      <View style={styles.filters}>
        <View style={styles.rulesetRow}>
          {RULESET_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => setRuleset(opt.key)}
              style={[
                styles.rulesetButton,
                ruleset === opt.key && styles.rulesetButtonActive,
              ]}
              testID={`ruleset-${opt.key}`}
            >
              <Text
                style={[
                  styles.rulesetText,
                  ruleset === opt.key && styles.rulesetTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par nom..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          testID="star-search-input"
        />

        <Pressable
          onPress={() => setMegaStarOnly((prev) => !prev)}
          style={[
            styles.megaToggle,
            megaStarOnly && styles.megaToggleActive,
          ]}
          testID="star-mega-toggle"
        >
          <Text
            style={[
              styles.megaToggleText,
              megaStarOnly && styles.megaToggleTextActive,
            ]}
          >
            {megaStarOnly ? "Mega stars uniquement" : `Mega stars (${megaCount})`}
          </Text>
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
          data={filtered}
          keyExtractor={(item) => item.slug}
          renderItem={({ item }) => (
            <StarRow
              player={item}
              onPress={() => navigateToDetail(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                Aucun star player ne correspond aux filtres.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function StarRow({
  player,
  onPress,
}: {
  player: StarPlayerSummary;
  onPress: () => void;
}) {
  const skills = getStarSkillList(player.skills);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, player.isMegaStar && styles.rowMegaStar]}
      testID={`star-row-${player.slug}`}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.displayName}
        </Text>
        <Text style={styles.playerCost}>{formatStarCost(player.cost)}</Text>
      </View>
      <View style={styles.statsRow}>
        <StatChip label="MA" value={formatStarStat("ma", player.ma)} />
        <StatChip label="ST" value={formatStarStat("st", player.st)} />
        <StatChip label="AG" value={formatStarStat("ag", player.ag)} />
        <StatChip label="PA" value={formatStarStat("pa", player.pa)} />
        <StatChip label="AV" value={formatStarStat("av", player.av)} />
      </View>
      {skills.length > 0 && (
        <Text style={styles.skillsText} numberOfLines={2}>
          {skills.join(" • ")}
        </Text>
      )}
      <Text style={styles.hirableText} numberOfLines={1}>
        Recrutable : {formatHirableBy(player.hirableBy)}
      </Text>
      {player.isMegaStar && (
        <View style={styles.megaBadge}>
          <Text style={styles.megaBadgeText}>Mega Star</Text>
        </View>
      )}
    </Pressable>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  filters: {
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  rulesetRow: {
    flexDirection: "row",
    gap: 8,
  },
  rulesetButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
  },
  rulesetButtonActive: {
    backgroundColor: "#2563EB",
  },
  rulesetText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
  },
  rulesetTextActive: {
    color: "#fff",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  megaToggle: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  megaToggleActive: {
    backgroundColor: "#D97706",
    borderColor: "#B45309",
  },
  megaToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
  },
  megaToggleTextActive: {
    color: "#fff",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rowMegaStar: {
    borderColor: "#D97706",
    backgroundColor: "#FFFBEB",
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  playerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  playerCost: {
    fontSize: 14,
    fontWeight: "600",
    color: "#D97706",
  },
  statsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  statChip: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
    minWidth: 44,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6B7280",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  skillsText: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 4,
  },
  hirableText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  megaBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#D97706",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  megaBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
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
});
