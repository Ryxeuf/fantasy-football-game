# Tasks — ordre de classement d'une ligue

## 1. La règle, au propre
- [x] 1.1 `services/league-standings-order` (PUR) : slugs, défaut
      « points → bonus → forfaits → diff TD → diff sorties → nom », parse
      tolérant, lecture brute, normalisation, sérialisation, comparateur.
      Tests unitaires sans Prisma.
- [x] 1.2 `services/league.ts` délègue et ne garde que des alias ; test de
      contrat (`toBe`) contre une seconde implémentation.
- [x] 1.3 Zod : les slugs sont lus dans le module pur, plus de miroir manuel.

## 2. Écriture
- [x] 2.1 `POST /leagues` et `PATCH /leagues/:id` : normalisation par le
      module pur (doublons, slugs inconnus, sentinelle « name »).
- [x] 2.2 `PATCH /admin/leagues/:id/standings-order` (admin, hors verrou),
      `null` = retour au défaut. Tests de route (chaîne Express réelle).

## 3. Lecture
- [x] 3.1 `GET /leagues/:id` : `effectiveTieBreakRules` à côté de la valeur
      brute ; `GET /leagues/seasons/:id/standings` : `tieBreakRules`.
      `showSeasonElo` en dérive. Tests de route.
- [x] 3.2 `GET /admin/leagues` : valeur brute + ordre effectif par ligue.

## 4. Écrans
- [x] 4.1 `components/TieBreakOrderEditor` partagé, helpers purs déménagés,
      coupe rebranchée (testids inchangés). Tests unitaires.
- [x] 4.2 `LeagueForm` (création + édition) : liste ordonnée + annonce du
      défaut. Tests composant.
- [x] 4.3 Console `/admin/leagues` : modale d'édition + résumé par ligne.
      Tests page.
- [x] 4.4 Classement : les départages appliqués sous le tableau. Tests
      composant.

## 5. Accès du commissaire (retour d'usage)
- [x] 5.1 `PATCH /leagues/:id/standings-order` (commissaire ou admin, hors
      verrou) ; écriture unifiée dans `setLeagueStandingsOrder`, schéma Zod
      partagé avec la route admin. Tests de route.
- [x] 5.2 La fiche de ligue garde son bouton de réglages une fois la ligue
      verrouillée ; `/leagues/[id]/edit` sert un panneau RÉDUIT au lieu de
      rediriger. Tests composant + page.

## 6. Documentation
- [x] 6.1 Mémoire `CLAUDE.md` (le tri suit les colonnes affichées ; une
      règle de LECTURE échappe au verrou d'édition ; un réglage sans chemin
      d'accès est un réglage absent).
