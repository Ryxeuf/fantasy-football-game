# Design — l'évolution persistée du coach

## Où vit chaque pièce

```
packages/sim-engine/src/coach/adaptation.ts   DriveRecord, CoachMemory, STRATEGY_INFLUENCE,
                                              driveReward, updateCoachMemory, adaptCoachProfile
packages/sim-engine/src/coach/coach.ts        suivi des drives (report()), forme (formPenalty)
packages/sim-engine/src/types.ts              SimRosterPlayer.form, SimResult.coachReport
packages/sim-engine/src/replay/journal.ts     ReplayJournal.profiles (figés)
prisma/schema.prisma                          ProCoach, ProCoachMemory (+ miroir SQLite)
apps/server/src/services/pro-coach-profile.ts nom, philosophie, relecture JSON, résumé (pur)
apps/server/src/services/pro-coach.ts         create-if-missing, adaptation, admin, reset
apps/server/src/services/pro-roster-form.ts   momentum → forme (pur) + écriture
apps/server/src/services/pro-league-sim-runner.ts  profil vivant, forme, évolution post-commit
apps/server/src/routes/admin-pro-team.ts      /teams/:id/coach (GET, PATCH, reset, memory)
apps/web/app/admin/pro-league/teams/[id]/_components/CoachPanel.tsx
apps/web/app/pro-league/teams/[slug]/_components/TeamCoachSection.tsx
```

## Décisions

### Un pas borné par match, pas une optimisation

L'exploration a tranché (décision 2) : pas de self-play. Le mécanisme est
volontairement SIMPLE à lire : une récompense par drive dans [−1, 1] (TD
+1, encaissé −1, mi-temps sans score −0,3 en attaque / +0,5 en défense,
−0,1 par turnover plafonné à −0,4), lissée par stratégie (EMA α = 0,2), et
un pas de `learningRate` (2) points vers ce que chaque stratégie vue au
moins `minSamples` (3) fois tire sur ses paramètres d'influence. Le profil
ne sort jamais de `ancre ± band` (15) et revient vers l'ancre de 5 % de
l'écart par match sans signal. Ces cinq nombres sont des options de
`adaptCoachProfile`, testées une à une.

Alternative écartée : faire jouer N variantes du profil l'une contre
l'autre et garder la meilleure. Plus puissant, mais ni borné ni
explicable, et coûteux (N matchs par match).

### L'ancre est à l'admin, le profil vivant à la saison

Un réglage admin ne corrige pas le profil vivant : il POSE L'ANCRE (et y
ramène le vivant). Sinon l'évolution ramènerait le profil là où il était
avant le réglage, et l'admin ne comprendrait pas pourquoi son curseur
« n'a pas tenu ». Le reset revient au profil de race, ancre comprise, et
vide la mémoire ; il écrit une ligne de journal (`matchId: null`) pour
rester lisible.

### Le résultat se journalise, le profil se recalcule

`ProCoachMemory` est append-only et porte TOUT ce qu'il faut pour relire
une évolution (drives, changements avec raison, profil avant/après) :
même famille que `TeamAuditEvent` (« chaque étape stocke son résultat »).
La colonne `memory` de `ProCoach` est un cache de la moyenne mobile — si
la règle change, elle se rejoue depuis le journal.

### Après le commit, jamais dedans

L'adaptation et la forme se jouent APRÈS `prisma.$transaction` du match :
un match persisté ne redevient jamais `failed` pour une évolution ratée,
chaque côté est isolé (`try/catch`, journalisé), et les matchs de test
(bac à sable admin) n'évoluent pas. Même posture que les hooks
post-settlement (CLAUDE.md « Hook post-settlement encapsulé »).

### La forme module l'ORDRE, pas les dés

Un joueur en méforme n'échoue pas plus souvent (les dés sont les dés) : ses
actions à dés reculent dans l'ordre du tour (`formPenalty` sur la classe de
risque, jusqu'à −8 × classe à 0 de forme) et sa température baisse ; un
joueur en forme avance un peu. Sans forme fournie, rien ne change — c'est
ce qui permet de re-tamponner le bench à l'identique sous `0.30.0`.

### Colonnes nullables, create-if-missing

`prisma/migrations/` est gitignoré : `ProCoach` n'a aucune ligne avant le
premier match d'une équipe (`ensureProCoach`), la fiche publique rend
`coach: null` en attendant, et `ProCoach.memory` est nullable. Les colonnes
JSON se relisent tolérantes (objet natif en PG, chaîne sur le miroir
SQLite), avec repli sur le profil de race si une ligne est illisible.
