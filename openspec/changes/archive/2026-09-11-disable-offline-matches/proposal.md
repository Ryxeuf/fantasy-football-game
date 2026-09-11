# Désactiver la partie offline, et assumer la feuille de match comme seul chemin

## Why

Trois constats remontés sur la gestion d'une coupe, qui sont le même
problème vu sous trois angles : **deux chemins concurrents mènent au même
résultat, et l'écran ne dit pas lequel s'applique.**

1. Le bandeau des rondes annonçait « Rondes (système suisse) » et décrivait
   l'appariement par classement EN PERMANENCE — y compris après que le
   commissaire ait sélectionné « Tirage au sort » ou « Saisie manuelle ». Le
   texte décrivait une règle qui n'allait pas être appliquée.
2. Une rencontre proposait encore de CRÉER une partie offline (« Créer le
   match » sur la rencontre, « Créer un match local pour cette coupe » en
   pied de page) alors que `cups-managed-like-leagues` a fait de la FEUILLE
   DE MATCH le chemin de saisie d'un résultat de coupe comme de ligue.
3. La brique « partie offline » (`/local-matches`) elle-même n'est pas mûre :
   journal d'actions saisi à la main, sans les règles de fin de match, sans
   VE ni PSP, et sans rapport avec la feuille. Elle occupe pourtant une
   entrée de menu et deux cartes d'accueil.

## What Changes

- **Le bandeau des rondes suit la pastille choisie.** Titre et description
  dérivent du système sélectionné ; hors sélection (coach inscrit, ou
  commissaire qui ne peut pas encore générer) le bandeau reste NEUTRE — une
  coupe panache les systèmes d'une ronde à l'autre, en annoncer un seul
  serait faux, et c'est le badge de chaque ronde qui tranche.
- **La feuille devient le seul chemin proposé.** Plus aucun bouton de
  création de partie offline depuis une coupe, et plus aucun lien de
  rencontre vers `/local-matches` : le bracket de play-offs pointe désormais
  la feuille, et la liste « Matchs de la coupe » devient un récapitulatif en
  lecture seule. Le `LocalMatch` reste ce qu'il est depuis
  `cups-managed-like-leagues` : la MATÉRIALISATION du résultat, dont le
  classement dérive — un support, pas un écran de saisie.
- **La partie offline passe derrière un feature gate `offline_match`, OFF.**
  Serveur (`requireFeatureFlag` sur `/local-match`) et web (gate sur
  `/local-matches`, entrées de menu et cartes d'accueil conditionnées). Un
  feature gate NORMAL, pas un kill-switch : `FEATURE_FLAGS_FORCE_ENABLED`
  (CI) et le rôle admin le court-circuitent, donc les suites continuent
  d'exercer les routes et les admins gardent `/admin/local-matches` pour
  administrer les parties déjà enregistrées.

## Impact

- Serveur : `services/featureFlags` (nouvelle clé + registre de synchro),
  `index.ts` (montage gaté, seed de test), `seed.ts` (flag créé désactivé).
- Web : `components/OfflineMatchGate` (nouveau), `local-matches/layout`
  (nouveau), `components/Header`, `components/home/{CoachDashboard,
  MarketingHome}`, `cups/[id]/{page,CupRoundsView,CupPlayoffBracketView}`,
  `cups/[id]/round-system-copy` (nouveau, pur), i18n fr/en.
- Aucune migration : `prisma/migrations/` est gitignoré (prod = `db push`),
  le flag est une LIGNE de `FeatureFlag` créée par le seed ou par
  « Synchroniser depuis le code ». Tant que la ligne n'existe pas, la
  fonctionnalité est vue comme désactivée — c'est l'effet recherché.
- Réversible d'un toggle admin : rien n'est supprimé.
