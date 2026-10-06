# Une ligue privée est invisible, pas seulement non listée

## Why

`League.isPublic = false` n'était qu'un **filtre de listing**. Toute lecture
d'une ligue **par id** — détail, saison (calendrier avec appariements et
participants), classement, poules, classements individuels, récap de fin de
saison, bracket de play-offs, feuille de match, rosters, documents officiels —
servait la ligue à n'importe quel compte connaissant ou devinant son id, et
plusieurs de ces lectures (poules, classements individuels, récap) n'exigeaient
même pas de compte.

Le produit penchait pourtant déjà vers « privée » : le formulaire annonce
« Privée », le JSON-LD n'indexe pas une ligue privée, `listLeagues` ne la
montre qu'à son commissaire, ses inscrits et ses invités, et les documents
officiels d'une ligue privée étaient réservés aux inscrits. Seules les lectures
par id faisaient exception — parce qu'aucun helper d'accès n'existait :
`ensureLeagueViewer`, `ensureLeagueCommissioner` et
`canViewCompetitionDocuments` réécrivaient chacun un fragment de règle.

## What Changes

- **Sémantique tranchée et documentée sur le champ Prisma** : `false` = ligue
  PRIVÉE, ni listée ni lisible par lien. Elle n'existe que pour son
  commissaire, les administrateurs, les coachs inscrits (une équipe dans une
  de ses saisons) et les coachs invités (invitation `pending`).
- **Un module unique, `services/league-access`** : règle pure
  (`isLeagueVisibleTo`) + résolutions Prisma par ligue, par saison et par
  rencontre (`canViewLeagueRow`, `findVisibleLeague`,
  `findVisibleSeasonLeague`, `isLeaguePairingHiddenFrom`, `canViewLeague`).
- **Appliqué à toutes les lectures par id** de `routes/league.ts` : détail,
  saison, classement, poules, classements individuels (×3), récap, bracket,
  feuille de match (et son `can-invalidate`), rosters en lecture seule ; et
  aux documents officiels (`services/competition-documents`).
- **404, jamais 403, pour un tiers** — avec le MÊME message qu'une ressource
  inexistante, pour ne pas révéler l'existence de la ligue.
- **Les routes sans authentification passent à `optionalAuthUser`** (poules,
  classements individuels, récap ; le bracket l'avait déjà) : une ligue
  publique reste lisible sans compte, une ligue privée n'est servie qu'à ses
  membres identifiés par leur jeton.
- **Le calendrier thématique public** (`GET /leagues/seasons/themed`) ne
  liste plus que les saisons de ligues publiques.
- **Rejoindre une saison par id** suit la même visibilité : un tiers ne peut
  pas s'inscrire à une ligue privée dont il a deviné l'id ; un coach invité,
  lui, la voit et peut s'inscrire.
- **Documents officiels d'une ligue privée** : 404 pour un tiers (au lieu de
  403), et les coachs invités en attente y ont accès comme à toute lecture de
  la ligue. Les coupes privées gardent leur 403.
- **Web** : un indice sous le choix Publique / Privée explique ce que
  « Privée » implique.

## Impact

- Serveur : `services/league-access.ts` (nouveau), `routes/league.ts`,
  `services/competition-documents.ts`, `services/league.ts`
  (`listThemedSeasons`), `prisma/schema.prisma` et son miroir SQLite
  (**commentaire seulement** — aucune colonne, aucune migration).
- Web : `leagues/_components/LeagueForm`, i18n fr/en.
- Rupture volontaire : un lien vers une ligue privée ne s'ouvre plus pour un
  coach qui n'en fait pas partie ; le calendrier thématique n'affiche plus les
  saisons d'une ligue privée. Aucune donnée n'est touchée, un commissaire
  rétablit l'ancien comportement en repassant sa ligue en « Publique ».
- Hors périmètre (suites possibles) : la visibilité des coupes privées
  (`GET /cup/:id` les sert à tous), les mutations réservées au commissaire
  (qui gardent leur 403), et les pages publiques de coach qui citent des
  palmarès de ligue par leur nom.
