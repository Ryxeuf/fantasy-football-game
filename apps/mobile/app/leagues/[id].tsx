import { useCallback, useEffect, useMemo, useState } from "react";
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
  formatLeagueRulesetLabel,
  formatLeagueSeasonStatusLabel,
  formatLeagueStatusLabel,
  parseLeagueDetailResponse,
  parseSeasonDetailResponse,
  parseStandingsResponse,
  type LeagueDetail,
  type LeagueSeasonDetail,
  type StandingRow,
} from "../../lib/leagues";

export default function LeagueDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const leagueId = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { logout } = useAuth();
  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [season, setSeason] = useState<LeagueSeasonDetail | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  const handleAuthError = useCallback(
    async (err: unknown): Promise<boolean> => {
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.status === 403)
      ) {
        await logout();
        router.replace("/login");
        return true;
      }
      return false;
    },
    [logout, router],
  );

  const fetchLeague = useCallback(async () => {
    if (!leagueId) return;
    try {
      setError(null);
      const response = await apiGet(`/league/${leagueId}`);
      const parsed = parseLeagueDetailResponse(response);
      if (!parsed) throw new Error("Ligue introuvable");
      setLeague(parsed);
      setSelectedSeasonId((prev) => {
        if (prev) return prev;
        if (parsed.seasons.length === 0) return null;
        return parsed.seasons[parsed.seasons.length - 1].id;
      });
    } catch (err: unknown) {
      if (await handleAuthError(err)) return;
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    }
  }, [leagueId, handleAuthError]);

  const fetchSeason = useCallback(
    async (seasonId: string) => {
      try {
        setSeasonLoading(true);
        setSeasonError(null);
        const [seasonRes, standingsRes] = await Promise.all([
          apiGet(`/league/seasons/${seasonId}`),
          apiGet(`/league/seasons/${seasonId}/standings`),
        ]);
        setSeason(parseSeasonDetailResponse(seasonRes));
        setStandings(parseStandingsResponse(standingsRes));
      } catch (err: unknown) {
        if (await handleAuthError(err)) return;
        setSeason(null);
        setStandings([]);
        setSeasonError(
          err instanceof Error ? err.message : "Erreur de chargement",
        );
      } finally {
        setSeasonLoading(false);
      }
    },
    [handleAuthError],
  );

  useEffect(() => {
    setLoading(true);
    fetchLeague().finally(() => setLoading(false));
  }, [fetchLeague]);

  useEffect(() => {
    if (!selectedSeasonId) {
      setSeason(null);
      setStandings([]);
      return;
    }
    fetchSeason(selectedSeasonId);
  }, [selectedSeasonId, fetchSeason]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeague();
    if (selectedSeasonId) {
      await fetchSeason(selectedSeasonId);
    }
    setRefreshing(false);
  }, [fetchLeague, fetchSeason, selectedSeasonId]);

  const participantsById = useMemo(() => {
    const map = new Map<string, string>();
    if (season) {
      for (const p of season.participants) {
        map.set(p.team.id, p.team.name);
      }
    }
    return map;
  }, [season]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (error || !league) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Ligue introuvable"}</Text>
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
        <Text style={styles.title} testID="league-title">
          {league.name}
        </Text>
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>
            {formatLeagueStatusLabel(league.status)}
          </Text>
          <Text style={styles.badgeSecondary}>
            {formatLeagueRulesetLabel(league.ruleset)}
          </Text>
          <Text style={styles.badgeSecondary}>
            {league.isPublic ? "Publique" : "Privee"}
          </Text>
        </View>
        {league.description ? (
          <Text style={styles.description}>{league.description}</Text>
        ) : null}
        <Text style={styles.metaText}>
          {`Createur: ${league.creator.coachName || league.creator.email || "—"} • Max ${league.maxParticipants} equipes`}
        </Text>
      </View>

      <View style={styles.scoringCard}>
        <Text style={styles.sectionTitle}>Bareme</Text>
        <View style={styles.scoringRow}>
          <ScoreCell label="Victoire" value={league.winPoints} />
          <ScoreCell label="Nul" value={league.drawPoints} />
          <ScoreCell label="Defaite" value={league.lossPoints} />
          <ScoreCell label="Forfait" value={league.forfeitPoints} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saisons</Text>
        {league.seasons.length === 0 ? (
          <Text style={styles.mutedText} testID="league-no-seasons">
            Aucune saison pour l'instant.
          </Text>
        ) : (
          <View style={styles.seasonTabs} testID="league-seasons-tabs">
            {league.seasons.map((s) => {
              const active = s.id === selectedSeasonId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedSeasonId(s.id)}
                  style={[styles.seasonTab, active && styles.seasonTabActive]}
                  testID={`season-tab-${s.id}`}
                >
                  <Text
                    style={[
                      styles.seasonTabText,
                      active && styles.seasonTabTextActive,
                    ]}
                  >
                    S{s.seasonNumber} — {s.name}
                  </Text>
                  <Text
                    style={[
                      styles.seasonTabSubtext,
                      active && styles.seasonTabTextActive,
                    ]}
                  >
                    {formatLeagueSeasonStatusLabel(s.status)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {selectedSeasonId ? (
        <>
          {seasonLoading ? (
            <View style={styles.seasonLoading}>
              <ActivityIndicator size="small" color="#2563EB" />
            </View>
          ) : null}
          {seasonError ? (
            <Text style={styles.errorText}>Erreur : {seasonError}</Text>
          ) : null}

          {season ? (
            <>
              <View style={styles.section} testID="season-rounds">
                <Text style={styles.sectionTitle}>Journees</Text>
                {season.rounds.length === 0 ? (
                  <Text style={styles.mutedText}>
                    Aucune journee planifiee.
                  </Text>
                ) : (
                  season.rounds.map((r) => (
                    <View
                      key={r.id}
                      style={styles.row}
                      testID={`season-round-${r.id}`}
                    >
                      <Text style={styles.rowMain}>
                        Journee {r.roundNumber}
                        {r.name ? ` — ${r.name}` : ""}
                      </Text>
                      <Text style={styles.rowSub}>{r.status}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.section} testID="season-standings">
                <Text style={styles.sectionTitle}>Classement</Text>
                {standings.length === 0 ? (
                  <Text style={styles.mutedText}>
                    Aucun match comptabilise.
                  </Text>
                ) : (
                  <View>
                    <View style={[styles.standingRow, styles.standingHeader]}>
                      <Text style={styles.standingCellTeam}>Equipe</Text>
                      <Text style={styles.standingCell}>V</Text>
                      <Text style={styles.standingCell}>N</Text>
                      <Text style={styles.standingCell}>D</Text>
                      <Text style={styles.standingCellPts}>Pts</Text>
                    </View>
                    {standings.map((row) => (
                      <View
                        key={row.teamId}
                        style={styles.standingRow}
                        testID={`season-standing-${row.teamId}`}
                      >
                        <Text style={styles.standingCellTeam} numberOfLines={1}>
                          {row.teamName ??
                            participantsById.get(row.teamId) ??
                            row.teamId}
                        </Text>
                        <Text style={styles.standingCell}>{row.wins}</Text>
                        <Text style={styles.standingCell}>{row.draws}</Text>
                        <Text style={styles.standingCell}>{row.losses}</Text>
                        <Text style={styles.standingCellPts}>{row.points}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.section} testID="season-participants">
                <Text style={styles.sectionTitle}>Participants</Text>
                {season.participants.length === 0 ? (
                  <Text style={styles.mutedText}>
                    Aucun participant pour cette saison.
                  </Text>
                ) : (
                  season.participants.map((p) => (
                    <View
                      key={p.id}
                      style={styles.row}
                      testID={`season-participant-${p.id}`}
                    >
                      <Text style={styles.rowMain}>{p.team.name}</Text>
                      <Text style={styles.rowSub}>
                        {p.team.roster} •{" "}
                        {p.team.owner.coachName ?? "—"} • ELO {p.seasonElo}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function ScoreCell({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.scoreCell}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>{value}</Text>
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
  description: { fontSize: 13, color: "#374151", marginVertical: 4 },
  metaText: { fontSize: 12, color: "#6B7280" },
  scoringCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 12,
  },
  scoringRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  scoreCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
  },
  scoreLabel: { fontSize: 11, color: "#6B7280", marginBottom: 2 },
  scoreValue: { fontSize: 15, fontWeight: "700", color: "#111827" },
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
  seasonTabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  seasonTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  seasonTabActive: { backgroundColor: "#111827", borderColor: "#111827" },
  seasonTabText: { fontSize: 13, fontWeight: "500", color: "#111827" },
  seasonTabSubtext: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  seasonTabTextActive: { color: "#fff" },
  seasonLoading: { padding: 12, alignItems: "center" },
  row: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  rowMain: { fontSize: 14, fontWeight: "500", color: "#111827" },
  rowSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  mutedText: { fontSize: 13, color: "#6B7280" },
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
