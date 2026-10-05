# crowns

## ADDED Requirements

### Requirement: Les Couronnes du coach sont visibles sur son profil
Avec le flag `crowns`, le profil DOIT afficher le solde de Crowns et les
dernières opérations (libellées : achat, remboursement, ajustement admin…),
et le menu utilisateur la pastille du solde. Flag OFF : aucune mention des
Crowns et aucune requête.

#### Scenario: Flag inactif
- WHEN le flag `crowns` est inactif pour le coach
- THEN `GET /crowns/me` DOIT répondre 403 `feature_flag_disabled`
- AND le profil NE DOIT PAS afficher de solde

#### Scenario: Solde servi
- WHEN un coach connecté appelle `GET /crowns/me`
- THEN la réponse DOIT contenir son solde du wallet et ses 20 dernières opérations

### Requirement: L'admin ajuste les Couronnes d'un coach
L'écran admin d'un coach DOIT permettre d'ajuster son solde par la route
wallet existante (`ADMIN_ADJUST`, raison obligatoire, journal admin).
