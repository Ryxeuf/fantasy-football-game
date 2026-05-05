import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Field } from "./SettingsFields";
import { settingsStyles as styles } from "../../app/settings.styles";
import { useTranslation } from "../../lib/i18n-context";
import type { ProfileFormData } from "../../lib/profile";

interface ProfileEditSectionProps {
  form: ProfileFormData;
  onChange: (form: ProfileFormData) => void;
  editing: boolean;
  saving: boolean;
  formError: string | null;
  formSuccess: string | null;
  onStart: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function ProfileEditSection({
  form,
  onChange,
  editing,
  saving,
  formError,
  formSuccess,
  onStart,
  onSave,
  onCancel,
}: ProfileEditSectionProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.section} testID="profile-edit">
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t("settings.profile.title")}</Text>
        {!editing && (
          <Pressable
            onPress={onStart}
            style={styles.secondaryButton}
            testID="edit-profile-button"
          >
            <Text style={styles.secondaryButtonText}>
              {t("settings.profile.editButton")}
            </Text>
          </Pressable>
        )}
      </View>

      {formSuccess && !editing && (
        <Text style={styles.success}>{formSuccess}</Text>
      )}

      {editing && (
        <View>
          {formError && <Text style={styles.error}>{formError}</Text>}
          <Field
            label={t("settings.profile.fields.email")}
            required
            value={form.email}
            onChangeText={(v) => onChange({ ...form, email: v })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            testID="input-email"
          />
          <Field
            label={t("settings.profile.fields.coachName")}
            required
            value={form.coachName}
            onChangeText={(v) => onChange({ ...form, coachName: v })}
            autoCapitalize="words"
            testID="input-coach-name"
          />
          <Field
            label={t("settings.profile.fields.firstName")}
            value={form.firstName}
            onChangeText={(v) => onChange({ ...form, firstName: v })}
            autoCapitalize="words"
          />
          <Field
            label={t("settings.profile.fields.lastName")}
            value={form.lastName}
            onChangeText={(v) => onChange({ ...form, lastName: v })}
            autoCapitalize="words"
          />
          <Field
            label={t("settings.profile.fields.dateOfBirth")}
            value={form.dateOfBirth}
            onChangeText={(v) => onChange({ ...form, dateOfBirth: v })}
            placeholder={t("settings.profile.fields.dateOfBirthPlaceholder")}
            autoCapitalize="none"
          />
          <View style={styles.buttonRow}>
            <Pressable
              onPress={onSave}
              disabled={saving}
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              testID="save-profile-button"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {t("settings.profile.saveButton")}
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
