import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { settingsStyles as styles } from "../../app/settings.styles";

interface DangerZoneProps {
  deleting: boolean;
  error: string | null;
  onPress: () => void;
}

export function DangerZone({ deleting, error, onPress }: DangerZoneProps) {
  return (
    <View style={styles.dangerSection} testID="danger-zone">
      <Text style={styles.dangerTitle}>Suppression du compte</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.dangerText}>
        La suppression desactive votre acces. Vos donnees de jeu peuvent etre
        conservees pour les statistiques, mais vous ne pourrez plus vous
        reconnecter.
      </Text>
      <Pressable
        onPress={onPress}
        disabled={deleting}
        style={[styles.dangerButton, deleting && styles.buttonDisabled]}
        testID="delete-account-button"
      >
        {deleting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.dangerButtonText}>Supprimer mon compte</Text>
        )}
      </Pressable>
    </View>
  );
}
