import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Field } from "./SettingsFields";
import { settingsStyles as styles } from "../../app/settings.styles";
import { useTranslation } from "../../lib/i18n-context";
import type { PasswordChange } from "../../lib/profile";

interface PasswordChangeSectionProps {
  password: PasswordChange;
  onChange: (password: PasswordChange) => void;
  changing: boolean;
  saving: boolean;
  error: string | null;
  success: string | null;
  onStart: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function PasswordChangeSection({
  password,
  onChange,
  changing,
  saving,
  error,
  success,
  onStart,
  onSave,
  onCancel,
}: PasswordChangeSectionProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.section} testID="security-section">
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t("settings.security.title")}</Text>
        {!changing && (
          <Pressable
            onPress={onStart}
            style={styles.secondaryButton}
            testID="change-password-button"
          >
            <Text style={styles.secondaryButtonText}>
              {t("settings.security.changeButton")}
            </Text>
          </Pressable>
        )}
      </View>

      {success && !changing && <Text style={styles.success}>{success}</Text>}

      {changing && (
        <View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Field
            label={t("settings.security.fields.currentPassword")}
            required
            value={password.currentPassword}
            onChangeText={(v) =>
              onChange({ ...password, currentPassword: v })
            }
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
          />
          <Field
            label={t("settings.security.fields.newPassword")}
            required
            value={password.newPassword}
            onChangeText={(v) => onChange({ ...password, newPassword: v })}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <Field
            label={t("settings.security.fields.confirmPassword")}
            required
            value={password.confirmPassword}
            onChangeText={(v) =>
              onChange({ ...password, confirmPassword: v })
            }
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <View style={styles.buttonRow}>
            <Pressable
              onPress={onSave}
              disabled={saving}
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              testID="save-password-button"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {t("settings.security.saveButton")}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={onCancel}
              disabled={saving}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                {t("common.cancel")}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
