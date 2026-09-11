# Parité feuille de match ↔ moteur de match en direct — 2026-09-11

> Rapport d'audit. Compare ce qu'une **feuille de match** (ligue et coupe,
> saisie manuelle) sait faire avec ce que le **moteur de match en direct**
> (`packages/game-engine` + le flux online/local) sait faire.
>
> Point de départ : une question sur « Vol Fatal », implémentée côté feuille
> depuis la PR #1014 mais absente du moteur. L'audit a généralisé la question.

## Méthode

Lecture de code uniquement, aucune exécution de match. Chaque affirmation
porte sa preuve `fichier:ligne`. Les affirmations les plus lourdes ont été
revérifiées à la main après un premier passage automatisé.

Périmètre :

- **Feuille** : `apps/server/src/services/league-match-sheet.ts` (~4 000 l.),
  `league-match-summary.ts`, `league-sheet-*.ts`, `cup-match-sheet.ts`,
  `apps/web/app/leagues/pairings/[id]/sheet/*`.
- **Moteur** : `packages/game-engine/src/` (352 fichiers `.ts`), plus les
  chemins serveur qui l'exploitent (`move-processor.ts`,
  `pre-match-automation.ts`, `post-match-league-sequence.ts`,
  `routes/local-match.ts`).

## TL;DR

Le moteur n'est **pas** un squelette : il a une séquence d'avant-match
complète (fans, météo, journaliers, coups de pouce, prières), 43 modules de
mécaniques, l'apothicaire dans le bon ordre BB, les séquelles, le public, la
tronçonneuse. L'écart n'est donc pas « la feuille fait tout, le moteur rien ».

L'écart est de **trois natures distinctes**, qu'il faut surtout ne pas
confondre :

1. **Délibéré et assumé** — la gestion de ligue est 100 % manuelle. Le moteur
   ne doit PAS écrire de classement ni d'économie de ligue.
2. **Le moteur s'arrête à la fin du match** — il calcule des deltas (gains,
   fans) mais ne connaît ni trésorerie, ni évolution, ni embauche, ni renvoi.
   C'est cohérent avec le point 1 pour la ligue, mais cela laisse les matchs
   amicaux sans après-match.
3. **De vrais trous fonctionnels, non documentés comme tels** — des règles
   annoncées à l'utilisateur (ou à l'admin) qui ne s'appliquent pas. C'est la
   catégorie qui compte, et elle est plus large qu'attendu.

## 1. Les deux chemins

| | Feuille de match | Moteur en direct |
|---|---|---|
| Saisie | Manuelle, 2 coachs, validation commissaire | Automatique, tour par tour |
| Compétitions | Ligue **et** coupe (`LeagueMatchSheet` polymorphe) | Amical, IA, local, online de ligue |
| Avant-match | Prières, météo + tables, coups de pouce, journaliers, Star Players, Petite Monnaie | Fans → météo → journaliers → coups de pouce → prières |
| Après-match | Séquence p.68 complète | Deltas calculés, persistance partielle |
| Classement de ligue | Oui (validation commissaire) | **Jamais** — décision d'architecture |

La décision d'architecture est écrite dans le code
(`apps/server/src/services/move-processor.ts:320`) :

> « les matchs en ligne n'écrivent plus jamais le classement de ligue. La
> gestion de ligue est désormais 100 % physique (saisie manuelle via
> `LeagueMatchSheet` + validation commissaire). »

Tout le rapport se lit à cette lumière : beaucoup d'« écarts » sont le
résultat voulu de ce choix.

## 2. Avant-match

Le moteur a une vraie séquence automatisée
(`apps/server/src/services/pre-match-automation.ts:38`) :
`idle → fans (D3) → météo (2D6) → journaliers → coups de pouce`, puis les
prières (`packages/game-engine/src/core/pre-match-sequence.ts:284`).

| Étape | Feuille | Moteur | Écart |
|---|---|---|---|
| Fans dévoués / affluence | Figé au gel | D3 × 2, `calculateFanFactor` | — |
| Météo | 2D6 **+ choix de la table** (classique, printanière…) | 2D6, tables par saison (`core/weather-types.ts:30`), effets réels (`mechanics/weather-effects.ts:31`) | Parité |
| Coups de pouce | Catalogue base, budget, Petite Monnaie | Catalogue base + règles régionales + Star Players (`services/inducement-context.ts`) | **Achat OK, effets non** (§6.3) |
| Prières à Nuffle | 0-3 par équipe, saisie du D16 | Nb = `floor(|ΔVEA| / 50 000)`, D16 | **Effets désalignés** (§6.1) |
| Journaliers | Poste **par journalier**, tirage d'évolution, gel re-baké | Complétion à 11, Human Lineman par défaut, `Loner (4+)` | Pas de choix de poste, pas de plafond 16 |
| Star Players | Engagement + coût + taxe | Règles spéciales câblées, **mais aucun alignement** | §6.4 |

## 3. Pendant le match — les 13 types d'évènement de la feuille

Source : `apps/web/app/leagues/pairings/[id]/sheet/event-fields.ts:8-21`.

| Évènement feuille | Équivalent moteur | Verdict |
|---|---|---|
| `kickoff` (table 2D6) | `mechanics/kickoff-events.ts` | **7/11 appliqués** (§6.2) |
| `touchdown` | `mechanics/ball.ts:48` | Parité |
| `casualty` (élim. sur blocage) | `mechanics/blocking.ts` → `injury.ts` | Parité |
| `pass_complete` | `mechanics/passing.ts:553` | Parité |
| `interception` | `mechanics/passing.ts:394` | Parité |
| `aggression` (agression) | `mechanics/foul.ts` | Parité (sauf Arbitre zélé, §6.2) |
| `expulsion` | `handleSentOff`, `mechanics/dugout.ts:74` | Parité |
| `crowd_surge` (sortie public) | `mechanics/blocking.ts:576-614` | Parité |
| `stalling` (temporisation) | — | **ABSENT du moteur** |
| `team_throw` (lancer de coéquipier) | `mechanics/throw-team-mate.ts` | Partiel |
| `ttm_landing` (atterrissage réussi) | `mechanics/throw-team-mate.ts` | **PSP non comptés** (§6.5) |
| `special_elim` (tronçonneuse, bombe…) | `mechanics/chainsaw.ts`, `bombardier.ts` | Mécanique OK, **PSP non** (§6.5) |
| `other_elim` | — (auto-élimination dérivée) | n/a (aucun PSP par règle) |

`stalling` : `grep -i "stalling|temporisation"` sur `packages/game-engine/src`
renvoie **zéro** résultat. Le terme n'existe que dans l'IA du `sim-engine`
(`packages/sim-engine/src/ai/strategy/strategies.ts:71`), comme stratégie,
pas comme règle.

## 4. PSP — trois barèmes, un seul juste

Le barème canonique vit côté serveur (`apps/server/src/services/spp-tracking.ts:12-19`) :
TD 3, Élimination 2, Réussite 1, Interception 2, **Atterrissage 1**, JDM 4 ;
avec l'override Bagarreurs Brutaux (`:27-30`) TD **2** / Élimination **3**.

Il en existe **deux autres copies, toutes deux fausses** :

| Copie | Emplacement | Ce qui manque |
|---|---|---|
| Canonique | `apps/server/src/services/spp-tracking.ts:12` | — (référence) |
| Moteur, en dur | `packages/game-engine/src/core/game-state.ts:763-769` | `ttmLanding`, Bagarreurs Brutaux |
| Web, redéclarée | `apps/web/app/components/PostMatchSPP.tsx:6-12` | `ttmLanding`, Bagarreurs Brutaux |

Conséquence concrète : l'écran d'après-match d'un match en direct affiche
**2 PSP par élimination à une équipe Bagarreurs Brutaux** alors que
`persistMatchSPP` en persiste **3**. L'affichage et la base se contredisent.

### Ce que `matchStats` ne sait pas compter

`packages/game-engine/src/core/types.ts:284-290` — quatre compteurs, un flag :

```ts
matchStats: Record<string, {
  touchdowns; casualties; completions; interceptions; mvp: boolean;
}>
```

Il n'y a **pas de champ `ttmLandings`**. `calculatePlayerSPP` lit
`stats.ttmLandings ?? 0` : le +1 PSP de l'atterrissage réussi d'un coéquipier
lancé est donc **structurellement impossible en direct**, alors que la feuille
le compte (`league-match-summary.ts:244`). Idem pour les `receptions`
(nécessaires à la prière « Réception Étourdissante ») et les `aggressions`.

### Les compétences qui modulent le crédit d'élimination

| Compétence | Feuille | Moteur |
|---|---|---|
| **Vol Fatal** (`fatal-flight`) | `collectFatalFlighters` → crédit conditionnel (`summary:254-260`) | Enregistrée `on-armor` (`skill-registry.ts:1820`) mais **jamais consommée** ; l'occupant de la case n'est même pas plaqué (`throw-team-mate.ts:313-322`) |
| **Innovateur Violent** (`violent-innovator`) | `collectViolentInnovators` → crédit conditionnel (`summary:282-288`) | Aucun équivalent |

La feuille lit ces compétences dans le **snapshot gelé du coup d'envoi**
(`league-sheet-frozen-skills.ts:108-132`), pour qu'une compétence gagnée à
l'étape 3 ne se rétro-applique pas. Le moteur n'a pas de notion de gel.

### JDM / MVP

- Feuille : **désigné** (`motmPlayerIds`), un joueur sans stat-line reçoit quand
  même ses PSP (`league-match-sheet.ts:1522-1549`).
- Moteur : **tiré au hasard**, 1 par équipe parmi les joueurs ni sortis ni
  expulsés (`core/game-state.ts:771-785`).

## 5. Fin de match — la séquence du livre p.68

| Étape p.68 | Feuille | Moteur |
|---|---|---|
| 1. Résultats et gains | `computeMatchWinnings` (`summary:447-471`), **bonus anti-temporisation** | `calculateMatchWinnings` — delta calculé, jamais crédité |
| 2. Fans dévoués | Clampé 1-6, persisté (`league-offline-result.ts:444`) | D6 calculé ; persisté par le serveur (`move-processor.ts:291`) |
| 3. **Amélioration de joueurs** | Hook `applyAdvancements` injecté **au bon endroit** de la séquence | **Absent** du moteur ; le serveur calcule seulement l'éligibilité (`post-match-league-sequence.ts`) |
| 4. **Embauches puis renvois** | `applyOfflinePurchases` (plafond 16) puis `applyOfflineFirings` | **Absents** |
| 5. Erreurs coûteuses | Assistant D6 dans l'UI, montant versé au débit | Table pure `core/expensive-mistakes.ts` **jamais appelée** |
| Trésorerie | `treasury += winnings − debit` | Le moteur n'a **aucun champ trésorerie** |

Le moteur n'a d'ailleurs **aucune fonction `endMatch`/`postMatch`** : la fin de
match est une transition `gamePhase: 'ended'` (`core/game-state.ts:736`) après
`calculateMatchResult`, qui produit des **deltas** que le serveur applique.

## 6. Les écarts, classés

### 6.1 — Prières à Nuffle : table 2025, effets 2020 🔴

Le moteur porte la table S3 complète (16 entrées,
`mechanics/prayers-to-nuffle.ts:57-175`) mais **applique encore les effets
simplifiés de l'édition précédente**. Le code l'avoue lui-même (`:60-62`) :

> « `applyPrayerEffect` ci-dessous implémente encore les effets **simplifiés
> S2** du match online — alignement mécanique à traiter dans le chantier
> online play (les textes ci-dessous font foi côté ligue). »

Le désalignement est total sur les deux prières que la feuille implémente :

| D16 | Libellé servi au joueur | Effet réellement appliqué en direct |
|---|---|---|
| 10 | **Passe Parfaite** — Réussite à 2 PSP | modifie la caractéristique `pa` (`:460-481`) |
| 11 | **Réception Étourdissante** — 1 PSP au réceptionneur | **étourdit un adversaire au hasard** (`:484-497`) |
| 8 | Bénédiction de Nuffle — compétence Pro | +1 relance d'équipe (`:427-440`) |
| 12 | Interaction avec les Fans | Châtaigne + Pilonnage (`:500-518`) |

Les **quatre prières à effet PSP** (10, 11, 12, 13) ne créditent **aucun PSP**
en direct. Et l'effet `foul-penalty` (prière 15) est bien stocké dans
`state.prayerEffects` mais **jamais relu** : les seuls lecteurs
(`core/game-state.ts:1731`, `core/clone-state.ts:227`) ne regardent que
`type: 'bribe'` ; `mechanics/foul.ts` ne le consulte pas.

C'est le même motif que « Vol Fatal » : la règle est correctement transcrite,
la feuille l'applique, le moteur sert l'édition d'avant.

### 6.2 — Coup d'envoi : 4 évènements sur 11 ne s'appliquent jamais 🔴

`packages/game-engine/src/core/game-state.ts:1905-1907` :

```ts
const applied = INTERACTIVE_KICKOFF_EVENT_IDS.has(event.id)
  ? state                                    // ← loggé, pas appliqué
  : applyKickoffEvent(state, event, rng, kickingTeam);
```

`INTERACTIVE_KICKOFF_EVENT_IDS` = `solid-defence`, `high-kick`, `quick-snap`,
`blitz` (`mechanics/kickoff-events.ts:130-136`). Motif assumé : ils posent un
`pendingKickoffEvent` qu'**aucune UI ne sait résoudre**, et les appliquer
bloquerait le match.

Les résolveurs existent pourtant (`mechanics/kickoff-resolution.ts:42,110,173,264`),
les moves existent (`core/types.ts:503-506`) et les handlers sont câblés
(`actions/actions.ts:304-310`). Il ne manque que l'interface.

Sur la feuille, les 11 évènements sont saisissables sans exception — le
sélecteur lit `KICKOFF_EVENTS` directement
(`apps/web/app/leagues/pairings/[id]/sheet/page.tsx:108`).

**Dead code associé** : `officiousRefForDrive` n'est **jamais mis à `true`**
(seule écriture : `core/game-state.ts:988`, à `false`). Le bloc « Arbitre zélé »
de `mechanics/foul.ts:157-169` est donc inatteignable.

### 6.3 — Coups de pouce : 4 câblés sur 17, et l'admin affirme le contraire 🔴

Catalogue de 17 entrées (`core/inducements.ts:213-386`). **Quatre** ont un
effet en match :

| Slug | Effet | Preuve |
|---|---|---|
| `extra_team_training` | +1 relance | `core/inducements.ts:686-696` |
| `wandering_apothecary` / `igor` | +1 usage apothicaire | `:698-715` |
| `bloodweiser_kegs` | seuil KO `max(2, 4−bonus)` | `core/game-state.ts:842-845` |
| `bribe` | D6 2+ contre l'expulsion | `mechanics/foul.ts:181-210` |

Les treize autres — **Chef Cuistot, Magicien, Mercenaires, Star Players,
Arbitre partial, Pom-pom girls, Entraîneurs assistants, Mascotte, Assistant
mortuaire, Médecin de peste, Bleus déchaînés, Mage météo, Prières** — se
paient, se déduisent du budget, et ne font **rien**. `grep` hors catalogue et
hors tests : **zéro occurrence**.

Détail savoureux : `state.cheerleaders` et `state.assistantCoaches` sont bien
**lus** par les évènements de coup d'envoi (`kickoff-events.ts:325,354`) — mais
**rien ne les alimente** depuis les coups de pouce correspondants.

Le plus gênant est la garde censée prévenir exactement ça. CLAUDE.md pose la
règle : *« Une ligne créée en admin avec un slug inconnu du moteur est un pur
libellé […] L'API le dit (`wired` / `knownToEngine`), la console l'affiche. »*
Or `WIRED_INDUCEMENT_SLUGS` est construit à partir de **tout le catalogue**
(`core/inducements.ts:389-391`) :

```ts
const WIRED_INDUCEMENT_SLUGS = new Set(INDUCEMENT_CATALOGUE.map(d => d.slug));
export function isWiredInducementSlug(slug) { return WIRED_INDUCEMENT_SLUGS.has(slug); }
```

`isWiredInducementSlug` renvoie donc `true` pour les 17, et
`apps/server/src/routes/admin-inducements.ts:132` sert ce `wired: true` à la
console d'administration. **La garde annonce un effet pour 13 coups de pouce
qui n'en ont aucun** — l'inverse exact de son intention.

### 6.4 — Star Players : engageables, jamais alignés 🟠

Les 10 règles spéciales sont câblées et suivies « une fois par match »
(`skills/star-player-rules.ts`). Le référentiel est complet
(`rosters/star-players.ts`, 1 800 l.). Mais **aucun code n'ajoute un Star
Player au roster de match** : `applyInducementEffects` tombe en `default: break`
sur `star_player` (`core/inducements.ts:725`), avec un commentaire
« resolved at match start » qui ne correspond à aucune implémentation.

Les règles spéciales ne se déclenchent donc que si un joueur porte déjà le slug
dans ses compétences. Côté feuille, l'engagement est complet
(`league-sheet-star-players.ts`, id `star-<side>-<slug>`, numéro à partir de 81).

### 6.5 — PSP du lancer de coéquipier et des actions spéciales 🟠

Trois règles de crédit que la feuille applique et que le moteur ne peut pas
appliquer, faute de compteurs :

1. **Atterrissage réussi = 1 PSP** — pas de `ttmLandings` dans `matchStats`.
2. **Vol Fatal** — l'occupant de la case n'est pas plaqué du tout
   (`throw-team-mate.ts:313-322` ne traite que le joueur lancé).
3. **Innovateur Violent** — aucune notion côté moteur.

### 6.6 — Temporisation 🟠

Absente du moteur (0 occurrence). Conséquence en cascade : le **bonus de gains
« aucune temporisation »** (+10 000 po, `league-match-summary.ts:409`) ne peut
pas exister en direct.

### 6.7 — Bagarreurs Brutaux ignoré en match local 🟡

`apps/server/src/routes/local-match.ts:1118` appelle `persistMatchSPP` **sans
contexte** → modificateur neutre. `move-processor.ts:202` passe bien
`leagueContext`. Un match local d'une équipe Bagarreurs Brutaux persiste donc
2 PSP par élimination au lieu de 3.

## 7. L'écart inverse : ce que le moteur a et que la feuille n'a pas

Le rapport serait malhonnête sans ce sens de lecture.

- **Apothicaire et Régénération** : le moteur les implémente correctement, dans
  l'ordre BB (apothicaire d'abord, régénération en repli —
  `mechanics/injury.ts:109-127`, `apothecary.ts:101-106`). La feuille n'a
  **aucun jet** : le commissaire saisit directement la sévérité finale, et
  l'apothicaire n'y est qu'un **booléen de staff** (gelé, affiché, achetable).
  C'est défendable — le jet a eu lieu sur la table physique — mais cela veut
  dire que la feuille ne peut pas vérifier qu'un apothicaire disponible a bien
  été consommé.
- **Effets mécaniques de la météo** (`mechanics/weather-effects.ts:31`), des
  14 autres prières, des évènements de coup d'envoi : la feuille ne les
  applique pas non plus, par nature — elle **consigne** une partie jouée
  ailleurs.
- **`badly_hurt` (Commotion)** : géré par le moteur, **délibérément ignoré** par
  la feuille (`league-match-sheet.ts:1392-1394`), puisque sans effet persistant.

## 8. Délibéré vs accidentel

**Délibéré, à ne pas « corriger »** :

- Le moteur n'écrit jamais le classement de ligue (`move-processor.ts:320`).
- La feuille ne rejoue aucune mécanique de dés : elle consigne.
- Une coupe n'écrit ni PSP, ni blessure, ni or, ni évolution
  (`CUP_SHEET_RULES`, `competition-match-sheet-context.ts:75-83`) — et la coupe
  se joue en **résurrection**, le roster d'inscription rejouant à chaque ronde.

**Accidentel, et c'est la liste de travail** : §6.1 à §6.7, plus les trois
barèmes PSP du §4.

## 9. Priorités suggérées

| # | Chantier | Pourquoi d'abord |
|---|---|---|
| 1 | **`wired` dit la vérité** (§6.3) | Une ligne de code. Aujourd'hui la console ment à l'admin, ce qui est pire que de ne rien dire. |
| 2 | **Barème PSP unique** (§4) | Supprimer les copies de `game-state.ts:763` et `PostMatchSPP.tsx:6` au profit d'une source partagée. Corrige un affichage faux à coût quasi nul. |
| 3 | **`ttmLandings` + compétences de crédit** (§6.5) | Ajoute un compteur à `matchStats` et débloque Vol Fatal, Innovateur Violent et le +1 d'atterrissage d'un coup. |
| 4 | **Prières S3** (§6.1) | Le plus gros écart de règle. Suppose d'abord le point 3 (les prières 10/11 sont des règles de PSP). |
| 5 | **UI des 4 kickoff interactifs** (§6.2) | Tout le moteur est écrit ; il ne manque que l'écran. Gros gain de conformité par unité d'effort. |
| 6 | **Coups de pouce non câblés** (§6.3) | Treize effets à écrire. À séquencer par valeur de jeu : Chef Cuistot et Mercenaires d'abord. |
| 7 | **Alignement des Star Players** (§6.4) | Dépend du point 6 (`star_player` est un coup de pouce). |

## Hors périmètre, mais relevé au passage

`updatePreMatch` (`league-match-sheet.ts:716-719`) et `updatePostMatch`
(`:1017-1019`) ne vérifient que « participant **ou** commissaire ». Le contrôle
de côté n'existe que sur `advancementsHome/Away`. Tous les autres champs —
prières, coups de pouce, journaliers, gains manuels, bonus de classement,
`sppBonus`, achats, JDM, licenciements — sont écrivables par **l'un ou l'autre**
des deux coachs. À traiter séparément : ce n'est pas un écart de parité.
