# Retours testeurs « ligue 2027 » — analyse et plan d'action

> Exploration du 2026-11-09, aucun code. Trois testeurs, 13 retours. Chaque
> point est confronté au code (chemins relatifs à la racine du dépôt) avant
> d'être classé : **bug** (le site contredit la règle ou perd des données),
> **manque** (la fonctionnalité n'existe pas), **découvrabilité** (elle existe
> mais le testeur ne l'a pas trouvée).

## Synthèse

| # | Retour | Nature | Effort | Lot |
|---|---|---|---|---|
| A | Coups de pouce : budget de l'outsider pas à jour | **bug** + manque | M | 1 |
| B | Un coach possède les deux équipes : feuille non validable | **bug** | M | 1 |
| C | Journaliers : seuls les Trois-quarts 0-16 (p.94) | **bug de règle** (à confirmer livre en main) | S | 1 |
| D | « Esquive en Force » en version 2020 | **bug de règle** (texte ET moteur) | S + audit M | 1 |
| E | Renommer / supprimer une journée | manque | S | 2 |
| F | Supprimer une saison | manque | M | 2 |
| G | Éditer les play-offs (taille, qualifiés) | en partie existant, en partie manque | M | 2 |
| H | Ne voir que « mes » ligues | manque | S | 2 |
| I | Compétence aléatoire ≠ compétence choisie | manque (donnée déjà là) | S | 3 |
| J | Acheter des fans à la création | découvrabilité + manque dans l'assistant | S | 3 |
| K | Numéro NAF dans le profil, vérifié | manque | S (saisie) / M (vérif.) | 3 |
| L | Ligue libre (matchs à la demande, % de victoires, seuil 5 matchs) | nouvelle fonctionnalité | L | 4 |

Ordre proposé : lot 1 avant que la ligue 2027 démarre (les points A et B
faussent des feuilles réelles), lot 2 pendant la saison régulière, lot 3 au
fil de l'eau, lot 4 en change OpenSpec dédié.

---

## Lot 1 — Bugs à corriger avant la ligue 2027

### A. Coups de pouce : budget en direct et ordre d'achat

**Règle** (compendium publié, `apps/web/app/compendium/data/rules-bb-2025.json`
l.589-603) : 1) l'équipe à la VEA la plus haute dépense d'abord sa trésorerie ;
2) l'outsider reçoit une Petite Monnaie = écart de VEA + ce que l'adversaire a
dépensé ; 3) il la dépense (+ jusqu'à 50 000 po de trésorerie) ; 4) à VEA
égales, personne ne puise dans sa trésorerie.

**Constat** — quatre défauts, dont un qui PERD des données :

1. **Écrasement des achats adverses.** `savePreMatch`
   (`apps/web/app/leagues/pairings/[id]/sheet/page.tsx` l.651-681) envoie
   `inducementsHome` ET `inducementsAway` depuis l'état local. L'outsider qui
   enregistre avec une page ouverte avant l'achat du favori remplace la liste
   du favori par une liste périmée (ou vide) ; le serveur l'accepte
   (`updatePreMatch`, `apps/server/src/services/league-match-sheet.ts`
   l.1576-1710).
2. **Budget servi sans la dépense adverse.** `getMatchSheet` construit la
   référence avec `spent: { home: 0, away: 0 }` (l.5399-5406) : la Petite
   Monnaie affichée n'inclut jamais ce que le favori a acheté. Seule la
   validation et le PATCH la recalculent avec les montants stockés — d'où
   « en fin de match c'est bien calculé ».
3. **Pas de rafraîchissement.** `PreMatchPanel`
   (`_components/MatchSheetPanels.tsx` l.1149+) garde `indH`/`indA` en
   `useState(initial…)` sans resynchronisation ni `key` ; aucune relecture
   périodique. Le détail « Petite Monnaie + cagnotte » (l.1019-1030) ne
   s'additionne pas au budget affiché.
4. **VEA égales** : `calculatePettyCash`
   (`packages/game-engine/src/core/inducements.ts` l.474-510) laisse les deux
   équipes puiser dans toute leur trésorerie, contrairement à l'étape 4.

**Plan**

- Serveur : servir le budget EFFECTIF (dépense adverse stockée via les
  montants de la feuille) dans `getMatchSheet` ; le PATCH d'avant-match
  n'écrit que le côté du coach appelant (le commissaire garde les deux) —
  même posture de FUSION que les journaliers et la Haine.
- Moteur : étape 4 (VEA égales ⇒ trésorerie à 0 pour les coups de pouce),
  test unitaire dédié.
- Web : `key` sur le panneau (ou resynchronisation à chaque `load()`),
  relecture au retour sur l'onglet + toutes les ~15 s sur l'onglet
  Avant-match, détail lisible « écart de VEA X + dépense adverse Y + trésorerie
  (plafond 50 000) Z = budget ».
- Ordre d'achat (demande explicite) : bouton « J'ai fini mes achats » côté
  favori (`inducementsDoneHomeAt/AwayAt`, colonnes nullables, `null` =
  feuille antérieure sans contrainte). Tant que le favori n'a pas confirmé,
  l'outsider voit « En attente des achats de X » et son budget provisoire ;
  la confirmation se retire si le favori modifie sa liste. Pas de verrou dur
  pour le commissaire.
- Tests : module pur du budget effectif (favori / outsider / égalité / coupe),
  test de route « un coach ne peut pas écraser le côté adverse », test web du
  panneau qui se met à jour.

### B. Un même coach possède les deux équipes

**Constat.** `coachSide` (`league-match-sheet.ts` l.724-728) teste domicile en
premier : un coach propriétaire des deux équipes est TOUJOURS « domicile ».
Conséquences : `submitByCoach` ne passe jamais à `both_submitted` (donc ni
notification, ni entrée « feuilles à valider » chez le commissaire),
`unsubmitByCoach` ne touche que domicile, et quatre actions refusent le côté
extérieur (`updateHateChoices` 403, `updateRaisedDead` 403, évolutions
`advancement_wrong_side`, tirage d'évolution d'un journalier). En coupe avec
double validation, c'est un blocage dur (`coach_submissions_missing`). Côté
web, `mySide` vaut toujours « home » et aucun sélecteur de côté n'existe.

**Plan**

- Serveur : remplacer les comparaisons `side !== X` par un prédicat
  d'appartenance `ownsSide(ctx, userId, side)` (Haine, mort relevé,
  évolutions, tirage de journalier) ; soumission / retrait de soumission avec
  un corps Zod `{ side?: "home" | "away" }`, obligatoire seulement quand le
  coach possède les deux côtés ; `getMatchSheet` expose `viewerSides`.
- Web : quand `viewerSides` a deux entrées, sélecteur « Je saisis pour :
  [équipe A] / [équipe B] » (persisté dans l'URL `?side=`), boutons de
  soumission par côté.
- Question ouverte : une ligue doit-elle seulement AUTORISER qu'un coach
  oppose ses deux équipes ? (Rien ne l'interdit aujourd'hui, ni en ligue ni en
  coupe.) Proposition : autorisé, mais signalé au commissaire.
- Tests : table sur les six actions côté extérieur pour un double
  propriétaire ; e2e soumission home puis away ⇒ `both_submitted`.

### C. Journaliers : Trois-quarts 0-16 uniquement

**Constat.** `isJourneymanEligible`
(`apps/server/src/services/league-sheet-journeymen.ts` l.93-99) retient un
poste s'il est 0-12+ OU si ses mots-clés disent « Trois-quart » — décision
posée en septembre (cf. CLAUDE.md, exemple du Gobelin orque 0-4). Pour
l'Alliance du Vieux Monde Saison 3, cela propose Trois-Quart Humain (0-16)
mais aussi Aspirant Halfling (0-3) et Trois-Quart Nain (0-3).

Le compendium publié se contredit lui-même (l.580-581) : « un journalier
correspond toujours à un poste de Trois-quart … avec une quantité 0-16 » puis
« un poste de Trois-quart limité à une quantité 0-16 ne peut pas servir de
journalier » (phrase manifestement fautive).

**Plan**

1. **Vérifier p.94 livre en main** (la transcription
   `docs/regles-bb-2025/` est hors dépôt). Si la règle dit bien « 0-16 » :
   critère = Trois-quart ET quantité 0-16 (repli 0-12+ pour les rosters
   Saison 2 dont le Trois-quart est 0-12).
2. **Découpler le mort relevé** : `raisedDeadPositionOptions`
   (`league-sheet-raised-dead.ts` l.404-413) réutilise la même fonction ; sa
   règle (« un Trois-quart de la fiche ») ne doit pas changer par ricochet.
3. Feuilles existantes : un poste stocké devenu inéligible retombe déjà sur le
   défaut (rang inconnu ⇒ choix global ⇒ Trois-quart de base) ; les feuilles
   VALIDÉES ne bougent pas (le poste est baké dans le gel).
4. Corriger la phrase du compendium, mettre à jour CLAUDE.md, les tests
   (`league-sheet-journeymen.test.ts`, spec e2e orque qui suppose le Gobelin
   éligible) et la fixture `/__test/seed-rosters`.

### D. « Esquive en Force » et audit des compétences Saison 3

**Constat.** Le site sert le texte 2020 (+1 si F ≤ 4, +2 si F ≥ 5, une fois
par activation) : `apps/server/src/static-skills-data.ts` l.388-394, sans
surcharge dans `static-skills-data-s3.ts`. Le moteur applique aussi la règle
2020 (`packages/game-engine/src/mechanics/break-tackle.ts`,
`st >= 5 ? 2 : 1`). Texte 2025 (`docs/reference/extraction_competences_blood_bowl.md`
l.138-140) : une fois par TOUR, +1 si F ≤ 3, +2 si F = 4, +3 si F ≥ 5.

**Plan**

- Ajouter `break-tackle` à `SEASON_3_SKILL_DESCRIPTIONS` (FR + EN), corriger
  la mécanique du moteur pour le ruleset Saison 3 (test par palier de Force),
  republier en prod via `update-skills-and-rules-from-ocr`.
- **Audit systématique** (le testeur se doute qu'il y en a d'autres) : test de
  cohérence qui confronte chaque compétence Saison 3 servie à
  `docs/reference/extraction_competences*.md` (~88 fiches) et liste les écarts
  — même esprit que `kickoff-table-consistency.test.ts`. 137 compétences au
  moteur, 67 surcharges S3 seulement : l'écart est probablement non nul. Les
  écarts trouvés donnent une liste de corrections (texte, et moteur quand la
  compétence est câblée).

---

## Lot 2 — Gestion de ligue côté commissaire

### E. Renommer / supprimer une journée

**Constat.** `LeagueRound.name` existe déjà, mais aucune route PATCH ni
DELETE de journée ; l'éditeur `ManualScheduleEditor.tsx` crée des journées et
des rencontres, sans les renommer ni les supprimer.

**Plan**

- `PATCH /leagues/rounds/:roundId` (`name`, dates) et
  `DELETE /leagues/rounds/:roundId`, commissaire (`ensureLeagueCreatorByRound`
  existe).
- Suppression refusée si une rencontre est engagée (`in_progress`, jouée,
  forfait, feuille validée, `Match.leagueScoredAt`) ou si c'est une journée de
  play-off (`kind = playoff` OU `bracketSlot`). Les rencontres « à jouer » et
  leurs brouillons partent en cascade (pronostics compris) — confirmation
  explicite à l'écran. Pas de renumérotation (le libellé affiché est le nom).
- Web : crayon + corbeille par journée dans l'éditeur et le calendrier.

### F. Supprimer une saison

**Constat.** Aucune suppression de saison. La cascade Prisma emporterait
poules, inscrits, journées, rencontres, feuilles et pronostics, mais ne
DÉFAIT pas ce que les feuilles validées ont écrit sur les équipes (PSP,
trésorerie, fans, blessures), et laisserait orphelins le fan offert
(`freeFanGrant`), les récompenses de Couronnes et le journal d'équipe.

**Plan**

- `DELETE /leagues/seasons/:seasonId` (commissaire ou admin), autorisé
  seulement si aucune rencontre n'a d'effet persisté (aucune feuille validée,
  aucun résultat saisi) — même posture que `commissioner-team-removal`
  (saison `draft`/`scheduled` ou rien de joué).
- Fans offerts repris via une variante saison de
  `withLeagueFreeFansRevokedForLeague` (motif `season_deleted`), inscrits
  notifiés après la réussite (patron `competition-lifecycle`).
- Pour une saison jouée : renvoyer vers « clôturer » ou « archiver la ligue »,
  avec le message qui l'explique. (Supprimer une saison jouée en rejouant
  toutes les invalidations est faisable mais risqué ; à ne faire que sur
  demande.)

### G. Éditer les play-offs

**Déjà possible** (probablement non trouvé) : choisir la taille 2/4/8 avant
génération, lancer en forçant, puis — tant qu'aucun match de play-off n'a
commencé, publié ou non — remplacer n'importe quel qualifié et réordonner les
têtes de série (`PlayoffParticipantsEditor`, `PATCH
/seasons/:id/playoff-bracket/participants`). Le scénario du testeur (finale à
2, le 2e part ⇒ mettre le 3e) passe donc tant que la finale n'est pas jouée.

**Manques**

1. Changer la TAILLE après génération (409 aujourd'hui) ⇒ bouton
   « Réinitialiser le bracket » (supprime les tours de play-off si aucun match
   n'a commencé, puis la taille redevient éditable).
2. Remplacer une équipe dans une rencontre de bracket non jouée alors qu'une
   AUTRE rencontre est déjà jouée (aujourd'hui un seul match engagé gèle tout)
   ⇒ remplacement par slot.
3. Retrait d'un coach en cours de saison : seul l'admin peut forcer, et rien
   ne propage le retrait aux rencontres restantes ⇒ retrait par le commissaire
   avec forfait automatique des rencontres non jouées (cf. coupe).
4. Découvrabilité : le flux « lancer ⇒ bracket NON publié ⇒ ajuster ⇒
   publier » doit être annoncé dans le panneau de lancement.

Question ouverte au testeur : le bracket était-il déjà généré quand il a
voulu remplacer le 2e ?

### H. N'afficher que mes ligues

**Constat.** `GET /leagues` sert ligues publiques + les miennes + invitations,
sans filtre « mes ligues » ; la page n'a qu'un filtre de statut. Idem coupes
(les indicateurs « créateur » / « inscrit » sont déjà calculés côté web).

**Plan.** Paramètre `scope=mine` (commissaire OU coach inscrit, toutes
saisons) dans `listLeaguesQuerySchema` + `listLeagues` ; onglets « Mes ligues
/ Toutes » sur `/leagues` (défaut « Mes ligues » dès qu'il y en a une),
idem `/cups`. Au passage, vérifier `hasTeamParticipating`
(`apps/web/app/cups/page.tsx` l.284-285, compare peut-être un id
d'inscription à un id d'équipe).

---

## Lot 3 — Confort

### I. Compétence aléatoire vs choisie

**Constat.** La donnée existe : `TeamPlayer.advancements` (JSON) porte `type`
(`random-primary`…) et `isRandom`, et `GET /team/:id` la sert déjà. Seul
l'affichage (`apps/web/app/me/teams/components/SkillTooltip.tsx`, bordure
orange pour toute compétence acquise) l'ignore.

**Plan.** Passer `advancements` à `SkillTooltip` (8 points d'appel) ; une
compétence tirée garde la bordure orange ET reçoit un petit dé (`D6Icon`, pour
suivre le thème de dés du coach) ; légende mise à jour. Repli : historique
sans type ⇒ affichage actuel.

### J. Acheter des fans à la création

**Constat.** Le constructeur complet (`/me/teams/new`) propose déjà les Fans
Dévoués (0 à 6, payants, envoyés à `POST /team/build`). L'**assistant de
première équipe** (`FirstTeamWizard.tsx`, `POST /team/create-from-roster`)
pose en dur 0 relance, 0 fan, pas d'apothicaire : c'est le chemin
« créer, valider, puis modifier ».

**Plan.** Ajouter une étape « Staff » à l'assistant (relances, fans,
apothicaire, au prix du moteur) OU un lien « Personnaliser » vers le
constructeur complet ; rendre le compteur de fans plus visible dans le
constructeur. Rappel : l'équipe ne reçoit son fan offert qu'en s'inscrivant en
ligue.

### K. Numéro NAF

**Constat.** `User.nafName` existe (pseudo NAF, route `PATCH /user/naf`) mais
aucun écran ne le propose ; `services/naf-sync.ts` est un bouchon (le format
de l'API NAF n'a jamais été confirmé). Aucun numéro de membre.

**Plan en deux temps.**
1. `nafNumber` (entier, nullable, unique) + champ dans `/me/profile`
   (contrôle de format, conflit d'unicité expliqué), affiché sur la fiche
   coach.
2. Vérification : à préciser — contrôle contre l'annuaire public de
   thenaf.net (hôte réseau à autoriser, format à valider) avec marqueur
   `nafVerifiedAt`, ou validation manuelle par un admin. Question ouverte.

---

## Lot 4 — La ligue libre (change OpenSpec dédié)

**Besoin.** Les coachs jouent quand ils veulent contre qui ils veulent, avec
plusieurs équipes ; classement au pourcentage de victoires avec un bonus au
nombre de matchs joués ; une équipe n'est classée qu'à partir de 5 matchs.

**Ce qui existe déjà** : plusieurs équipes par coach dans une saison (seule
contrainte : une équipe par saison) ; rencontres créées à la main.
**Ce qui bloque** : une rencontre exige une journée (`LeaguePairing.roundId`
obligatoire), seul le commissaire crée des rencontres, la garde « journée
précédente non close » raisonne par numéro de journée, et le classement ne
connaît ni pourcentage ni seuil.

**Proposition de conception (à valider en `/opsx:explore`)**

- `League.format` nullable (`null` = standard, `open` = libre), sans
  `@default`.
- Pas de rencontre sans journée : les journées d'une ligue libre sont créées
  PARESSEUSEMENT, une par mois (« Novembre 2026 ») — calendrier, pronostics,
  feuilles et exports continuent de fonctionner sans apprendre un nouveau cas.
- Un coach inscrit DÉCLARE un match (son équipe contre une équipe de la
  saison) ; il atterrit dans la journée du mois ; le commissaire peut
  supprimer. Garde de fraîcheur : chronologique par équipe plutôt que par
  numéro de journée.
- Classement : nouveau mode (module pur, à côté de
  `league-standings-order`) — % de victoires + bonus de participation, seuil
  de qualification configurable (5 par défaut), équipes sous le seuil listées
  à part « non classées (n/5) ».

**Questions à trancher avec les testeurs** : formule exacte (un nul vaut-il
une demi-victoire ? quel bonus par match, plafonné ?) ; nombre maximal de
matchs contre le même adversaire ; un coach peut-il opposer ses propres
équipes ; la ligue libre a-t-elle des play-offs et une date de fin.

---

## Mise en œuvre

Conformément aux consignes de vague (CLAUDE.md, « Consignes permanentes ») :
lots 1 à 3 sur une branche, un commit atomique par point, un test par point,
logique de sélection en modules purs ; lot 4 en change OpenSpec séparé. Les
colonnes ajoutées (`inducementsDone*At`, `nafNumber`, `League.format`) sont
nullables et lues sans backfill (`db push` en prod).

Questions à poser aux testeurs avant de coder :

1. p.94 : la règle des journaliers dit-elle bien « Trois-quart 0-16 »
   uniquement ? (C)
2. Un coach peut-il opposer ses deux équipes en ligue ? (B)
3. Le bracket était-il déjà généré lors du départ du 2e ? (G)
4. « Vérifier » le numéro NAF : contrôle automatique ou validation admin ? (K)
5. Formule du classement de la ligue libre. (L)
