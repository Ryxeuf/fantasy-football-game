/**
 * S27.3.4 — Header du lobby : salutation + boutons quick-actions.
 *
 * Extrait de `apps/mobile/app/lobby.tsx`. Les libelles viennent de
 * `lobby.title`, `lobby.greeting` et `lobby.actions.*`.
 */

import { Pressable, Text, View } from "react-native";
import { useTranslation } from "../../lib/i18n-context";
import { lobbyStyles as styles } from "./lobby.styles";

interface LobbyHeaderProps {
  coachName?: string | null;
  onTeams: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

export function LobbyHeader({
  coachName,
  onTeams,
  onLeaderboard,
  onSettings,
  onLogout,
}: LobbyHeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Text style={styles.title}>
        {coachName
          ? t("lobby.greeting", { name: coachName })
          : t("lobby.title")}
      </Text>
      <View style={styles.headerActions}>
        <Pressable onPress={onTeams} style={styles.teamsButton}>
          <Text style={styles.teamsButtonText}>{t("lobby.actions.teams")}</Text>
        </Pressable>
        <Pressable onPress={onLeaderboard} style={styles.leaderboardButton}>
          <Text style={styles.leaderboardButtonText}>
            {t("lobby.actions.leaderboard")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onSettings}
          style={styles.settingsButton}
          testID="lobby-settings-button"
        >
          <Text style={styles.settingsButtonText}>
            {t("lobby.actions.profile")}
          </Text>
        </Pressable>
        <Pressable onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>{t("common.logout")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
