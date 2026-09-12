# league-match-sheet

## Purpose

La saisie de feuille de match de ligue physique (avant-match, évènements, fin
de match), alignée sur les règles officielles Blood Bowl, avec les données de
référence (météo, coups de pouce, budgets) fournies par le serveur — plus les
compléments d'ergonomie qui la rendent tenable en bord de table :
différenciation visuelle des équipes, accès aux coups de pouce par roster,
auto-calculs de fin de match et édition des évolutions de joueurs.

Le résumé de la feuille porte UNE définition de la sortie — une élimination
qui rapporte des PSP — dont dérivent le classement, les points bonus et les
classements individuels ; les feuilles validées sous une définition antérieure
se resynchronisent sans rejouer la fin de match.

Les règles spéciales qui font naître un joueur PENDANT le match (Maîtres de
la Non-vie : le mort relevé) sont portées par la feuille comme des joueurs
SYNTHÉTIQUES dérivés du choix stocké et des évènements — jamais persistés
avant leur recrutement d'après-match, gratuit mais à valeur pleine.

## Requirements

### Requirement: Coups de pouce accessibles par équipe
Chaque équipe NE DOIT se voir proposer QUE les coups de pouce et star
players réellement accessibles à son roster selon les règles, avec le coût
effectif (rabais régional appliqué).

#### Scenario: Filtre d'accès apothicaire
- WHEN un roster a accès à l'apothicaire
- THEN l'« apothicaire itinérant » DOIT être proposé et « Igor » NE DOIT PAS l'être (et inversement pour un roster sans accès apothicaire)

#### Scenario: Coût régional
- WHEN un roster bénéficie d'un rabais régional sur un coup de pouce
- THEN le coût proposé DOIT être le coût réduit

### Requirement: Différenciation visuelle des équipes par couleur
La feuille DOIT colorer les éléments propres à chaque équipe à partir d'une
couleur dérivée de son roster, afin d'identifier l'équipe d'un coup d'œil.

#### Scenario: Timeline colorée
- WHEN un évènement est attribué à une équipe
- THEN sa ligne de timeline DOIT porter la couleur de cette équipe

#### Scenario: En-tête coloré
- WHEN le récap du match est affiché
- THEN chaque équipe DOIT être associée à sa couleur dans l'en-tête

### Requirement: Saisie d'évènements prioritaire à l'écran
Le bloc de saisie d'un évènement DOIT être positionné avant la timeline, de
sorte qu'ajouter un évènement ne nécessite pas de faire défiler la liste.

#### Scenario: Ajout sans défilement
- WHEN la liste contient de nombreux évènements
- THEN le formulaire d'ajout DOIT rester accessible en haut de la section

### Requirement: Auto-calcul des récompenses de fin de match
La feuille DOIT calculer automatiquement ce qui est déterministe par les
règles (SPP par joueur depuis les évènements, gains depuis la popularité) et
NE demander une saisie manuelle que pour les éléments non déterministes
(jets de dé, choix). Le SPP affiché DOIT correspondre au calcul appliqué.

#### Scenario: SPP par joueur
- WHEN des évènements (TD, sorties, passes, interceptions, MVP) sont saisis
- THEN le SPP de chaque joueur DOIT être calculé et affiché, et appliqué tel quel à la validation

#### Scenario: Gains automatiques
- WHEN le facteur de popularité est saisi
- THEN les gains DOIVENT être calculés automatiquement (override possible)

### Requirement: Évolutions de joueurs depuis la feuille, après validation
Le coach DOIT pouvoir réaliser les évolutions de ses joueurs (compétences /
améliorations de caractéristique) directement depuis la feuille de match,
une fois celle-ci validée par le commissaire. Les évolutions NE DOIVENT être
appliquées au roster qu'après cette validation.

#### Scenario: Édition inline après validation
- WHEN le match est validé et le coach ouvre l'onglet Évolutions
- THEN il DOIT pouvoir choisir et appliquer les avancements de ses joueurs éligibles sans quitter la feuille

#### Scenario: Aucune évolution avant validation
- WHEN le match n'est pas encore validé
- THEN aucune évolution NE DOIT être applicable et l'interface DOIT l'indiquer

### Requirement: Identité et valeur d'équipe sur la feuille
La feuille DOIT exposer, pour chaque équipe, sa **race** (libellé du
roster), son **coach** (owner), sa **TV** (valeur d'équipe actuelle) et
sa **cagnotte** (trésorerie). Ces informations DOIVENT être affichées sur
le résumé du match.

#### Scenario: Badges race + coach
- WHEN un coach ou le commissaire ouvre la feuille
- THEN chaque équipe DOIT afficher un badge race et un badge coach sous son nom

#### Scenario: TV et cagnotte affichées
- WHEN la feuille est chargée
- THEN la TV (VEA) et la cagnotte de chaque équipe DOIVENT être affichées

### Requirement: Tables météo officielles et météo dépendante
La feuille DOIT proposer l'ensemble des tables météo du moteur. La météo
sélectionnable DOIT dépendre de la table choisie (résultats 2..12 de
cette table). La **conséquence informative** de la météo sélectionnée
DOIT être affichée.

#### Scenario: La météo dépend de la table
- WHEN aucune table météo n'est choisie
- THEN le sélecteur de météo DOIT être désactivé
- WHEN une table est choisie
- THEN le sélecteur de météo DOIT lister les conditions (roll → condition) de cette table

#### Scenario: Conséquence de la météo
- WHEN une météo est sélectionnée
- THEN sa conséquence (description de la règle) DOIT être affichée à titre informatif

#### Scenario: Changement de table
- WHEN la table météo est modifiée
- THEN la météo précédemment choisie DOIT être réinitialisée

### Requirement: Coups de pouce issus du catalogue officiel
Les coups de pouce NE DOIVENT PLUS être une saisie libre : ils DOIVENT
être choisis dans le catalogue officiel et parmi les Star Players
disponibles pour le roster de l'équipe. Le coût DOIT être pré-rempli et
la quantité bornée par la limite du catalogue (1 pour un Star Player).

#### Scenario: Ajout depuis le catalogue
- WHEN un coach ajoute un coup de pouce
- THEN il DOIT le choisir dans le catalogue (ou parmi les Star Players de son équipe)
- AND le coût DOIT être renseigné automatiquement

#### Scenario: Quantité bornée
- WHEN un coup de pouce a une quantité maximale
- THEN la quantité saisie NE DOIT PAS dépasser cette limite

### Requirement: Budget des coups de pouce (petty cash + trésorerie)
Le budget de coups de pouce d'une équipe DOIT être calculé selon les
règles officielles : petty cash (différence de CTV pour l'équipe la moins
chère) + trésorerie. Une sélection dépassant ce budget DOIT être empêchée
côté interface ET rejetée côté serveur.

#### Scenario: Budget affiché
- WHEN la feuille est chargée
- THEN le petty cash, la trésorerie et le budget total de chaque équipe DOIVENT être affichés

#### Scenario: Dépassement bloqué côté UI
- WHEN la sélection de coups de pouce dépasse le budget
- THEN l'enregistrement de l'avant-match DOIT être désactivé

#### Scenario: Dépassement rejeté côté serveur
- WHEN une sélection hors budget est soumise à `updatePreMatch`
- THEN la requête DOIT être rejetée (`inducement_over_budget`) sans modification

#### Scenario: Comptabilité petty cash à la validation
- WHEN le match est validé par le commissaire
- THEN la trésorerie NE DOIT être débitée que de l'excédent des coups de pouce au-delà du petty cash reçu

### Requirement: Mi-temps et tour des évènements
Chaque évènement de match DOIT pouvoir porter une **mi-temps** (1 ou 2) et
un **tour**. Ces valeurs DOIVENT être persistées et affichées à côté de
l'évènement.

#### Scenario: Saisie mi-temps + tour
- WHEN un coach ajoute un évènement avec une mi-temps et un tour
- THEN la mi-temps et le tour DOIVENT être enregistrés (dans `meta`)

#### Scenario: Affichage
- WHEN la liste des évènements est rendue
- THEN la mi-temps et le tour de chaque évènement (s'ils existent) DOIVENT être affichés

### Requirement: Timeline chronologique des évènements
La liste des évènements DOIT être affichée dans l'ordre chronologique :
par mi-temps croissante puis par tour croissant, l'ordre de saisie servant
de départage stable. Les évènements sans mi-temps/tour DOIVENT rester
affichables (traités comme début de 1re mi-temps).

#### Scenario: Tri par mi-temps puis tour
- WHEN plusieurs évènements ont des mi-temps/tours différents
- THEN ils DOIVENT être ordonnés par mi-temps puis par tour, indépendamment de leur ordre de saisie

#### Scenario: Départage stable
- WHEN deux évènements ont la même mi-temps et le même tour
- THEN leur ordre relatif de saisie DOIT être conservé

### Requirement: Navigation par phase (onglets)
La saisie DOIT être organisée en trois phases navigables — avant-match,
en cours, fin du match — sur une seule page, sans rechargement ni perte
de l'état de saisie en changeant de phase. Le résumé du match, les
actions de validation (coach / commissaire) et l'invalidation DOIVENT
rester accessibles quelle que soit la phase active.

#### Scenario: Changement de phase
- WHEN l'utilisateur sélectionne une autre phase
- THEN le contenu correspondant DOIT s'afficher sans rechargement de page
- AND l'état de saisie des autres phases NE DOIT PAS être perdu

#### Scenario: Actions toujours accessibles
- WHEN une phase quelconque est active
- THEN le résumé et les actions de workflow DOIVENT rester visibles

### Requirement: Une sortie est une élimination qui rapporte des PSP

Le résumé d'une feuille de match (`casualtiesHome/Away` par équipe,
`casualtiesInflicted` par joueur) NE DOIT compter que les éliminations qui
rapportent les PSP d'Élimination à leur auteur, selon une définition UNIQUE
(`eliminationEarnsSpp`) :

- une Élimination sur Blocage (blitz compris) compte toujours ;
- une Élimination sur Action Spéciale compte si son auteur a « Innovateur
  Violent » au coup d'envoi ;
- une Élimination en atterrissant sur un adversaire compte si le joueur
  lancé a « Vol Fatal » au coup d'envoi ;
- une Élimination lors d'une Agression compte si le côté de l'auteur a
  obtenu la Prière à Nuffle 13 « Frénésie d'Agression » ;
- une sortie par le public, une esquive ratée, une chute ou une
  temporisation ne comptent jamais.

Les compétences DOIVENT être lues dans le gel de la feuille (« version du
match »), les Prières dans les colonnes d'avant-match de la feuille. Une
agression DOIT rester comptée dans les agressions et sa blessure consignée,
que la sortie compte ou non. Les sorties d'équipe DOIVENT être la somme des
sorties créditées aux joueurs, à l'exception d'une Élimination sur Blocage
saisie sans acteur, qui compte pour l'équipe seule.

#### Scenario: Agression qui blesse, sans prière
- WHEN une feuille porte 4 Éliminations sur Blocage et 1 agression avec blessure pour l'équipe domicile
- THEN `casualtiesHome` DOIT valoir 4
- AND l'agresseur DOIT avoir `aggressions = 1` et `casualtiesInflicted = 0`
- AND la victime de l'agression DOIT figurer parmi les blessés

#### Scenario: Agression sous Frénésie d'Agression
- WHEN l'équipe domicile a obtenu la Prière 13 et qu'un de ses joueurs blesse un adversaire lors d'une Agression
- THEN cette agression DOIT compter comme sortie de l'équipe domicile et créditer `casualtiesInflicted` à son auteur
- AND une agression de l'équipe extérieure NE DOIT PAS compter (la prière ne bénit que son côté)

#### Scenario: Action Spéciale et atterrissage sans la compétence
- WHEN un joueur sans « Innovateur Violent » élimine un adversaire par une Action Spéciale, et qu'un joueur lancé sans « Vol Fatal » en élimine un autre en atterrissant
- THEN aucune des deux éliminations NE DOIT compter dans les sorties de l'équipe
- AND les deux victimes DOIVENT figurer parmi les blessés

#### Scenario: Même résultat à la lecture et à la validation
- WHEN une feuille est lue puis validée
- THEN les sorties et les PSP affichés DOIVENT être exactement ceux persistés par la validation (mêmes options de summarizer)

### Requirement: Resynchronisation des sorties d'une feuille validée

Le serveur DOIT permettre de resynchroniser les compteurs persistés d'une
feuille de LIGUE déjà validée avec la définition courante d'une sortie, sans
rejouer la séquence de fin de match : sorties pour / contre des deux
participants, `totalCasualties` et PSP de chaque joueur (au barème du côté),
points bonus du pairing (règles de la ligue ré-évaluées, bonus commissaire
conservé) et snapshot `offlineResultInput`. L'opération DOIT être
idempotente, journalisée dans le journal des deux équipes, et DOIT ignorer
les rencontres de coupe, les feuilles non validées et les saisons clôturées.

#### Scenario: Feuille validée sous l'ancienne règle
- WHEN une feuille validée persiste 5 sorties domicile dont 1 agression, et que sa relecture n'en compte que 4
- THEN la resynchronisation DOIT retirer 1 sortie pour au domicile et 1 sortie contre à l'extérieur
- AND retirer 1 sortie de carrière et 2 PSP (3 en Bagarreurs Brutaux) à l'agresseur
- AND réécrire le snapshot avec 4 sorties, de sorte qu'une invalidation ultérieure reprenne 4

#### Scenario: Feuille déjà à jour
- WHEN les compteurs persistés correspondent à la relecture
- THEN la resynchronisation NE DOIT rien écrire

#### Scenario: Simulation
- WHEN la resynchronisation est lancée sans `apply`
- THEN le plan DOIT être calculé et rendu sans aucune écriture

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
