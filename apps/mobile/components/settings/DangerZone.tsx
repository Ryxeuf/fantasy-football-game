import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { settingsStyles as styles } from "../../app/settings.styles";
import { useTranslation } from "../../lib/i18n-context";

interface DangerZoneProps {
  deleting: boolean;
  error: string | null;
  onPress: () => void;
}

export function DangerZone({ deleting, error, onPress }: DangerZoneProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.dangerSection} testID="danger-zone">
      <Text style={styles.dangerTitle}>{t("settings.danger.title")}</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.dangerText}>{t("settings.danger.description")}</Text>
      <Pressable
        onPress={onPress}
        disabled={deleting}
        style={[styles.dangerButton, deleting && styles.buttonDisabled]}
        testID="delete-account-button"
      >
        {deleting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.dangerButtonText}>
            {t("settings.danger.button")}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
