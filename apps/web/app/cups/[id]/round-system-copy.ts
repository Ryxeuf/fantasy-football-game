/**
 * Bandeau des rondes d'une coupe : quel TITRE et quelle DESCRIPTION afficher
 * selon le système d'appariement (logique PURE, sans React ni i18n résolu).
 *
 * Le bandeau annonçait « Rondes (système suisse) » en permanence — y compris
 * après que le commissaire ait choisi « Tirage au sort » ou « Saisie
 * manuelle » : le texte décrivait alors une règle d'appariement qui n'allait
 * pas être appliquée. La dérivation vit ici pour être testable sans DOM ; le
 * composant se contente de résoudre les clés retournées.
 *
 * Hors sélection (coach inscrit, ou commissaire qui ne peut pas encore
 * générer), le bandeau reste NEUTRE : une coupe panache les systèmes d'une
 * ronde à l'autre, en annoncer un seul serait faux. C'est le badge de chaque
 * ronde qui dit avec quel système elle a été composée.
 */
import type { CupRoundSystem } from "./manual-round";

export type CupRoundSystemLabelKey =
  | "roundSystemRandom"
  | "roundSystemSwiss"
  | "roundSystemManual";

export type CupRoundSystemDescriptionKey = `${CupRoundSystemLabelKey}Description`;

/** Libellé court d'un système (pastille de choix, titre du bandeau). */
export const CUP_ROUND_SYSTEM_LABEL_KEYS: Readonly<
  Record<CupRoundSystem, CupRoundSystemLabelKey>
> = {
  random: "roundSystemRandom",
  swiss: "roundSystemSwiss",
  manual: "roundSystemManual",
};

/** Règle d'appariement appliquée par ce système, en une ou deux phrases. */
export const CUP_ROUND_SYSTEM_DESCRIPTION_KEYS: Readonly<
  Record<CupRoundSystem, CupRoundSystemDescriptionKey>
> = {
  random: "roundSystemRandomDescription",
  swiss: "roundSystemSwissDescription",
  manual: "roundSystemManualDescription",
};

export interface CupRoundsHeadingKeys {
  /** `roundsTitleWithSystem` attend la variable `{{system}}`. */
  readonly titleKey: "roundsTitle" | "roundsTitleWithSystem";
  /** Libellé à injecter dans `{{system}}` ; `null` quand le titre est neutre. */
  readonly systemLabelKey: CupRoundSystemLabelKey | null;
  readonly descriptionKey: "roundsDescription" | CupRoundSystemDescriptionKey;
}

export function cupRoundsHeadingKeys(args: {
  readonly system: CupRoundSystem;
  /** Le sélecteur d'appariement est-il affiché à l'écran ? */
  readonly systemSelectorVisible: boolean;
}): CupRoundsHeadingKeys {
  if (!args.systemSelectorVisible) {
    return {
      titleKey: "roundsTitle",
      systemLabelKey: null,
      descriptionKey: "roundsDescription",
    };
  }
  return {
    titleKey: "roundsTitleWithSystem",
    systemLabelKey: CUP_ROUND_SYSTEM_LABEL_KEYS[args.system],
    descriptionKey: CUP_ROUND_SYSTEM_DESCRIPTION_KEYS[args.system],
  };
}
