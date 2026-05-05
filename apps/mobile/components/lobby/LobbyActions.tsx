/**
 * S27.3.4 — Boutons d'actions principales du lobby (matchmaking,
 * coupes, ligues, stars, creer/rejoindre).
 *
 * Extrait de `apps/mobile/app/lobby.tsx`. Les libelles viennent de
 * `lobby.actions.*`. Les couleurs / styles sont identiques au design
 * d'origine (palette par bouton).
 */

import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "../../lib/i18n-context";
import { lobbyStyles as styles } from "./lobby.styles";

interface LobbyActionsProps {
  createLoading: boolean;
  onMatchmaking: () => void;
  onCups: () => void;
  onLeagues: () => void;
  onStars: () => void;
  onCreate: () => void;
  onJoin: () => void;
}

export function LobbyActions({
  createLoading,
  onMatchmaking,
  onCups,
  onLeagues,
  onStars,
  onCreate,
  onJoin,
}: LobbyActionsProps) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.actionRow}>
        <Pressable style={styles.matchmakingButton} onPress={onMatchmaking}>
          <Text style={styles.actionButtonText}>
            {t("lobby.actions.matchmaking")}
          </Text>
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={styles.cupsButton}
          onPress={onCups}
          testID="lobby-cups-button"
        >
          <Text style={styles.actionButtonText}>{t("lobby.actions.cups")}</Text>
        </Pressable>
        <Pressable
          style={styles.leaguesButton}
          onPress={onLeagues}
          testID="lobby-leagues-button"
        >
          <Text style={styles.actionButtonText}>
            {t("lobby.actions.leagues")}
          </Text>
        </Pressable>
        <Pressable
          style={styles.starsButton}
          onPress={onStars}
          testID="lobby-stars-button"
        >
          <Text style={styles.actionButtonText}>
            {t("lobby.actions.stars")}
          </Text>
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.createButton, createLoading && styles.buttonDisabled]}
          onPress={onCreate}
          disabled={createLoading}
        >
          {createLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>
              {t("lobby.actions.create")}
            </Text>
          )}
        </Pressable>
        <Pressable style={styles.joinButton} onPress={onJoin}>
          <Text style={styles.actionButtonText}>{t("lobby.actions.join")}</Text>
        </Pressable>
      </View>
    </>
  );
}
