# Design — coups de pouce achetés à la création d'une équipe de coupe

## Context

Voir `proposal.md` (Why) et les specs pour les exigences. Cette section ne
reprend que l'état du code qui conditionne l'approche.

**Catalogue et règlement**

- Le catalogue effectif d'une équipe (accès apothicaire, règles spéciales
  lues en base, Ligue régionale, remises, liste de ligue, règlement) est
  calculé par `inducementOptionsFor`. Cette fonction est PRIVÉE à
  `services/league-match-sheet.ts`, et seule la feuille s'en sert.
- `applyPackInducementRules` (`services/tournament-inducements.ts`, pur)
  remplace le prix du catalogue par celui du règlement, sans regarder si
  l'équipe avait droit à une remise.
- Le moteur porte déjà les remises (`discountRule` / `discountRoster` /
  `discountCost`) et les plafonds par règle (`ruleMaxQuantity`) dans
  `INDUCEMENT_CATALOGUE`.

**Construction et inscription**

- Les Star Players sont le seul coup de pouce acheté au build :
  - `TeamStarPlayer` stocke le slug et le coût ;
  - `buildTeamBudgetSummary` les compte dans la dépense ;
  - `buildRosterSnapshot` les fige dans `RosterSnapshot.starPlayers` ;
  - la fiche d'équipe web refait le calcul côté client ;
  - le clonage (`fromTeamId`) les recopie.
- `creditInitialTreasury` verse le reliquat du budget en trésorerie.
  `resyncDraftTreasury` le recalcule à chaque édition d'un brouillon.

**Feuille de coupe**

- Elle gèle le roster D'INSCRIPTION (`registrationSnapshots`) avec sa
  trésorerie. Son budget de coups de pouce passe par
  `buildMatchSheetReference` → `calculatePettyCash` en mode ligue
  (`LEAGUE_UNDERDOG_INDUCEMENT_BONUS`), sans aucune branche de coupe.
- Les Star Players de la feuille (`starPlayersHired`, id
  `star-<side>-<slug>`) ne sont dérivés QUE des coups de pouce saisis sur
  la feuille (`deriveSheetStarPlayers`). La dérivation est appelée à
  plusieurs endroits :
  - `getMatchSheet` (`withStarPlayers`) ;
  - le repli de `sideSheetPlayers` ;
  - les lectures d'appartenance et de noms de la validation.

**Composition d'une coupe**

- Les règles de composition (`cupRulesConfigSchema`) s'écrivent par
  `POST /cup` et `PATCH /cup/:id/rules`. Ce PATCH est fermé dès que la
  coupe est validée, sauf pour un administrateur.

**Base**

- `prisma/migrations/` est gitignoré et la prod tourne en `db push` :
  aucune reprise de données n'est possible.

## Goals / Non-Goals

**Goals**

- Une seule résolution du catalogue effectif, partagée par le builder, la
  validation du build, l'inscription et la feuille.
- Une seule dérivation des Star Players de la feuille, quelle que soit leur
  source (build ou avant-match).
- Aucune donnée à reprendre : toute colonne nouvelle se lit `null` comme
  l'état historique.
- Livrable par lots, le lot 0 corrigeant des bugs sans dépendre du reste.

**Non-Goals**

- Le jet de Débutants Déchaînés à chaque ronde (2D3+1 journaliers dérivés
  sur la feuille). Ils restent un rappel, et la suite part au backlog.
- Les coups de pouce au build des LIGUES à règlement : une ligue garde
  l'avant-match.
- L'assistant « première équipe » (`create-from-roster`), déjà au backlog
  pour la même raison.
- Le match en ligne.
- La règle d'égalité de VEA de `calculatePettyCash` en ligue (les deux
  équipes peuvent y puiser toute leur trésorerie, alors que le compendium
  dit « aucune »). Elle est hors coupe une fois la trésorerie retirée des
  coupes, et doit être confirmée dans le livre. Elle part au backlog.

## Decisions

### D1 — `Cup.inducementMode String?`, `null` = `match`, SANS `@default`

Valeurs `"build" | "match" | "none"`. Une fonction pure,
`resolveCupInducementMode(raw, { pack, format })`, sert à la LECTURE et à
l'ÉCRITURE :

- sous règlement ⇒ `build` ;
- en Sept, `build` est impossible ;
- valeur inconnue ou `null` ⇒ `match`.

`POST /cup` écrit la valeur explicitement (`build` en BB11, `match` en
Sept) : c'est le patron de `sheetEntryMode` et de `playoffsPublished`.

- *Rejeté : `@default("build")`.* `db push` poserait le défaut sur les
  coupes existantes et changerait leur régime sans que personne l'ait
  décidé.
- *Rejeté : déduire le mode de `resurrectionMode`.* Toutes les coupes sont
  en résurrection (forcé côté serveur), ce champ ne discrimine rien.
- *Rejeté : un booléen `buildInducements`.* `none` est un vrai besoin de
  commissaire (« coupe sans coups de pouce »), et un booléen ne l'exprime
  pas sans second champ.

### D2 — `Cup.allowedInducements Json?`, `null` = tout le catalogue à prix fixe

Même forme que `League.allowedInducements` (liste de slugs), parseur
tolérant PG / SQLite. L'intersection avec le règlement passe par
`effectiveInducementAllowlist`, qui existe déjà.

Les deux champs (mode et liste) entrent dans `cupRulesConfigSchema`. Ils
héritent donc des deux écritures (création, `PATCH /cup/:id/rules`) et de
leur fenêtre (fermée à la validation de la coupe).

- *Rejeté : un réglage via `PATCH /cup/:id`.* Cette route est ouverte en
  cours de coupe. Changer de régime après les inscriptions casserait des
  équipes construites pour l'ancien.

### D3 — Table `TeamInducement`, voisine de `TeamStarPlayer`

Colonnes :

```
id, teamId, slug, quantity, unitCost (po, figé à l'achat), createdAt
@@unique([teamId, slug])
onDelete: Cascade
```

C'est le même chemin que les Star Players, à chaque étape : budget, snapshot,
fiche, clonage, journal. Le prix est figé parce qu'un admin peut modifier le
catalogue (`Inducement` en base) : la dépense d'une équipe déjà construite ne
doit pas bouger.

- *Rejeté : une colonne `Team.buildInducements Json`.* Elle échapperait au
  ratchet du journal d'équipe, et chaque lecteur devrait la parser.
- *Rejeté : rattacher les coups de pouce à `CupParticipant`.* Ils sont payés
  sur le budget de CONSTRUCTION. Une équipe à règlement construite hors
  coupe, puis inscrite telle quelle, doit les porter.

Le ratchet `team-audit-coverage` ajoute `teamInducement` aux modèles
surveillés.

### D4 — Un service de catalogue partagé : `services/inducement-options`

`inducementOptionsFor` sort de `league-match-sheet.ts` sans changement de
comportement. La feuille l'importe, et un second appelant s'ajoute :
`buildInducementCatalogue({ roster, ruleset, regionalLeague, pack,
allowlist, hiredStarSlugs })`. Celui-ci retire `star_player` et les coûts
variables (`variableCost`), puis applique le règlement.

Un nouveau `GET /team/build-inducements` (`authUser` + `validateQuery`) le
sert au builder. Les paramètres sont roster, édition, Ligue régionale,
règlement ou `cupId`. Quand `cupId` est fourni, le serveur relit lui-même
le règlement, le mode et la liste de la coupe.

- *Rejeté : recalculer le catalogue côté web.* C'est ce que la règle
  « base d'abord » interdit. Accès apothicaire, règles spéciales et
  catalogue sont en base, et le web divergerait au premier réglage admin.

### D5 — Remises du règlement par la DÉFINITION du moteur

`TournamentInducementRule` gagne deux champs :

- `discountCost?` : prix réduit. Il s'applique quand la définition du
  moteur accorde SA remise à l'équipe. Une fonction pure de moteur,
  `qualifiesForInducementDiscount(def, ctx)`, extraite de
  `getInducementCost`, dit si l'équipe y a droit.
- `maxWithSecretWeaponStar?` : plafond quand un Star Player recruté porte
  `secret-weapon` (compétences lues dans le catalogue de stars).

Le plafond effectif est le minimum de ces valeurs :

- le plafond du règlement, ou celui du moteur s'il n'en pose pas (6
  Pots-de-vin pour Chantage et Corruption, via `ruleMaxQuantity`) ;
- le plafond Arme Secrète, quand il s'applique.

Données NAF WC 2027 :

| Coup de pouce | Prix | Prix réduit | Plafond Arme Secrète |
|---|---|---|---|
| Pots-de-vin | 100 000 | 50 000 | 2 |
| Chef Cuistot Halfling | 300 000 | 100 000 | — |

- *Rejeté : redéclarer dans le pack QUI a droit à la remise* (slug de règle
  ou de roster). Ce serait une seconde source de vérité qui divergerait de
  `TeamSpecialRule` en base.
- *Écarté : un champ `onlyRosters` pour les Débutants Déchaînés.* En
  Saison 3, seuls Ogres et Snotlings portent « Trois-quarts à vil prix » :
  le moteur restreint déjà exactement comme le pack, et la note reste
  informative.

Le schéma Zod des règlements valide les deux champs (prix réduit compris
entre 0 et le prix, plafond ≥ 0). `serializeDefinition` les conserve, et
l'éditeur admin (`sections.tsx`) les expose.

### D6 — Validation au build : un module pur, puis la transaction existante

`resolveBuildInducements(requested, catalogue)` est pur. Il rend les lignes
`{ slug, name, quantity, unitCost }`, le total en po, ou une erreur :

- slug inconnu ou hors catalogue ;
- quantité au-delà du plafond ;
- doublon.

`team-build-handler` l'appelle après les Star Players (il a besoin de leurs
slugs pour le plafond Arme Secrète) et avant le contrôle de budget, puis
ajoute le total à `totalBudgetUsed`. Le message de dépassement nomme la
part des coups de pouce. Les lignes s'écrivent dans la MÊME transaction que
l'équipe et ses stars, et l'étape `team.create` du journal les détaille.

Le contexte autorisé est `pack != null || (cup && mode === "build")`.
Partout ailleurs, la présence du champ suffit à refuser (400).

Le schéma Zod reste borné à la forme :

```ts
inducements: z.array(z.object({
  slug: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(10),
})).max(20).optional()
```

Le fond (catalogue, plafonds) est vérifié par le module. Un champ `cost`
envoyé par le client est ignoré : le schéma ne le déclare pas.

### D7 — Or perdu sous règlement : une règle dans le calcul du reliquat

`buildTeamBudgetSummary` gagne les coups de pouce (`inducementsCost` dans
`totalSpent`). Le reliquat versable vaut `0` quand
`team.tournamentRuleset` est renseigné.

La règle vit dans le calcul, pas dans le seul appel de création :
`resyncDraftTreasury` repasse par le même résumé à chaque édition d'un
brouillon. Une règle posée uniquement à la création serait défaite à la
première sauvegarde.

### D8 — Snapshot : `RosterSnapshot.inducements?`, absent = aucun

`buildRosterSnapshot` fige les coups de pouce comme les Star Players
`{ slug, name, quantity, unitCost }`. Le champ est OPTIONNEL : un snapshot
antérieur se lit sans coup de pouce, et `parseRosterSnapshot` reste
tolérant. La capture est faite quel que soit le mode ; c'est la lecture qui
décide (`build` ⇒ rappel, autres modes ⇒ ignoré). L'inscription refuse de
toute façon une équipe porteuse dans une coupe hors `build` (D10).

### D9 — Feuille : une dérivation de Star Players, un budget de coupe

**Star Players.** Une seule fonction, `deriveSideStarPlayers({ side,
inducements, frozenSnapshot, ruleset, competitionKind })`. Elle fusionne :

- en coupe, les Star Players du roster FIGÉ de la feuille (pour une coupe,
  c'est le roster d'inscription, cf. `registrationSnapshots`) ;
- ceux saisis en coup de pouce d'avant-match.

Le dédoublonnage se fait par slug, et les ids restent `star-<side>-<slug>` :
tous les filtres de joueurs synthétiques (`isSyntheticSheetPlayerId`,
`computeSheetSpp`, `assertOwnership`, pickers) continuent de fonctionner
sans modification. Tous les sites d'appel actuels passent par elle. C'est
la règle « une seule dérivation » des journaliers (`journeymenChoiceInput`).

Un Star Player déjà au roster d'inscription et sélectionné aussi en
avant-match est refusé à la sélection (400), au lieu d'être fusionné en
silence. La lecture d'une feuille ANCIENNE qui porterait déjà les deux
dédoublonne sans erreur.

**Budget.** `buildMatchSheetReference` reçoit `{ kind, inducementMode }` :

| Compétition | Mode | Budget de coups de pouce |
|---|---|---|
| Ligue | — | inchangé |
| Coupe | `match` | `calculatePettyCash` sans bonus d'outsider et avec des trésoreries à 0 : le moins cher reçoit l'écart de VEA, l'autre rien |
| Coupe | `build` / `none` | budget nul, catalogue vide ; `updatePreMatch` refuse toute sélection (`inducements_locked`, 400) |

La lecture d'une coupe en `build` sert en plus, par équipe, les coups de
pouce figés (`registeredInducements`). L'UI les affiche en rappel dans
l'en-tête d'équipe, dans les deux modes de saisie. Ce n'est pas une saisie :
le profil simplifié reste intact.

- *Rejeté : pré-remplir `inducementsHome/Away` avec les coups de pouce du
  build.* La feuille les « posséderait » alors : un coach pourrait les
  retirer, et le contrôle de budget les compterait contre une petite
  monnaie nulle.

### D10 — Inscription telle quelle : la dépense, et rien d'interdit

`registerTeamToCup` contrôle deux choses :

- **Budget.** Il compare `buildTeamBudgetSummary(...).totalSpent` au budget
  de la coupe : joueurs, relances, staff, fans, Star Players et coups de
  pouce aux coûts figés. Il ne compare plus `team.teamValue`.
- **Coups de pouce.** Si l'équipe porte des `TeamInducement`, la coupe doit
  être en `build`, et chaque ligne doit figurer au catalogue effectif de la
  coupe pour ce roster, en quantité ≤ plafond. Sinon :
  `CupRegistrationError('inducement_not_allowed')`, avec un message qui
  oriente vers « Adapter à la coupe ».

### D11 — Builder : un composant et un module pur, hors de `page.tsx`

`page.tsx` fait déjà 1 792 lignes. Le builder reçoit :

- `BuildInducementPicker.tsx` (liste, quantités ±, prix, plafonds) ;
- `build-inducements.ts`, pur : total, bornage, filtre de clonage (écartés
  / retenus).

`page.tsx` ne fait que charger le catalogue, tenir l'état et ajouter
`inducementsCost` au bandeau et au budget restant. La section n'apparaît
que si `pack || cupInducementMode === "build"`. Un changement de roster
vide la sélection, puisque le catalogue change.

**Clonage.** `GET /team/:id` sert les `inducements`. Le builder retient
ceux qui figurent au catalogue de la coupe, au prix de ce catalogue, et
liste les autres comme écartés.

**Fiche d'équipe** (`me/teams/[id]`). Elle liste les coups de pouce et les
ajoute à son calcul de dépense, à côté des Star Players.

**Formulaire de coupe** (`cups/page.tsx`, section « Règles de
composition »). Il propose :

- le mode, en trois choix, imposé et grisé sous règlement, `build` absent
  en Sept ;
- la liste autorisée, avec la case à cocher extraite de `LeagueForm` dans
  un champ partagé.

### D12 — Feuille papier

L'adaptateur de `lib/competition-pdf` lit `registeredInducements` et
`starPlayersHired`, qui viennent de la dérivation D9. Il imprime un bloc
« Coups de pouce (inscription) » par équipe, dans les deux modes de saisie
d'une coupe en `build`, et aucune case d'achat. Le profil de saisie
(`lib/sheet-entry-profile`) n'est pas modifié : le rappel n'est pas une
saisie.

## Risks / Trade-offs

- [Feuilles de coupe en brouillon portant déjà une sélection financée par la
  trésorerie] → Le contrôle de budget ne tourne que sur un PATCH qui
  modifie la sélection. Une feuille existante se lit et se valide telle
  quelle (une coupe n'écrit rien sur les équipes).
- [Coach qui avait racheté un Star Player du build en coup de pouce,
  comme contournement] → À la lecture, le dédoublonnage par slug n'en garde
  qu'un ; seule une NOUVELLE sélection en double est refusée.
- [Équipes NAF déjà créées avec une trésorerie] → Elles la gardent : pas de
  reprise possible. En coupe, elle n'est plus lue. Une ligue sous règlement
  la verrait encore en avant-match ; c'est accepté et consigné en suite.
- [Inscription telle quelle plus stricte] → Seules les NOUVELLES
  inscriptions sont contrôlées. Les participants existants ne sont pas
  revérifiés.
- [Catalogue admin modifié après un build] → Le prix est figé sur
  `TeamInducement`. Un coup de pouce retiré du catalogue reste sur
  l'équipe, mais l'inscription à une nouvelle coupe le refusera.
- [Divergence builder / serveur sur le prix] → Le builder affiche ce que
  sert le serveur et n'a aucun calcul de prix propre.

## Migration Plan

1. `db push` : deux colonnes nullables sur `Cup` et une table neuve. Aucune
   reprise de données. Le miroir SQLite et son client sont régénérés dans
   le même commit.
2. Déploiement par lots (cf. `tasks.md`). Le lot 0 est sûr seul : il ne lit
   aucune colonne neuve.
3. Retour arrière : l'ancien code ignore les colonnes et la table. Les
   `TeamInducement` créés restent inertes, et leur dépense n'est plus
   comptée.
