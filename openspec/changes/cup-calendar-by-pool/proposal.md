# Calendrier de coupe groupé par poule

## Why

`cup-pools-and-playoffs` a donné des poules aux coupes : elles apparient par
groupe et servent un classement par poule. Le CALENDRIER, lui, est resté à
plat — `CupRoundsView` liste les rencontres d'une ronde les unes sous les
autres, sans dire à quelle poule chacune appartient.

Sur une coupe à 24 équipes en 4 poules, une ronde compte 12 rencontres dont
9 ne concernent pas le coach qui regarde. La ligue a résolu ça depuis
longtemps (`SeasonCalendar` groupe par poule et remonte celle du coach) ; la
coupe avait tout ce qu'il faut en base et n'exploitait rien.

C'est la dernière suite de la parité ligue ↔ coupe listée dans
[`openspec-suites.md`](../../../docs/roadmap/backlog/openspec-suites.md) qui
soit à la fois petite et visible.

## What Changes

- **La règle de groupement devient COMMUNE.** Elle vivait dans
  `SeasonCalendar.groupPairingsByPool` : seuil de découpage (on ne groupe pas
  quand une seule poule est représentée), tri par nom, poule du coach en
  tête, groupe sentinelle pour les non-affectés. Elle part dans
  `lib/competition-pools` (`groupByPool`, pur) et les deux compétitions la
  consomment. Chacune ne garde que ce qui lui est propre : la ligue lit la
  poule par son PARTICIPANT, la coupe par son ÉQUIPE.
- **Une ronde de BRACKET ne se groupe jamais.** Une finale oppose par
  construction les qualifiés de deux poules : la coiffer de « Poule A » parce
  que son équipe à domicile en vient serait faux. C'est la seule règle que la
  coupe ajoute au moteur commun.
- **`GET /cup/:id` sert ses poules.** La réponse portait `poolStandings`
  (classement) mais pas la liste des poules — le calendrier a besoin de
  NOMMER ses groupes, pas de classer. Champ additif `pools`.
- `putPoolFirst` déménage avec la règle ; `leagues/[id]/pool-order` reste le
  point d'entrée historique de la ligue et le ré-exporte.

## Impact

- Serveur : `routes/cup.ts` (un champ additif — un client antérieur l'ignore).
- Web : `lib/competition-pools` (nouveau, pur), `cups/[id]/round-pools`
  (nouveau, pur), `cups/[id]/CupRoundsView`, `cups/[id]/page`,
  `leagues/[id]/SeasonCalendar` (délègue au moteur commun),
  `leagues/[id]/pool-order` (ré-export).
- Aucune migration : la donnée existe déjà.
- Comportement inchangé pour une coupe SANS poule — la liste reste à plat.
