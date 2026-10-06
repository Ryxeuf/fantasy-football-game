# home-dashboard

## Purpose

Definir la surface d'accueil web et la navigation vers l'espace personnalise
du coach : une home marketing publique toujours accessible (`/`), un tableau
de bord personnalise a URL propre (`/me`), des liens explicites entre les
deux, et le conditionnement des actions "Jouer en ligne" par feature flag.

## Requirements

### Requirement: Accueil public toujours rendu
La route racine `/` DOIT rendre la home marketing publique pour tous les
visiteurs (connectes ou non) en preservant le rendu cote serveur (SEO). Elle
NE DOIT PAS basculer automatiquement vers un autre rendu selon l'etat
d'authentification.

#### Scenario: Visiteur deconnecte
- WHEN un visiteur sans `auth_token` ouvre `/`
- THEN la home marketing DOIT etre rendue
- AND aucun appel a `/auth/me` ne DOIT etre emis

#### Scenario: Coach connecte sur l'accueil
- WHEN un coach avec un `auth_token` valide ouvre `/`
- THEN la home marketing DOIT etre rendue
- AND un bandeau personnalise pointant vers `/me` DOIT etre affiche apres le montage client

#### Scenario: Token expire
- WHEN un visiteur dont le token est invalide/expire ouvre `/`
- THEN la home marketing DOIT etre rendue sans bandeau coach

### Requirement: Tableau de bord personnalise a l'URL `/me`
Le tableau de bord du coach DOIT etre servi a l'URL propre `/me` et DOIT etre
reserve aux utilisateurs authentifies.

#### Scenario: Acces connecte
- WHEN un coach authentifie ouvre `/me`
- THEN son tableau de bord DOIT etre rendu (ses equipes et statistiques)

#### Scenario: Acces non authentifie
- WHEN un visiteur sans `auth_token` valide demande `/me`
- THEN le middleware DOIT le rediriger vers `/auth/sync` (pas de cookie) ou `/login` (cookie invalide)

### Requirement: Navigation croisee accueil <-> tableau de bord
L'interface DOIT fournir des liens explicites entre l'accueil public et le
tableau de bord personnalise, dans les deux sens.

#### Scenario: Du tableau de bord vers l'accueil public
- WHEN un coach consulte `/me`
- THEN un lien "Retour a l'accueil" DOIT pointer vers `/`

#### Scenario: De l'accueil vers le tableau de bord
- WHEN un coach connecte consulte `/`
- THEN le bandeau personnalise DOIT pointer vers `/me`

### Requirement: Actions "Jouer en ligne" conditionnees par feature flag
Tous les points d'entree "Jouer en ligne" (carte du tableau de bord, section
de la home marketing, menu compte) ainsi que la route `/me/matches` DOIVENT
etre conditionnes par le feature flag `online_play`.

#### Scenario: Flag desactive
- WHEN le flag `online_play` est inactif pour l'utilisateur
- THEN les points d'entree "Jouer en ligne" NE DOIVENT PAS etre affiches
- AND la route `/me/matches` DOIT afficher l'ecran "fonctionnalite indisponible" (`OnlinePlayGate`)

#### Scenario: Flag active
- WHEN le flag `online_play` est actif pour l'utilisateur
- THEN les points d'entree "Jouer en ligne" DOIVENT etre affiches
- AND la route `/me/matches` DOIT etre accessible

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

### Requirement: Bandeau « À la une » lisible sans texte en mouvement
Quand le flag `home_news_ticker` est actif et que l'API sert des éléments, la
home DOIT présenter les résultats de ligue et de coupe en cartes fixes et les
autres actualités (Gazette, inscriptions ouvertes) sur une ligne affichant un
seul élément à la fois. Aucun texte NE DOIT défiler en continu.

#### Scenario: Résultat en carte
- WHEN l'API sert un résultat de ligue « Rats 2 – 1 Nains »
- THEN une carte liée à la page de la compétition DOIT afficher les deux
  équipes, leur score et marquer « Rats » comme vainqueur
- AND l'âge de l'évènement DOIT être affiché en temps relatif

#### Scenario: Plusieurs actualités
- WHEN l'API sert plus d'une actualité hors résultats
- THEN la ligne DOIT en afficher une seule, avec des commandes
  « précédente », « suivante » et « pause »
- AND la rotation automatique NE DOIT PAS démarrer si l'utilisateur préfère
  réduire les animations

#### Scenario: Zone vide
- WHEN l'API ne sert que des résultats (ou que des actualités)
- THEN seule la zone concernée DOIT être rendue
