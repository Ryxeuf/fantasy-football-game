# league-match-sheet

## ADDED Requirements

### Requirement: Invalidation d'une feuille après le recrutement d'un joueur de feuille

Le garde-fou de reversion `purchase-consumed` DOIT comparer chaque joueur créé
par les achats du match à son état À LA CRÉATION, jamais à zéro. Un journalier
ou un mort relevé recruté à l'étape EMBAUCHES arrive avec 1 match joué, ses
PSP restants et l'évolution prise à l'étape 3 : ce qu'il a gagné en jouant CE
match n'est pas un usage postérieur et NE DOIT PAS empêcher le commissaire
d'invalider la feuille. Un joueur créé qui a rejoué, gagné des PSP, progressé
ou est mort DEPUIS sa création DOIT toujours bloquer la reversion.

La référence DOIT être consignée dans la trace des mutations à la validation
(`createdPlayers`) et, pour une feuille validée avant cette trace, être
redérivée des achats du snapshot sans backfill ; quand cette redérivation
n'est pas certaine (un achat créateur a été sauté), le garde-fou DOIT
retomber sur la comparaison à zéro plutôt que deviner.

L'invalidation DOIT retirer le joueur recruté du roster, rendre l'or et
ressusciter le mort adverse relevé ; une nouvelle validation DOIT le
recruter à nouveau.

#### Scenario: Mort relevé recruté, feuille invalidée
- WHEN le relevé a marqué un TD, pris une évolution, a été recruté (`raised_dead`) et que la feuille a été validée
- THEN le commissaire DOIT pouvoir l'invalider (200), le Zombie recruté DOIT quitter le roster, la trésorerie revenir à son état d'avant validation et le mort adverse être ressuscité
- AND le choix « Relever le Mort » DOIT être conservé sur la feuille invalidée

#### Scenario: Journalier recruté, feuille invalidée
- WHEN un journalier recruté (`journeyman`) a joué et pris une évolution sur ce match
- THEN l'invalidation DOIT être acceptée, le joueur retiré et le prix du recrutement rendu

#### Scenario: Recrutement qui a rejoué depuis
- WHEN le joueur recruté compte un match, des PSP ou un avancement DE PLUS qu'à sa création, ou est mort
- THEN la reversion DOIT être refusée avec `purchase-consumed`

#### Scenario: Feuille validée avant la trace
- WHEN le snapshot ne porte pas `createdPlayers` mais ses achats enrichis
- THEN la référence DOIT être redérivée des achats (un recrutement vaut ses PSP, son évolution et 1 match) et l'invalidation acceptée si rien n'a bougé depuis

#### Scenario: Re-validation après invalidation
- WHEN les deux coachs re-soumettent et le commissaire re-valide la feuille invalidée
- THEN le relevé DOIT être recruté à nouveau avec la même compétence et les mêmes PSP, et l'or crédité comme à la première validation
