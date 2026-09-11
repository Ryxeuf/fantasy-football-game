# offline-matches

## ADDED Requirements

### Requirement: La partie offline est derrière un feature gate, désactivé

La brique « partie offline » (`/local-matches` côté web, `/local-match` côté
API) DOIT être gatée par le feature flag `offline_match`, désactivé par
défaut. Tant qu'il est inactif :

- les routes `/local-match` DOIVENT répondre `403` ;
- aucune entrée de menu ni carte d'accueil NE DOIT y mener ;
- un accès direct à un écran `/local-matches` DOIT afficher un repli
  expliquant que le résultat se saisit sur la feuille de match.

Le flag DOIT être un feature gate normal et NON un kill-switch :
`FEATURE_FLAGS_FORCE_ENABLED` (CI) et le rôle `admin` le court-circuitent,
de sorte que les suites automatisées continuent d'exercer les routes et que
les administrateurs gardent l'accès aux parties déjà enregistrées.

L'écriture du modèle `LocalMatch` par le serveur (matérialisation du résultat
d'une feuille de coupe) NE DOIT PAS être affectée par le flag.

#### Scenario: Coach sans le flag
- WHEN un coach connecté ouvre le site
- THEN aucune entrée « Parties Offline » NE DOIT apparaître dans le menu

#### Scenario: Accès direct par un signet
- WHEN un coach ouvre `/local-matches` sans le flag
- THEN l'écran DOIT expliquer que la fonctionnalité est désactivée et
  orienter vers ses compétitions

#### Scenario: Suites automatisées
- WHEN `FEATURE_FLAGS_FORCE_ENABLED` est actif
- THEN les routes `/local-match` DOIVENT rester accessibles

#### Scenario: Validation d'une feuille de coupe
- WHEN une feuille de coupe est validée alors que le flag est inactif
- THEN le résultat DOIT être matérialisé et le classement mis à jour
