/**
 * S27.3.4 — Carte d'un match dans la liste du lobby.
 *
 * Extrait de `apps/mobile/app/lobby.tsx`. Aucun changement visuel.
 * Les labels sont passes via i18n (`useTranslation()`), les helpers
 * de formatage viennent de `lib/lobby/match-display.ts`.
 */

import { Pressable, Text, View } from "react-native";
import { useTranslation } from "../../lib/i18n-context";
import {
  formatMatchDate,
  formatRoundLabel,
  getStatusColor,
  getStatusLabel,
} from "../../lib/lobby/match-display";
import type { MatchSummary } from "../../lib/lobby/match-filter";
import { lobbyStyles as styles } from "./lobby.styles";

interface MatchCardProps {
  match: MatchSummary;
  onPress: () => void;
  onReplay?: () => void;
}

export function MatchCard({ match, onPress, onReplay }: MatchCardProps) {
  const { t, locale } = useTranslation();
  const isMyTurn = match.isMyTurn && match.status === "active";
  const isEnded = match.status === "ended";

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, isMyTurn && styles.cardMyTurn]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(match.status) },
            ]}
          />
          <Text style={styles.statusText}>{getStatusLabel(match.status, t)}</Text>
          {isMyTurn && (
            <View style={styles.myTurnBadge}>
              <Text style={styles.myTurnText}>{t("lobby.myTurnBadge")}</Text>
            </View>
          )}
        </View>
        <Text style={styles.dateText}>
          {formatMatchDate(match.createdAt, locale)}
        </Text>
      </View>

      <View style={styles.teamsRow}>
        <Text style={styles.teamName} numberOfLines={1}>
          {match.myTeam?.teamName || t("lobby.teamPlaceholder")}
        </Text>
        {match.status !== "pending" && (
          <Text style={styles.score}>
            {match.myScore} - {match.opponentScore}
          </Text>
        )}
        <Text style={styles.teamName} numberOfLines={1}>
          {match.opponent?.teamName || t("lobby.waitingOpponent")}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        {match.opponent?.coachName ? (
          <Text style={styles.footerText}>
            {t("lobby.vsCoach", { name: match.opponent.coachName })}
          </Text>
        ) : (
          <Text style={styles.footerText} />
        )}
        {match.half > 0 && (
          <Text style={styles.footerText}>
            {formatRoundLabel(match.half, match.turn, t)}
          </Text>
        )}
      </View>

      {isEnded && onReplay && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onReplay();
          }}
          style={styles.replayButton}
          accessibilityLabel={t("lobby.actions.replayA11y")}
        >
          <Text style={styles.replayButtonText}>
            {t("lobby.actions.replay")}
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}
