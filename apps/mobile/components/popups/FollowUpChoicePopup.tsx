import { Modal, View, Text, Pressable, StyleSheet } from "react-native";

interface FollowUpChoicePopupProps {
  visible: boolean;
  attackerName: string;
  targetName: string;
  targetNewPosition: { x: number; y: number };
  onChoose: (followUp: boolean) => void;
  onClose: () => void;
}

export default function FollowUpChoicePopup({
  visible,
  attackerName,
  targetName,
  targetNewPosition,
  onChoose,
  onClose,
}: FollowUpChoicePopupProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Suivi (Follow-up)</Text>
          <Text style={styles.subtitle}>
            {attackerName} a repoussé {targetName} vers ({targetNewPosition.x},{" "}
            {targetNewPosition.y})
          </Text>
          <Text style={styles.question}>
            Voulez-vous que {attackerName} le suive dans la case libérée ?
          </Text>

          <View style={styles.row}>
            <Pressable
              onPress={() => onChoose(true)}
              style={({ pressed }) => [
                styles.choiceButton,
                styles.choiceYes,
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Suivre"
            >
              <Text style={styles.choiceIcon}>✓</Text>
              <Text style={styles.choiceText}>Suivre</Text>
            </Pressable>
            <Pressable
              onPress={() => onChoose(false)}
              style={({ pressed }) => [
                styles.choiceButton,
                styles.choiceNo,
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Ne pas suivre"
            >
              <Text style={styles.choiceIcon}>✗</Text>
              <Text style={styles.choiceText}>Ne pas suivre</Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>
            Le suivi est gratuit et ne consomme pas de points de mouvement
          </Text>

          <Pressable
            onPress={onClose}
            style={styles.cancelButton}
            accessibilityLabel="Annuler"
          >
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 10,
  },
  question: {
    fontSize: 13,
    color: "#374151",
    textAlign: "center",
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 16,
  },
  choiceButton: {
    flex: 1,
    maxWidth: 150,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  choiceYes: {
    backgroundColor: "#16A34A",
  },
  choiceNo: {
    backgroundColor: "#DC2626",
  },
  pressed: {
    opacity: 0.8,
  },
  choiceIcon: {
    fontSize: 18,
    color: "#fff",
    marginBottom: 2,
  },
  choiceText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  hint: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 14,
  },
  cancelButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
});
