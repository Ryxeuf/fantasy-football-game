/**
 * S27.3.4 — Barre de filtres du lobby (Tous / Mon tour / En cours / Termines).
 *
 * Extrait de `apps/mobile/app/lobby.tsx`. Les labels viennent de
 * `lobby.filters.*`. Le compteur "Mon tour ({n})" utilise l'interpolation.
 */

import { Pressable, Text, View } from "react-native";
import { useTranslation } from "../../lib/i18n-context";
import type { LobbyFilter } from "../../lib/lobby/match-filter";
import { lobbyStyles as styles } from "./lobby.styles";

interface FilterBarProps {
  active: LobbyFilter;
  myTurnCount: number;
  onChange: (next: LobbyFilter) => void;
}

export function FilterBar({ active, myTurnCount, onChange }: FilterBarProps) {
  const { t } = useTranslation();
  const filters: { key: LobbyFilter; label: string }[] = [
    { key: "all", label: t("lobby.filters.all") },
    {
      key: "my-turn",
      label: t("lobby.filters.myTurn", { count: myTurnCount }),
    },
    { key: "active", label: t("lobby.filters.active") },
    { key: "ended", label: t("lobby.filters.ended") },
  ];

  return (
    <View style={styles.filterRow}>
      {filters.map((f) => (
        <Pressable
          key={f.key}
          onPress={() => onChange(f.key)}
          style={[
            styles.filterButton,
            active === f.key && styles.filterButtonActive,
          ]}
        >
          <Text
            style={[
              styles.filterText,
              active === f.key && styles.filterTextActive,
            ]}
          >
            {f.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
