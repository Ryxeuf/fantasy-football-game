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
6. **Les coachs n'impriment pas.** Le kit d'impression (planche de cartes,
   cadres de cartes à imprimer, thèmes PDF, planche de jetons) passe en
   attente (§6.C).
7. **Un support nouveau a une version de base GRATUITE** ; seuls ses styles se
   paient (§3).
8. **Les couleurs d'équipe sont des PALETTES NOMMÉES**, pas un nuancier libre
   (§6.A).
9. **Le plafond d'émission se compte par SAISON DE LIGUE** (§5).

## 3. Les garde-fous de la boutique

- **Rien qui change un résultat.** Ni po, ni PSP, ni relance, ni coup de
  pouce, ni points de pronostic. « Les po sont la monnaie des coachs, les
  Crowns celle des tribunes » (exploration du 2026-09-27).
- **Pas de hasard.** Achat direct uniquement : pas de pack, pas de rareté
  tirée au sort. Même sans euros aujourd'hui, c'est la porte qu'on ne veut pas
  avoir à refermer le jour où la question du paiement reviendrait (loot box).
- **Ne jamais faire payer ce qui est gratuit aujourd'hui** : upload de logo,
  photo de joueur, description d'équipe restent gratuits.
- **Un support NOUVEAU naît avec une version de base gratuite** (décision du
  2026-10-06) : la boutique vend l'HABILLAGE, pas l'accès. Les couleurs
  canoniques du roster sont la base gratuite des palettes ; un cimetière
  d'équipe serait gratuit, l'épitaphe payante. Seule exception assumée : un
  consommable à coût réel (la Gazette), qui est un service, pas un support.
- **Un titre ne s'achète pas** (Oracle, Champion…), et un habillage qui
  SIGNALE un statut (cadre « vétéran » selon le niveau, « légende » selon la
  carrière) est DÉRIVÉ et gratuit. Ce qui se vend, c'est un STYLE ; un statut
  acheté mentirait.

## 4. Où un cosmétique se voit, quand on joue sur table

```
   AVANT le match              PENDANT (sur table)           APRÈS (feuille saisie)
 ┌───────────────────┐    ┌───────────────────────┐    ┌───────────────────────────┐
 │ roster, achats    │    │ vrais dés             │    │ feuille validée           │
 │ (rien d'imprimé)  │───▶│ vraies figurines      │───▶│ séquence p.68 (D8, achats)│
 │                   │    │ (le site est fermé)   │    │ classement, pronostics    │
 └───────────────────┘    └───────────────────────┘    └───────────────────────────┘
                                                                 ▲
                                                          PAGES DE LIGUE
```

| Qui le voit ? | Exemples |
|---|---|
| moi seul | thème de dés (l'adversaire voit les siens) |
| toute la ligue | couleurs et emblème au classement / calendrier / feuille, Gazette, épitaphe |
| la table | rien : les coachs n'impriment pas (décision 6) |
| internet | page de partage `/r/[token]` et son image OG, carte joueur exportée |

Un cosmétique se vend parce qu'on le MONTRE. Or le thème de dés est surtout
dans la case « moi seul » — et sur table on lance de vrais dés : les dés
numériques n'apparaissent qu'au lanceur de la home, au D8 d'amélioration
(`AdvancementEditor`) et au récapitulatif des jets de Haine de la feuille.
Ce n'est pas une raison de le retirer, mais les prochains articles doivent
viser les cases « ligue » et « internet » — la case « table » est vide, et
c'est la page de LIGUE qui porte presque tout.

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
- **Plafond d'émission par coach et par SAISON DE LIGUE** (décision 9),
  calculé depuis le registre des récompenses au moment du crédit. Un coach
  inscrit dans deux ligues a deux plafonds : c'est voulu, il joue deux fois
  plus. Une COUPE n'a pas de saison : la coupe elle-même tient lieu de
  période (clé `season:<seasonId>` ou `cup:<cupId>`). Les succès, uniques par
  nature, restent hors plafond ; feuilles, pronostics et palmarès y entrent.

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

**Palettes d'équipe, achetées par le coach.** C'est le seul article qui se
voit à la fois au classement, au calendrier, dans l'en-tête de la feuille, sur
la page de partage et son image OG, et sur les cartes joueurs exportées.

- **Des palettes NOMMÉES** (décision 8), pas un nuancier libre : un catalogue
  (« Rouge sang & or », « Vert marais & os »…) dont chaque entrée porte une
  couleur principale et une secondaire. Le contraste est garanti par la
  curation, et chaque palette est un article — un vrai puits, là où un
  nuancier libre ne se vendait qu'une fois. Les coachs peignent leurs
  figurines : le catalogue doit couvrir les schémas classiques pour qu'une
  équipe retrouve SES couleurs.
- **La base est gratuite** (décision 7) : les couleurs canoniques du roster
  (`ROSTER_COLORS`) restent le défaut de toute équipe.
- **Propriété = le coach, choix = l'équipe** (décision 2). Une palette achetée
  sert à TOUTES ses équipes ; chacune choisit la sienne parmi celles que son
  coach possède. Le choix vit sur `Team` (une colonne nullable portant le slug
  de la palette, `null` = couleurs du roster) — lisible sans backfill.
- **On stocke le slug, pas les couleurs** : corriger une teinte en admin
  corrige toutes les équipes qui la portent. Une palette n'a AUCUN fichier
  (contrairement aux PNG des dés) : elle peut être entièrement « base
  d'abord », créée et modifiée en admin sans déploiement, avec un contrôle de
  contraste À L'ÉCRITURE (une palette illisible n'est jamais servie).
- **Une seule résolution** : slug → couleurs via le catalogue caché, puis
  `getTeamColors(slug, override?)`, qui accepte déjà une surcharge
  (`packages/game-engine/src/rosters/team-colors.ts`). Tout consommateur en
  part, comme `effectiveRegionalRules` pour les Ligues.
- **Possession contrôlée à l'écriture, pas à la lecture** : le classement lit
  N équipes, il ne joint pas les acquisitions de N coachs. À la lecture, un
  slug inconnu (palette supprimée) retombe sur les couleurs du roster — même
  posture que les thèmes de dés. Retirée de la vente ≠ retirée à l'acheteur ;
  un retrait admin d'une palette à un coach remet à `null` les équipes de ce
  coach qui la portaient.

**Blasons et cadre d'emblème.** `renderTeamLogoSvg` dessine 4 formes
(`TEAM_LOGO_SHAPES` : écu, cercle, losange, hexagone) et un glyphe par roster
pour les équipes sans logo : formes et glyphes supplémentaires à vendre. Un
**cadre** (lauriers, chaînes, crânes) habille aussi un logo uploadé.

**Correctif gratuit, faible priorité** : l'export PDF du roster laisse une
cellule vide « pour le logo qui n'est pas inclus »
(`apps/web/app/me/teams/utils/exportPDF.ts`). Correction de base, gratuite —
mais les coachs n'impriment pas : à faire en passant, pas pour elle-même.

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

### C. L'impression — en attente (les coachs n'impriment pas)

Décision 6. Pistes gardées pour le jour où l'usage changerait :

- **Cartes joueurs** : `card-art.tsx` est déjà au format carte poker
  (750 × 1050 px = 63,5 × 88,9 mm à 300 dpi) ; une planche A4 de 9 cartes
  (3 × 3) suffirait. Les **familles de cadres** de la carte gardent un intérêt
  hors impression : la carte exportée se PARTAGE (case « internet » du §4) —
  le cadre de statut restant dérivé (§3).
- **Thèmes d'impression** (feuille d'équipe, fiche de compétences, feuille
  papier de 5 pages) : `competition-pdf/theme.ts` repose sur une seule
  palette (`PDF_COLORS`).
- **Planche de jetons** (pastilles pour socles de 32 mm, marqueur de tour,
  relances, dugout) : support nouveau, donc base gratuite (décision 7).

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
| Kit d'impression | les coachs n'impriment pas — en attente (§6.C) |
| Nuancier de couleurs libre | palettes nommées retenues (contraste garanti, plusieurs articles) |

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
  La boutique fusionne les deux. Les palettes d'équipe sont le premier
  `kind` (`team_palette`) : leurs couleurs sont des DONNÉES de la ligne
  (pas un contrat de code), validées (format, contraste) à l'écriture et à la
  lecture — une ligne invalide n'est jamais servie.
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
 1. crowns-earning ───────────────── feuilles validées + succès + plafond par saison
        │                            + registre des récompenses
        │                            (prérequis à l'ouverture de `crowns`)
        ├── 2. team-palettes ─────── catalogue de palettes nommées, achat par coach,
        │                            choix par équipe, résolution unique, propagation
        │                            (classement, calendrier, feuille, OG, cartes)
        ├── 3. match-gazette ──────── article payant, remboursement système
        └── 4. player-memorial ───── épitaphe (cimetière gratuit)
```

Les lots 2 à 4 sont indépendants entre eux ; ils supposent seulement que les
Couronnes se gagnent (lot 1). Le lot 2 pose au passage la table générique des
possessions (§8), que les blasons et cadres d'emblème réutiliseront.

## 10. Questions ouvertes

Tranchées le 2026-10-06 : impression (non), base gratuite (oui), palettes
nommées (oui), plafond par saison de ligue (oui). Restent :

- **Bonus d'inscription** : réduire (un thème classique, 250 ?) ou supprimer ?
- **Montants** des sources, valeur du plafond et prix des nouveaux articles,
  à calibrer sur le rythme réel de feuilles validées en prod.
- **Palettes** : combien au lancement, à quel prix (plus bas qu'un thème de
  dés, puisqu'on en achète plusieurs ?), et faut-il des palettes « de roster »
  réservées à un roster donné ?
- **Gazette** : seul un coach de la rencontre paie, ou aussi le commissaire,
  voire un spectateur d'une ligue ouverte ?
