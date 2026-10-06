# Exploration — Que vendre en Couronnes après les thèmes de dés ? (2026-10-06)

> **2026-10-06** — `/opsx:explore`, aucun code applicatif écrit. Suite directe
> du change `dice-theme-shop-and-crowns` (archivé le 2026-10-05), qui a ouvert
> la boutique de thèmes de dés et le solde de Couronnes en recette (flags
> `dice_themes` et `crowns`, OFF).
>
> Question de départ (coach) : *« On vient d'activer les couronnes et les
> thèmes de dés (sous FF pour la recette). Qu'est-ce qu'on peut proposer
> d'autre à l'achat avec ces couronnes ? »*

## 1. État des lieux : un puits, aucun robinet

Hors Pro League (gelée depuis le 2026-06-01, `PRO_LEAGUE_ENABLED=false`),
voici tout ce qui bouge le solde `ProWallet.crowns` :

| Sens | Mouvement | Montant | Code | Vivant ? |
|---|---|---|---|---|
| Source | Ajustement admin (`ADMIN_ADJUST`) | ± libre | `routes/admin-wallet.ts` | **oui — le seul** |
| Source | Remboursement d'un thème retiré (`ADMIN_REFUND`) | prix payé | `services/dice-theme-admin.ts` | oui |
| Source | Bonus d'inscription (`REWARD`, ref `first_signup`) | 1000 | `services/pro-wallet-rewards.ts` | gelé |
| Source | Bonus quotidien (`DAILY`) | 50 / 24 h | idem | gelé |
| Source | Gains de paris (`WIN`) | mise × cote | `services/pro-bet-settlement.ts` | gelé |
| Source | Succès (`BADGE`) | — | type déclaré dans `pro-wallet.ts`, **jamais écrit** | — |
| Puits | Thème de dés (`SINK`, ref `dice-theme:<id>`) | 250 / 400 | `services/dice-theme-preference.ts` | **oui — le seul** |
| Puits | Dédicace au Hall of Fame | 500 | `services/pro-hall-of-fame-dedicate.ts` | gelé |
| Puits | Entrée de tournoi Pro | 100 | `services/pro-tournament-entry.ts` | gelé |
| Puits | Paris (`BET`) | 1 – 100 000 | `services/pro-bet.ts` | gelé |

Aucun succès ne rapporte de Couronnes (`services/achievements.ts` n'a ni champ
de récompense ni appel à `credit`), et le seed n'en crédite aucune.

**Conséquence** : la question « que vendre ? » ne se sépare pas de « combien
un coach gagne par saison ». Sans rythme de gain, les prix de 250 et 400 ne
veulent rien dire, et la recette ne teste que des Couronnes offertes par
l'admin. C'est la suite déjà notée dans `openspec-suites.md` (« sources à
décider avant d'ouvrir `crowns` à tous ») et la gate du §5 de
[l'exploration des pronostics](./2026-09-27-pronostics-de-ligue.md) : au moins
deux puits, dont un à coût réel, et un plafond d'émission.

## 2. Décisions prises (2026-10-06)

1. **Les Couronnes restent 100 % gagnées.** Pas de passage en euros : il n'y a
   pas encore assez de matière ni d'utilisateurs pour le justifier. Le Season
   Pass payant du Sprint R (R.B.2, `priceEur`, Stripe) reste au placard.
   Principe déjà posé par `docs/roadmap/sprints/SPRINT-pro-league.md`
   (« Crowns gagnées uniquement »).
2. **Les couleurs d'équipe se débloquent par COACH**, pas par équipe (cf. §6.A).
3. **Le joker de pronostic est enterré.** Proposé au §5 du 2026-09-27
   (« doubler les points d'un pronostic par journée »), il achetait le titre
   d'Oracle — qui est tout l'intérêt du pick'em.
4. **Le plateau en ligne est hors périmètre.** Le jeu en ligne est derrière
   `online_play` (OFF par défaut, cf. `seed.ts`), pas ouvert au public et
   encore bugué. Les coachs jouent **sur table** et saisissent la feuille de
   match sur le site.
5. **La feuille est saisie APRÈS COUP**, pas pendant le match : elle n'est pas
   une vitrine « en direct » posée sur la table.

## 3. Les garde-fous de la boutique

- **Rien qui change un résultat.** Ni po, ni PSP, ni relance, ni coup de
  pouce, ni points de pronostic. « Les po sont la monnaie des coachs, les
  Crowns celle des tribunes » (exploration du 2026-09-27).
- **Pas de hasard.** Achat direct uniquement : pas de pack, pas de rareté
  tirée au sort. Même sans euros aujourd'hui, c'est la porte qu'on ne veut pas
  avoir à refermer le jour où la question du paiement reviendrait (loot box).
- **Ne jamais faire payer ce qui est gratuit aujourd'hui** : upload de logo,
  photo de joueur, description d'équipe restent gratuits.
- **Un titre ne s'achète pas** (Oracle, Champion…), et un habillage qui
  SIGNALE un statut (cadre « vétéran » selon le niveau, « légende » selon la
  carrière) est DÉRIVÉ et gratuit. Ce qui se vend, c'est un STYLE ; un statut
  acheté mentirait.

## 4. Où un cosmétique se voit, quand on joue sur table

```
   AVANT le match              PENDANT (sur table)           APRÈS (feuille saisie)
 ┌───────────────────┐    ┌───────────────────────┐    ┌───────────────────────────┐
 │ roster, achats    │    │ vrais dés             │    │ feuille validée           │
 │ impressions PDF   │───▶│ vraies figurines      │───▶│ séquence p.68 (D8, achats)│
 │ cartes joueurs    │    │ (le site est fermé)   │    │ classement, pronostics    │
 └───────────────────┘    └───────────────────────┘    └───────────────────────────┘
        ▲                                                        ▲
     IMPRIMÉ                                              PAGES DE LIGUE
```

| Qui le voit ? | Exemples |
|---|---|
| moi seul | thème de dés (l'adversaire voit les siens) |
| toute la ligue | couleurs et emblème au classement / calendrier / feuille, Gazette, épitaphe |
| la table | PDF imprimés, cartes joueurs, jetons |
| internet | page de partage `/r/[token]` et son image OG, carte joueur exportée |

Un cosmétique se vend parce qu'on le MONTRE. Or le thème de dés est surtout
dans la case « moi seul » — et sur table on lance de vrais dés : les dés
numériques n'apparaissent qu'au lanceur de la home, au D8 d'amélioration
(`AdvancementEditor`) et au récapitulatif des jets de Haine de la feuille.
Ce n'est pas une raison de le retirer, mais les prochains articles doivent
viser les cases « ligue », « table » et « internet ».

Piste mineure pour le puits existant : afficher sur la feuille le **tirage
d'amélioration** dans le thème du coach qui l'a lancé, visible de l'adversaire.

## 5. Les robinets (prérequis à l'ouverture de `crowns`)

**Principe : récompenser la PARTICIPATION, pas la victoire.** Sinon les
Couronnes deviennent un signe extérieur de domination et les nouveaux coachs
ne peuvent rien s'offrir. Sur table, l'activité EST la feuille validée.

| Source | Clé d'idempotence | Rattrapage | Risque de farm |
|---|---|---|---|
| Feuille de match validée (ligue ET coupe) | `sheet:<sheetId>` par coach | oui, `validatedAt` | faible : deux coachs + commissaire ; rien si les deux côtés appartiennent au même compte |
| Succès débloqué | `achievement:<slug>` | oui, `UserAchievement` persisté | nul (une fois par succès) |
| Points de pronostic | `predictions:<seasonId>` | oui, points dérivés des pronostics réglés | plafond par saison (§5 du 2026-09-27) |
| Palmarès (champion, Oracle) | `honour:<seasonId>:<kind>` | oui | nul |

Propriétés qui vont avec :

- **Une récompense de participation ne dépend pas du résultat**, donc une
  invalidation ne la change pas : pas de reversion à écrire, et le piège
  « un correctif de calcul ne corrige pas un compteur persisté » ne se pose
  pas. Une feuille invalidée puis revalidée ne recrédite pas (même clé).
- **Une coupe compte.** `CUP_SHEET_RULES.economyEnabled = false` parle de l'or
  d'ÉQUIPE ; les Couronnes sont au niveau du COACH, un match de coupe joué est
  un match joué.
- **Pas de forfait** : pas de feuille, pas de Couronnes.
- **Des sources rattrapables rendent la date d'ouverture indifférente** : on
  n'a pas besoin de créditer pendant la recette, un premier passage idempotent
  à l'ouverture crédite l'historique (effet « vos Couronnes vous attendent »).
- **Plafond d'émission** par coach et par période, calculé depuis le registre
  des récompenses au moment du crédit.

Ordre de grandeur, **chiffres à calibrer** (hypothèses pour fixer les idées) :

```
 coach de ligue « moyen », une saison d'environ 10 rencontres
   10 feuilles validées × 25        ≈ 250
   3-4 succès × 50                  ≈ 175
   pronostics (plafonnés)           ≈ 100
   ───────────────────────────────────────
   ≈ 500 Couronnes / saison  →  1 thème d'équipe + 1 article de Gazette
```

Deux sources existantes à NE PAS rebrancher telles quelles :

- **Bonus quotidien** : il récompense la connexion, pas le jeu, et la Pro
  League a dû inventer les dédicaces pour freiner l'hyperinflation qu'il
  créait.
- **Bonus d'inscription de 1000** : à lui seul deux thèmes et demi face à un
  rythme d'environ 500 par saison. À réduire ou à supprimer.

## 6. Le catalogue retenu

### A. L'identité d'équipe — un achat, visible partout (priorité)

**Couleurs d'équipe, débloquées par coach.** C'est le seul article qui se voit
à la fois au classement, au calendrier, dans l'en-tête de la feuille, sur la
page de partage et son image OG, dans les PDF et sur les cartes joueurs.

- **Propriété = le coach, valeur = l'équipe.** Le déblocage est acheté une
  fois ; chacune de ses équipes peut alors porter ses couleurs. Les valeurs
  vivent sur `Team` (deux colonnes nullables, `null` = couleurs canoniques du
  roster, `ROSTER_COLORS`) — lisibles sans backfill, sur le modèle de
  `ProTeam.primaryColor`.
- **Une seule résolution** : `getTeamColors(slug, override?)` accepte déjà une
  surcharge (`packages/game-engine/src/rosters/team-colors.ts`). Tout
  consommateur en part, comme `effectiveRegionalRules` pour les Ligues.
- **Contrôle à l'écriture, pas à la lecture** : le classement lit N équipes,
  il ne doit pas joindre les déblocages de N coachs. Un retrait admin du
  déblocage remet explicitement à `null` les couleurs des équipes du coach.
- **Argument propre au jeu sur table** : les couleurs d'une équipe sont celles
  de ses FIGURINES PEINTES. C'est un argument fort pour un nuancier libre (avec
  contrôle de contraste) plutôt que des palettes nommées — à trancher (§10).

**Blasons et cadre d'emblème.** `renderTeamLogoSvg` dessine 4 formes
(`TEAM_LOGO_SHAPES` : écu, cercle, losange, hexagone) et un glyphe par roster
pour les équipes sans logo : formes et glyphes supplémentaires à vendre. Un
**cadre** (lauriers, chaînes, crânes) habille aussi un logo uploadé.

**Correctif gratuit au passage** : l'export PDF du roster laisse une cellule
vide « pour le logo qui n'est pas inclus » (`apps/web/app/me/teams/utils/exportPDF.ts`).
Mettre le logo dans le PDF est une correction de base — gratuite, et livrable
seule dès maintenant.

### B. La Gazette de MA rencontre — le puits à coût réel

Un « journaliste » écrit le récit d'une rencontre validée. La feuille est une
matière première très riche : coup d'envoi, météo, prières, sorties, morts,
morts relevés, Joueur du Match. Réutilise `pro-gazette-llm.ts` (Haiku) et
`summarizeMatchSheet` ; le récap de saison (`computeSeasonRecap`) existe déjà
sans LLM, la Gazette en serait le pendant par rencontre. Chaque article coûte
des tokens : il retire vraiment des Couronnes de la circulation.

Points à trancher dans la proposition :

- **Qui paie** : l'un des deux coachs de la rencontre, un article par feuille.
- **Échec du LLM** : débit conditionnel (réservation), génération, puis
  remboursement en cas d'échec — il faut un type de remboursement SYSTÈME,
  `ADMIN_REFUND` étant réservé à l'admin.
- **Invalidation** : l'article est masqué ; à la revalidation, une
  régénération est offerte (le coach a payé l'article de CE match).
- **Visibilité** : celle de la ligue (`services/league-access`) — une ligue
  privée garde sa Gazette privée. Coupes comprises (feuille polymorphe).
- **Modération** : noms d'équipes et de joueurs saisis par les coachs ⇒
  sortie passée au filtre de mots interdits (Q.B.2).

### C. Ce qui va sur la table — l'impression (si les coachs impriment, §10)

- **Cartes joueurs** : `card-art.tsx` est déjà au format carte poker
  (750 × 1050 px = 63,5 × 88,9 mm à 300 dpi). Il manque une **planche A4 de
  9 cartes** (3 × 3 tient sur une A4) et des **familles de cadres** payantes
  (parchemin, acier, Chaos…). Le cadre de statut, lui, reste dérivé (§3).
- **Thèmes d'impression** : feuille d'équipe, fiche de compétences, feuille de
  rencontre papier de 5 pages. Coût faible : `competition-pdf/theme.ts` repose
  sur une seule palette (`PDF_COLORS`).
- **Planche de jetons** aux couleurs et au blason de l'équipe : pastilles
  numérotées pour socles de 32 mm, marqueur de tour, compteur de relances,
  dugout. Support NOUVEAU : base gratuite ou non, à trancher (§10).

### D. Le récit de ligue

- **Épitaphe d'un joueur mort.** En ligue sur table, une mort est un moment
  fort. Copie conforme de la dédicace du Hall of Fame (280 caractères, filtre
  Q.B.2) ; le « cimetière » de l'équipe (liste des morts) reste gratuit, seule
  l'épitaphe se paie. Une mort annulée (`revertPlayerStatus`) masque
  l'épitaphe et la rembourse.
- **Épingle de chambrage** sur une rencontre : un message par coach et par
  rencontre.
- **Trophée de ligue ou de coupe**, offert par le commissaire, affiché au
  palmarès.
- **Cadeau** : offrir un article à un autre coach (`UserDiceTheme.source`
  connaît déjà `admin_grant`, il suffirait d'un `gift` et d'une notification
  interne).

### E. Le profil du coach (dernier)

Cadre ou bannière de profil, flair au classement général
(`CoachProfileHeader` n'affiche que nom, ELO et badge supporter ;
`/leaderboard` n'a aucun flair). Surface la moins vue d'une ligue sur table.

### F. Le plateau en ligne — en attente

Palettes de terrain (`packages/ui/src/board/terrain-skins.ts`, palettes sans
texture), figurines (`TEAM_SPRITE_MANIFESTS` vide), thème de dés de
l'adversaire. À reprendre quand le jeu en ligne sera ouvert et fiable. Noté
pour ce jour-là : le terrain est aujourd'hui un réglage du MATCH, accepté par
le serveur sans liste ni contrôle de propriété.

## 7. Écarté, et pourquoi

| Idée | Raison |
|---|---|
| Joker de pronostic | achète le titre d'Oracle — décision du 2026-10-06 |
| Or d'équipe, PSP, relances, coups de pouce | pay-to-win (déjà rejeté le 2026-09-27) |
| Entrée de compétition en Couronnes | exclut les nouveaux (2026-09-27) |
| Packs, rareté tirée au sort | loot box |
| Titres achetables | dévaluent les titres gagnés |
| Bonus quotidien | récompense la connexion, hyperinflation vécue en Pro League |
| Season Pass en euros (R.B.2) | pas assez de matière ni d'utilisateurs — décision du 2026-10-06 |
| Plateau en ligne | jeu en ligne fermé (FF) et bugué — en attente |

## 8. Esquisse technique (pour la proposition, pas pour coder ici)

Trois natures d'achat, qui ne se modélisent pas pareil :

```
 POSSESSION (débloquée à vie, s'équipe)    dés, couleurs, blason, cadre, style de carte
    └── portée : le coach

 CONSOMMABLE (produit un contenu)          Gazette, épitaphe, épingle
    └── lié à une feuille ou un joueur, remboursé si échec ou annulation

 CADEAU (acheté pour un autre)             article offert, trophée de ligue
```

- **Possessions** : une table générique (`CosmeticItem { kind, slug, prix,
  enabled, ordre, libellés }` + `UserCosmetic { userId, kind, slug, source }`,
  unique `(userId, kind, slug)`) pour tout nouvel article. `DiceTheme` /
  `UserDiceTheme` RESTENT : sous `db push`, un renommage est un DROP + CREATE.
  La boutique fusionne les deux. Les couleurs d'équipe sont un article
  `kind = team_colors` sans catalogue de variantes.
- **Consommables** : chacun sa table (article de Gazette, épitaphe), avec la
  référence de son débit. Ils ne partagent que le débit conditionnel et le
  remboursement.
- **Récompenses** : `REWARD` à référence stable (`sheet:<id>`,
  `achievement:<slug>`…). L'unicité ne peut pas venir d'un index ajouté sur
  `ProTransaction` : des doublons historiques de la Pro League feraient
  échouer le `db push`. Elle vient d'une table dédiée au registre des
  récompenses (unique `(userId, sourceKey)`), écrite dans la même transaction
  que le crédit — c'est aussi elle qui sert le plafond.
- **Écritures du solde** : incrément ou décrément conditionnel uniquement
  (spec `crowns`), y compris pour les remboursements système.

## 9. Découpage proposé

```
 0. logo dans le PDF du roster ───── correctif gratuit, indépendant, tout de suite
 1. crowns-earning ───────────────── feuilles validées + succès + plafond + registre
        │                            (prérequis à l'ouverture de `crowns`)
        ├── 2. team-colors ───────── déblocage par coach, colonnes Team, résolution unique,
        │                            propagation (classement, feuille, PDF, cartes, OG)
        ├── 3. match-gazette ──────── article payant, remboursement système
        ├── 4. print-kit ─────────── planche de cartes, cadres, thèmes PDF (si impression)
        └── 5. player-memorial ───── épitaphe
```

Les lots 2 à 5 sont indépendants entre eux ; ils supposent seulement que les
Couronnes se gagnent (lot 1).

## 10. Questions ouvertes

- **Les coachs impriment-ils** leurs rosters et leurs cartes ? Si oui, le lot 4
  monte juste après les couleurs.
- **Un support nouveau** (planche de jetons, planche de cartes) : base
  gratuite et styles payants, ou entièrement payant ?
- **Couleurs** : nuancier libre (les couleurs de peinture des figurines) ou
  palettes nommées ? Penchant : nuancier libre avec contrôle de contraste.
- **Plafond** : par saison de ligue, ou par mois calendaire (un coach peut
  jouer dans plusieurs ligues) ?
- **Bonus d'inscription** : réduire (un thème classique, 250 ?) ou supprimer ?
- **Montants** des sources et prix des nouveaux articles, à calibrer sur le
  rythme réel de feuilles validées en prod.
- **Gazette** : seul un coach de la rencontre paie, ou aussi le commissaire,
  voire un spectateur d'une ligue ouverte ?
