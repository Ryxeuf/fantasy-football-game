# Haine (X) — acquisition du trait sur blessure

## La règle

Un joueur sorti d'un match avec une blessure qui le rendra **absent au
moins le match suivant** (Amoché, Blessure Sérieuse, Séquelle) jette
**1D6** à la validation de la feuille de match. Sur **4+**, il gagne le
trait **Haine (X)**, où **X** est un Mot-clé du joueur qui l'a éliminé.

X est nécessairement un mot-clé de **lignée** (Humain, Orque, Nain,
Troll, Homme Lézard…). Les mots-clés de **poste** sont exclus :

> Gros Bras, Bloqueur (*Blocker*), Blitzer, Receveur, Trois-quart,
> Coureur, Spécial, Lanceur.

Haïr « les Blitzers » n'aurait aucun sens de rivalité, et la moitié du
terrain finirait par porter le trait.

Le trait **ne se choisit jamais à l'évolution** : c'est le seul trait du
jeu qui s'obtient uniquement en étant mis sur la touche.

## Où ça vit

| Couche | Fichier | Rôle |
|---|---|---|
| Moteur (pur) | `packages/game-engine/src/skills/hate-trait.ts` | Mots-clés exclus, choix de X, slug de compétence, seuil du D6, définition de la compétence à créer |
| Résumé de feuille | `apps/server/src/services/league-match-summary.ts` | `InjuredPlayer.causedByPlayerId` — l'auteur de la sortie |
| Service | `apps/server/src/services/league-hate-trait.ts` | Candidats, résolution des Mots-clés, jet + pose, réversion |
| Feuille de match | `apps/server/src/services/league-match-sheet.ts` | Résout les Mots-clés des joueurs de la feuille et produit `hateCandidates` |
| Application | `apps/server/src/services/league-offline-result.ts` | Joue le jet **après** les blessures, mémorise `hateGranted` dans le snapshot |
| Invalidation | `apps/server/src/services/league-offline-edit.ts` | Retire les traits accordés par le match annulé |
| Interface | `apps/web/app/leagues/pairings/[id]/sheet/_components/HateRollsRecap.tsx` | Récapitulatif des jets sur la feuille validée |

## Détails qui comptent

**Qui peut être haï.** L'auteur de la sortie peut être un joueur du
roster, un **journalier** ou un **Star Player** engagé : tous les trois
portent des Mots-clés. Une auto-élimination (esquive ratée) et une sortie
par la foule n'ont pas d'auteur — personne à haïr.

**La mort ne déclenche rien.** Un joueur mort n'a plus de match à jouer.

**Un seul jet par couple (victime, X).** Deux sorties infligées par le
même adversaire dans le même match ne donnent qu'un jet. Un joueur qui
possède déjà Haine (X) pour ce mot-clé ne rejette pas.

**Le trait ne coûte rien en VE.** Il est posé sur la CSV
`TeamPlayer.skills`, pas dans `advancements` — le calcul de valeur
d'équipe ne lit que `advancements`. Ce n'est pas une amélioration
achetée.

**Mots-clés : base d'abord, moteur en repli.** La colonne
`Position.keywords` est éditable en admin ; `KEYWORDS_SEASON3` en est la
transcription de référence et le repli (même posture que
`effectiveRegionalRules`).

**Création à la volée.** Le catalogue ne porte que trois variantes
(`hate`, `hate-troll`, `hate-dwarf`). Les autres sont créées à la
première occurrence, toujours avec `excludedFromSelection: true`. Une
ligne antérieure restée sélectionnable est réparée au passage — le seed
la corrige aussi, sans attendre le prochain déploiement.

**Réversible.** Comme toute écriture d'après-match, les traits accordés
sont mémorisés dans `Match.offlineResultInput.hateGranted` et retirés à
l'invalidation de la feuille.

## Ce que voit l'utilisateur

Le D6 est lancé **côté serveur**, à la validation de la feuille par le
commissaire. Sans restitution, un coach verrait un jour un trait
apparaître sur la fiche d'un joueur sans savoir d'où il vient — ou, pire,
ne saurait jamais qu'un jet a eu lieu et a échoué. Trois choses sont donc
exposées.

**1. Le récapitulatif des jets, sur la feuille validée.** L'onglet « Fin
du match » affiche `HateRollsRecap` (coachs et commissaire) : le rappel de
la règle, puis **un dé par ligne** avec le résultat, le joueur blessé, son
équipe, et l'issue réelle. Les jets **ratés y figurent aussi** — c'est ce
qui prouve au coach que le jet a bien eu lieu. `data-testid` :
`hate-rolls-recap`, `hate-roll-granted`, `hate-roll-failed`.

Il vit sous « Fin du match » (conséquences d'après-match, à côté des
gains, achats et licenciements) et **non** sous « Évolutions » : le trait
ne coûte pas de PSP, ne change pas la VE et ne se choisit pas — le ranger
avec les améliorations achetées induirait en erreur.

**2. Le trait sur la fiche du joueur.** Une fois accordé, il vit dans la
CSV `TeamPlayer.skills` et s'affiche comme toute autre compétence
(`SkillTooltip`), avec son libellé officiel et sa description.

**3. Le journal d'équipe.** L'acquisition écrit une étape
`team.player.hate_trait` (jet, mot-clé, compétences avant/après) et la
réversion une étape `team.player.hate_trait.reverted` — une compétence
qui apparaît sans que personne ne l'ait choisie est exactement ce qu'un
coach vient demander.

### Deux pièges de restitution

**Le succès du dé n'est PAS l'attribution.** Un 4+ peut ne rien accorder
si la compétence n'a pas pu être garantie au catalogue. Le service trace
donc `granted` **et** un `failure` (`skill-unavailable` / `write-failed`)
distincts du seuil : afficher « 4+ requis » sur un 5 serait un mensonge,
et un jet réussi sans trait sur la fiche passerait pour une perte de
données. C'est `HateRoll`, distinct de `HateGrant` (qui, lui, ne sert
qu'à la réversion et garde sa forme d'origine).

**Le catalogue est mémoïsé 5 min.** Une variante créée à la volée
(`hate-homme-lezard`) resterait invisible de `GET /api/skills` jusqu'à
expiration, et le badge s'afficherait en **slug brut** sur la fiche du
joueur. `ensureHateSkill` appelle donc `invalidatePublicSkillsCache()`
(`utils/skills-cache.ts`) juste après la création. Côté composant, le
repli n'est jamais le slug mais `Haine (X)` reconstruit depuis le
mot-clé.

### Persistance du récapitulatif

Les jets sont écrits dans `Match.offlineResultInput.hateRolls`, à côté de
`hateGranted`, et relus par `getMatchSheet` : le récap survit donc à un
rechargement de page, il ne dépend pas de la réponse ponctuelle de la
validation. Le snapshot est écrit **même quand tous les jets ont raté**
(rien à réverser, mais quelque chose à montrer). Un match validé avant ce
champ n'a que `hateGranted` : `parseHateRolls` en reconstitue les jets
réussis pour que l'historique ne soit pas vide.
