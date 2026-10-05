# dice-themes

## ADDED Requirements

### Requirement: Le dé original est servi par défaut, partout
Le thème par défaut (`nuffle`) DOIT dessiner les faces PNG « original-or »
du Dé de Blocage et des dés numériques or & charbon, sur tout le site et
dans tous les simulateurs de dés (home, D8 d'amélioration, feuille de match,
match en ligne : popup de choix, journal, popup de résultat, plateau Pixi).

#### Scenario: Visiteur anonyme
- WHEN un visiteur non connecté affiche la home
- THEN les dés DOIVENT être les faces PNG du dé original

#### Scenario: Total de 2D6 sur le plateau
- WHEN le plateau anime un jet dont la valeur dépasse 6
- THEN le dé DOIT afficher la valeur chiffrée, pas des points

### Requirement: 36 thèmes, un registre de rendu partagé
Le catalogue DOIT compter le dé original, 4 déclinaisons et 31 thèmes
d'équipe ; chaque id du catalogue serveur DOIT avoir un skin dans
`@bb/ui/dice` et chaque PNG référencé DOIT exister en 64, 128 et 320 px.

#### Scenario: Thème du coach en match en ligne
- WHEN un coach a choisi un thème et ouvre un match en ligne
- THEN la popup de choix de blocage, le journal et le dé animé DOIVENT être dessinés dans ce thème

### Requirement: Le coach achète un thème en Crowns
Avec les flags `dice_themes` et `crowns`, `POST /dice-themes/:id/purchase`
DOIT débiter le prix, enregistrer l'acquisition, journaliser un débit `SINK`
(`dice-theme:<id>`) et équiper le thème, en une transaction.

#### Scenario: Solde insuffisant
- WHEN le solde est inférieur au prix
- THEN la réponse DOIT être 402 `insufficient-funds`, sans écriture

#### Scenario: Déjà possédé
- WHEN le coach possède déjà le thème
- THEN la réponse DOIT être 409 `theme-already-owned`, sans débit

#### Scenario: Retiré de la vente
- WHEN l'admin a retiré le thème de la vente
- THEN l'achat DOIT être refusé (409 `theme-not-for-sale`) et le thème masqué aux non-possédants
- AND un coach qui l'avait acheté DOIT le garder

### Requirement: L'admin gère le catalogue et les cosmétiques des coachs
L'admin DOIT pouvoir modifier libellés, prix, mise en vente et ordre d'un
thème (le défaut restant gratuit et en service), voir ses statistiques,
offrir ou retirer un thème à un coach (avec remboursement optionnel d'un
achat) et choisir le thème d'un coach parmi ceux qu'il possède.

#### Scenario: Retrait remboursé
- WHEN l'admin retire un thème acheté avec remboursement
- THEN le prix DOIT être recrédité (`ADMIN_REFUND`) et la préférence remise au défaut si le thème était choisi
