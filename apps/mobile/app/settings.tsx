import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { apiDelete, apiGet, apiPut, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useTranslation } from "../lib/i18n-context";
import {
  AccountInfoSection,
  StatsSection,
} from "../components/settings/AccountInfoSection";
import { DangerZone } from "../components/settings/DangerZone";
import { PasswordChangeSection } from "../components/settings/PasswordChangeSection";
import { ProfileEditSection } from "../components/settings/ProfileEditSection";
import { ProfileHeader } from "../components/settings/ProfileHeader";
import { settingsStyles as styles } from "./settings.styles";
import {
  buildProfileUpdatePayload,
  parseProfileResponse,
  profileToFormData,
  validatePasswordChange,
  validateProfileUpdate,
  type PasswordChange,
  type ProfileFormData,
  type UserProfile,
} from "../lib/profile";

const EMPTY_FORM: ProfileFormData = {
  email: "",
  coachName: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
};

const EMPTY_PASSWORD: PasswordChange = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useTranslation();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ProfileFormData>(EMPTY_FORM);
  const [password, setPassword] = useState<PasswordChange>(EMPTY_PASSWORD);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [changingPassword, setChangingPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleAuthError = useCallback(
    async (err: unknown) => {
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.status === 403)
      ) {
        await logout();
        router.replace("/login");
        return true;
      }
      return false;
    },
    [logout, router],
  );

  const loadProfile = useCallback(async () => {
    try {
      const response = await apiGet("/auth/me");
      const parsed = parseProfileResponse(response);
      if (!parsed) {
        setLoadError(t("settings.profile.notFound"));
        return;
      }
      setProfile(parsed);
      setForm(profileToFormData(parsed));
      setLoadError(null);
    } catch (err: unknown) {
      if (await handleAuthError(err)) return;
      const msg =
        err instanceof Error ? err.message : t("settings.profile.loadError");
      setLoadError(msg);
    }
  }, [handleAuthError, t]);

  useEffect(() => {
    setLoading(true);
    loadProfile().finally(() => setLoading(false));
  }, [loadProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  const onStartEdit = () => {
    if (!profile) return;
    setForm(profileToFormData(profile));
    setEditing(true);
    setFormError(null);
    setFormSuccess(null);
  };

  const onCancelEdit = () => {
    if (profile) setForm(profileToFormData(profile));
    setEditing(false);
    setFormError(null);
  };

  const onSaveProfile = async () => {
    setFormError(null);
    setFormSuccess(null);
    const validation = validateProfileUpdate(form);
    if (validation) {
      setFormError(validation);
      return;
    }
    setSaving(true);
    try {
      const payload = buildProfileUpdatePayload(form);
      const response = await apiPut("/auth/me", payload);
      const parsed = parseProfileResponse(response);
      if (parsed) {
        setProfile(parsed);
        setForm(profileToFormData(parsed));
      }
      setEditing(false);
      setFormSuccess(t("settings.profile.saveSuccess"));
    } catch (err: unknown) {
      if (await handleAuthError(err)) return;
      const msg =
        err instanceof Error ? err.message : t("settings.profile.saveError");
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const onStartPassword = () => {
    setPassword(EMPTY_PASSWORD);
    setPasswordError(null);
    setPasswordSuccess(null);
    setChangingPassword(true);
  };

  const onCancelPassword = () => {
    setPassword(EMPTY_PASSWORD);
    setChangingPassword(false);
    setPasswordError(null);
  };

  const onSavePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);
    const validation = validatePasswordChange(password);
    if (validation) {
      setPasswordError(validation);
      return;
    }
    setSavingPassword(true);
    try {
      await apiPut("/auth/me/password", {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword(EMPTY_PASSWORD);
      setChangingPassword(false);
      setPasswordSuccess(t("settings.password.success"));
    } catch (err: unknown) {
      if (await handleAuthError(err)) return;
      const msg =
        err instanceof Error ? err.message : t("settings.password.error");
      setPasswordError(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const runDeleteAccount = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await apiDelete("/auth/me");
      await logout();
      router.replace("/login");
    } catch (err: unknown) {
      if (await handleAuthError(err)) return;
      const msg =
        err instanceof Error ? err.message : t("settings.delete.error");
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      t("settings.delete.title"),
      t("settings.delete.confirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.delete.button"),
          style: "destructive",
          onPress: runDeleteAccount,
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (loadError || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {loadError ?? t("settings.profile.notFound")}
        </Text>
        <Pressable onPress={onRefresh} style={styles.retryButton}>
          <Text style={styles.retryText}>{t("common.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <ProfileHeader profile={profile} />
        <StatsSection profile={profile} />
        <AccountInfoSection profile={profile} />

        <ProfileEditSection
          form={form}
          onChange={setForm}
          editing={editing}
          saving={saving}
          formError={formError}
          formSuccess={formSuccess}
          onStart={onStartEdit}
          onSave={onSaveProfile}
          onCancel={onCancelEdit}
        />

        <PasswordChangeSection
          password={password}
          onChange={setPassword}
          changing={changingPassword}
          saving={savingPassword}
          error={passwordError}
          success={passwordSuccess}
          onStart={onStartPassword}
          onSave={onSavePassword}
          onCancel={onCancelPassword}
        />

        <View style={styles.section}>
          <Pressable
            onPress={onLogout}
            style={styles.logoutButton}
            testID="logout-button"
          >
            <Text style={styles.logoutButtonText}>
              {t("settings.actions.logout")}
            </Text>
          </Pressable>
        </View>

        <DangerZone
          deleting={deleting}
          error={deleteError}
          onPress={confirmDeleteAccount}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
