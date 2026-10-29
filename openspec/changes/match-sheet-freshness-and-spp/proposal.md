# Feuille de match : un état d'équipe à jour, des PSP complets

## Why

Retour testeur (Discord, 29/10/2026), trois défauts de la feuille de match de
ligue :

1. **Une feuille ouverte trop tôt reste sur un état périmé.** L'ouverture fige
   l'état complet des deux équipes (« version du match »). Ouverte avant la
   validation de la journée précédente d'une des deux équipes, la feuille de
   J+1 part d'un état sans les effets de J — PSP, blessures, morts, or, fans,
   évolutions (« ma J3 ouverte le 16/09 reste comme si nos 2 teams n'avaient
   pas joué »). Même chose quand J est invalidée puis corrigée après
   l'ouverture de J+1.
2. **Une élimination soignée ne compte plus.** Apothicaire réussi ou
   Régénération : la blessure est annulée, le coach laisse la gravité vide —
   et l'élimination disparaît (ni sortie, ni bonus « sorties infligées », ni
   les 2 PSP de l'auteur). Le livre accorde ces PSP « même si l'élimination
   est ensuite annulée ».
3. **Le lancer de coéquipier ne rapporte rien au lanceur.** La table des PSP
   prévoit le « Lancer Sécurisé » (1 PSP au lanceur d'un Lancer de Coéquipier
   réussi) en plus de l'atterrissage (1 PSP au joueur lancé). Seul le second
   était compté.

## What Changes

- **Garde d'ouverture** : une feuille de ligue ne s'ouvre pas tant qu'une
  rencontre d'une journée antérieure de la même saison, impliquant l'une des
  deux équipes, n'est pas close. Le refus nomme les rencontres à valider
  d'abord ; le commissaire peut forcer (journée reportée).
- **Feuille périmée** : la lecture signale qu'une autre feuille d'une des
  deux équipes a été validée ou invalidée après le gel, et un coach ou le
  commissaire met la feuille à jour (nouveau gel) tant que personne n'a
  soumis. Refus si la saisie cite un joueur que le nouveau gel ne connaît
  plus.
- **Élimination soignée** : une Élimination sur Blocage ou sur Action
  Spéciale est une élimination par son type, gravité saisie ou non ; une
  issue explicite « Aucune séquelle (Apothicaire / Régénération) » qualifie
  les autres cas (agression sous Frénésie, atterrissage sous Vol Fatal) sans
  créer de blessure.
- **Lancer Sécurisé** : 1 PSP au lanceur de chaque Lancer de Coéquipier
  réussi saisi.
- **Rattrapage** : les feuilles déjà validées (saisons non clôturées) sont
  reprises à la prochaine lecture du classement — règle des sorties en
  version 2, Lancers Sécurisés compris.

## Capabilities

### Modified Capabilities

- `league-match-sheet` : définition d'une sortie (élimination soignée),
  resynchronisation (Lancers Sécurisés, match joué d'une ligne ajoutée),
  garde d'ouverture, fraîcheur et mise à jour du gel, Lancer Sécurisé.

## Impact

- **Base** : aucune colonne. Le gel porte déjà `capturedAt` ;
  `CASUALTY_RULE_VERSION` passe à 2 (le rattrapage relit
  `casualtyRuleVersion < 2`).
- **Serveur** : `league-match-summary` (`eliminationOccurred`,
  `HEALED_ELIMINATION`, `safeThrows`), `spp-tracking` (`safeThrow`),
  `league-offline-result` / `league-offline-edit` (persistance et reprise),
  `league-sheet-casualty-resync` (Lancers Sécurisés, `newStatLine`),
  `league-player-stats` (sac de frappe, PSP de saison), modules purs
  `league-sheet-open-guard` et `league-sheet-snapshot-freshness`,
  `createMatchSheet` (`force`), `refreshMatchSheetSnapshots`, route
  `POST /leagues/pairings/:id/sheet/refresh`, codes `previous_match_pending`
  et `refresh_*` (409, `details` servis).
- **Web** : client API (`ApiClientError.details`), écran d'ouverture,
  bandeau de fraîcheur, option « Aucune séquelle », rappels de règle,
  feuille PDF (code AS, légende du lancer).
- **Tests e2e** : trois specs jouaient une journée 2 avant la journée 1 de
  l'adversaire ; elles ouvrent désormais en commissaire forcé.
