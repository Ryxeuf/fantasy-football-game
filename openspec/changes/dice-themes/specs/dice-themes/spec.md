# dice-themes

## ADDED Requirements

### Requirement: Les dés se dessinent dans le thème du coach
Toute face de Dé de Blocage ou de D6 affichée par le site DOIT passer par
`BlockDieIcon` / `D6Icon`, qui dessinent dans le thème de dés effectif du
coach. Le thème effectif est le thème par défaut quand le flag `dice_themes`
est inactif, pour un visiteur anonyme, en cas d'erreur réseau, ou quand le
thème stocké est inconnu ou non possédé.

#### Scenario: Flag inactif
- WHEN le flag `dice_themes` est inactif pour le coach
- THEN les dés DOIVENT être dessinés dans le thème par défaut
- AND aucune requête `/dice-themes/me` NE DOIT être émise

#### Scenario: Thème stocké retiré du catalogue
- WHEN la préférence stockée désigne un thème absent du catalogue
- THEN `GET /dice-themes/me` DOIT servir le thème par défaut

### Requirement: Le coach choisit son thème depuis son profil
Quand le flag est actif, le profil DOIT lister les thèmes du catalogue avec
un aperçu de leurs faces, marquer le thème actif, permettre de choisir un
thème possédé, et afficher verrouillé (avec son prix en Crowns) un thème
payant non possédé.

#### Scenario: Choix d'un thème possédé
- WHEN le coach choisit un thème possédé
- THEN `PUT /dice-themes/me` DOIT l'enregistrer et le servir comme thème actif

#### Scenario: Thème inconnu ou non possédé
- WHEN `PUT /dice-themes/me` reçoit un thème inconnu
- THEN la réponse DOIT être 400 `unknown-theme`, sans écriture
- WHEN il reçoit un thème payant non possédé
- THEN la réponse DOIT être 403 `theme-not-owned`, sans écriture
