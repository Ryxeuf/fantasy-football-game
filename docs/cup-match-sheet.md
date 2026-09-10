# Feuille de match de coupe

> Comment une rencontre de coupe se saisit, se valide et s'invalide — et
> pourquoi c'est le MÊME code que les ligues. Décision détaillée dans
> `openspec/changes/cups-managed-like-leagues/`.

## Principe

Une coupe se joue avec la feuille de match des ligues : avant-match (météo,
popularité, coups de pouce, prières), journal d'évènements, soumission par
chacun des deux coachs, validation du commissaire, fenêtre d'invalidation.
Rien n'est dupliqué — les routes de coupe montent les handlers de
`routes/league`, et le web sert la même page.

Ce qui change tient dans un JEU DE RÈGLES
(`services/competition-match-sheet-context`) :

| Effet d'après-match | Ligue | Coupe |
|---|---|---|
| PSP gagnés | oui | **non** |
| Blessures / morts / absences | oui | **non** |
| Or, gains, fans dévoués | oui | **non** |
| Évolutions, achats, licenciements | oui | **non** |
| Roster « version du match » | état live au gel | **roster d'inscription** |

Une coupe se joue donc en résurrection : le roster inscrit rejoue à
l'identique à chaque ronde. Seuls le score et le classement bougent.

## Rattachement polymorphe

`LeagueMatchSheet` porte DEUX FK nullables : `pairingId` (ligue) XOR
`cupPairingId` (coupe), même patron que `CompetitionDocument`. Le modèle
garde son nom — `db push` traite un renommage comme DROP + CREATE, ce qui
perdrait toutes les feuilles existantes.

L'invariant « exactement une des deux » n'est pas exprimable en Prisma : il
est tenu par `resolveCompetitionPairing`, seul chemin de résolution. Celui-ci
cherche la rencontre dans `LeaguePairing` puis dans `CupPairing` — les
`cuid()` sont uniques d'une table à l'autre, ce qui permet à TOUTES les
fonctions de la feuille de garder leur signature `{ pairingId }`.

Une rencontre de coupe SANS adversaire (exempt) n'a pas de feuille.

## Du journal au classement

Le classement d'une coupe, ses podiums par action et ses classements
individuels sont **dérivés** de ses `LocalMatch` terminés. Plutôt que
d'apprendre à ces trois lectures à lire aussi une feuille, la validation
MATÉRIALISE la rencontre :

```
feuille validée
  └─ LocalMatch { status: completed, scoreTeamA/B, cupPairingId }   (unique)
      └─ LocalMatchAction[]  (td · blocage/blitz · aggression · passe · interception)
          └─ computeCupStandings / awards / computeCupPlayerLeaderboards
```

C'est le même procédé que le `Match` offline synthétique des ligues.
`cupPairingId` étant unique, revalider réécrit le même match au lieu d'en
empiler un second. L'invalidation le supprime : le classement, entièrement
dérivé, revient de lui-même à son état d'avant.

Seuls les gestes que le barème d'une coupe sait compter sont rejoués. Une
sortie sans auteur au contact (esquive ratée, foule) n'entre pas : elle n'a
personne à créditer. La feuille reste la source de vérité complète.

## Routes

| Méthode | Chemin | Rôle |
|---|---|---|
| `GET` / `POST` | `/cup/pairings/:id/sheet` | lire / ouvrir (2 coachs + commissaire) |
| `PATCH` | `…/sheet/pre-match`, `…/sheet/post-match` | avant / après-match |
| `POST` / `DELETE` | `…/sheet/events[/:eventId]` | journal |
| `POST` | `…/sheet/submit`, `…/sheet/unsubmit` | soumission d'un coach |
| `POST` | `…/sheet/validate` | validation (commissaire) |
| `GET` / `POST` | `…/sheet/can-invalidate`, `…/sheet/invalidate` | fenêtre + invalidation |

Montées sur `/cup` AVANT `cupRoutes`, dont le `GET /:id` avalerait
`/pairings`. La fenêtre d'invalidation d'une coupe est ouverte tant que la
coupe n'est ni `terminee` ni `archivee` : il n'y a rien à « dé-appliquer » sur
les équipes.

`GET /leagues/me/pending-validations` couvre les DEUX compétitions ; chaque
entrée porte son `kind`.

## Web

`/cups/pairings/[id]/sheet` ré-exporte la page des ligues. Elle s'adapte au
`competitionKind` servi par l'API : lien retour vers la coupe, bandeau « mode
résurrection », et les phases « Fin du match » et « Évolutions » masquées —
rien n'y étant persisté, les afficher inviterait à une saisie sans effet.

## Tests

- `services/competition-match-sheet-context.test.ts` — résolution polymorphe,
  jeux de règles, exempt.
- `services/cup-match-sheet.test.ts` — traduction du journal, matérialisation
  idempotente, réversion, fenêtre.
- `tests/e2e-api/specs/cup-match-sheet-flow.spec.ts` — parcours complet sur
  base réelle, et la preuve que rien n'est écrit sur les équipes.
