import { Text, View } from "react-native";
import { InfoRow, StatCard } from "./SettingsFields";
import { settingsStyles as styles } from "../../app/settings.styles";
import { useTranslation } from "../../lib/i18n-context";
import {
  formatDateFr,
  isAdmin,
  type UserProfile,
} from "../../lib/profile";

export function StatsSection({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation();
  return (
    <View style={styles.section} testID="profile-stats">
      <Text style={styles.sectionTitle}>{t("settings.stats.title")}</Text>
      <View style={styles.statsGrid}>
        <StatCard
          label={t("settings.stats.elo")}
          value={String(profile.eloRating)}
        />
        <StatCard
          label={t("settings.stats.teams")}
          value={String(profile.counts.teams)}
        />
        <StatCard
          label={t("settings.stats.matchesPlayed")}
          value={String(profile.counts.matches)}
        />
        <StatCard
          label={t("settings.stats.matchesCreated")}
          value={String(profile.counts.createdMatches)}
        />
      </View>
    </View>
  );
}

export function AccountInfoSection({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("settings.account.title")}</Text>
      <InfoRow
        label={t("settings.account.registeredAt")}
        value={formatDateFr(profile.createdAt)}
      />
      <InfoRow
        label={t("settings.account.lastUpdate")}
        value={formatDateFr(profile.updatedAt)}
      />
      {profile.firstName && (
        <InfoRow
          label={t("settings.account.firstName")}
          value={profile.firstName}
        />
      )}
      {profile.lastName && (
        <InfoRow
          label={t("settings.account.lastName")}
          value={profile.lastName}
        />
      )}
      {profile.dateOfBirth && (
        <InfoRow
          label={t("settings.account.dateOfBirth")}
          value={formatDateFr(profile.dateOfBirth)}
        />
      )}
      {isAdmin(profile) && (
        <InfoRow
          label={t("settings.account.role")}
          value={t("settings.account.adminRole")}
        />
      )}
    </View>
  );
}
