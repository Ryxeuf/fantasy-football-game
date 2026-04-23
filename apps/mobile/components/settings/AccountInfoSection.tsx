import { Text, View } from "react-native";
import { InfoRow, StatCard } from "./SettingsFields";
import { settingsStyles as styles } from "../../app/settings.styles";
import {
  formatDateFr,
  isAdmin,
  type UserProfile,
} from "../../lib/profile";

export function StatsSection({ profile }: { profile: UserProfile }) {
  return (
    <View style={styles.section} testID="profile-stats">
      <Text style={styles.sectionTitle}>Statistiques</Text>
      <View style={styles.statsGrid}>
        <StatCard label="ELO" value={String(profile.eloRating)} />
        <StatCard label="Equipes" value={String(profile.counts.teams)} />
        <StatCard
          label="Matchs joues"
          value={String(profile.counts.matches)}
        />
        <StatCard
          label="Matchs crees"
          value={String(profile.counts.createdMatches)}
        />
      </View>
    </View>
  );
}

export function AccountInfoSection({ profile }: { profile: UserProfile }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Informations du compte</Text>
      <InfoRow label="Inscrit le" value={formatDateFr(profile.createdAt)} />
      <InfoRow
        label="Derniere mise a jour"
        value={formatDateFr(profile.updatedAt)}
      />
      {profile.firstName && (
        <InfoRow label="Prenom" value={profile.firstName} />
      )}
      {profile.lastName && <InfoRow label="Nom" value={profile.lastName} />}
      {profile.dateOfBirth && (
        <InfoRow
          label="Date de naissance"
          value={formatDateFr(profile.dateOfBirth)}
        />
      )}
      {isAdmin(profile) && <InfoRow label="Role" value="Administrateur" />}
    </View>
  );
}
