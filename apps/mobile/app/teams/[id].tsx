import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiGet, apiPut, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useTranslation } from "../../lib/i18n-context";
import {
  type TeamDetail,
  countPlayersByPosition,
  formatTeamValue,
  formatGoldShort,
} from "../../lib/teams";

interface EditableInfo {
  rerolls: number;
  cheerleaders: number;
  assistants: number;
  apothecary: boolean;
  dedicatedFans: number;
}

export default function TeamDetailScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const teamId = params.id;
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<EditableInfo | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTeam = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await apiGet(`/team/${teamId}`);
      setTeam(data.team);
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
        err instanceof Error ? err.message : t("teams.detail.errors.loadError"),
      );
    }
  }, [teamId, router, logout, t]);

  useEffect(() => {
    fetchTeam().finally(() => setLoading(false));
  }, [fetchTeam]);

  function startEdit() {
    if (!team) return;
    setDraft({
      rerolls: team.rerolls ?? 0,
      cheerleaders: team.cheerleaders ?? 0,
      assistants: team.assistants ?? 0,
      apothecary: team.apothecary ?? false,
      dedicatedFans: team.dedicatedFans ?? 1,
    });
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setDraft(null);
  }

  async function saveEdit() {
    if (!draft || !teamId) return;
    setSaving(true);
    try {
      await apiPut(`/team/${teamId}/info`, draft);
      await fetchTeam();
      setEditMode(false);
      setDraft(null);
    } catch (err: unknown) {
      Alert.alert(
        t("common.error"),
        err instanceof Error
          ? err.message
          : t("teams.detail.errors.saveErrorMessage"),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (error || !team) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {error || t("teams.detail.notFound")}
        </Text>
        <Pressable onPress={() => router.replace("/teams")} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>
            {t("teams.detail.backToList")}
          </Text>
        </Pressable>
      </View>
    );
  }

  const positions = countPlayersByPosition(team.players ?? []);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.teamName}>{team.name}</Text>
          <Text style={styles.teamRoster}>
            {team.roster} • {team.ruleset}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <Stat
            label={t("teams.detail.stats.value")}
            value={formatTeamValue(team.currentValue)}
          />
          <Stat
            label={t("teams.detail.stats.treasury")}
            value={formatGoldShort(team.treasury ?? 0)}
          />
          <Stat
            label={t("teams.detail.stats.players")}
            value={String(team.players?.length ?? 0)}
          />
        </View>

        <Section title={t("teams.detail.configuration.title")}>
          {editMode && draft ? (
            <View>
              <Counter
                label={t("teams.detail.configuration.rerolls")}
                value={draft.rerolls}
                min={0}
                max={8}
                onChange={(v) => setDraft({ ...draft, rerolls: v })}
              />
              <Counter
                label={t("teams.detail.configuration.cheerleaders")}
                value={draft.cheerleaders}
                min={0}
                max={12}
                onChange={(v) => setDraft({ ...draft, cheerleaders: v })}
              />
              <Counter
                label={t("teams.detail.configuration.assistants")}
                value={draft.assistants}
                min={0}
                max={6}
                onChange={(v) => setDraft({ ...draft, assistants: v })}
              />
              <Counter
                label={t("teams.detail.configuration.dedicatedFans")}
                value={draft.dedicatedFans}
                min={1}
                max={6}
                onChange={(v) => setDraft({ ...draft, dedicatedFans: v })}
              />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>
                  {t("teams.detail.configuration.apothecary")}
                </Text>
                <Pressable
                  onPress={() =>
                    setDraft({ ...draft, apothecary: !draft.apothecary })
                  }
                  style={[
                    styles.toggle,
                    draft.apothecary && styles.toggleOn,
                  ]}
                >
                  <Text style={styles.toggleText}>
                    {draft.apothecary
                      ? t("teams.detail.configuration.onLabel")
                      : t("teams.detail.configuration.offLabel")}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.editActions}>
                <Pressable
                  onPress={cancelEdit}
                  style={[styles.actionButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelText}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable
                  onPress={saveEdit}
                  style={[styles.actionButton, styles.saveButton]}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveText}>
                      {t("teams.detail.configuration.saveButton")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              <InfoRow
                label={t("teams.detail.configuration.rerolls")}
                value={String(team.rerolls ?? 0)}
              />
              <InfoRow
                label={t("teams.detail.configuration.cheerleaders")}
                value={String(team.cheerleaders ?? 0)}
              />
              <InfoRow
                label={t("teams.detail.configuration.assistants")}
                value={String(team.assistants ?? 0)}
              />
              <InfoRow
                label={t("teams.detail.configuration.dedicatedFans")}
                value={String(team.dedicatedFans ?? 1)}
              />
              <InfoRow
                label={t("teams.detail.configuration.apothecary")}
                value={
                  team.apothecary
                    ? t("teams.detail.configuration.yes")
                    : t("teams.detail.configuration.no")
                }
              />
              <Pressable onPress={startEdit} style={styles.editButton}>
                <Text style={styles.editButtonText}>
                  {t("teams.detail.configuration.editButton")}
                </Text>
              </Pressable>
            </View>
          )}
        </Section>

        <Section
          title={t("teams.detail.players.title", {
            count: team.players?.length ?? 0,
          })}
        >
          {positions.length === 0 ? (
            <Text style={styles.empty}>{t("teams.detail.players.empty")}</Text>
          ) : (
            <>
              {positions.map((p) => (
                <InfoRow
                  key={p.position}
                  label={p.position}
                  value={`x${p.count}`}
                />
              ))}
              {(team.players ?? []).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/player/${team.id}/${p.id}`)}
                  style={styles.row}
                >
                  <Text style={styles.rowLabel}>
                    #{p.number} {p.name}
                  </Text>
                  <Text style={styles.rowValue}>{p.position} ›</Text>
                </Pressable>
              ))}
            </>
          )}
        </Section>

        {team.starPlayers && team.starPlayers.length > 0 && (
          <Section
            title={t("teams.detail.starPlayers.title", {
              count: team.starPlayers.length,
            })}
          >
            {team.starPlayers.map((sp) => (
              <InfoRow
                key={sp.id}
                label={sp.name || sp.slug}
                value={formatGoldShort(sp.cost)}
              />
            ))}
          </Section>
        )}

        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{t("teams.detail.backButton")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Counter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.counter}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          style={[styles.counterButton, value <= min && styles.counterDisabled]}
          disabled={value <= min}
        >
          <Text style={styles.counterButtonText}>-</Text>
        </Pressable>
        <TextInput
          style={styles.counterValue}
          value={String(value)}
          onChangeText={(text) => {
            const n = Number.parseInt(text, 10);
            if (!Number.isNaN(n)) {
              onChange(Math.max(min, Math.min(max, n)));
            } else if (text === "") {
              onChange(min);
            }
          }}
          keyboardType="numeric"
        />
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          style={[styles.counterButton, value >= max && styles.counterDisabled]}
          disabled={value >= max}
        >
          <Text style={styles.counterButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F9FAFB",
  },
  header: { marginBottom: 16 },
  teamName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  teamRoster: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  stat: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  section: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rowLabel: {
    fontSize: 13,
    color: "#374151",
  },
  rowValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  toggle: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
  },
  toggleOn: {
    backgroundColor: "#22C55E",
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  counter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  counterDisabled: {
    backgroundColor: "#9CA3AF",
  },
  counterButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  counterValue: {
    minWidth: 40,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 6,
    backgroundColor: "#fff",
  },
  editButton: {
    marginTop: 12,
    backgroundColor: "#EFF6FF",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  editButtonText: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "600",
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#E5E7EB",
  },
  saveButton: {
    backgroundColor: "#2563EB",
  },
  cancelText: {
    color: "#374151",
    fontWeight: "600",
  },
  saveText: {
    color: "#fff",
    fontWeight: "600",
  },
  empty: {
    fontSize: 13,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  backButton: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  backText: {
    color: "#6B7280",
    fontSize: 14,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  linkButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  linkButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
