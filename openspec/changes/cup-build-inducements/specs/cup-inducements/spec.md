# cup-inducements

## Purpose

Le régime des coups de pouce d'une coupe : achetés une fois à la création de
l'équipe (logique de tournoi), achetés avant chaque match, ou absents — et
tout ce qui en découle du builder à la feuille de match.

## ADDED Requirements

### Requirement: Mode de coups de pouce d'une coupe

Chaque coupe DOIT porter un mode : `build` (achat à la création, valable à
chaque ronde), `match` (achat d'avant-match) ou `none` (aucun coup de pouce).
Une coupe antérieure au réglage DOIT se lire en `match`, sans reprise de
données. `GET /cup/:id` DOIT servir le mode effectif.

#### Scenario: Coupe antérieure au réglage
- **WHEN** une coupe existait avant l'introduction du mode
- **THEN** son mode effectif DOIT être `match`

#### Scenario: Mode servi à la lecture
- **WHEN** un coach consulte une coupe en `build`
- **THEN** `GET /cup/:id` DOIT servir `inducementMode = "build"`

### Requirement: Mode d'une coupe neuve

Une coupe BB11 créée sans choix explicite DOIT être enregistrée en `build`.
Une coupe sous règlement de tournoi DOIT être en `build`, quelle que soit la
valeur demandée. Une coupe à Sept NE DOIT PAS pouvoir être en `build` :
sans choix, elle DOIT être enregistrée en `match`, et une demande explicite
de `build` DOIT être refusée (400).

#### Scenario: Coupe BB11 sans choix
- **WHEN** un commissaire crée une coupe BB11 sans préciser le mode
- **THEN** la coupe DOIT être enregistrée en `build`

#### Scenario: Coupe à règlement
- **WHEN** un commissaire crée une coupe NAF WC 2027 en demandant `match`
- **THEN** la coupe DOIT être enregistrée en `build`

#### Scenario: Coupe à Sept
- **WHEN** un commissaire crée une coupe à Sept en demandant `build`
- **THEN** la création DOIT être refusée (400)

### Requirement: Mode modifiable jusqu'à la clôture des inscriptions

Le mode et la liste autorisée DOIVENT être modifiables par le commissaire
avec les règles de composition, tant que les inscriptions sont ouvertes
(un administrateur garde la main après). Les règles imposées par la
création (règlement ⇒ `build`, Sept ⇒ pas de `build`) DOIVENT tenir aussi
à la modification.

#### Scenario: Inscriptions closes
- **WHEN** le commissaire change le mode d'une coupe validée
- **THEN** la requête DOIT être refusée (400) et le mode inchangé

#### Scenario: Coupe à règlement
- **WHEN** le commissaire demande `none` sur une coupe NAF WC 2027
- **THEN** la coupe DOIT rester en `build`

### Requirement: Liste autorisée d'une coupe sans règlement

Une coupe sans règlement DOIT pouvoir restreindre les coups de pouce à une
liste choisie par le commissaire ; sans liste, tout le catalogue à prix fixe
est autorisé. Sous règlement, la liste fermée et les prix du règlement
priment, et la liste de la coupe NE DOIT PAS pouvoir y ajouter un coup de
pouce.

#### Scenario: Coupe sans liste
- **WHEN** une coupe en `build` sans règlement ne restreint rien
- **THEN** le builder DOIT proposer tout le catalogue à prix fixe accessible au roster

#### Scenario: Coupe avec liste
- **WHEN** la coupe n'autorise que la Mascotte et les Fûts de Blitz Premium
- **THEN** le builder et le serveur DOIVENT refuser tout autre coup de pouce

### Requirement: Achat de coups de pouce au builder

Le builder DOIT proposer une section de coups de pouce quand l'équipe est
construite pour une coupe en `build` ou sous un règlement de tournoi, et
dans aucun autre cas. Chaque option DOIT afficher son prix pour CE roster et
sa quantité maximale, et le total DOIT être compté dans le budget restant.

#### Scenario: Construction pour une coupe en build
- **WHEN** un coach ouvre `/me/teams/new?cupId=<coupe en build>`
- **THEN** une section « Coups de pouce » DOIT être proposée, avec le total déduit du budget restant

#### Scenario: Jeu libre
- **WHEN** un coach construit une équipe hors coupe et hors règlement
- **THEN** aucune section de coups de pouce NE DOIT être proposée

### Requirement: Catalogue du builder servi par le serveur

Le serveur DOIT servir au builder le catalogue effectif d'un roster dans son
contexte (édition, Ligue régionale, règlement, coupe) : coups de pouce
accessibles au roster, prix après remises, quantité maximale. Les coups de
pouce à coût variable et les Star Players NE DOIVENT PAS y figurer, les Star
Players gardant leur propre sélecteur.

#### Scenario: Remise régionale ou de règle spéciale
- **WHEN** le builder demande le catalogue d'une équipe goblin en coupe en `build`
- **THEN** les Pots-de-vin DOIVENT être servis à 50 000 po, jusqu'à 6

#### Scenario: Coût variable exclu
- **WHEN** le builder demande le catalogue d'une coupe sans liste
- **THEN** les Joueurs Mercenaires NE DOIVENT PAS être proposés

### Requirement: Validation serveur des coups de pouce au build

`POST /team/build` DOIT accepter une liste `{ slug, quantité }` et refuser
(400) tout coup de pouce hors contexte, hors catalogue effectif, au-delà de
sa quantité maximale, ou faisant dépasser le budget d'or. Le prix DOIT être
recalculé par le serveur ; un montant envoyé par le client DOIT être ignoré.

#### Scenario: Hors contexte
- **WHEN** un build hors coupe et hors règlement porte une Mascotte
- **THEN** la création DOIT être refusée (400)

#### Scenario: Budget dépassé
- **WHEN** joueurs, staff, Star Players et coups de pouce dépassent le budget d'or
- **THEN** la création DOIT être refusée (400) en détaillant la part des coups de pouce

#### Scenario: Prix du client ignoré
- **WHEN** le body annonce une Mascotte à 0 po
- **THEN** la Mascotte DOIT être facturée au prix du catalogue effectif

### Requirement: Coups de pouce rattachés à l'équipe

Les coups de pouce achetés au build DOIVENT être enregistrés sur l'équipe
avec leur prix unitaire figé à l'achat. Ils NE DOIVENT entrer ni dans la VE
ni dans la VEA, et DOIVENT compter dans la dépense de construction. La
création DOIT les tracer dans le journal d'équipe.

#### Scenario: Équipe créée
- **WHEN** une équipe est construite avec une Mascotte et deux Fûts
- **THEN** l'équipe DOIT porter ces coups de pouce et leur prix
- **AND** sa VE DOIT être identique à celle de la même équipe sans eux

#### Scenario: Journal
- **WHEN** l'équipe est créée
- **THEN** l'étape `team.create` du journal DOIT détailler les coups de pouce achetés

### Requirement: Fiche d'équipe

La fiche d'une équipe DOIT afficher ses coups de pouce achetés à la création
(nom, quantité, coût) et les compter dans le résumé de budget, à côté des
Star Players.

#### Scenario: Fiche
- **WHEN** un coach ouvre la fiche d'une équipe portant une Mascotte
- **THEN** la Mascotte DOIT être listée et son coût compté dans la dépense

### Requirement: Coups de pouce figés à l'inscription

Le roster d'inscription d'une coupe en `build` DOIT figer les coups de pouce
de l'équipe. Une modification ultérieure de l'équipe NE DOIT PAS changer
ceux d'une rencontre de la coupe. Un roster d'inscription antérieur à cette
fonctionnalité DOIT se lire sans coup de pouce.

#### Scenario: Snapshot
- **WHEN** une équipe portant une Mascotte s'inscrit à une coupe en `build`
- **THEN** chaque feuille de la coupe DOIT lui servir la Mascotte

#### Scenario: Snapshot ancien
- **WHEN** un roster d'inscription a été figé avant la fonctionnalité
- **THEN** la feuille DOIT s'ouvrir sans coup de pouce pour cette équipe

### Requirement: Feuille d'une coupe en build

En `build`, la feuille DOIT rappeler en lecture seule, dans les deux modes
de saisie, les coups de pouce figés de chaque équipe, et NE DOIT proposer
aucun achat d'avant-match. Le serveur DOIT refuser (400) une sélection
d'avant-match sur une telle feuille.

#### Scenario: Rappel
- **WHEN** un coach ouvre la feuille d'une rencontre de coupe en `build`
- **THEN** les coups de pouce figés des deux équipes DOIVENT être affichés, sans contrôle de saisie

#### Scenario: Achat refusé
- **WHEN** un PATCH d'avant-match porte des coups de pouce sur une coupe en `build`
- **THEN** il DOIT être refusé (400) sans modification

### Requirement: Feuille d'une coupe sans coups de pouce

En `none`, la feuille NE DOIT proposer aucun achat de coup de pouce et le
serveur DOIT refuser (400) toute sélection d'avant-match. Les Star Players
du roster d'inscription jouent toujours le match.

#### Scenario: Achat refusé
- **WHEN** un PATCH d'avant-match porte des coups de pouce sur une coupe en `none`
- **THEN** il DOIT être refusé (400) sans modification

### Requirement: Inscription d'une équipe qui porte des coups de pouce

L'inscription d'une équipe portant des coups de pouce DOIT être refusée,
avec un message qui le dit, si la coupe n'est pas en `build` ou si l'un
d'eux est hors du catalogue effectif de la coupe. Le message DOIT orienter
vers « Adapter à la coupe ».

#### Scenario: Coupe en match
- **WHEN** une équipe portant une Mascotte s'inscrit telle quelle à une coupe en `match`
- **THEN** l'inscription DOIT être refusée avec le code `inducement_not_allowed`

### Requirement: Budget d'inscription sur la dépense

L'inscription telle quelle à une coupe qui fixe un budget DOIT comparer ce
budget à la dépense de construction de l'équipe (joueurs, relances, staff,
Star Players, coups de pouce), plus à sa VE.

#### Scenario: Star Players hors VE
- **WHEN** une équipe de VE 1 000 kpo qui a payé 150 kpo de Star Players s'inscrit à une coupe à 1 000 kpo
- **THEN** l'inscription DOIT être refusée (`budget_exceeded`)

### Requirement: Adapter une équipe à la coupe

« Adapter à la coupe » DOIT recopier les coups de pouce de l'équipe de base
que la coupe autorise, au prix effectif de la coupe, et signaler ceux qui
sont écartés.

#### Scenario: Coup de pouce écarté
- **WHEN** l'équipe de base porte un Mage Météo et la coupe ne l'autorise pas
- **THEN** le builder DOIT préremplir les autres et signaler le Mage Météo comme écarté
