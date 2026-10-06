# league-match-sheet

## ADDED Requirements

### Requirement: Contagieux (Trait) — contamination sur blocage mortel

Pour une équipe dont un joueur de la feuille (roster, journalier aligné, Star
Player engagé) porte le Trait Contagieux (`contagieux` ou `plague-ridden`), la
feuille de match DOIT exposer la source `plague_ridden` et les adversaires
tués pendant ce match qui sont contaminables : résultat Mort consigné sur une
Élimination infligée par une Action de BLOCAGE dont l'auteur porte le Trait,
victime ni Gros Bras (Mot-clé du poste, base d'abord ; Solitaire en repli
sans mots-clés, jamais pour un Star Player), ni Décomposition, ni
Régénération, ni Minus — sans plafond de Force. Le coach de ce côté (ou le
commissaire) DOIT pouvoir contaminer UN de ces morts, au plus une fois par
match, par le même choix stocké que « Relever le Mort ».

Le Contaminé est le même joueur synthétique (`raised-<side>-1`), libellé
« Contaminé (<poste>) », dérivé du choix stocké et des évènements ; il DOIT
disparaître si la sortie, sa cause ou son auteur ne remplissent plus la règle.
Chaque adversaire relevable DOIT porter la règle qui l'y autorise (`source`) ;
quand les deux règles s'appliquent à la même victime, la gratuite (Maîtres de
la Non-vie) DOIT l'emporter.

#### Scenario: Blocage mortel d'un porteur du Trait
- WHEN un Pourri (Contagieux) tue un Trois-quart adverse sans Décomposition, Régénération ni Minus sur un blocage
- THEN la feuille DOIT le lister parmi les victimes du côté Nurgle avec `source: "plague_ridden"`, et rien chez l'adversaire

#### Scenario: Agression, ou auteur sans le Trait
- WHEN la mort survient lors d'une Agression, par le public, ou sur un blocage d'un joueur sans le Trait
- THEN la victime NE DOIT PAS être proposée, et le PATCH qui la désigne DOIT être refusé (400)

#### Scenario: Victime exclue par la règle
- WHEN le mort est un Gros Bras, ou porte Décomposition, Régénération ou Minus
- THEN il NE DOIT PAS être contaminable — alors qu'un mort de Force 5 sans ces Traits l'est

#### Scenario: Équipe sans aucune règle
- WHEN une équipe sans Maîtres de la Non-vie ni joueur Contagieux tente de relever
- THEN le serveur DOIT répondre 409

### Requirement: Recrutement du Contaminé au prix du poste

À l'étape EMBAUCHES, un achat `raised_dead` portant sur un Contaminé DOIT le
recruter « de la même manière qu'un journalier » : au prix de son poste plus
le surcoût de l'évolution prise à l'étape 3, quel que soit le montant saisi ;
il rejoint le roster avec ses PSP du match, sans Solitaire, et sa valeur
pleine entre dans la Valeur d'Équipe. La feuille DOIT exposer ce prix
(`raisedDead.hireCost`) et sa règle (`raisedDead.source`). Liste pleine,
doublon, relevé absent ou tué à son tour DOIVENT retomber en dépense diverse
à 0 comme pour un mort relevé.

#### Scenario: Contaminé recruté avec un 0 saisi
- WHEN le coach ajoute un achat `raised_dead` à 0 po pour un Contaminé qui a stagé un tirage « Hasard »
- THEN la validation DOIT créer le Trois-quart au poste de la fiche avec la compétence tirée et débiter le prix du poste plus le surcoût de l'évolution

#### Scenario: Mort relevé recruté avec un montant saisi
- WHEN le coach saisit 40 000 pour un mort relevé par Maîtres de la Non-vie
- THEN la validation NE DOIT rien débiter

## MODIFIED Requirements

### Requirement: Recrutement gratuit du mort relevé

À l'étape EMBAUCHES, un achat de type `raised_dead` portant sur un mort relevé
par **Maîtres de la Non-vie** DOIT recruter le Trois-quart relevé pour 0 pièce
d'or, quel que soit le montant saisi : il rejoint le roster au poste choisi,
avec ses PSP du match, l'évolution prise à l'étape 3 (vérifiée comme celle
d'un journalier) et sans Solitaire ; sa valeur pleine (poste + évolution)
entre dans la Valeur d'Équipe. La feuille DOIT dire si l'embauche est possible
(`canHire`) : la liste d'équipe, morts de ce match retirés, doit compter moins
de 16 joueurs. Le prix d'un relevé né d'une AUTRE règle (Contagieux) est fixé
par cette règle.

Un achat `raised_dead` sans relevé, en doublon, pour un relevé tué à son tour
ou pour une liste déjà à 16 DOIT retomber en dépense diverse à 0 : aucun
joueur créé, rien débité, évolution tracée « non recruté ».

#### Scenario: Recrutement avec évolution
- WHEN le relevé a marqué un TD (3 PSP), stagé un tirage « Hasard » servi par la feuille, et que le coach ajoute un achat `raised_dead` avec un montant de 40 000
- THEN la validation DOIT créer le joueur au poste choisi avec la compétence tirée et 0 PSP, débiter 0 pièce d'or, et tracer l'entrée « appliquée »

#### Scenario: Liste pleine
- WHEN la liste compte déjà 16 joueurs une fois les morts de ce match retirés
- THEN `canHire` DOIT être faux et l'achat `raised_dead` NE DOIT créer aucun joueur
