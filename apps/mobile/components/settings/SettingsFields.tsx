import { Text, TextInput, View } from "react-native";
import { settingsStyles as styles } from "../../app/settings.styles";

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  required?: boolean;
  secureTextEntry?: boolean;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?:
    | "email"
    | "password"
    | "current-password"
    | "new-password"
    | "off";
  testID?: string;
}

export function Field({
  label,
  value,
  onChangeText,
  required,
  secureTextEntry,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoComplete,
  testID,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        autoComplete={autoComplete}
        testID={testID}
      />
    </View>
  );
}

export function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}
