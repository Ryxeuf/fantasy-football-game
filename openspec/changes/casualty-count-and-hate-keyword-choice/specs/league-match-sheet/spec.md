# league-match-sheet

## ADDED Requirements

### Requirement: Haine (X) — le mot-clé haï se choisit

Un joueur qui gagne Haine (X) hait un Mot-clé de celui qui l'a blessé, et un
joueur en porte souvent plusieurs (un Zombie est *Humain* ET *Morts-Vivants*).
La feuille DOIT exposer, pour chaque joueur candidat au jet de Haine, l'auteur
de sa blessure et TOUS ses mots-clés éligibles (les mots-clés de POSTE restent
exclus), ainsi que le choix courant.

Le coach du côté de la victime, ou le commissaire, DOIT pouvoir retenir l'un
de ces mots-clés tant que la feuille est éditable. Le choix est STOCKÉ ; le
candidat reste DÉRIVÉ des évènements et des mots-clés de l'auteur.

À la validation, le mot-clé retenu DOIT être celui choisi s'il figure encore
parmi les éligibles de l'auteur, sinon le premier éligible — une feuille sans
choix se valide donc exactement comme avant.

#### Scenario: Deux lignées possibles
- WHEN un Zombie (Humain, Morts-Vivants) met un adversaire sur la touche
- THEN la feuille DOIT proposer « Humain » et « Morts-Vivants » pour ce blessé

#### Scenario: Choix retenu
- WHEN le coach retient « Morts-Vivants » et que la feuille est validée sur un 4+
- THEN le joueur DOIT gagner « Haine (Morts-Vivants) »

#### Scenario: Choix devenu ineligible
- WHEN l'auteur de la blessure est corrigé et que le mot-clé retenu n'est plus le sien
- THEN la validation DOIT retomber sur le premier mot-clé éligible du nouvel auteur

#### Scenario: Côté adverse
- WHEN un coach tente de choisir le mot-clé d'un blessé de l'équipe adverse
- THEN le serveur DOIT refuser (403)
