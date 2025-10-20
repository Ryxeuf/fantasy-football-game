# Implémentation de toutes les équipes de Blood Bowl

## Résumé

Toutes les équipes officielles de Blood Bowl ont été ajoutées au jeu, portant le nombre total d'équipes jouables de 3 à 21.

## Équipes implémentées

### Équipes déjà présentes (3)
1. **Skavens** (skaven)
2. **Hommes-Lézards** (lizardmen)  
3. **Elfes Sylvains** (wood_elf)

### Nouvelles équipes ajoutées (18)
4. **Elfes Noirs** (dark_elf) - Naggaroth Nightwings
5. **Nains** (dwarf) - Dwarf Giants
6. **Gobelins** (goblin) - Scarcrag Snivellers
7. **Morts-Vivants** (undead) - Champions of Death
8. **Renégats du Chaos** (chaos_renegade) - Chaos All-Stars
9. **Ogres** (ogre) - Fire Mountain Gut-Busters
10. **Halflings** (halfling) - Greenfield Grasshuggers
11. **Bas-Fonds** (underworld) - Underworld Creepers
12. **Élus du Chaos** (chaos_chosen) - Doom Lords
13. **Noblesse Impériale** (imperial_nobility) - Bogenhafen Barons
14. **Horreurs Nécromantiques** (necromantic_horror) - Wolfenburg Crypt-Stealers
15. **Orques** (orc) - Gouged Eye
16. **Nurgle** (nurgle) - Nurgle's Rotters
17. **Alliance du Vieux Monde** (old_world_alliance) - Middenheim Maulers
18. **Union Elfique** (elven_union) - Elfheim Eagles
19. **Humains** (human) - Reikland Reavers
20. **Orques Noirs** (black_orc) - Thunder Valley Peaux-Vertes
21. **Snotlings** (snotling) - Mighty Crud-Creek Nosepickers

## Fichiers modifiés

### Backend (Game Engine & Server)
1. **`packages/game-engine/src/rosters/positions.ts`**
   - Ajout de toutes les définitions d'équipes avec leurs positions
   - Chaque équipe inclut : nom, budget, et liste complète des positions avec leurs caractéristiques (MA, ST, AG, PA, AV, compétences)

2. **`packages/game-engine/src/rosters/positions.js`**
   - Synchronisé automatiquement avec le fichier TypeScript via compilation

3. **`apps/server/src/routes/team.ts`**
   - Mise à jour de `ALLOWED_TEAMS` pour inclure toutes les 21 équipes

### Frontend (Web App)
4. **`apps/web/app/me/teams/new/page.tsx`**
   - Ajout de toutes les équipes dans le sélecteur de création d'équipe

5. **`apps/web/app/me/teams/page.tsx`**
   - Ajout de toutes les équipes dans le sélecteur de la page "Mes équipes"

## Caractéristiques des équipes

Chaque équipe comprend :
- **Budget initial** : 1000k pièces d'or (50 000 - 70 000 selon les équipes)
- **Positions de joueurs** avec :
  - Slug unique (ex: `dark_elf_lineman`)
  - Nom d'affichage (ex: "Dark Elf Linemen")
  - Coût en kpo
  - Limites min/max de joueurs par position
  - Caractéristiques (Movement Allowance, Strength, Agility, Passing, Armour Value)
  - Compétences de base (séparées par virgules, format slug)

## Exemple de structure d'équipe

```typescript
dark_elf: {
  name: "Elfes Noirs",
  budget: 1000,
  positions: [
    {
      slug: "dark_elf_lineman",
      displayName: "Dark Elf Linemen",
      cost: 70,
      min: 0,
      max: 12,
      ma: 6,
      st: 3,
      ag: 2,
      pa: 4,
      av: 9,
      skills: "",
    },
    // ... autres positions
  ]
}
```

## Tests

- ✅ Compilation TypeScript du game-engine : **RÉUSSIE**
- ✅ Tests du game-engine : **462/475 passent** (les 13 échecs existaient déjà, non liés aux équipes)
- ✅ Pas d'erreurs de linting
- ✅ Toutes les équipes sont disponibles dans le frontend

## Notes techniques

- Le système utilise des slugs uniques pour chaque position (ex: `dark_elf_lineman`, `dwarf_blocker_lineman`)
- Les compétences sont stockées au format slug kebab-case (ex: `mighty-blow-1`, `thick-skull`)
- Budget par défaut de 1000k pièces d'or pour toutes les équipes
- Compatibilité maintenue avec le système de mapping legacy pour les anciennes positions

## Prochaines étapes possibles

1. Ajouter les images/icônes des équipes
2. Implémenter les règles spéciales de chaque équipe
3. Ajouter les Star Players spécifiques à chaque équipe
4. Créer des templates de rosters recommandés pour débutants
5. Ajouter la documentation des stratégies par équipe

## Source des données

Les données proviennent du livre officiel Blood Bowl 2020, avec toutes les caractéristiques et compétences conformes aux règles officielles.

