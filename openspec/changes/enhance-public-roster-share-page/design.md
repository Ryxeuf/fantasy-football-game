# Design — Page publique d'un roster partagé

## 1. Qui calcule les coûts : le serveur, une fois

La fiche du coach a déjà tranché la question (`GET /team/:id` sert
`playerValues`, `staffConfig`, `budgetSummary`) après un bug franc : la
colonne « Coût » affichait le tarif de recrue d'un joueur deux fois
amélioré, soit 140k face à une VE qui le comptait 230k. La page publique
partait du même mauvais pied — sauf qu'elle n'affichait aucun coût du
tout.

Trois façons de la servir :

| Option | Effet | Retenu |
|---|---|---|
| Re-dériver côté web avec `getPlayerCost(position, roster)` | Ignore le ruleset de l'équipe, les surcoûts d'avancement et le surcoût Élite : ré-introduit exactement le bug déjà corrigé sur la fiche | non |
| Appeler `GET /team/:id` depuis la page publique | Route authentifiée, réservée au propriétaire | non |
| Étendre la réponse publique avec les mêmes trois champs | Une seule comptabilité, celle du serveur ; le web n'a plus qu'à afficher | **oui** |

Conséquence directe : `buildPublicTeamView` réutilise
`computePlayerValuesFor`, `resolveStaffConfigBySlug` et
`buildTeamBudgetSummary` — les fonctions de la fiche du coach, pas des
copies.

## 2. Pourquoi une VUE explicite plutôt que la ligne `Team`

`getPublicTeamByToken` rendait `prisma.team.findFirst({ include: { players,
starPlayers } })`, donc TOUTES les colonnes de `Team` — `ownerId` et
`shareToken` compris — dans une réponse anonyme. Le risque n'est pas
seulement ce qui fuit aujourd'hui : c'est que la prochaine colonne ajoutée
au modèle devienne publique sans que personne ne l'ait décidé.

`PublicTeamView` liste donc ses champs. Le coût est un mapping à écrire,
le bénéfice est qu'ajouter une colonne au modèle est désormais un
non-événement pour cette route.

## 3. Enrichissements isolés, et pas de persistance

Chaque enrichissement tourne dans son propre `try/catch`
(`optionalEnrichment`), même posture que `GET /team/:id` : « les
enrichissements d'AFFICHAGE ne doivent jamais priver le coach de sa fiche ».
Ici l'enjeu est plus fort encore — la page est vue par des inconnus, et un
catalogue incomplet ne doit pas leur renvoyer une erreur.

Une différence assumée avec la fiche du coach : celle-ci PERSISTE la
VE/VEA quand elle diverge (auto-réparation). La lecture publique ne le
fait pas. Un visiteur anonyme n'écrit pas dans l'équipe d'autrui, et la
route est cachée par ISR : l'écriture serait déclenchée par le cache, pas
par une action.

## 4. Rendre les compétences comme la fiche du coach, sans client lourd

Les badges base/acquise + tooltip vivent dans `me/teams/components/SkillTooltip`,
un composant CLIENT qui a besoin de trois choses : la langue, le
catalogue de compétences, et les compétences PAR DÉFAUT de la position
(`dbBaseSkills`) pour trancher base vs acquise.

La page `/r/[token]` est un composant serveur (ISR 600s). On applique le
patron déjà en place sur `/teams/[slug]` : le serveur résout le catalogue
(`fetchSkillsCatalog`) et le passe à `SkillsCatalogProvider`, qui enveloppe
le composant client. Les libellés sont donc corrects **dès le HTML
initial** — pas de flash « slug brut puis vrai nom », ce qui compte quand
un lien partagé n'est souvent ouvert qu'une fois.

Les compétences par défaut viennent du détail roster
(`GET /api/rosters/:slug`), la même source que la fiche du coach — pas de
la liste compilée du moteur, qui diverge dès qu'un admin édite une
position.

### Repli du libellé de poste

`getDisplayName(slug)` rend le **slug brut** pour une position que le
catalogue compilé ne connaît pas. La page publique affichait auparavant
`prettifySlug(position)` (« Skaven Blitzer »). Le repli final la conserve
donc :

```
détail roster (base) → catalogue compilé → prettifySlug
```

Sans cette dernière marche, une panne du détail roster aurait remplacé
« Skaven Blitzer » par « skaven_blitzer » sur la page vitrine du site.

## 5. Mobile

Un lien partagé s'ouvre majoritairement au téléphone, et l'effectif compte
désormais dix colonnes. La table reste en `md:` et cède la place à une
carte par joueur en dessous — même parti pris que la fiche du coach.
