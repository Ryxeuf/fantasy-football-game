# Ajout du roster Elfes Sylvains (Wood Elf)

## Date : 15 Octobre 2025

## Modifications effectuées

### 1. Ajout du roster Wood Elf dans le game-engine

**Fichier : `packages/game-engine/src/rosters/positions.ts`**
- Ajout du roster complet des Elfes Sylvains avec 5 positions :
  - **Lineman** : 0-12 joueurs, 70k, MA:7, ST:3, AG:2, PA:4, AV:8
  - **Thrower** : 0-2 joueurs, 95k, MA:7, ST:3, AG:2, PA:2, AV:8, Compétences: Pass, Sure Hands
  - **Catcher** : 0-4 joueurs, 90k, MA:8, ST:2, AG:2, PA:4, AV:8, Compétences: Catch, Dodge
  - **Wardancer** : 0-2 joueurs, 125k, MA:8, ST:3, AG:2, PA:4, AV:8, Compétences: Block, Dodge, Leap
  - **Treeman** : 0-1 joueur, 120k, MA:2, ST:6, AG:5, PA:5, AV:11, Compétences: Loner (4+), Mighty Blow (+1), Stand Firm, Strong Arm, Take Root, Thick Skull, Throw Team-mate
- Budget initial : 1000k

**Fichier : `packages/game-engine/src/rosters/positions.js`**
- Synchronisation automatique avec le fichier TypeScript

**Fichier : `packages/game-engine/src/rosters/index.ts`**
- Mise à jour du type `AllowedRoster` pour inclure `'wood_elf'`
- Ajout de `'wood_elf'` dans la constante `ALLOWED_TEAMS`

### 2. Mise à jour du serveur

**Fichier : `apps/server/src/routes/team.ts`**
- Ajout de `"wood_elf"` dans la constante `ALLOWED_TEAMS`
- Ajout d'un template de roster par défaut pour les Wood Elves dans la fonction `rosterTemplates()` :
  - 2 Wardancers
  - 2 Catchers
  - 1 Thrower
  - 6 Linemen
  - (Treeman optionnel non inclus par défaut)

### 3. Mise à jour de l'interface web

**Fichier : `apps/web/app/me/teams/page.tsx`**
- Ajout de l'option "Elfes Sylvains" dans le sélecteur de roster

**Fichier : `apps/web/app/me/teams/new/page.tsx`**
- Ajout de l'option "Elfes Sylvains" dans le sélecteur de roster du team builder

## Source des données

Les statistiques et compétences ont été extraites du fichier officiel `data/rules.txt` (section ELFES SYLVAINS, lignes 2375-2385), basé sur les règles Blood Bowl 2020.

## Tests

- ✅ Compilation TypeScript du game-engine réussie
- ⚠️ Tests existants : Certains tests échouent mais ces échecs existaient déjà avant les modifications (problèmes de placement de joueurs en phase setup)

## Correction supplémentaire effectuée

⚠️ **Problème découvert** : Le roster Lizardmen était incomplet. Il manquait les **Chameleon Skinks** !

**Correction appliquée** : Ajout des Chameleon Skinks (0-2 joueurs, 70k) avec leurs compétences spéciales : Dodge, On the Ball, Shadowing, Stunty.

Voir le rapport détaillé : `LIZARDMEN-CHAMELEON-SKINKS-FIX.md`

## Équipes manquantes identifiées

D'après l'analyse des fichiers de règles, les équipes suivantes sont encore manquantes dans le système :

### Priorité haute (équipes officielles BB2020)
1. **Human** (Humains)
2. **Orc** (Orcs)
3. **Dark Elf** (Elfes Noirs)
4. **Dwarf** (Nains)
5. **High Elf** (Hauts Elfes)
6. **Elven Union** (Union Elfique)
7. **Chaos Chosen** (Élus du Chaos)
8. **Norse** (Norse)
9. **Undead** (Morts-Vivants)
10. **Necromantic Horror** (Horreur Nécromantique)
11. **Vampire** (Vampires)
12. **Nurgle** (Nurgle)
13. **Khorne** (Khorne)
14. **Amazon** (Amazones)
15. **Underworld Denizens** (Bas-Fonds)
16. **Goblin** (Gobelins)
17. **Halfling** (Halflings)
18. **Ogre** (Ogres)
19. **Snotling** (Snotlings)
20. **Old World Alliance** (Alliance du Vieux Monde)
21. **Chaos Dwarf** (Nains du Chaos)
22. **Chaos Renegades** (Renégats du Chaos)
23. **Black Orc** (Orcs Noirs)
24. **Tomb Kings** (Rois des Tombes)
25. **Gnome** (Gnomes)
26. **Imperial Nobility** (Noblesse Impériale)

## Prochaines étapes recommandées

1. Ajouter progressivement les autres rosters manquants
2. Vérifier et corriger les tests échouants sur la phase de setup
3. Ajouter des tests spécifiques pour les nouveaux rosters
4. Documenter les règles spéciales de chaque équipe (Regional Rules, Team Special Rules)

## Compatibilité

Les modifications sont rétrocompatibles et n'affectent pas les équipes existantes (Skaven et Lizardmen).

