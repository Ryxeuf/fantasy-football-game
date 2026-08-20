# admin-data-forms (delta)

Capability : formulaires d'administration des données de jeu (positions,
Star Players) — saisie des listes à catalogue (compétences, règles de
recrutement, rosters).

## ADDED Requirements

### Requirement: Sélecteur multiple unifié à catalogue
Les formulaires d'admin data DOIVENT saisir les listes à catalogue via un
sélecteur commun : valeurs choisies affichées en chips retirables, ajout
par recherche avec suggestions, suggestions groupées par catégorie quand
le catalogue est groupé.

#### Scenario: Compétences d'un Star Player comme celles d'une position
- WHEN un admin édite les compétences d'un Star Player
- THEN la visualisation et l'ajout DOIVENT se faire avec le même sélecteur que les compétences d'une position

#### Scenario: Règles de recrutement et rosters spécifiques
- WHEN un admin édite le bloc « Recrutable par » d'un Star Player
- THEN les règles/ligues régionales et les rosters spécifiques DOIVENT utiliser ce même sélecteur, en deux listes indépendantes

### Requirement: Valeurs hors catalogue jamais perdues
Une valeur déjà enregistrée mais absente du catalogue courant DOIT rester
visible (signalée « hors catalogue ») et DOIT être conservée à
l'enregistrement tant qu'elle n'est pas retirée explicitement.

#### Scenario: Slug hérité d'un autre ruleset
- WHEN un Star Player porte une compétence absente du catalogue du ruleset affiché
- THEN elle apparaît en chip « hors catalogue » et est réémise telle quelle à l'enregistrement

### Requirement: Sémantique de recrutement inchangée
Le payload des règles de recrutement d'un Star Player DOIT rester :
chaînes pour les règles globales, couples `{ rule, rosterId }` pour les
rosters explicitement autorisés.

#### Scenario: Roster ciblé
- WHEN un admin ajoute un roster spécifique puis enregistre
- THEN l'entrée émise porte le couple règle + identifiant du roster
