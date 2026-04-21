import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { rollTypeLabel } from "../../lib/block-popups";

interface RerollChoicePopupProps {
  visible: boolean;
  rollType: string;
  playerName: string;
  teamRerollsLeft: number;
  onChoose: (useReroll: boolean) => void;
  onClose: () => void;
}

export default function RerollChoicePopup({
  visible,
  rollType,
  playerName,
  teamRerollsLeft,
  onChoose,
  onClose,
}: RerollChoicePopupProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Relance disponible !</Text>
          <Text style={styles.subtitle}>
            {playerName} a raté son jet de{" "}
            <Text style={styles.rollType}>{rollTypeLabel(rollType)}</Text>
          </Text>
          <Text style={styles.rerollsLeft}>
            Relances restantes : {teamRerollsLeft}
          </Text>

          <View style={styles.row}>
            <Pressable
              onPress={() => onChoose(true)}
              style={({ pressed }) => [
                styles.choiceButton,
                styles.rerollButton,
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Relancer"
            >
              <Text style={styles.rerollText}>Relancer</Text>
            </Pressable>
            <Pressable
              onPress={() => onChoose(false)}
              style={({ pressed }) => [
                styles.choiceButton,
                styles.declineButton,
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Refuser"
            >
              <Text style={styles.declineText}>Refuser</Text>
            </Pressable>
          </View>
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
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 4,
  },
  rollType: {
    fontWeight: "700",
    color: "#111827",
  },
  rerollsLeft: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  choiceButton: {
    flex: 1,
    maxWidth: 150,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  rerollButton: {
    backgroundColor: "#F97316",
  },
  declineButton: {
    backgroundColor: "#E5E7EB",
  },
  pressed: {
    opacity: 0.8,
  },
  rerollText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  declineText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
});
