import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiGet, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import {
  canAffordAdvancement,
  computeInjurySummary,
  computePlayerStatus,
  formatAdvancementType,
  formatSpp,
  formatStatValue,
  getEffectiveStat,
  getNextAdvancementOptions,
  parsePlayerAdvancements,
  type StatKey,
  type TeamPlayerWithProgression,
} from "../../../lib/player-details";

const STATS: Array<{ key: StatKey; label: string }> = [
  { key: "ma", label: "MA" },
  { key: "st", label: "ST" },
  { key: "ag", label: "AG" },
  { key: "pa", label: "PA" },
  { key: "av", label: "AV" },
];

export default function PlayerDetailScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const params = useLocalSearchParams<{ teamId: string; playerId: string }>();
  const teamId = params.teamId;
  const playerId = params.playerId;

  const [player, setPlayer] = useState<TeamPlayerWithProgression | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayer = useCallback(async () => {
    if (!teamId || !playerId) return;
    try {
      const data = await apiGet(`/team/${teamId}`);
      const team = data?.team;
      if (!team) {
        setError("Equipe introuvable");
        return;
      }
      setTeamName(team.name ?? "");
      const match: TeamPlayerWithProgression | undefined = (
        team.players ?? []
      ).find((p: TeamPlayerWithProgression) => p.id === playerId);
      if (!match) {
        setError("Joueur introuvable");
        return;
      }
      setPlayer(match);
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
  }, [teamId, playerId, router, logout]);

  useEffect(() => {
    fetchPlayer().finally(() => setLoading(false));
  }, [fetchPlayer]);

  const advancements = useMemo(
    () => (player ? parsePlayerAdvancements(player.advancements) : []),
    [player],
  );

  const options = useMemo(
    () => getNextAdvancementOptions(advancements.length),
    [advancements.length],
  );

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
        <Text style={styles.errorText}>{error ?? "Joueur introuvable"}</Text>
        <Pressable
          onPress={() => (teamId ? router.replace(`/teams/${teamId}`) : router.back())}
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonText}>Retour a l&apos;equipe</Text>
        </Pressable>
      </View>
    );
  }

  const injuries = computeInjurySummary(player);
  const status = computePlayerStatus(player);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <Text style={styles.playerName}>
          #{player.number} {player.name}
        </Text>
        <Text style={styles.subtitle}>
          {player.position} — {teamName}
        </Text>
        <View style={[styles.badge, statusStyle(status)]}>
          <Text style={styles.badgeText}>{status}</Text>
        </View>
      </View>

      <Section title="Caracteristiques">
        <View style={styles.statRow}>
          {STATS.map((s) => {
            const effective = getEffectiveStat(player, s.key);
            const base = player[s.key] ?? 0;
            const reduced = effective !== base;
            return (
              <View key={s.key} style={styles.statCell}>
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text
                  style={[styles.statValue, reduced && styles.statReduced]}
                >
                  {formatStatValue(s.key, effective)}
                </Text>
                {reduced && (
                  <Text style={styles.statBase}>
                    base {formatStatValue(s.key, base)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </Section>

      <Section title="Progression">
        <InfoRow label="SPP disponibles" value={formatSpp(player.spp)} />
        <InfoRow
          label="Matchs joues"
          value={String(player.matchesPlayed ?? 0)}
        />
        <InfoRow
          label="Touchdowns"
          value={String(player.totalTouchdowns ?? 0)}
        />
        <InfoRow
          label="Sorties infligees"
          value={String(player.totalCasualties ?? 0)}
        />
        <InfoRow
          label="Passes reussies"
          value={String(player.totalCompletions ?? 0)}
        />
        <InfoRow
          label="Interceptions"
          value={String(player.totalInterceptions ?? 0)}
        />
        <InfoRow
          label="MVP"
          value={String(player.totalMvpAwards ?? 0)}
        />
        <InfoRow
          label="Avancements pris"
          value={String(advancements.length)}
        />
      </Section>

      <Section title="Competences">
        {player.skills ? (
          <Text style={styles.skillsText}>{player.skills}</Text>
        ) : (
          <Text style={styles.empty}>Aucune competence acquise</Text>
        )}
      </Section>

      <Section title="Avancements acquis">
        {advancements.length === 0 ? (
          <Text style={styles.empty}>Aucun avancement pour l&apos;instant</Text>
        ) : (
          advancements.map((adv, idx) => (
            <InfoRow
              key={`${adv.skillSlug}-${idx}`}
              label={`${idx + 1}. ${adv.skillSlug}`}
              value={formatAdvancementType(adv.type)}
            />
          ))
        )}
      </Section>

      <Section title="Prochain avancement">
        {player.dead ? (
          <Text style={styles.empty}>Joueur decede — aucune progression</Text>
        ) : (
          options.map((opt) => {
            const affordable = canAffordAdvancement(player.spp, opt.sppCost);
            return (
              <View key={opt.type} style={styles.row}>
                <Text style={styles.rowLabel}>{opt.label}</Text>
                <Text
                  style={[
                    styles.rowValue,
                    affordable ? styles.rowAffordable : styles.rowLocked,
                  ]}
                >
                  {opt.sppCost} SPP {affordable ? "✓" : "✗"}
                </Text>
              </View>
            );
          })
        )}
      </Section>

      <Section title="Blessures & statut">
        {injuries.length === 0 ? (
          <Text style={styles.empty}>Aucune blessure persistante</Text>
        ) : (
          injuries.map((entry, idx) => (
            <Text key={idx} style={styles.injuryItem}>
              • {entry}
            </Text>
          ))
        )}
      </Section>

      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Retour</Text>
      </Pressable>
    </ScrollView>
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

function statusStyle(status: string) {
  if (status === "Decede") return styles.badgeDead;
  if (status === "Absent prochain match") return styles.badgeWarn;
  if (status === "Blesse") return styles.badgeInjured;
  return styles.badgeOk;
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
  playerName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginTop: 8,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  badgeOk: { backgroundColor: "#22C55E" },
  badgeWarn: { backgroundColor: "#F59E0B" },
  badgeInjured: { backgroundColor: "#EA580C" },
  badgeDead: { backgroundColor: "#991B1B" },
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
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statCell: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  statReduced: {
    color: "#B91C1C",
  },
  statBase: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 1,
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
  rowAffordable: {
    color: "#047857",
  },
  rowLocked: {
    color: "#9CA3AF",
  },
  skillsText: {
    fontSize: 13,
    color: "#111827",
    lineHeight: 18,
  },
  empty: {
    fontSize: 13,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  injuryItem: {
    fontSize: 13,
    color: "#B91C1C",
    paddingVertical: 2,
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
