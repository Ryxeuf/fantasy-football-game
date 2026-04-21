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
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    }
  }, [teamId, router, logout]);

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
        "Erreur",
        err instanceof Error ? err.message : "Impossible de sauvegarder",
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
          {error || "Equipe introuvable"}
        </Text>
        <Pressable onPress={() => router.replace("/teams")} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>Retour aux equipes</Text>
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
          <Stat label="Valeur" value={formatTeamValue(team.currentValue)} />
          <Stat label="Tresor" value={formatGoldShort(team.treasury ?? 0)} />
          <Stat label="Joueurs" value={String(team.players?.length ?? 0)} />
        </View>

        <Section title="Configuration">
          {editMode && draft ? (
            <View>
              <Counter
                label="Relances"
                value={draft.rerolls}
                min={0}
                max={8}
                onChange={(v) => setDraft({ ...draft, rerolls: v })}
              />
              <Counter
                label="Pom-pom girls"
                value={draft.cheerleaders}
                min={0}
                max={12}
                onChange={(v) => setDraft({ ...draft, cheerleaders: v })}
              />
              <Counter
                label="Assistants coach"
                value={draft.assistants}
                min={0}
                max={6}
                onChange={(v) => setDraft({ ...draft, assistants: v })}
              />
              <Counter
                label="Fans devoues"
                value={draft.dedicatedFans}
                min={1}
                max={6}
                onChange={(v) => setDraft({ ...draft, dedicatedFans: v })}
              />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Apothicaire</Text>
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
                    {draft.apothecary ? "OUI" : "NON"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.editActions}>
                <Pressable
                  onPress={cancelEdit}
                  style={[styles.actionButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelText}>Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={saveEdit}
                  style={[styles.actionButton, styles.saveButton]}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveText}>Sauvegarder</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              <InfoRow label="Relances" value={String(team.rerolls ?? 0)} />
              <InfoRow
                label="Pom-pom girls"
                value={String(team.cheerleaders ?? 0)}
              />
              <InfoRow
                label="Assistants coach"
                value={String(team.assistants ?? 0)}
              />
              <InfoRow
                label="Fans devoues"
                value={String(team.dedicatedFans ?? 1)}
              />
              <InfoRow
                label="Apothicaire"
                value={team.apothecary ? "Oui" : "Non"}
              />
              <Pressable onPress={startEdit} style={styles.editButton}>
                <Text style={styles.editButtonText}>Editer la configuration</Text>
              </Pressable>
            </View>
          )}
        </Section>

        <Section title={`Joueurs (${team.players?.length ?? 0})`}>
          {positions.length === 0 ? (
            <Text style={styles.empty}>Aucun joueur recrute</Text>
          ) : (
            positions.map((p) => (
              <InfoRow key={p.position} label={p.position} value={`x${p.count}`} />
            ))
          )}
        </Section>

        {team.starPlayers && team.starPlayers.length > 0 && (
          <Section title={`Star Players (${team.starPlayers.length})`}>
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
          <Text style={styles.backText}>Retour</Text>
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
