# cup-team-roster

## Purpose

Consulter le roster d'une équipe inscrite à une coupe, depuis n'importe quel
endroit de la coupe. La fiche montre le roster d'INSCRIPTION — celui que
rejoue chaque rencontre, une coupe se jouant en résurrection — et les
statistiques DANS LA COUPE, dérivées des matchs locaux qu'elle matérialise.
Même mise en page que la fiche de roster d'une ligue, moins ce qui n'existe
pas en coupe (trésorerie, blessures durables, disponibilité).

Change d'origine : `cup-league-parity` (#1077, archivé le 2026-10-17).

## Requirements

### Requirement: Fiche de roster d'une équipe inscrite

`GET /cup/:id/teams/:teamId/roster-view` DOIT servir, à tout compte connecté
qui lit la coupe, le roster D'INSCRIPTION de l'équipe (joueurs, staff,
valeurs, Star Players inscrits, coups de pouce de création) avec la valeur
de chaque joueur et ses statistiques DANS LA COUPE (touchdowns,
éliminations sur blocage, passes, interceptions, agressions, rencontres
jouées). Un participant sans roster d'inscription DOIT retomber sur l'équipe
en direct, et la réponse DOIT le dire (`source`). Une équipe non inscrite à
la coupe DOIT répondre 404, un appel sans compte 401.

#### Scenario: Roster d'inscription
- WHEN un compte connecté consulte la fiche d'un inscrit
- THEN la fiche DOIT montrer le roster figé à l'inscription, `source: "registration"`

#### Scenario: Statistiques de coupe
- WHEN une feuille de la coupe est validée avec un touchdown et une élimination d'un joueur
- THEN la fiche DOIT lui compter 1 touchdown, 1 élimination et 1 rencontre jouée

#### Scenario: Équipe hors coupe
- WHEN on demande la fiche d'une équipe non inscrite
- THEN la réponse DOIT être 404

### Requirement: Tout nom d'équipe d'une coupe mène à son roster

Sur la page d'une coupe, le nom d'une équipe DOIT être un lien vers
`/cups/:id/teams/:teamId` dans la liste des inscrits (avec un bouton « Voir
le roster »), le classement général et par poule, les cartes de ronde
(exempt compris), le bracket de play-offs, le bracket chronologique, la liste
des matchs, les podiums et les classements individuels. Le résumé de la
feuille de match DOIT lier les deux équipes : en coupe pour tout lecteur, en
ligue pour les coachs du match et le commissaire.

#### Scenario: Depuis le classement
- WHEN un lecteur clique le nom d'une équipe au classement d'une coupe
- THEN il DOIT arriver sur la fiche de roster de cette équipe dans cette coupe
