/**
 * S27.3.4 — Liste des matchs (FlatList) avec pull-to-refresh.
 *
 * Extrait de `apps/mobile/app/lobby.tsx`. Affiche un `MatchCard` par
 * match, gere l'etat vide via i18n (`lobby.errors.empty`).
 */

import {
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useTranslation } from "../../lib/i18n-context";
import type { MatchSummary } from "../../lib/lobby/match-filter";
import { MatchCard } from "./MatchCard";
import { lobbyStyles as styles } from "./lobby.styles";

interface MatchListProps {
  matches: MatchSummary[];
  refreshing: boolean;
  onRefresh: () => void;
  onMatchPress: (match: MatchSummary) => void;
  onMatchReplay: (match: MatchSummary) => void;
}

export function MatchList({
  matches,
  refreshing,
  onRefresh,
  onMatchPress,
  onMatchReplay,
}: MatchListProps) {
  const { t } = useTranslation();
  return (
    <FlatList
      data={matches}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <MatchCard
          match={item}
          onPress={() => onMatchPress(item)}
          onReplay={() => onMatchReplay(item)}
        />
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t("lobby.errors.empty")}</Text>
        </View>
      }
    />
  );
}
