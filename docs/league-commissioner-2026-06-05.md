# Commissaire de ligue : édition des paramètres, badge & succès — 2026-06-05

Sprint L2.D. Trois fonctionnalités liées au rôle de **commissaire** (le
créateur d'une ligue Blood Bowl, distincte de la pro-league).

## 1. Édition des paramètres tant qu'aucun match n'est joué

Le commissaire peut modifier les paramètres de sa ligue (nom, description,
ruleset, visibilité, max participants, points win/draw/loss/forfeit,
rosters autorisés, tie-breaks) **tant qu'aucun match n'a été joué et
saisi**. Le verrou est `Match.leagueScoredAt` : dès qu'un match d'une
saison de la ligue est comptabilisé, les paramètres sont figés.

### Serveur
- `schemas/league.schemas.ts` : `updateLeagueSchema = createLeagueSchema.partial()`
  + `.refine` (body non vide). Export `UpdateLeagueBody`.
- `services/league.ts` :
  - `hasLeagueScoredMatch(leagueId)` → `prisma.match.count` sur
    `leagueScoredAt != null` + `leagueSeason.leagueId`.
  - `updateLeague(leagueId, input)` : PATCH partiel (seuls les champs
    fournis), stringify `allowedRosters`/`tieBreakRules`, validations de
    base (nom non vide, maxParticipants ≥ 2).
- `routes/league.ts` :
  - `PATCH /leagues/:id` (`handleUpdateLeague`) : 404 ligue absente,
    **403** si non-créateur, **409** si verrouillée (match joué), sinon
    update + renvoie la ligue sérialisée.
  - `GET /leagues/:id` expose désormais `league.hasScoredMatch` (verrou
    d'édition côté UI ; la vérité reste serveur).

### Web
- `leagues/_components/LeagueForm.tsx` : formulaire **mutualisé** entre
  création et édition (extrait de `new/page.tsx`). Testids `league-form-*`.
- `leagues/new/page.tsx` : réécrit pour consommer `LeagueForm` (POST).
- `leagues/[id]/edit/page.tsx` : nouvelle page d'édition. Charge la ligue
  + `/auth/me`, **redirige** vers le détail si non-créateur ou verrouillée,
  pré-remplit le form, PATCH au submit.
- `leagues/[id]/page.tsx` : bouton **✏️ Modifier** (`edit-league-cta`) dans
  l'en-tête, visible si `isCreator && !league.hasScoredMatch`.

## 2. Badge « Commissaire »

Dans l'en-tête de la page détail, un badge `👑 Commissaire`
(`league-commissioner-badge`) est affiché à côté du nom du créateur,
visible par tous les visiteurs de la ligue.

i18n : `commissionerBadge` (FR « Commissaire » / EN « Commissioner »).

## 3. Succès « Commissaire »

Nouveau succès débloqué quand le créateur **termine** une de ses ligues
(au moins une saison passée en `completed`).

- `services/achievements.ts` :
  - Nouvelle catégorie `leagues`.
  - Stat `leaguesCommissioned` = `prisma.league.count` sur
    `creatorId = userId` + `seasons.some(status = "completed")`.
  - Succès `commissioner` (🏆, catégorie `leagues`,
    `predicate: s.leaguesCommissioned >= 1`).
- Évaluation **lazy** (comme les autres succès) au `GET /achievements` :
  pas de hook ni de cron. Le succès remonte dans `newlyUnlocked` (bannière
  dorée existante) à la première ouverture de la page succès après la fin
  de la ligue.
- `me/achievements/page.tsx` : catégorie `leagues` (label « Ligues »)
  ajoutée au type, aux labels et au groupement.

## Décisions / hypothèses

- **« Ligue terminée »** = la ligue créée a ≥ 1 saison `completed`
  (plus robuste que `League.status`, qui n'est pas toujours auto-mis à
  jour en fin de saison).
- **Verrou d'édition** = premier `Match.leagueScoredAt` non-null, toutes
  saisons confondues (cohérent avec le refus de régénération du calendrier).
- Badge affiché dans l'en-tête (associé au créateur, visible par tous).

## Vérification

- `tsc --noEmit` OK (web + serveur).
- Tests : serveur **3496** (dont `league.test.ts`, `routes/league.test.ts`,
  `achievements.test.ts`), web **1213** (dont `leagues/[id]/page.test.tsx`
  + nouveau `leagues/[id]/edit/page.test.tsx`). Tous verts.
