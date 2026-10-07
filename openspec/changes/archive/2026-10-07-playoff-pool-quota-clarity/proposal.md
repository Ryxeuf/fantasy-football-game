# Quotas de poule : un panneau de play-offs qui dit vrai, un quota qui se corrige

## Why

Retour commissaire (ligue Kraken, 2026-10-07) : « il me semblait avoir mis 4
équipes qualifiées par poule pour faire des 1/8e de finale », face à un panneau
qui affichait « Qualifiés par poule : 8 pour un bracket de 8 — cohérent ».

Deux défauts, et un piège :

- **Le libellé ment.** Le chiffre est la SOMME des quotas de toutes les poules
  (`totalQualified`), affichée sous l'intitulé « Qualifiés par poule ». Deux
  poules à 4 s'affichent « 8 par poule ». Même défaut sur la coupe.
- **Le menu de taille ne dit pas combien d'équipes jouent.** « Quarts de
  finale (8) » se lit comme un numéro de tour ; « 1/8e de finale » (16
  équipes) n'existe pas, ce que rien n'annonce.
- **En ligue, un quota faux est définitif.** Le quota est bloqué dès que la
  saison démarre (`ensureSeasonEditable`), alors qu'il ne gouverne que le
  seeding du bracket, qui n'a pas encore eu lieu. La coupe, elle, le laisse
  corrigeable (capacité `cup-pools`). Un commissaire dont la somme ne colle
  pas à la taille du bracket n'a plus que la taille du bracket pour s'en
  sortir. Le formulaire de création de poule REMET le quota à 1 après chaque
  ajout : saisir 4 pour la poule A crée les suivantes à 1 si l'on ne
  ressaisit pas.

## What Changes

- `poolQualification` (bracket de ligue ET de coupe) sert, en plus du total, le
  DÉTAIL par poule (`pools: [{ poolId, name, qualifiesForPlayoffs }]`), calculé
  par UNE fonction pure du moteur de bracket partagé. Champ additif.
- Le panneau de lancement (ligue et coupe) affiche « Qualifiés : 8 au total
  (Poule A : 4 · Poule B : 4) pour un bracket de 8 », et le menu de taille
  annonce le nombre d'équipes (« Quarts de finale (8 équipes) »).
- Le refus `pool-qualification-mismatch` indique quoi corriger (quota d'une
  poule ou taille du bracket).
- En ligue, le QUOTA d'une poule reste modifiable tant que le bracket n'est pas
  généré et que la saison n'est pas clôturée ; la composition (création,
  suppression, affectation, nom, ordre, couleur) reste figée au démarrage. Le
  panneau des poules garde le champ de quota actif dans cette fenêtre.
- Le formulaire de création de poule garde le dernier quota saisi.

Hors périmètre : un bracket de 16 (huitièmes de finale). C'est une
fonctionnalité du moteur (slots, carte d'avancement, schémas, écrans, PDF), à
traiter dans son propre change si le besoin est confirmé.

## Capabilities

### Modified Capabilities

- `league-playoff-launch` : restitution du détail des quotas ; quota de poule
  corrigeable jusqu'au bracket.
- `cup-playoffs` : restitution du détail des quotas.

## Impact

- Serveur : `services/bracket-seeding` (fonction pure
  `summarizePoolQualification`), `routes/league.ts` (bracket de ligue,
  mapping HTTP des refus de poule), `services/cup-playoffs` (bracket de coupe),
  `services/league-pool` (fenêtre d'édition du quota).
- Web : `leagues/[id]/PlayoffBracketView`, `leagues/[id]/PoolsManagerPanel`,
  `leagues/[id]/page`, `cups/[id]/CupPlayoffBracketView`, locales fr/en, module
  pur `lib/pool-qualification`.
- Aucune colonne, aucune migration. API additive (le web tolère l'absence de
  `pools`).
