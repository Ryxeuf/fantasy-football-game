import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { describeDirection } from "../../lib/block-popups";

interface PushDirection {
  x: number;
  y: number;
}

interface PushChoicePopupProps {
  visible: boolean;
  attackerName: string;
  targetName: string;
  availableDirections: PushDirection[];
  onChoose: (direction: PushDirection) => void;
  onClose: () => void;
}

export default function PushChoicePopup({
  visible,
  attackerName,
  targetName,
  availableDirections,
  onChoose,
  onClose,
}: PushChoicePopupProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Choix de direction de poussée</Text>
          <Text style={styles.subtitle}>
            {attackerName} doit choisir dans quelle direction pousser {targetName}
          </Text>

          <View style={styles.grid}>
            {availableDirections.map((direction) => {
              const { label, arrow } = describeDirection(direction);
              const key = `${direction.x},${direction.y}`;
              return (
                <Pressable
                  key={key}
                  onPress={() => onChoose(direction)}
                  style={({ pressed }) => [
                    styles.optionButton,
                    pressed && styles.optionButtonPressed,
                  ]}
                  accessibilityLabel={`Pousser vers ${label}`}
                >
                  <Text style={styles.arrow}>{arrow}</Text>
                  <Text style={styles.label}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

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
    marginBottom: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  optionButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    minWidth: 80,
  },
  optionButtonPressed: {
    backgroundColor: "#E5E7EB",
  },
  arrow: {
    fontSize: 24,
    marginBottom: 2,
    color: "#111827",
  },
  label: {
    fontSize: 11,
    color: "#6B7280",
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
