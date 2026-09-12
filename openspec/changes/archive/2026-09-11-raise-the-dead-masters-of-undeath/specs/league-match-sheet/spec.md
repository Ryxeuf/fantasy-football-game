# league-match-sheet

## ADDED Requirements

### Requirement: Relever le Mort (Maîtres de la Non-vie)

Pour une équipe dont le roster porte la règle spéciale Maîtres de la Non-vie
(lue en base, catalogue du moteur en repli), la feuille de match DOIT exposer
les adversaires tués pendant ce match qui sont relevables — résultat Mort
consigné dans les évènements, Force 4 ou moins, sans le Trait Minus (`stunty`)
— et les postes de Trois-quart de sa fiche. Le coach de ce côté (ou le
commissaire) DOIT pouvoir relever UN de ces morts, au plus une fois par match,
en choisissant le poste quand la fiche en offre plusieurs ; le choix DOIT
pouvoir être annulé tant que la feuille n'est pas validée.

Le Trois-quart relevé est un joueur SYNTHÉTIQUE de la feuille (`raised-<side>-1`),
dérivé du choix stocké et des évènements : il DOIT disparaître si la sortie du
mort est retirée, porter les compétences de son poste SANS Solitaire, prendre
le numéro suivant ceux du roster et des journaliers, et garder le nom du mort.
Il DOIT être proposé comme acteur, cible et Joueur du Match, gagner des PSP et
pouvoir staguer une évolution comme un journalier.

#### Scenario: Adversaire tué relevable
- WHEN un Trois-quart adverse de Force 3 sans Minus subit un résultat Mort
- THEN la feuille DOIT le lister parmi les morts relevables du porteur de la règle, et PAS chez son adversaire

#### Scenario: Mort non relevable
- WHEN le mort a une Force de 5, ou porte le Trait Minus, ou appartient à l'équipe qui relève
- THEN il NE DOIT PAS être proposé, et le PATCH qui le désigne DOIT être refusé (400)

#### Scenario: Équipe sans la règle ou mauvais coach
- WHEN une équipe sans Maîtres de la Non-vie tente de relever, ou le coach adverse relève pour l'autre camp
- THEN le serveur DOIT répondre 409, respectivement 403

#### Scenario: Sortie retirée
- WHEN l'évènement de la mort du relevé est supprimé
- THEN le Trois-quart relevé NE DOIT plus apparaître sur la feuille

### Requirement: Recrutement gratuit du mort relevé

À l'étape EMBAUCHES, un achat de type `raised_dead` DOIT recruter le Trois-quart
relevé pour 0 pièce d'or, quel que soit le montant saisi : il rejoint le roster
au poste choisi, avec ses PSP du match, l'évolution prise à l'étape 3 (vérifiée
comme celle d'un journalier) et sans Solitaire ; sa valeur pleine (poste +
évolution) entre dans la Valeur d'Équipe. La feuille DOIT dire si l'embauche
est possible (`canHire`) : la liste d'équipe, morts de ce match retirés, doit
compter moins de 16 joueurs.

Un achat `raised_dead` sans relevé, en doublon, pour un relevé tué à son tour
ou pour une liste déjà à 16 DOIT retomber en dépense diverse à 0 : aucun
joueur créé, rien débité, évolution tracée « non recruté ».

#### Scenario: Recrutement avec évolution
- WHEN le relevé a marqué un TD (3 PSP), stagé un tirage « Hasard » servi par la feuille, et que le coach ajoute un achat `raised_dead` avec un montant de 40 000
- THEN la validation DOIT créer le joueur au poste choisi avec la compétence tirée et 0 PSP, débiter 0 pièce d'or, et tracer l'entrée « appliquée »

#### Scenario: Liste pleine
- WHEN la liste compte déjà 16 joueurs une fois les morts de ce match retirés
- THEN `canHire` DOIT être faux et l'achat `raised_dead` NE DOIT créer aucun joueur

### Requirement: Relecture fidèle des achats côté web

La relecture des achats stockés sur la feuille DOIT conserver le type de chaque
achat (`player`, `reroll`, `staff`, `other`, `journeyman`, `raised_dead`) et
l'identifiant du journalier recruté.

#### Scenario: Journalier relu après rechargement
- WHEN la feuille est rechargée avec un achat `journeyman` portant `journeymanId`
- THEN l'achat DOIT rester un recrutement de journalier avec le même identifiant
