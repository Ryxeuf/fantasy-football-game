import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Field } from "./SettingsFields";
import { settingsStyles as styles } from "../../app/settings.styles";
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
  return (
    <View style={styles.section} testID="profile-edit">
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Profil</Text>
        {!editing && (
          <Pressable
            onPress={onStart}
            style={styles.secondaryButton}
            testID="edit-profile-button"
          >
            <Text style={styles.secondaryButtonText}>Modifier</Text>
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
            label="Email"
            required
            value={form.email}
            onChangeText={(v) => onChange({ ...form, email: v })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            testID="input-email"
          />
          <Field
            label="Nom de coach"
            required
            value={form.coachName}
            onChangeText={(v) => onChange({ ...form, coachName: v })}
            autoCapitalize="words"
            testID="input-coach-name"
          />
          <Field
            label="Prenom"
            value={form.firstName}
            onChangeText={(v) => onChange({ ...form, firstName: v })}
            autoCapitalize="words"
          />
          <Field
            label="Nom"
            value={form.lastName}
            onChangeText={(v) => onChange({ ...form, lastName: v })}
            autoCapitalize="words"
          />
          <Field
            label="Date de naissance (YYYY-MM-DD)"
            value={form.dateOfBirth}
            onChangeText={(v) => onChange({ ...form, dateOfBirth: v })}
            placeholder="1990-05-15"
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
                <Text style={styles.primaryButtonText}>Enregistrer</Text>
              )}
            </Pressable>
            <Pressable
              onPress={onCancel}
              disabled={saving}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
