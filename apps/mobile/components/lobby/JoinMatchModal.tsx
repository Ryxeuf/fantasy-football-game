/**
 * S27.3.4 — Modal pour saisir l'ID d'un match a rejoindre.
 *
 * Extrait de `apps/mobile/app/lobby.tsx`. Les libelles viennent de
 * `lobby.joinModal.*` et `common.cancel`.
 */

import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "../../lib/i18n-context";
import { lobbyStyles as styles } from "./lobby.styles";

interface JoinMatchModalProps {
  visible: boolean;
  matchId: string;
  loading: boolean;
  onChangeMatchId: (next: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function JoinMatchModal({
  visible,
  matchId,
  loading,
  onChangeMatchId,
  onClose,
  onSubmit,
}: JoinMatchModalProps) {
  const { t } = useTranslation();
  const trimmed = matchId.trim();
  const disabled = !trimmed || loading;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View
          style={styles.modalContent}
          onStartShouldSetResponder={() => true}
        >
          <Text style={styles.modalTitle}>{t("lobby.joinModal.title")}</Text>
          <TextInput
            style={styles.modalInput}
            placeholder={t("lobby.joinModal.inputPlaceholder")}
            placeholderTextColor="#9CA3AF"
            value={matchId}
            onChangeText={onChangeMatchId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable
              style={[styles.modalConfirm, !trimmed && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={disabled}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalConfirmText}>
                  {t("lobby.actions.join")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
