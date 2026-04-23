import { Text, View } from "react-native";
import { settingsStyles as styles } from "../../app/settings.styles";
import { getInitials, type UserProfile } from "../../lib/profile";

export function ProfileHeader({ profile }: { profile: UserProfile }) {
  const initials = getInitials(
    profile.coachName,
    profile.coachName,
    profile.email,
  );
  return (
    <View style={styles.headerCard} testID="profile-header">
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <Text style={styles.coachName}>{profile.coachName}</Text>
      <Text style={styles.email}>{profile.email}</Text>
      {profile.patreon && (
        <View style={styles.patreonBadge}>
          <Text style={styles.patreonText}>Patreon</Text>
        </View>
      )}
    </View>
  );
}
