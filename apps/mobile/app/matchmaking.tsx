import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { apiGet, apiPost, apiDelete, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useTranslation } from "../lib/i18n-context";
import {
  canStartSearch,
  formatElapsed,
  formatTVShort,
  formatTVRange,
  reduceQueueTransition,
  type JoinQueueResponse,
  type QueueStatusResponse,
  type TeamOption,
} from "../lib/matchmaking";
import { matchmakingStyles as styles } from "./matchmaking.styles";

const POLL_INTERVAL_MS = 3000;

export default function MatchmakingScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useTranslation();

  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [queueStatus, setQueueStatus] = useState<QueueStatusResponse>({
    inQueue: false,
  });
  const [searching, setSearching] = useState(false);
  const [searchElapsed, setSearchElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingSearch, setStartingSearch] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const navigatedRef = useRef(false);

  const handleAuthError = useCallback(
    async (err: unknown): Promise<boolean> => {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await logout();
        router.replace("/login");
        return true;
      }
      return false;
    },
    [logout, router],
  );

  const goToMatch = useCallback(
    (matchId: string) => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      router.replace(`/play/${matchId}`);
    },
    [router],
  );

  const loadTeams = useCallback(async () => {
    try {
      const data = await apiGet("/team/mine");
      const list: TeamOption[] = (data.teams ?? []).map(
        (t: { id: string; name: string; roster: string; currentValue?: number }) => ({
          id: t.id,
          name: t.name,
          roster: t.roster,
          currentValue: t.currentValue ?? 0,
        }),
      );
      setTeams(list);
    } catch (err: unknown) {
      if (await handleAuthError(err)) return;
      setError(
        err instanceof Error ? err.message : t("matchmaking.errors.loadTeams"),
      );
    }
  }, [handleAuthError, t]);

  const loadQueueStatus = useCallback(async () => {
    try {
      const data: QueueStatusResponse = await apiGet("/matchmaking/status");
      setQueueStatus(data);
      const transition = reduceQueueTransition(data);
      if (transition.kind === "matched") {
        setSearching(false);
        goToMatch(transition.matchId);
        return;
      }
      if (transition.kind === "searching") {
        setSearching(true);
        if (transition.teamId) {
          setSelectedTeamId(transition.teamId);
        }
      } else {
        setSearching(false);
      }
    } catch (err: unknown) {
      if (await handleAuthError(err)) return;
      // Ignore transient errors, keep previous state
    }
  }, [handleAuthError, goToMatch]);

  useEffect(() => {
    Promise.all([loadTeams(), loadQueueStatus()]).finally(() =>
      setLoading(false),
    );
  }, [loadTeams, loadQueueStatus]);

  // Poll queue status while searching (fallback for no WS)
  useEffect(() => {
    if (!searching) return;
    const interval = setInterval(() => {
      loadQueueStatus();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [searching, loadQueueStatus]);

  // Elapsed timer
  useEffect(() => {
    if (!searching) {
      setSearchElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setSearchElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [searching]);

  async function handleStartSearch() {
    setError(null);
    const validation = canStartSearch(selectedTeamId);
    if (validation.valid === false) {
      setError(t("matchmaking.errors.selectTeam"));
      return;
    }
    setStartingSearch(true);
    try {
      const result: JoinQueueResponse = await apiPost("/matchmaking/join", {
        teamId: selectedTeamId,
      });
      if (result.matched === true) {
        goToMatch(result.matchId);
        return;
      }
      setSearching(true);
      setQueueStatus({
        inQueue: true,
        status: "searching",
        teamId: selectedTeamId,
        teamValue: result.teamValue,
      });
    } catch (err: unknown) {
      if (await handleAuthError(err)) return;
      setError(
        err instanceof Error ? err.message : t("matchmaking.errors.joinQueue"),
      );
    } finally {
      setStartingSearch(false);
    }
  }

  async function handleCancelSearch() {
    setError(null);
    setCancelling(true);
    try {
      await apiDelete("/matchmaking/leave");
      setSearching(false);
      setQueueStatus({ inQueue: false });
    } catch (err: unknown) {
      if (await handleAuthError(err)) return;
      setError(
        err instanceof Error
          ? err.message
          : t("matchmaking.errors.cancelSearch"),
      );
    } finally {
      setCancelling(false);
    }
  }

  const selectedTeamValue = queueStatus.teamValue
    ?? teams.find((t) => t.id === selectedTeamId)?.currentValue;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t("matchmaking.title")}</Text>
        <Text style={styles.subtitle}>{t("matchmaking.subtitle")}</Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      )}

      {!loading && searching && (
        <View style={styles.searchBox} testID="matchmaking-searching">
          <View style={styles.searchRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.searchingTitle}>
              {t("matchmaking.searching.title")}
            </Text>
            <Text style={styles.elapsed}>{formatElapsed(searchElapsed)}</Text>
          </View>
          {selectedTeamValue !== undefined && (
            <Text style={styles.rangeText}>
              {t("matchmaking.searching.teamValueRange", {
                value: formatTVShort(selectedTeamValue),
                range: formatTVRange(selectedTeamValue),
              })}
            </Text>
          )}
          <Pressable
            testID="matchmaking-cancel"
            style={[styles.cancelButton, cancelling && styles.buttonDisabled]}
            onPress={handleCancelSearch}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#DC2626" size="small" />
            ) : (
              <Text style={styles.cancelText}>
                {t("matchmaking.searching.cancel")}
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {!loading && !searching && teams.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>{t("matchmaking.empty.title")}</Text>
          <Text style={styles.emptyText}>
            {t("matchmaking.empty.description")}
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push("/teams/new")}
          >
            <Text style={styles.primaryButtonText}>
              {t("matchmaking.empty.createTeam")}
            </Text>
          </Pressable>
        </View>
      )}

      {!loading && !searching && teams.length > 0 && (
        <View style={styles.formBox}>
          <Text style={styles.label}>{t("matchmaking.form.label")}</Text>
          <View style={styles.teamList}>
            {teams.map((team) => {
              const selected = team.id === selectedTeamId;
              return (
                <Pressable
                  key={team.id}
                  testID={`matchmaking-team-${team.id}`}
                  onPress={() => setSelectedTeamId(team.id)}
                  style={[
                    styles.teamCard,
                    selected && styles.teamCardSelected,
                  ]}
                >
                  <View style={styles.teamCardHeader}>
                    <Text style={styles.teamName} numberOfLines={1}>
                      {team.name}
                    </Text>
                    <Text style={styles.teamValue}>
                      {formatTVShort(team.currentValue)}
                    </Text>
                  </View>
                  <Text style={styles.teamRoster}>{team.roster}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            testID="matchmaking-start"
            style={[
              styles.primaryButton,
              (!selectedTeamId || startingSearch) && styles.buttonDisabled,
            ]}
            onPress={handleStartSearch}
            disabled={!selectedTeamId || startingSearch}
          >
            {startingSearch ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {t("matchmaking.form.submit")}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
