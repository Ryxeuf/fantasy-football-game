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
import { useTranslation } from "../../lib/i18n-context";
import type { TranslationFn } from "../../lib/i18n-context";
import {
  CUP_STATUSES,
  filterCupsByStatus,
  formatCupStatusLabel,
  parseCupListResponse,
  sortCupsByRecent,
  type Cup,
  type CupStatusFilter,
} from "../../lib/cups";

function buildFilterOptions(
  t: TranslationFn,
): ReadonlyArray<{ value: CupStatusFilter; label: string }> {
  return [
    { value: "all", label: t("cups.list.filters.all") },
    ...CUP_STATUSES.map((s) => ({
      value: s as CupStatusFilter,
      label: formatCupStatusLabel(s),
    })),
  ];
}

export default function CupsListScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useTranslation();
  const [cups, setCups] = useState<Cup[]>([]);
  const [filter, setFilter] = useState<CupStatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterOptions = useMemo(() => buildFilterOptions(t), [t]);

  const fetchCups = useCallback(async () => {
    try {
      setError(null);
      const response = await apiGet("/cup");
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
      setError(
        err instanceof Error ? err.message : t("cups.list.errors.loadError"),
      );
    }
  }, [logout, router, t]);

  useEffect(() => {
    setLoading(true);
    fetchCups().finally(() => setLoading(false));
  }, [fetchCups]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCups();
    setRefreshing(false);
  }, [fetchCups]);

  const visible = useMemo(() => filterCupsByStatus(cups, filter), [cups, filter]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("cups.list.title")}</Text>
        <Pressable
          onPress={() => router.push("/cups/archived")}
          style={styles.archivedLink}
          testID="cups-archived-link"
        >
          <Text style={styles.archivedLinkText}>
            {t("cups.list.archivedLink")}
          </Text>
        </Pressable>
      </View>

      <View style={styles.filters} testID="cups-filters">
        {filterOptions.map((opt) => {
          const active = opt.value === filter;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setFilter(opt.value)}
              style={[styles.filterChip, active && styles.filterChipActive]}
              testID={`cups-filter-${opt.value}`}
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
          <Text style={styles.errorText}>
            {t("cups.list.errors.prefix", { message: error })}
          </Text>
          <Pressable onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CupCard
              cup={item}
              t={t}
              onPress={() => router.push(`/cups/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText} testID="cups-empty">
                {t("cups.list.empty")}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function CupCard({
  cup,
  onPress,
  t,
}: {
  cup: Cup;
  onPress: () => void;
  t: TranslationFn;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      testID={`cup-card-${cup.id}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {cup.name}
        </Text>
        <Text style={styles.cardStatus}>
          {formatCupStatusLabel(cup.status)}
        </Text>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText}>
          {cup.participantCount > 1
            ? t("cups.list.card.participantPlural", {
                count: cup.participantCount,
              })
            : t("cups.list.card.participantSingular", {
                count: cup.participantCount,
              })}
        </Text>
        <Text style={styles.cardMetaText}>
          {cup.isPublic ? t("cups.public") : t("cups.private")}
        </Text>
        <Text style={styles.cardMetaText}>{cup.ruleset}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  archivedLink: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
  },
  archivedLinkText: { fontSize: 13, color: "#111827", fontWeight: "500" },
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
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cardMetaText: { fontSize: 12, color: "#6B7280" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
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
  retryText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  emptyText: { color: "#6B7280", fontSize: 15, textAlign: "center" },
});
