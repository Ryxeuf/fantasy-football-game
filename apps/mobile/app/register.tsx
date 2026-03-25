import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { apiPost } from "../lib/api";

export default function RegisterScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [coachName, setCoachName] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const canSubmit = email.trim() !== "" && coachName.trim() !== "" && password.trim() !== "" && !loading;

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await apiPost("/auth/register", {
        email: email.trim(),
        password,
        coachName: coachName.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.title}>Compte créé !</Text>
          <Text style={styles.successText}>
            Un administrateur doit valider votre compte avant que vous puissiez
            vous connecter.
          </Text>
          <Pressable style={styles.linkButton} onPress={() => router.replace("/login")}>
            <Text style={styles.linkText}>Aller à la connexion</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Créer un compte</Text>

          <Text style={styles.label}>
            Email <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <Text style={styles.label}>
            Nom de coach <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Coach Nuffleborg"
            placeholderTextColor="#9CA3AF"
            value={coachName}
            onChangeText={setCoachName}
            autoCapitalize="words"
            autoComplete="username"
            textContentType="username"
          />

          <Text style={styles.label}>Prénom</Text>
          <TextInput
            style={styles.input}
            placeholder="Prénom"
            placeholderTextColor="#9CA3AF"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
          />

          <Text style={styles.label}>Nom</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom de famille"
            placeholderTextColor="#9CA3AF"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
          />

          <Text style={styles.label}>
            Mot de passe <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="8 caractères minimum"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>S'inscrire</Text>
            )}
          </Pressable>

          <Pressable style={styles.linkButton} onPress={() => router.push("/login")}>
            <Text style={styles.linkText}>
              Déjà un compte ? Se connecter
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
    marginTop: 12,
  },
  required: {
    color: "#EF4444",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  error: {
    color: "#DC2626",
    fontSize: 14,
    marginTop: 12,
  },
  submitButton: {
    backgroundColor: "#16A34A",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  successIcon: {
    fontSize: 48,
    color: "#16A34A",
    textAlign: "center",
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: "#374151",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  linkButton: {
    marginTop: 16,
    alignItems: "center",
  },
  linkText: {
    color: "#2563EB",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
