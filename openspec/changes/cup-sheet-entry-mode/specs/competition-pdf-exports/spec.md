# competition-pdf-exports

## MODIFIED Requirements

### Requirement: Feuille de rencontre imprimable

La feuille de match (ligue et coupe) DOIT proposer une feuille de rencontre
PDF en A4 paysage comprenant : l'avant-match (identité figée, popularité,
coups de pouce, prières, météo, toss, forfait), une page par équipe listant
chaque joueur disponible avec une case par action saisissable sur le site, un
journal des évènements avec ses légendes (types, blessures, table de coup
d'envoi 2D6 du moteur), la fin de match dans l'ordre du livre et les
signatures. Les joueurs morts NE DOIVENT pas y figurer ; un absent DOIT être
grisé ; journaliers, Star Players engagés et joueur relevé DOIVENT être
listés. Une rencontre de coupe en saisie simplifiée DOIT n'imprimer que ce
que son formulaire demande.

#### Scenario: Feuille vierge
- WHEN aucune saisie n'a été faite sur la feuille du site
- THEN la feuille imprimée NE DOIT porter ni score, ni évènement, ni compteur

#### Scenario: Feuille déjà saisie
- WHEN des évènements, un avant-match ou des JDM sont saisis sur le site
- THEN ils DOIVENT être reportés sur la feuille imprimée

#### Scenario: Rencontre de coupe
- WHEN la rencontre appartient à une coupe
- THEN la feuille NE DOIT comporter ni colonne de PSP, ni gains, ni améliorations, ni embauches, ni erreurs coûteuses

#### Scenario: Rencontre de coupe en saisie simplifiée
- WHEN la rencontre appartient à une coupe en saisie simplifiée
- THEN la feuille DOIT comporter le forfait et, par équipe, une case par joueur pour les touchdowns, sorties sur blocage, sorties sur agression, passes réussies et interceptions, ainsi que les victimes des sorties
- AND elle NE DOIT comporter ni météo, ni pile ou face, ni popularité, ni coups de pouce, ni prières, ni table de coup d'envoi, ni légende de gravité des blessures
