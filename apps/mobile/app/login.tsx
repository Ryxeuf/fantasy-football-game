import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

// Placeholder login screen — full implementation is task 4.1
export default function LoginScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connexion</Text>
      <Text style={styles.subtitle}>
        Écran de connexion à venir.
      </Text>
      <Pressable style={styles.linkButton} onPress={() => router.push("/register")}>
        <Text style={styles.linkText}>
          Pas de compte ? S'inscrire
        </Text>
      </Pressable>
      <Pressable style={styles.linkButton} onPress={() => router.push("/")}>
        <Text style={styles.linkText}>Retour à l'accueil</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginBottom: 24,
    textAlign: "center",
  },
  linkButton: {
    marginTop: 12,
  },
  linkText: {
    color: "#2563EB",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
