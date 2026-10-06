# Pro League — l'évolution persistée du coach (lot 4)

## Pourquoi

Après le lot 3, chaque équipe de la Pro League est jouée par un coach qui a
un plan, des probabilités et un style — mais ce style est le PROFIL DE RACE
compilé (`race-profiles.ts`), identique à chaque match et pour toujours. Deux
équipes orques jouent exactement pareil, une saison entière ne change rien,
et la forme des joueurs (`ProTeamRoster.form`, colonne présente depuis le
lot 1.E) n'est jamais écrite ni lue. Quatrième des cinq lots de l'exploration
[`docs/roadmap/explorations/2026-10-05-pro-league-match-integral.md`](../../../docs/roadmap/explorations/2026-10-05-pro-league-match-integral.md)
(§5 « des arbres qui évoluent », §8 décisions 2 et 3 : adaptation BORNÉE et
EXPLIQUÉE, pas de self-play ; le coach est une persona IA par équipe).

## Quoi

1. **Adaptation bornée et expliquée** (`packages/sim-engine/src/coach/adaptation.ts`,
   pur) : le coach rend un RAPPORT de drives (stratégie dominante,
   possession, issue, turnovers) ; une mémoire par stratégie (moyenne mobile
   exponentielle de la récompense) fait bouger, d'au plus deux points par
   match, les paramètres que les stratégies qui rapportent « tirent »
   (`STRATEGY_INFLUENCE`), dans `ancre ± 15`, avec un rappel lent vers
   l'ancre sans signal. Chaque changement porte sa raison en français.
2. **Forme persistée** : le momentum de fin de match écrit
   `ProTeamRoster.form` (hot +15, cold −15, retour vers 50 de 5), et le
   coach la relit au match suivant pour reculer les actions à dés d'un
   joueur en méforme (`formPenalty`) et moduler sa température.
3. **`ProCoach` + `ProCoachMemory`** (Prisma) : un coach par équipe, créé
   à la demande depuis le profil de race (nom déterministe, philosophie
   dérivée), profil VIVANT + ANCRE + mémoire + expérience ; un journal
   append-only par match intégré (drives, changements expliqués, profil
   avant/après, résumé pour la Gazette).
4. **Le runner** sert le profil vivant au simulateur, la forme dans le
   roster, et joue l'évolution APRÈS le commit du match, best-effort et
   jamais pour un match de test.
5. **Profils figés dans le journal du replay** (`ReplayJournal.profiles`).
6. **Console admin** : panneau coach (ancre sur 15 curseurs, nom,
   philosophie, reset, journal des évolutions) ; **fiche publique** :
   section « Le coach ».

## Hors périmètre

- Le self-play, l'optimisation par descente de gradient, tout apprentissage
  qui ne se lit pas en une phrase (décision 2 de l'exploration).
- La Gazette LLM par match : elle lit le résumé d'évolution, elle n'est pas
  modifiée ici.
- Le pool de workers, les cotes sur 50 runs, les transitions
  `ready → completed` et la rétention des replays : lot 5.
