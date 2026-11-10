# tournament-ruleset

## Purpose

Règlements de tournoi (« rules packs ») sélectionnables à la
création d'équipe — axe orthogonal à l'édition (`ruleset`) et au `format` —
imposant budget d'or, budget de SPP, restrictions de Star Players et cumul de
compétences, et imposables par une ligue ou une coupe à ses participants.
Premier pack : NAF World Cup 2027 (V2.1).

## Requirements

### Requirement: Registre pur des règlements de tournoi
Le package `@bb/game-engine` DOIT exposer un registre
`TOURNAMENT_RULESETS` de définitions pures (slug, libellés, version,
édition et format requis, règles par roster — budget d'or en kpo, budget
SPP, cumul de compétences, autorisation Star Players —, barème d'achat de
compétences, Star Players bannis, taxe SPP par tranche, inducements
autorisés, scoring, résurrection). Le NAF World Cup 2027 V2.1 DOIT couvrir
exactement les 31 rosters de l'édition season_3.

#### Scenario: Définition NAF World Cup 2027 fidèle au pack
- WHEN on lit `NAF_WORLD_CUP_2027`
- THEN les budgets d'or DOIVENT être limités aux valeurs {1080, 1100, 1140, 1160, 1180, 1200} kpo
- AND les budgets SPP aux valeurs {44, 52, 58, 60, 66}
- AND les 9 rosters étoilés (black_orc, bretonnian, chaos_renegade, gnome, goblin, halfling, norse, ogre, snotling) DOIVENT être les seuls autorisés à recruter des Star Players

#### Scenario: Slug inconnu
- WHEN un slug absent du registre est résolu (`getTournamentRuleset`)
- THEN la résolution DOIT renvoyer null (et les couches serveur DOIVENT refuser en 400, sans fallback silencieux)

### Requirement: Choix du règlement à la création d'équipe
La création d'équipe (`POST /team/build`, `POST /team/create-from-roster`)
DOIT accepter un champ optionnel `tournamentRuleset` (défaut : aucun).
Quand un règlement est actif, le serveur DOIT imposer le budget d'or et le
pool de SPP du tier du roster (valeurs client ignorées), exiger l'édition
et le format du pack, refuser les rosters absents du pack, et persister le
slug sur l'équipe. Sans règlement, le comportement DOIT rester identique à
l'historique.

#### Scenario: Budget et pool imposés
- WHEN un coach construit une équipe orc avec `tournamentRuleset=naf_world_cup_2027` et `teamValue=2000`
- THEN l'équipe DOIT être créée avec un budget de 1080 kpo et un pool de 44 SPP
- AND `tournamentRuleset` DOIT valoir `naf_world_cup_2027` sur l'équipe

#### Scenario: Édition incompatible refusée
- WHEN le body demande `ruleset=season_2` avec le NAF World Cup 2027
- THEN la création DOIT être refusée (400)

### Requirement: Restrictions de Star Players du règlement
Sous un règlement, le recrutement de Star Players DOIT être refusé pour un
roster non marqué d'une étoile, refusé pour tout Star Player banni par le
pack, et la taxe SPP (par tranche de coût cumulé des stars, en kpo) DOIT
être déduite du pool avant l'achat de compétences.

#### Scenario: Star banni
- WHEN une équipe goblin sous NAF WC 2027 tente de recruter `morg_n_thorg`
- THEN la création DOIT être refusée (400) en nommant le règlement

#### Scenario: Taxe SPP par tranche
- WHEN une équipe goblin recrute des stars pour 300 kpo cumulés
- THEN le pool persisté DOIT être 60 − 32 = 28 SPP

### Requirement: Plan de compétences contraint par le règlement
Sous un règlement, les améliorations au build DOIVENT être des choix
primaires/secondaires uniquement (aléatoires et caractéristiques
interdits), limitées à 2 compétences par joueur, et le nombre de joueurs
cumulant 2 compétences DOIT respecter le cumul du roster (aucun / 1
joueur / 2 joueurs). Le pool DOIT être décompté au barème du pack
(1re primaire 6, 1re secondaire 10, 2e primaire 8, 2e secondaire 12,
surcoût Elite).

#### Scenario: Cumul refusé
- WHEN une équipe orc (cumul : aucun) achète 2 compétences au même joueur
- THEN la création DOIT être refusée (400)

### Requirement: Cumuls retirés par Star Player recruté
Un règlement PEUT déclarer `stackReductionPerStarPlayer` : le nombre de
joueurs autorisés à porter 2 compétences DOIT alors être le quota du roster
moins cette valeur par Star Player recruté, sans jamais devenir négatif. Un
règlement qui ne le déclare pas (NAF WC 2027 V2.1) NE DOIT PAS voir son quota
modifié par les Star Players. La règle DOIT s'appliquer à la création
d'équipe, à l'ajout d'une compétence sur une équipe existante et dans le
builder, par une seule fonction pure (`maxTwoSkillPlayersWithStars`).

#### Scenario: Un Star Player retire un cumul
- WHEN une équipe Ogre NAF WC 2027 V3.0 (2 cumuls) recrute un Star Player et demande 2 joueurs à 2 compétences
- THEN le build DOIT être refusé (400) avec un message citant les Star Players, et aucune équipe NE DOIT être créée

#### Scenario: Deux Star Players, plus aucun cumul
- WHEN la même équipe recrute deux Star Players
- THEN aucun joueur NE DOIT pouvoir porter 2 compétences, les premières compétences restant libres

#### Scenario: Règlement sans la règle
- WHEN une équipe NAF WC 2027 V2.1 recrute deux Star Players
- THEN son quota de joueurs à 2 compétences DOIT rester celui du roster

### Requirement: Plusieurs versions d'un même tournoi coexistent
Une nouvelle version d'un pack (NAF WC 2027 V3.0) DOIT être ajoutée au
registre sous un slug propre (`naf_world_cup_2027_v3`), sans modifier la
définition de la version précédente : les équipes et compétitions déjà créées
référencent son slug. Les libellés courts DOIVENT permettre de distinguer les
versions dans les listes.

#### Scenario: Seed sur une base qui porte déjà le V2.1
- WHEN le seed des règlements tourne sur une base contenant `naf_world_cup_2027`
- THEN la ligne `naf_world_cup_2027_v3` DOIT être créée et la ligne V2.1 laissée intacte

#### Scenario: Tier V3.0
- WHEN une équipe Ogre est construite sous NAF WC 2027 V3.0
- THEN son budget DOIT être 1 200 kpo et son pool 72 SPP

### Requirement: Règlement imposé par une ligue ou une coupe
Une ligue et une coupe DOIVENT pouvoir être créées avec un
`tournamentRuleset` (validé : slug connu, édition — et format pour la
coupe — compatibles). L'inscription d'une équipe (join direct, acceptation
d'invitation, inscription coupe, build Flow B) DOIT exiger l'égalité
stricte des slugs : une compétition à règlement n'accepte que des équipes
créées avec ce règlement, et une équipe à règlement ne peut rejoindre
qu'une compétition au même règlement.

#### Scenario: Ligue à règlement refuse une équipe standard
- WHEN une équipe sans règlement rejoint une saison d'une ligue NAF WC 2027
- THEN l'inscription DOIT être refusée avec un message nommant le règlement (invitation : code `tournament_ruleset_mismatch`, 409)

#### Scenario: Équipe à règlement refusée en compétition standard
- WHEN une équipe NAF WC 2027 s'inscrit à une coupe sans règlement
- THEN l'inscription DOIT être refusée (code `tournament_ruleset_mismatch`)

#### Scenario: Build pour une coupe à règlement
- WHEN une équipe est construite avec `cupId` d'une coupe NAF WC 2027
- THEN le pack de la coupe DOIT être imposé (budget/pool du tier, slug persisté) et primer sur les budgets par tier de la coupe

### Requirement: Affichage du règlement
La fiche roster d'une équipe créée avec un règlement DOIT afficher un
label avec le nom court du pack. Le builder DOIT proposer la sélection
(défaut « Aucun ») et afficher les règles imposées au roster sélectionné.
Les pages ligue/coupe DOIVENT afficher le règlement, et les sélecteurs
d'équipes (inscription) DOIVent filtrer par égalité stricte.

#### Scenario: Label sur la fiche roster
- WHEN un coach ouvre la fiche d'une équipe créée sous NAF WC 2027
- THEN un badge « NAF World Cup 2027 » DOIT être visible à côté des badges ruleset/format
