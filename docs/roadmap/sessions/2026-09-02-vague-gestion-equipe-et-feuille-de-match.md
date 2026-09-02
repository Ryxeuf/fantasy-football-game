# Vague « gestion d'équipe & feuille de match » — août 2026

> **2026-08-17 → 2026-09-01** — 69 PR mergées (#938 → #1006, plage contiguë),
> 859 fichiers touchés, ~123 500 lignes ajoutées, 197 nouveaux fichiers de test
> (1 030 au total dans le repo), 34 nouveaux services serveur, 12 nouvelles
> pages web, 6 modèles Prisma.
>
> Trois chantiers menés en parallèle, tous issus des retours de terrain des
> premières ligues physiques : **la feuille de match devient conforme au
> livre**, **la valeur d'équipe cesse de mentir**, et **les données de
> catalogue quittent le code pour la base**. Un quatrième chantier, non
> planifié, s'est imposé en fin de vague : la CI avalait des suites rouges
> depuis des semaines.

## 1. Ce qui a été livré, par chantier

### A. Feuille de match — conformité au livre (18 PR)

Le plus gros morceau. La feuille de match était fonctionnelle mais divergeait
du règlement officiel sur des points qui changent le résultat.

| PR | Apport |
|----|--------|
| #938 | Blessures Persistantes notées « N BP » et cumulées |
| #939 | Bandeau « En attente validation » sur la page de la journée |
| #942 | Roster élargi (toutes les colonnes visibles) |
| #946 | Résultat validé affiché dans le calendrier |
| #950 | Consultation du roster adverse depuis la feuille |
| #951 | Valeur de chaque joueur du roster |
| #963 | **Lot de 13** : points bonus hors points génériques, invalidation après choix des compétences, VEA = VE − absents, journaliers automatiques, en-tête figé, « Atterrissage réussi », PSP d'élimination sur Action Spéciale, photos de joueurs |
| #965 | Staff en kpo + déblocage de l'invalidation `advancement-consumed` |
| #966 | VEA juste : absents/blessés exclus, journaliers comptés dans la CTV |
| #969 | **Lot de 8** : compétences Élite, fans dévoués, classement, navigation |
| #971 | Qualification par poule et contrôle du lancement des playoffs |
| #984 | **Séquence de fin de match du livre (p.68)**, gel du match, journaliers & Star Players synthétiques, publication des playoffs |
| #987 | Trait Haine (X), invalidation d'un match de play-off, tags d'état du roster |
| #994 | Haine (X) : restitution du jet d'après-match (jets ratés compris) |
| #995 | Le joueur mort quitte l'équipe en fin de match ; journaliers annoncés au coup d'envoi |
| #996 | La passe réussie enregistre son réceptionneur (`targetPlayerId`) |
| #998 | Journaliers panachables (poste par journalier), PSP de réception, invalidation d'un match de play-off |
| #1001 | Catalogue d'embauche (fin de la saisie libre), Haine francisé, Ligue retenue seule, règle PSP des éliminations |

**Les trois règles structurantes** qui en sortent, toutes consignées dans
`CLAUDE.md` :

1. **L'ORDRE des étapes d'après-match est une règle**, pas de la cosmétique
   (résultats → fans dévoués → *améliorations* → *embauches puis renvois* →
   erreurs coûteuses). Une compétence gagnée à l'étape 3 change le prix de
   recrutement d'un journalier ; un mort libère sa place avant tout achat.
2. **Le gel « version du match » se fait à l'OUVERTURE de la feuille**, pas à
   la première soumission. Un gel tardif laissait TV et cagnotte diverger
   entre le brouillon et la feuille validée.
3. **Les joueurs synthétiques** (journaliers, Star Players engagés) sont
   dérivés à la lecture, jamais persistés — et doivent être *proposés* par
   tout nouveau picker d'évènement, sinon on ne peut pas leur attribuer un TD.

### B. Valeur d'équipe & comptabilité

Le symptôme initial : deux écrans affichaient deux VE différentes pour la
même équipe. La cause était une accumulation de règles appliquées à des
endroits différents.

- **#968** — Fans Dévoués : off-by-one de −5k sur *toutes* les équipes, puis
  décision de les sortir complètement de la VE/VEA (ils coûtent de la
  trésorerie, pas de la valeur).
- **#973** — « Trois-quarts à vil prix » (Ogres, Snotlings) appliqué à la
  VEA : le coût d'embauche des Trois-quarts compte pour 0 po dans la VEA,
  leurs avancements comptent normalement. Seule exception au calcul standard.
- **#975 / #982 / #1002** — Séparation nette **or ≠ valeur d'équipe**, coûts
  et plafonds de staff issus du roster en base, résumé budgétaire cohérent,
  comptabilité des PSP fiabilisée.
- **#966 / #963** — VEA = VE − valeur des absents, recalculées ensemble.
- **#1006** — La page publique **explique** enfin l'écart VE / VE actuelle
  au lieu d'afficher deux nombres sans contexte.
- **#979** — Surcoût des compétences d'Élite : +10 000 po de VE (30k pour une
  primaire Élite au lieu de 20k), propagé partout où la VE est recalculée.

### C. Référentiels « base d'abord » — audit statique vs BDD

Audit conduit le 2026-08-27
([`docs/audit-statique-vs-bdd-2026-08-27.md`](../../audit-statique-vs-bdd-2026-08-27.md))
puis lots 1→6
([`docs/lot6-modele-de-donnees-2026-08-27.md`](../../lot6-modele-de-donnees-2026-08-27.md)).

Constat : des données de catalogue (coups de pouce, barème d'avancement,
règles spéciales, univers des rosters) vivaient **en dur dans le code**, donc
non éditables sans déploiement, et divergeaient déjà des colonnes que l'admin
pouvait modifier.

Le patron retenu, décliné 4 fois, est calqué sur `tournament-ruleset-repository` :

| Donnée | Table | Repository | Repli compilé |
|---|---|---|---|
| Coups de pouce | `Inducement` | `inducement-repository` | `INDUCEMENT_CATALOGUE` |
| Barème d'avancement | `AdvancementCost` + `CharacteristicValue` + `RulesetConfig` | `advancement-schedule-repository` | `DEFAULT_ADVANCEMENT_SCHEDULE` |
| Règles spéciales / Ligues | `TeamSpecialRule`, `RegionalLeague` | `team-rules-catalogue` | `TEAM_SPECIAL_RULES`, `REGIONAL_LEAGUES` |
| Univers des rosters | `Roster.slug` | `roster-catalogue` | `ALLOWED_TEAMS` |

Cinq règles en sont sorties (détaillées dans `CLAUDE.md`), dont la plus
contraignante : **`prisma/migrations/` est gitignoré** (prod = `db push`),
donc aucune colonne ajoutée ne peut être backfillée — elle est nullable et
lue avec repli, et le seeder n'écrase jamais une valeur déjà posée.

### D. Journal d'équipe — traçabilité (#985)

`AuditLog` ne traçait que l'admin, `TeamPlayerStatusEvent` que les
morts/licenciements, et **aucun ne stockait l'état obtenu** — d'où des écarts
de trésorerie irreconstituables.

`TeamAuditEvent` (append-only) répond aux trois questions : **qui**
(`actorUserId` + `actorRole` + libellé figé + `impersonatorId`), **quoi**
(`action` dot-case, `details`, `changes`), **quel résultat** (`after` +
colonnes dénormalisées `treasury` / `teamValue` / `currentValue` + deltas).

Le point clé : **une opération = plusieurs étapes** (un achat débite la
trésorerie *puis* `updateTeamValues` réécrit la VE). `correlationId` les
regroupe, `step` les ordonne, et chacune porte son état résultant.

L'identité de l'appelant transite par un `AsyncLocalStorage`
(`utils/audit-context.ts`) plutôt que par les signatures — threader
`{ userId, ip, requestId }` aurait touché des dizaines de fonctions sans
rapport avec l'audit. Garde CI `team-audit-coverage.test.ts` (ratchet) :
tout module écrivant sur `Team`/`TeamPlayer`/`TeamStarPlayer` sans
journaliser fait échouer les tests.

Doc dédiée : [`docs/team-audit-journal.md`](../../team-audit-journal.md).

### E. Star Players & catalogue

- **#952** — 500 → 200 sur `/star-players/:slug` : `findUnique({ slug })`
  alors que `slug` n'est unique qu'associé au `ruleset`.
- **#953** — Rubrique « Joue pour » (index inverse pur, sensible au ruleset).
- **#954 / #957** — Saisie admin en cases à cocher ; base = source de vérité.
- **#955** — Mots-clés (lignée + type) sur 68 stars.
- **#958** — **Lot Legends 2025** : 50 Star Players du PDF GW alignés.
- **#956** — Actif / Passif affiché partout où une compétence est détaillée.
- **#961** — Cartes joueurs exportables (PNG 750×1050).
- **#989** — Portraits sur les cartes, contenu éditorial des positionnels.
- **#983** — Règlements de tournoi éditables depuis la console admin.
- **#970 / #979** — Pack NAF World Cup 2027 V2.1 (budget, pool SPP, taxe
  Star Players, barème de cumul de compétences).

### F. Admin & confort

#940/#945/#947/#948 (Ligues d'un roster en cases à cocher + garde-fous),
#960 (sélecteurs unifiés « chips + recherche », statistiques de roster
utiles), #986 (la fiche d'équipe devient une page lisible comme le site
public), #993 (masquer les supprimées, les restaurer, éditer),
#992 (renommer son équipe après création, même engagée),
#943/#972/#980/#981 (logos d'équipe), #959 (`/aide-de-jeu` : companion de
table mobile-first, 14 fiches dérivées du compendium),
#1003 (lien public d'un roster : compétences, coûts, staff, fluff).

### G. Qualité — la CI avalait les échecs (#1000)

**Le problème le plus grave de la vague, et le moins visible.** La step
« Unit tests » de `ci.yml` se terminait par `|| echo "..."`, ce qui avalait le
code de sortie de **toutes** les suites — y compris `@bb/tests` et
`@bb/tests-integration`, qui ont dérivé sans que rien ne le signale.

Correctif : les workspaces e2e (qui ont besoin de DB/browsers absents du
runner) sont désormais **exclus par filtre** au lieu d'être noyés dans un
fallback, et les deux suites concernées gatent la CI. **27 tests rouges**
réparés au passage.

Autres correctifs qualité : #944 (typedRoutes), #974 (E2E rouge sur main
depuis #964), #981 (E2E UI accessibilité), #1005 (faces officielles du dé
de blocage et ordre « repousser puis plaquer »),
#997 (couverture de la purge du cache du catalogue de compétences).

## 2. Modèles Prisma ajoutés (6 + 1 enum)

| Modèle | Rôle |
|--------|------|
| `TournamentRuleset` | Règlements de tournoi éditables (`slug` unique + `enabled` + `definition` JSON validée Zod à l'écriture ET à la lecture) |
| `Inducement` | Catalogue des coups de pouce (les 4 `canPurchase` closures deviennent des champs `requiresAnyRule` / `requiresRoster` / `requiresApothecary`) |
| `AdvancementCost` | Barème PSP des avancements, par édition |
| `CharacteristicValue` | Valeur en po des augmentations de caractéristique |
| `RulesetConfig` | Config par édition (surcoûts, plafonds) |
| `TeamAuditEvent` | Journal d'équipe append-only (cf. §1.D) |
| `enum AdvancementKind` | Type d'avancement (compétence / caractéristique) |

Colonnes notables ajoutées, **toutes nullables** (contrainte `db push`) :
`Position.pa` et `TeamPlayer.pa` passés `Int?` (« pas de passe » = `-`),
`StarPlayer.keywords`, `Team.description`, `LeagueSeason.playoffsPublished`
(booléen **à trois états** : `null` = saison antérieure visible, `false` =
généré non publié, `true` = publié).

## 3. Pièges rencontrés (consignés dans CLAUDE.md)

- **Une colonne de rattachement nullable ne peut pas servir de garde-fou.**
  `Match.leagueRoundId` est `String?` avec `onDelete: SetNull` → NULL sur les
  matchs antérieurs comme sur ceux dont le round a été supprimé. Le garde-fou
  d'invalidation s'en servait pour reconnaître un match de play-off, d'où
  « Reversion impossible: playoffs-generated » sur un play-off bien réel. La
  source fiable est le lien **obligatoire** `LeaguePairing.roundId`.
- **Un round de play-off ne s'auto-numérote pas `+1`.** `startPlayoffs` crée
  UN round par slot (demi 1 = N, demi 2 = N+1) : la finale visait le numéro
  du round frère et la contrainte unique `(seasonId, roundNumber)` faisait
  échouer sa création **en silence**. Tout nouveau round doit s'allouer
  `max(roundNumber) + 1`.
- **Une compétence déjà possédée n'était refusée nulle part.**
  `applyAdvancementChoice` concaténait un doublon dans le CSV `skills` ; seul
  le tirage `random-primary` les excluait. Refus serveur `skill-already-owned`
  ajouté, vérifié avant tout le reste de la branche compétence.
- **`computedSpp` doit couvrir les joueurs sans stat-line.** Un Joueur du
  Match sans TD/sortie/passe n'a pas de stat-line, donc son palier
  d'évolution n'était pas proposé — alors que la validation lui créditait
  bien ses PSP.
- **Le contenu généré automatiquement exige une publication explicite.** Les
  coachs découvraient un bracket provisoire avant correction des seeds par le
  commissaire. D'où le flag de publication à trois états, et **les deux**
  lectures gatées (le bracket ET les rounds `kind=playoff` du calendrier).
- **Les prières à Nuffle qui changent le barème de PSP** (10 « Passe
  Parfaite », 11 « Réception Étourdissante ») doivent alimenter les deux
  chemins — PSP affichés et PSP persistés — depuis un module pur commun,
  sinon les deux divergent.
- **Le seuil « 0-12 ou plus » rate les Trois-quarts à quota réduit** (Orques :
  Trois-quart Gobelin, 0-4). Un poste est retenu s'il est 0-12+ **ou** si ses
  Mots-clés déclarent « Trois-quart ».

## 4. État de la dette à la fin de la vague

| Point | État |
|-------|------|
| CI qui avalait les échecs de test | ✅ Corrigé (#1000) |
| Suites `@bb/tests` / `@bb/tests-integration` rouges | ✅ 27 tests réparés, elles gatent la CI |
| Changes OpenSpec non archivés | ✅ 28 archivés + specs synchronisées (cette PR) |
| `docs/roadmap/phases.md` figé au 2026-06-15 | ✅ Mis à jour (cette PR) |
| **59 changesets en attente depuis le 2026-07-22** | ⚠️ **Non traité** — voir ci-dessous |

### Le point ouvert : les changesets s'accumulent

`.changeset/` contient **59 changesets non consommés**, le plus ancien datant
du 2026-07-22. Le versionnement réel est assuré par `semantic-release`
(v1.240.1 au 2026-09-01), et `pnpm changeset:version` n'a apparemment jamais
tourné sur cette série.

Ce n'est pas bloquant — les changesets servent de fait de notes de version
détaillées, et leur contenu est excellent — mais **deux mécanismes de
versionnement coexistent sans que l'un consomme l'autre**. À trancher :
soit on consomme les changesets (et les packages `@bb/*` prennent enfin leurs
versions), soit on assume qu'ils sont un journal de release et on documente ce
choix pour éviter que quelqu'un lance `changeset:version` sur 59 entrées.

## 5. Suites identifiées

Les suites hors périmètre des changes archivés sont consignées dans
[`backlog/openspec-suites.md`](../backlog/openspec-suites.md) — notamment le
reste du pack NAF World Cup 2027 (escouades, résurrection en ligue,
enforcement de la liste fermée de coups de pouce).
