import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { apiGet, apiPost, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  type RosterSummary,
  validateTeamName,
  validateTeamValue,
  getTeamValueOptions,
} from "../../lib/teams";

export default function NewTeamScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [name, setName] = useState("");
  const [rosters, setRosters] = useState<RosterSummary[]>([]);
  const [selectedRoster, setSelectedRoster] = useState<string | null>(null);
  const [teamValue, setTeamValue] = useState<number>(1000);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRosters = useCallback(async () => {
    try {
      const data = await apiGet("/api/rosters");
      setRosters(data.rosters || []);
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
    fetchRosters().finally(() => setLoading(false));
  }, [fetchRosters]);

  async function handleSubmit() {
    const nameCheck = validateTeamName(name);
    if (nameCheck.valid === false) {
      Alert.alert("Nom invalide", nameCheck.error);
      return;
    }
    if (!selectedRoster) {
      Alert.alert("Roster requis", "Choisissez un roster pour votre equipe");
      return;
    }
    const valueCheck = validateTeamValue(teamValue);
    if (valueCheck.valid === false) {
      Alert.alert("Budget invalide", valueCheck.error);
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiPost("/team/create-from-roster", {
        name: name.trim(),
        roster: selectedRoster,
        teamValue,
      });
      const newId = data?.team?.id;
      if (newId) {
        router.replace(`/teams/${newId}`);
      } else {
        router.replace("/teams");
      }
    } catch (err: unknown) {
      Alert.alert(
        "Erreur",
        err instanceof Error ? err.message : "Impossible de creer l'equipe",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Erreur : {error}</Text>
        <Pressable
          onPress={() => {
            setLoading(true);
            fetchRosters().finally(() => setLoading(false));
          }}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Reessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>Nom de l'equipe</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex: Reikland Reavers"
          placeholderTextColor="#9CA3AF"
          maxLength={100}
        />

        <Text style={styles.label}>Roster</Text>
        <View style={styles.rosterGrid}>
          {rosters.map((roster) => {
            const selected = selectedRoster === roster.slug;
            return (
              <Pressable
                key={roster.slug}
                onPress={() => setSelectedRoster(roster.slug)}
                style={[
                  styles.rosterCard,
                  selected && styles.rosterCardSelected,
                ]}
              >
                <Text
                  style={[
                    styles.rosterName,
                    selected && styles.rosterNameSelected,
                  ]}
                  numberOfLines={2}
                >
                  {roster.name}
                </Text>
                {roster.tier !== null && roster.tier !== undefined && (
                  <Text style={styles.rosterMeta}>Tier {roster.tier}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Budget (K po)</Text>
        <View style={styles.budgetRow}>
          {getTeamValueOptions().map((value) => {
            const selected = teamValue === value;
            return (
              <Pressable
                key={value}
                onPress={() => setTeamValue(value)}
                style={[
                  styles.budgetOption,
                  selected && styles.budgetOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.budgetText,
                    selected && styles.budgetTextSelected,
                  ]}
                >
                  {value}K
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.submit, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Creer l'equipe</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.cancel}>
          <Text style={styles.cancelText}>Annuler</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  rosterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rosterCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
    width: "48%",
    minHeight: 60,
  },
  rosterCardSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  rosterName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  rosterNameSelected: {
    color: "#1D4ED8",
  },
  rosterMeta: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
  },
  budgetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  budgetOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
  },
  budgetOptionSelected: {
    backgroundColor: "#2563EB",
  },
  budgetText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  budgetTextSelected: {
    color: "#fff",
  },
  submit: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancel: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  cancelText: {
    color: "#6B7280",
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F9FAFB",
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
});
