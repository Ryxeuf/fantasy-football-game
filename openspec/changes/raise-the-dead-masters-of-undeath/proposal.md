# Maîtres de la Non-vie : « Relever le Mort » sur la feuille de match

## Why

Retour testeur (Discord, 2026-09-11) : « on n'a pas mis en place la règle des
Maîtres de la Non-vie ? » Quatre rosters portent cette règle spéciale
(Morts-Vivants, Horreurs Nécromantiques, Rois des Tombes, Vampires) et le
catalogue du moteur la DÉCRIT (`TEAM_SPECIAL_RULES`, compendium publié), mais
la feuille de match de ligue ne l'APPLIQUAIT nulle part. Un coach mort-vivant
qui tuait un adversaire devait « gérer avec un achat de joueur lineman à 0 » —
un contournement qui ne fait pas jouer le Trois-quart relevé pendant le match,
ne lui crédite aucun PSP, et laisse la trésorerie et la valeur d'équipe au
bon vouloir de la saisie.

La règle (livre, règles spéciales d'équipe) : une fois par match, si un joueur
ADVERSE de Force 4 ou moins et sans le Trait Minus subit un résultat Mort,
l'équipe peut Relever le Mort — elle ajoute immédiatement un Trois-quart de sa
Fiche d'Équipe à sa réserve (jusqu'à dépasser temporairement 16 joueurs), et
peut l'embaucher GRATUITEMENT à la Séquence d'Après Match tant que la liste ne
compte pas déjà 16 joueurs, sinon il est perdu. Le joueur ajoute quand même sa
valeur totale à la Valeur d'Équipe.

## What Changes

- **Une TROISIÈME famille de joueurs synthétiques** sur la feuille, après les
  journaliers et les Star Players : le mort relevé, id `raised-<side>-1`,
  DÉRIVÉ (jamais persisté avant recrutement) depuis un choix stocké sur la
  feuille (`LeagueMatchSheet.raisedDeadHome/Away` : `{ victimId, position }`)
  et les morts consignés dans les évènements. Module pur
  `services/league-sheet-raised-dead` : éligibilité de la victime (adversaire
  tué, Force ≤ 4, sans Minus — `stunty`), postes de Trois-quart (mêmes règles
  que les journaliers), dérivation, recrutement gratuit.
- **Le relevé joue le match** : proposé comme acteur / cible d'évènement et
  Joueur du Match, PSP calculés comme ceux d'un journalier (côté lu dans
  l'id), évolution de l'étape 3 stagée, vérifiée et tirée par la feuille
  (`/journeymen/:id/roll-random-primary` accepte son id).
- **Un choix, une fois par match** : `PATCH /leagues/pairings/:id/sheet/raise-dead`
  (`side`, `victimId | null`, `position?`), réservé au coach du côté et au
  commissaire ; le serveur vérifie la règle spéciale de l'équipe (base d'abord,
  catalogue en repli), l'éligibilité du mort et le poste. La colonne ne porte
  qu'UN choix par côté.
- **Recrutement GRATUIT** : nouveau type d'achat `raised_dead`. À la validation,
  le serveur force le coût à 0 (le montant saisi n'est jamais débité), redérive
  poste, PSP et évolution, et matérialise le joueur (sans Solitaire, valeur
  pleine du poste + évolution en VE). Un relevé absent, doublé, tué à son tour
  ou une liste déjà à 16 retombent en « dépense diverse » à 0 : rien de créé,
  rien de débité, évolution tracée « non recruté ».
- **Web** : bandeau « Relever le Mort » (victimes relevables, poste Zombie /
  Squelette chez les Morts-Vivants, annulation), relevé dans les pickers, la
  timeline, l'estimation de PSP, l'éditeur d'évolutions et la vue du roster ;
  type d'achat « Mort relevé (gratuit) » avec rappel et ajout en un clic à
  l'étape 4.
- **Correctif embarqué** : la relecture des achats côté web ramenait tout type
  inconnu à « Joueur » et perdait `journeymanId` — un recrutement de
  journalier relu après rechargement redevenait un achat de joueur sans poste.
  `parsePurchases` (extrait en module pur) conserve désormais chaque type.
- **Fixtures e2e-api** : roster `undead` (règle spéciale en base, Squelette et
  Zombie) et spec `leagues-sheet-raise-dead-undead.spec.ts` rejouant toute la
  chaîne sur une vraie base.

## Impact

- Serveur : `services/league-sheet-raised-dead.ts` (nouveau),
  `league-match-sheet.ts`, `league-sheet-star-players.ts`
  (`isSyntheticSheetPlayerId` / `syntheticSheetPlayerSide`),
  `league-sheet-journeyman-advancements.ts`, `league-offline-purchases.ts`,
  `schemas/league-match-sheet.schemas.ts`, `routes/league.ts`, fixtures
  `/__test/seed-team` et `/__test/seed-rosters`.
- Prisma : deux colonnes `Json?` nullables (`raisedDeadHome`, `raisedDeadAway`)
  sur `LeagueMatchSheet`, schéma racine + miroir SQLite. Lisibles sans backfill
  (`null` = pas relevé) — `prisma db push` suffit.
- Moteur : `team-special-rules.ts`, description anglaise corrigée (« Stunty »,
  pas « Titchy » — Minus est Stunty).
- Web : `MatchSheetPanels.tsx`, `page.tsx`, `RosterSection.tsx`,
  `purchases.ts` (nouveau).
- Hors périmètre (suite consignée) : le Trait **Contagieux** (Nurgle) partage
  la mécanique de recrutement mais se déclenche sur un Blocage du porteur et
  exclut Décomposition / Régénération / Minus ; le Trois-quart relevé ne porte
  pas ses blessures du match s'il est recruté (même limite que le journalier).
