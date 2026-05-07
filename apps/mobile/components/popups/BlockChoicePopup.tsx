import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "../../lib/i18n-context";
import type { TranslationKey } from "../../lib/i18n";

export type BlockResult =
  | "PLAYER_DOWN"
  | "BOTH_DOWN"
  | "PUSH_BACK"
  | "STUMBLE"
  | "POW";

interface BlockChoicePopupProps {
  visible: boolean;
  attackerName: string;
  defenderName: string;
  chooser: "attacker" | "defender";
  options: BlockResult[];
  onChoose: (result: BlockResult) => void;
  onClose: () => void;
}

const RESULT_LABEL_KEYS: Record<BlockResult, TranslationKey> = {
  PLAYER_DOWN: "popups.block.results.playerDown",
  BOTH_DOWN: "popups.block.results.bothDown",
  PUSH_BACK: "popups.block.results.pushBack",
  STUMBLE: "popups.block.results.stumble",
  POW: "popups.block.results.pow",
};

export default function BlockChoicePopup({
  visible,
  attackerName,
  defenderName,
  chooser,
  options,
  onChoose,
  onClose,
}: BlockChoicePopupProps) {
  const { t } = useTranslation();
  const chooserName = chooser === "attacker" ? attackerName : defenderName;
  const cancelLabel = t("common.cancel");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("popups.block.title")}</Text>
          <Text style={styles.subtitle}>
            {t("popups.block.chooserChoosing", { name: chooserName })}
          </Text>

          <View style={styles.grid}>
            {options.map((opt) => {
              const label = t(RESULT_LABEL_KEYS[opt]);
              return (
                <Pressable
                  key={opt}
                  onPress={() => onChoose(opt)}
                  style={({ pressed }) => [
                    styles.optionButton,
                    pressed && styles.optionButtonPressed,
                  ]}
                  accessibilityLabel={t("popups.block.chooseA11y", {
                    result: label,
                  })}
                >
                  <Text style={styles.optionLabel}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onClose}
            style={styles.cancelButton}
            accessibilityLabel={cancelLabel}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    minWidth: 100,
    alignItems: "center",
  },
  optionButtonPressed: {
    backgroundColor: "#E5E7EB",
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
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
