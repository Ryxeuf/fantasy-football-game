# Session 2026-10-05 — Pro League lot 4 : l'évolution persistée

> Change OpenSpec `pro-league-coach-evolution`. Quatrième des cinq lots de
> l'exploration
> [`2026-10-05-pro-league-match-integral.md`](../explorations/2026-10-05-pro-league-match-integral.md),
> après le lot 1 (match complet, #1053), le lot 2 (journal rejouable, #1055)
> et le lot 3 (cerveau du coach, #1056).

## Ce qui a changé

Le coach d'une équipe n'est plus le profil de race compilé : c'est une
**persona persistée** (`ProCoach`) avec un nom, une philosophie, un profil
VIVANT qui évolue entre deux matchs dans une bande de ± 15 autour d'une
ANCRE, une mémoire par stratégie et une expérience. Chaque match intégré
écrit une ligne append-only `ProCoachMemory` : les drives joués, les
changements avec leur raison en français, le profil avant et après, un
résumé pour la Gazette. La forme des joueurs (`ProTeamRoster.form`) est
enfin écrite après chaque match et relue par le coach au suivant. Les
profils joués sont figés dans le journal du replay.

## Comment ça évolue (et pourquoi pas autrement)

- Le coach rend un **rapport de drives** (`SimResult.coachReport`) :
  stratégie dominante, possession, issue (`td` / `conceded` / `half-end`),
  turnovers. Un TD clôt le drive des deux côtés.
- `adaptCoachProfile` (pur) : récompense par drive dans [−1, 1], moyenne
  mobile exponentielle par stratégie (α = 0,2), pas de 2 points au plus par
  match vers ce que les stratégies vues au moins 3 fois « tirent »
  (`STRATEGY_INFLUENCE` : `stall` → `stallTendency` + `patience`,
  `breakaway` → `breakawayInstinct` + `pace` + `gfiTolerance` + `riskAppetite`…),
  jamais hors de `ancre ± 15`, et rappel de 5 % de l'écart vers l'ancre sans
  signal. Chaque changement porte sa raison (« « stall » rapporte sur 5
  drives (EMA +0,42) → stallTendency +2 »).
- Pas de self-play (décision 2 de l'exploration) : le mécanisme se lit en
  une phrase, se teste sur « trois saisons » d'issues aléatoires (la borne
  tient quoi qu'il arrive) et ne coûte aucun match supplémentaire.

## Trois règles qu'on ne devine pas en lisant un fichier

1. **Un réglage admin pose l'ANCRE.** Corriger seulement le profil vivant
   serait défait au match suivant par le rappel vers l'ancre. Le panneau
   admin règle donc l'ancre et y ramène le vivant ; le reset revient au
   profil de race, ancre comprise, vide la mémoire et laisse une ligne de
   journal sans match.
2. **L'évolution se joue APRÈS le commit du match**, par côté isolé
   (`try/catch` journalisé), jamais pour un match de test. Un match persisté
   ne redevient jamais `failed` pour une évolution ratée — même posture que
   les hooks post-settlement.
3. **La forme module l'ORDRE, pas les dés.** Un joueur en méforme (< 35)
   voit ses actions à dés reculer dans l'ordre du tour (`formPenalty`) et sa
   température baisser ; en forme (> 65) elles avancent un peu. Sans forme,
   rien ne change : le bench a été re-tamponné à l'identique sous `0.30.0`.

## Où ça se branche

| Pièce | Fichier |
|---|---|
| Adaptation pure | `packages/sim-engine/src/coach/adaptation.ts` |
| Drives + forme dans le coach | `packages/sim-engine/src/coach/coach.ts` |
| Modèles | `prisma/schema.prisma` (`ProCoach`, `ProCoachMemory`) + miroir SQLite |
| Coach (I/O) | `apps/server/src/services/pro-coach.ts` |
| Nom, philosophie, relecture JSON, résumé | `apps/server/src/services/pro-coach-profile.ts` |
| Forme | `apps/server/src/services/pro-roster-form.ts` |
| Runner | `apps/server/src/services/pro-league-sim-runner.ts` |
| Routes admin | `apps/server/src/routes/admin-pro-team.ts` (`/teams/:id/coach…`) |
| Fiche publique | `getProTeamDetail` → `coach` |
| Console admin | `apps/web/app/admin/pro-league/teams/[id]/_components/CoachPanel.tsx` |
| Fiche équipe | `apps/web/app/pro-league/teams/[slug]/_components/TeamCoachSection.tsx` |

## Tests

- sim-engine : `adaptation.test.ts` (récompense, EMA, renforcement,
  relâchement, rappel, bornes sur 3 saisons, options), `coach.test.ts`
  (rapport de drives sur un vrai match, profils figés, `formPenalty`, la
  forme change le match à graine constante sans changer sa structure).
- serveur : `pro-coach-profile.test.ts`, `pro-coach.test.ts`,
  `pro-roster-form.test.ts`, `admin-pro-team.test.ts` (quatre routes),
  `pro-league-sim-runner.test.ts` (profil vivant, forme, évolution après
  commit, match de test, échec non bloquant), `pro-league-team.test.ts`.
- web : `CoachPanel.test.tsx` (dont le garde-fou des 15 paramètres relu
  dans la source du moteur), `TeamCoachSection.test.tsx`, page admin
  (panneau monté, isolé).

## Au déploiement

`prisma db push` (tables `ProCoach`, `ProCoachMemory`). Aucun backfill : le
coach d'une équipe se crée à son premier match, la fiche publique rend
`coach: null` d'ici là.

## Suites (hors lot)

Gazette « le coach » par match, comparaison de deux coachs d'une même race,
script de rejeu de la mémoire depuis le journal — listées dans
`openspec/changes/pro-league-coach-evolution/tasks.md`.
