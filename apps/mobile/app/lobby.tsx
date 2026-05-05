/**
 * S27.3.4 — Ecran lobby refactore en sous-composants + i18n complet.
 *
 * Avant : 816 lignes (state + UI + styles + helpers status/format).
 * Apres : orchestration uniquement. Logique UI repartie dans
 *  - components/lobby/MatchCard, MatchList, FilterBar
 *  - components/lobby/LobbyHeader, LobbyActions, MyTurnBanner
 *  - components/lobby/JoinMatchModal
 *  - components/lobby/lobby.styles (styles partages)
 *  - lib/lobby/match-filter (filterMatches, countMyTurn)
 *  - lib/lobby/match-display (status/color/date helpers)
 *
 * Aucun changement visuel ni fonctionnel. Toutes les strings passent
 * par i18n (`useTranslation()`).
 */

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ApiError, apiGet, apiPost } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useTranslation } from "../lib/i18n-context";
import {
  countMyTurn,
  filterMatches,
  type LobbyFilter,
  type MatchSummary,
} from "../lib/lobby/match-filter";
import { FilterBar } from "../components/lobby/FilterBar";
import { JoinMatchModal } from "../components/lobby/JoinMatchModal";
import { LobbyActions } from "../components/lobby/LobbyActions";
import { LobbyHeader } from "../components/lobby/LobbyHeader";
import { MatchList } from "../components/lobby/MatchList";
import { MyTurnBanner } from "../components/lobby/MyTurnBanner";
import { lobbyStyles as styles } from "../components/lobby/lobby.styles";

export default function LobbyScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<LobbyFilter>("all");
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
      setError(
        err instanceof Error ? err.message : t("lobby.alerts.loadError"),
      );
    }
  }, [router, logout, t]);

  useEffect(() => {
    fetchMatches().finally(() => setLoading(false));
  }, [fetchMatches]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  }, [fetchMatches]);

  const filtered = filterMatches(matches, filter);
  const myTurnCount = countMyTurn(matches);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  async function handleCreate() {
    setCreateLoading(true);
    try {
      const data = await apiPost("/match/create", {});
      await fetchMatches();
      Alert.alert(
        t("lobby.alerts.matchCreatedTitle"),
        t("lobby.alerts.matchCreatedBody", { id: data.match?.id || "OK" }),
      );
    } catch (err: unknown) {
      Alert.alert(
        t("common.error"),
        err instanceof Error ? err.message : t("lobby.alerts.createError"),
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
      Alert.alert(
        t("lobby.alerts.joinSuccessTitle"),
        t("lobby.alerts.joinSuccessBody"),
      );
    } catch (err: unknown) {
      Alert.alert(
        t("common.error"),
        err instanceof Error ? err.message : t("lobby.alerts.joinError"),
      );
    } finally {
      setJoinLoading(false);
    }
  }

  function navigateToMatch(match: MatchSummary) {
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
      <LobbyHeader
        coachName={user?.coachName ?? null}
        onTeams={() => router.push("/teams")}
        onLeaderboard={() => router.push("/leaderboard")}
        onSettings={() => router.push("/settings")}
        onLogout={handleLogout}
      />

      <MyTurnBanner count={myTurnCount} />

      <LobbyActions
        createLoading={createLoading}
        onMatchmaking={() => router.push("/matchmaking")}
        onCups={() => router.push("/cups")}
        onLeagues={() => router.push("/leagues")}
        onStars={() => router.push("/star-players")}
        onCreate={handleCreate}
        onJoin={() => setJoinModalVisible(true)}
      />

      <FilterBar
        active={filter}
        myTurnCount={myTurnCount}
        onChange={setFilter}
      />

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {t("lobby.errors.prefix", { message: error })}
          </Text>
          <Pressable onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && (
        <MatchList
          matches={filtered}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onMatchPress={navigateToMatch}
          onMatchReplay={navigateToReplay}
        />
      )}

      <JoinMatchModal
        visible={joinModalVisible}
        matchId={joinMatchId}
        loading={joinLoading}
        onChangeMatchId={setJoinMatchId}
        onClose={() => setJoinModalVisible(false)}
        onSubmit={handleJoin}
      />
    </View>
  );
}
