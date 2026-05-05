/**
 * S27.3.4 — Banner "X matchs en attente de votre tour".
 *
 * Extrait de `apps/mobile/app/lobby.tsx`. Selectionne singulier/pluriel
 * via `lobby.myTurnBannerSingular` ou `lobby.myTurnBannerPlural` selon
 * `count`. Ne s'affiche pas si `count <= 0`.
 */

import { Text, View } from "react-native";
import { useTranslation } from "../../lib/i18n-context";
import { lobbyStyles as styles } from "./lobby.styles";

interface MyTurnBannerProps {
  count: number;
}

export function MyTurnBanner({ count }: MyTurnBannerProps) {
  const { t } = useTranslation();
  if (count <= 0) return null;
  const key =
    count > 1 ? "lobby.myTurnBannerPlural" : "lobby.myTurnBannerSingular";
  return (
    <View style={styles.turnBanner}>
      <Text style={styles.turnBannerText}>{t(key, { count })}</Text>
    </View>
  );
}
