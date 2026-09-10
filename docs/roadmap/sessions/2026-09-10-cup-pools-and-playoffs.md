# 2026-09-10 — Poules et play-offs de coupe

> Suite directe de
> [`2026-09-10-cups-managed-like-leagues.md`](./2026-09-10-cups-managed-like-leagues.md).
> Change OpenSpec : `cup-pools-and-playoffs`. Doc :
> [`docs/cup-pools-and-playoffs.md`](../../cup-pools-and-playoffs.md).

## Point de départ

Le change précédent avait mis la coupe au niveau de la ligue sur la feuille de
match, les trois systèmes d'appariement et les critères de classement, en
laissant en archive une liste de suites. Deux d'entre elles ressortaient comme
les plus structurantes :

1. une coupe ne savait pas **répartir ses inscrits** — donc le format « phase
   de poules », celui de la plupart des tournois réels, n'était pas
   exprimable ;
2. une coupe n'avait **aucun bracket administrable** — `CupBracketView` ne
   relisait que les matchs déjà joués, rien ne CRÉAIT de rencontre
   d'élimination directe. Une coupe ne pouvait donc pas se terminer par une
   finale.

Les deux se tiennent : le seeding d'un bracket se lit dans les quotas de
qualification des poules. Les livrer séparément aurait imposé de réécrire le
seeding.

## Ce qui a été fait

### CI : `typecheck` gate enfin la CI

Avant tout le reste. `pnpm --filter @bb/web typecheck` était ROUGE sur `main`
(6 erreurs préexistantes), masqué par un `|| echo` sur la step Typecheck de
`ci.yml` et par `typescript.ignoreBuildErrors: true` côté Next. C'est
exactement le défaut documenté dans CLAUDE.md (« Un `|| echo` sur une step de
test AVALE tous les échecs »), à un endroit de plus.

Les 8 erreurs (6 préexistantes + 2 des écrans de coupe) sont corrigées —
toutes des `href` calculés que `experimental.typedRoutes` refuse, d'où le
helper `app/lib/typed-route.ts` — et le `|| echo` est retiré : les 8
workspaces gatent désormais la CI.

### Poules

`CupPool` (nom, ordre, couleur, quota de qualifiés) + `CupParticipant.poolId`.
Composition réservée au commissaire et figée dès la première ronde ; le quota,
lui, reste modifiable — il ne gouverne que le seeding, encore à venir.

Les rondes restent COMMUNES à la coupe : c'est l'appariement qui se fait
groupe par groupe. Une ronde par poule aurait dupliqué les numéros de ronde et
obligé chaque lecture à raisonner par poule. Conséquence assumée : une ronde
porte plusieurs exempts, d'où `CupRoundPlan.byes` en liste.

Le classement par poule est une PROJECTION du classement général
(`groupCupStandingsByPool`, pur), jamais un second tri.

### Play-offs

Le moteur de bracket est sorti de `league-playoffs` vers `bracket-seeding` et
partagé : croisement des têtes, carte d'avancement, sélection depuis les
quotas de poule. Il ne connaît que des identifiants opaques — la coupe lui
passe des `teamId` là où la ligue passe des `participantId`.
`league-playoffs` l'importe et le ré-exporte : aucun appelant n'a bougé, ses
89 tests passent inchangés.

Côté coupe : une ronde par slot (`kind = "playoff"` + `bracketSlot`), création
paresseuse (seul le premier tour est créé au lancement ; les suivants naissent
à la clôture de leur tour amont, avec un placeholder `home === away` tant que
le second qualifié manque), publication explicite en booléen à trois états.

### La fuite fermée

Gater `getCupBracket` seul ne suffisait pas : le CALENDRIER (`GET /cup/:id`)
sert lui aussi les rondes et aurait annoncé les têtes de série avant
publication. `visibleCupRounds` (pur) filtre les rondes `kind=playoff` servies
au lecteur non commissaire — et n'est JAMAIS appliqué au calcul du classement,
qui reste assis sur toutes les rondes : masquer une ronde ne doit pas changer
les points d'un exempt.

## Ce qui reste ouvert

Remonté dans
[`openspec-suites.md`](../backlog/openspec-suites.md) : le calendrier groupé
par poule et la « poule du coach en premier », que la ligue a et que
`cups/[id]` n'a pas encore ; ainsi que les suites déjà listées (export PDF
d'une ronde, relance des coachs, palmarès persisté, éditeur de roster
commissaire, i18n de `cups/[id]/page.tsx`).
