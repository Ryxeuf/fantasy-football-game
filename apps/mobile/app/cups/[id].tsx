import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiGet, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  formatCupStatusLabel,
  parseCupDetailResponse,
  type CupDetail,
} from "../../lib/cups";

export default function CupDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const cupId = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { logout } = useAuth();
  const [cup, setCup] = useState<CupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCup = useCallback(async () => {
    if (!cupId) return;
    try {
      setError(null);
      const response = await apiGet(`/cup/${cupId}`);
      const parsed = parseCupDetailResponse(response);
      if (!parsed) {
        throw new Error("Coupe introuvable");
      }
      setCup(parsed);
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
  }, [cupId, logout, router]);

  useEffect(() => {
    setLoading(true);
    fetchCup().finally(() => setLoading(false));
  }, [fetchCup]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCup();
    setRefreshing(false);
  }, [fetchCup]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (error || !cup) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Coupe introuvable"}</Text>
        <Pressable onPress={onRefresh} style={styles.retryButton}>
          <Text style={styles.retryText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.headerBlock}>
        <Text style={styles.title} testID="cup-title">
          {cup.name}
        </Text>
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>{formatCupStatusLabel(cup.status)}</Text>
          <Text style={styles.badgeSecondary}>
            {cup.isPublic ? "Publique" : "Privee"}
          </Text>
          <Text style={styles.badgeSecondary}>{cup.ruleset}</Text>
        </View>
        <Text style={styles.metaText}>
          Cree par {cup.creator.coachName || cup.creator.email || "—"}
        </Text>
      </View>

      <Section title="Participants" testID="cup-participants">
        {cup.participants.length === 0 ? (
          <Text style={styles.mutedText}>Aucun participant pour l'instant.</Text>
        ) : (
          cup.participants.map((p) => (
            <View key={p.id} style={styles.row} testID={`cup-participant-${p.id}`}>
              <Text style={styles.rowMain}>{p.name}</Text>
              <Text style={styles.rowSub}>
                {p.roster} — {p.owner.coachName || p.owner.email || "—"}
              </Text>
            </View>
          ))
        )}
      </Section>

      <Section title="Classement" testID="cup-standings">
        {cup.standings.length === 0 ? (
          <Text style={styles.mutedText}>Aucun match termine.</Text>
        ) : (
          <View>
            <View style={[styles.standingRow, styles.standingHeader]}>
              <Text style={styles.standingCellTeam}>Equipe</Text>
              <Text style={styles.standingCell}>V</Text>
              <Text style={styles.standingCell}>N</Text>
              <Text style={styles.standingCell}>D</Text>
              <Text style={styles.standingCellPts}>Pts</Text>
            </View>
            {cup.standings.map((row) => {
              const participant = cup.participants.find((p) => p.id === row.teamId);
              return (
                <View
                  key={row.teamId}
                  style={styles.standingRow}
                  testID={`cup-standing-${row.teamId}`}
                >
                  <Text style={styles.standingCellTeam} numberOfLines={1}>
                    {participant?.name ?? row.teamId}
                  </Text>
                  <Text style={styles.standingCell}>{row.wins}</Text>
                  <Text style={styles.standingCell}>{row.draws}</Text>
                  <Text style={styles.standingCell}>{row.losses}</Text>
                  <Text style={styles.standingCellPts}>{row.points}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Section>

      <Section title="Matchs" testID="cup-matches">
        {cup.matches.length === 0 ? (
          <Text style={styles.mutedText}>Aucun match joue.</Text>
        ) : (
          cup.matches.map((m) => (
            <View key={m.id} style={styles.row}>
              <Text style={styles.rowMain}>Match {m.id.slice(0, 8)}</Text>
              <Text style={styles.rowSub}>{m.status}</Text>
            </View>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  children,
  testID,
}: {
  title: string;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F9FAFB",
  },
  headerBlock: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 6 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  badge: {
    fontSize: 12,
    color: "#1F2937",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeSecondary: {
    fontSize: 12,
    color: "#374151",
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  metaText: { fontSize: 12, color: "#6B7280" },
  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  rowMain: { fontSize: 14, fontWeight: "500", color: "#111827" },
  rowSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  mutedText: { fontSize: 13, color: "#6B7280" },
  errorText: { color: "#DC2626", fontSize: 14, marginBottom: 12, textAlign: "center" },
  retryButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  standingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  standingHeader: { borderBottomColor: "#9CA3AF" },
  standingCellTeam: { flex: 1, fontSize: 13, color: "#111827" },
  standingCell: {
    width: 28,
    textAlign: "center",
    fontSize: 13,
    color: "#374151",
    fontVariant: ["tabular-nums"],
  },
  standingCellPts: {
    width: 40,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
});
