# 2026-09-10 — Les coupes se gèrent comme les ligues

> Récit de session. Décision versionnée dans
> `openspec/changes/cups-managed-like-leagues/`.

## Le point de départ

Un retour d'usage en quatre lignes : « la gestion des coupes n'est pas bonne,
il faut que les coupes se gèrent comme les ligues ». Avec les différences
attendues, énoncées telles quelles : aucun gain de PSP, mode résurrection par
défaut, chaque match joué avec le roster initial tel quel, aucun gain d'or ni
de staff. Plus trois demandes : même feuille de match, critères de classement
définissables, et génération des rondes selon plusieurs modes (aléatoire,
suisse, manuel). Et un bug : construire une équipe depuis une coupe World Cup
retombait à 1 000 kpo sans compétences.

## Ce que l'audit a montré

Côté serveur, le fossé était structurel : `LeagueMatchSheet` (~4 000 lignes de
service) n'existait que pour les ligues ; une rencontre de coupe se jouait
dans un `LocalMatch` à la saisie libre. Côté web, 26 451 lignes de ligue
contre 4 699 de coupe.

Le bug de construction, lui, avait DÉJÀ été corrigé une semaine plus tôt
(#1015) — mais deux chemins résiduels reproduisaient exactement le symptôme :
un règlement introuvable côté client (désactivé en admin, ou appel en échec)
faisait retomber la précédence sur la branche « coupe » sans rien dire, et le
lien de secours « Créer une équipe » pointait un builder nu.

## Les trois décisions

1. **Une seule feuille, polymorphe.** Dupliquer le service, c'était garantir
   la divergence — le dépôt en a déjà l'expérience. Deux FK nullables (patron
   de `CompetitionDocument`), une résolution polymorphe qui laisse intactes
   les signatures `{ pairingId }`, et un jeu de règles nommé par compétition.
   Le branchement se limite à quatre endroits.
2. **Matérialiser plutôt qu'enseigner.** Le classement d'une coupe est dérivé
   de ses matchs ; la validation crée le `LocalMatch` et rejoue le journal en
   actions. Trois lectures (classement, podiums, classements individuels)
   n'ont pas bougé d'une ligne, et l'invalidation se réduit à supprimer le
   match.
3. **Le tirage au sort n'est pas un moteur.** Mélanger l'ordre et déléguer au
   moteur suisse donne gratuitement le « zéro rematch », l'exempt tournant et
   l'équilibrage des réceptions. La graine `<cupId>:<roundNumber>` rend le
   tirage rejouable.

## Ce qui reste

La parité UI n'est pas complète : poules, playoffs de coupe, export PDF d'une
ronde, relance des coachs, page de récapitulatif et palmarès dédiés, éditeur
de roster commissaire. `cups/[id]/page.tsx` est encore majoritairement en
français en dur. Ces suites sont listées dans le `tasks.md` du change et
doivent être remontées dans
[`docs/roadmap/backlog/openspec-suites.md`](../backlog/openspec-suites.md) à
l'archivage — les enterrer avec le change serait les perdre.
