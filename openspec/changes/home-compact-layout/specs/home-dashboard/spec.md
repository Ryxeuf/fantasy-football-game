# home-dashboard

## ADDED Requirements

### Requirement: Valeur principale dans les premiers écrans de l'accueil
La home publique DOIT présenter les compétitions (ligue et coupes)
immédiatement après le hero, avant le catalogue de référence et la vitrine
des factions.

#### Scenario: Ordre des sections
- WHEN un visiteur ouvre `/`
- THEN la section des compétitions DOIT suivre directement le hero
- AND le catalogue de référence DOIT précéder la vitrine des factions

### Requirement: Appel principal selon l'état du visiteur
Le hero DOIT proposer l'inscription (avec retour à `/me/teams`) à un
visiteur non reconnu, accompagnée d'un lien de connexion, et l'accès direct
à `/me/teams` à un coach connecté.

#### Scenario: Visiteur déconnecté
- WHEN un visiteur sans `auth_token` ouvre `/`
- THEN l'appel principal DOIT pointer vers `/register?redirect=%2Fme%2Fteams`
- AND un lien DOIT pointer vers `/login?redirect=%2Fme%2Fteams`

#### Scenario: Coach connecté
- WHEN un coach avec un `auth_token` valide ouvre `/`
- THEN l'appel principal DOIT pointer vers `/me/teams`
- AND aucun lien de connexion NE DOIT être affiché

### Requirement: Catalogue de référence entièrement lié
Chaque tuile du catalogue de la home DOIT mener à une page, sans doublon de
lien, et le catalogue DOIT inclure les règles (`/compendium`), l'aide de jeu
(`/aide-de-jeu`) et la tier-list (`/teams/tier-list`).

#### Scenario: Tuiles
- WHEN la home est rendue
- THEN chaque tuile DOIT être un lien
- AND aucune rangée d'accès rapide dupliquant ces liens NE DOIT être affichée
