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
