# Tasks — Désactiver la partie offline

## 1. Bandeau des rondes réactif
- [x] 1.1 `cups/[id]/round-system-copy` (pur) : `cupRoundsHeadingKeys` +
      tables de clés libellé/description. Tests (dont couverture fr/en et
      non-collision des descriptions).
- [x] 1.2 `CupRoundsView` : titre + description dérivés, `data-testid`
      `cup-rounds-title` / `cup-rounds-description`, suppression du texte
      dupliqué sous les pastilles. Tests de bascule entre les 3 systèmes et
      de neutralité hors sélection.
- [x] 1.3 i18n fr/en : `roundsTitle`, `roundsTitleWithSystem`,
      `roundsDescription`, `roundSystem*Description` (remplacent
      `swissTitle`, `swissDescription`, `roundSystem*Hint`).

## 2. La feuille, seul chemin
- [x] 2.1 `CupRoundsView` : plus de bouton « Créer le match » ni de lien
      « Voir le match » ; la feuille reste la seule action. Tests.
- [x] 2.2 `CupPlayoffBracketView` : le lien d'un tour mène à la feuille de
      sa rencontre (rien sur un placeholder). Tests.
- [x] 2.3 `cups/[id]/page` : bouton « Créer un match local pour cette
      coupe » retiré, liste « Matchs de la coupe » en lecture seule.
- [x] 2.4 i18n : libellés devenus morts retirés des deux locales.

## 3. Gate `offline_match`
- [x] 3.1 Serveur : `OFFLINE_MATCH_FLAG` + entrée `KNOWN_FLAGS`.
- [x] 3.2 `index.ts` : `/local-match` monté derrière `requireFeatureFlag` ;
      clé ajoutée au seed de `/__test/seed-rosters` (ON pour les suites).
- [x] 3.3 `seed.ts` : flag créé DÉSACTIVÉ, sans override utilisateur.
- [x] 3.4 Web : `OFFLINE_MATCH_FLAG`, `OfflineMatchGate`,
      `local-matches/layout`. Tests du gate.
- [x] 3.5 Web : entrées de menu (bureau + mobile) et cartes d'accueil
      (`CoachDashboard`, `MarketingHome`) conditionnées. Tests du Header.
- [x] 3.6 Garde de câblage `services/offline-match-gate.test.ts` : montage
      gaté, clé connue du registre, flag hors `KILL_SWITCH_FLAGS`.

## 4. Documentation
- [x] 4.1 `CLAUDE.md` : la règle « un chemin de saisie, pas deux ».
