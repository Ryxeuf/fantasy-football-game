# dice-themes

## Purpose

Les dés du site — faces du Dé de Blocage et dés numériques (D6 à points, D3,
D8, D16, totaux de 2D6 chiffrés) — se dessinent dans un THÈME. Le thème par
défaut, le dé ORIGINAL or & charbon, est servi à tout le monde ; derrière le
flag `dice_themes`, un coach choisit le sien parmi 36 (le dé original, quatre
déclinaisons et 31 thèmes d'équipe), les thèmes payants s'achetant en
Couronnes (capacité `crowns`).

Trois choix tiennent la capacité : un seul registre de RENDU (`@bb/ui/dice`),
partagé par le site et le match en ligne, pour qu'un dé ait la même apparence
partout ; un catalogue « base d'abord » dont l'admin édite les libellés, les
prix et la mise en vente mais jamais les visuels ni les ids, qui restent un
contrat de code ; et une préférence résolue à la LECTURE — un thème inconnu,
retiré ou plus possédé retombe sur le dé original, seule l'écriture refuse.

Changes d'origine : `dice-themes` puis `dice-theme-shop-and-crowns`
(archivés le 2026-10-05).

## Requirements

### Requirement: Le dé original est servi par défaut, partout
Le thème par défaut (`nuffle`) DOIT dessiner les faces PNG « original-or » du
Dé de Blocage et les dés numériques or & charbon, sur tout le site et dans tous
les simulateurs de dés (home, D8 d'amélioration, feuille de match, match en
ligne : popup de choix, journal, popup de résultat, notifications, plateau
Pixi). Il DOIT être servi quand le flag `dice_themes` est inactif, pour un
visiteur anonyme, en cas d'erreur réseau, ou quand le thème stocké est
inconnu, retiré ou non possédé.

#### Scenario: Visiteur anonyme
- WHEN un visiteur non connecté affiche la home
- THEN les dés DOIVENT être les faces PNG du dé original
- AND aucune requête `/dice-themes/me` NE DOIT être émise

#### Scenario: Thème stocké retiré du catalogue
- WHEN la préférence stockée désigne un thème absent du catalogue ou non possédé
- THEN `GET /dice-themes/me` DOIT servir le thème par défaut

### Requirement: Un total de 2D6 n'est jamais dessiné en points
Un jet dont la valeur dépasse 6, ou dont la cible dépasse 6+ (armure,
blessure), DOIT être affiché chiffré, jamais comme un D6 à points.

#### Scenario: Jet d'armure sur le plateau
- WHEN le plateau anime un jet de 5 contre une cible de 9+
- THEN le dé DOIT afficher « 5 » chiffré, pas cinq points

### Requirement: 36 thèmes, un registre de rendu partagé
Le catalogue DOIT compter le dé original, 4 déclinaisons et 31 thèmes
d'équipe ; chaque id du catalogue serveur DOIT avoir un skin dans
`@bb/ui/dice` et chaque PNG référencé DOIT exister en 64, 128 et 320 px.

#### Scenario: Thème du coach en match en ligne
- WHEN un coach a choisi un thème et ouvre un match en ligne
- THEN la popup de choix de blocage, le journal et le dé animé DOIVENT être dessinés dans ce thème

### Requirement: Le coach choisit son thème dans la boutique
Quand le flag est actif, la boutique (`/me/dice-themes`) DOIT lister les
thèmes en vente et ceux que le coach possède, avec un aperçu de leurs faces,
marquer le thème actif et permettre de choisir un thème possédé. Le profil
DOIT montrer le thème actif et mener à la boutique.

#### Scenario: Choix d'un thème possédé
- WHEN le coach choisit un thème possédé
- THEN `PUT /dice-themes/me` DOIT l'enregistrer et le servir comme thème actif

#### Scenario: Thème inconnu ou non possédé
- WHEN `PUT /dice-themes/me` reçoit un thème inconnu
- THEN la réponse DOIT être 400 `unknown-theme`, sans écriture
- WHEN il reçoit un thème payant non possédé
- THEN la réponse DOIT être 403 `theme-not-owned`, sans écriture

### Requirement: Le coach achète un thème en Couronnes
Avec les flags `dice_themes` et `crowns`, `POST /dice-themes/:id/purchase`
DOIT débiter le prix, enregistrer l'acquisition, journaliser un débit `SINK`
(`dice-theme:<id>`) et équiper le thème, en une transaction. Un achat
pendant une impersonation admin DOIT être refusé.

#### Scenario: Solde insuffisant
- WHEN le solde est inférieur au prix
- THEN la réponse DOIT être 402 `insufficient-funds`, sans écriture

#### Scenario: Déjà possédé
- WHEN le coach possède déjà le thème
- THEN la réponse DOIT être 409 `theme-already-owned`, sans débit

#### Scenario: Achats simultanés
- WHEN deux achats concurrents dépassent ensemble le solde
- THEN un seul DOIT aboutir et le solde NE DOIT JAMAIS passer sous zéro

#### Scenario: Retiré de la vente
- WHEN l'admin a retiré le thème de la vente
- THEN l'achat DOIT être refusé (409 `theme-not-for-sale`) et le thème masqué aux non-possédants
- AND un coach qui l'avait acheté DOIT le garder

### Requirement: L'admin gère le catalogue et les cosmétiques des coachs
L'admin DOIT pouvoir modifier libellés, prix, mise en vente et ordre d'un
thème (le défaut restant gratuit et en service), voir ses statistiques,
offrir ou retirer un thème à un coach (avec remboursement optionnel d'un
achat) et choisir le thème d'un coach parmi ceux qu'il possède. Chaque
mutation DOIT être tracée dans le journal admin.

#### Scenario: Retrait remboursé
- WHEN l'admin retire un thème acheté avec remboursement
- THEN le prix DOIT être recrédité (`ADMIN_REFUND`) et la préférence remise au défaut si le thème était choisi

#### Scenario: Défaut verrouillé
- WHEN l'admin tente de rendre payant ou de retirer le thème par défaut
- THEN la réponse DOIT être 409 `default-theme-locked`, sans écriture
