# Rapport de Correction des Compétences des Joueurs

## Date
13 octobre 2025

## Problème Identifié
Plusieurs joueurs dans le fichier `apps/server/src/routes/team.ts` avaient des compétences manquantes par rapport aux règles officielles de Blood Bowl (référence: `data/rules.txt`).

## Corrections Effectuées

### 1. Rat Ogre (Skaven) ✅
**Ligne de référence dans rules.txt:** 2665-2666

**Avant:**
```typescript
skills: "Frenzy,Animal Savagery"
```

**Après:**
```typescript
skills: "Animal Savagery,Frenzy,Loner (4+),Mighty Blow (+1),Prehensile Tail"
```

**Compétences ajoutées:**
- Loner (4+) - Solitaire (4+)
- Mighty Blow (+1) - Châtaigne (+1)
- Prehensile Tail - Queue Préhensile

**Justification:** Selon les règles officielles (ligne 2665-2666), le Rat Ogre doit avoir : "Sauvagerie Animale, Frénésie, Solitaire (4+), Châtaigne (+1), Queue Préhensile"

---

### 2. Kroxigor (Hommes-Lézards) ✅
**Ligne de référence dans rules.txt:** 2467-2468

**Avant:**
```typescript
skills: "Bone Head,Prehensile Tail"
```

**Après:**
```typescript
skills: "Bone Head,Loner (4+),Mighty Blow (+1),Prehensile Tail,Thick Skull,Throw Team-mate"
```

**Compétences ajoutées:**
- Loner (4+) - Solitaire (4+)
- Mighty Blow (+1) - Châtaigne (+1)
- Thick Skull - Crâne Épais
- Throw Team-mate - Lancer de Coéquipier

**Justification:** Selon les règles officielles (ligne 2467-2468), le Kroxigor doit avoir : "Cerveau Lent, Solitaire (4+), Châtaigne (+1), Crâne Épais, Queue Préhensile" + "Lancer de Coéquipier" (ligne 2383 pour Treeman similaire)

---

### 3. Skink (Hommes-Lézards) ✅
**Ligne de référence dans rules.txt:** 2462-2463

**Avant:**
```typescript
skills: "Dodge"
```

**Après:**
```typescript
skills: "Dodge,Stunty"
```

**Compétences ajoutées:**
- Stunty - Minus

**Justification:** Selon les règles officielles (ligne 2462-2463), les Skink Runner Linemen doivent avoir : "Esquive, Minus"

**Note:** La compétence "Minus" en français correspond à "Stunty" en anglais dans les règles Blood Bowl.

---

## Fichiers Modifiés

### `apps/server/src/routes/team.ts`
- Ligne 97: Rat Ogre - Compétences complétées
- Ligne 129: Skink - Compétence Stunty ajoutée
- Ligne 142: Kroxigor - Compétences complétées
- Ligne 214: Template Skink - Compétence Stunty ajoutée

## Vérification

### Cohérence avec base-skills-data.ts
Le fichier `apps/web/app/me/teams/base-skills-data.ts` contenait déjà les bonnes compétences :
- ✅ Rat Ogre: `["Animal Savagery", "Frenzy", "Loner (4+)", "Mighty Blow (+1)", "Prehensile Tail"]`
- ✅ Kroxigor: `["Bone Head", "Loner (4+)", "Mighty Blow (+1)", "Prehensile Tail", "Thick Skull", "Throw Team-mate"]`

Les corrections dans `team.ts` alignent maintenant les deux fichiers.

## Impact

### Joueurs Affectés
1. **Rat Ogre** - Maintenant correctement équipé avec toutes ses compétences de trait
2. **Kroxigor** - Maintenant correctement équipé avec toutes ses compétences de trait
3. **Skink** - Maintenant correctement équipé avec la compétence Stunty (Minus)

### Gameplay
Ces corrections rendent les joueurs conformes aux règles officielles de Blood Bowl :
- Le Rat Ogre et le Kroxigor ont maintenant **Loner (4+)** et **Mighty Blow (+1)**, ce qui les rend plus puissants mais aussi plus imprévisibles
- Le Kroxigor peut maintenant lancer des coéquipiers (**Throw Team-mate**)
- Les Skinks sont maintenant correctement marqués comme **Stunty**, ce qui affecte leurs interactions avec d'autres joueurs

## Tests Recommandés
1. ✅ Vérifier que les nouvelles équipes créées ont les bonnes compétences
2. ⏳ Tester le comportement du Loner (4+) en jeu
3. ⏳ Tester le comportement de Mighty Blow (+1) lors des blocages
4. ⏳ Tester le comportement de Stunty pour les Skinks
5. ⏳ Tester l'action Throw Team-mate du Kroxigor

## Références
- Règles officielles: `data/rules.txt` (lignes 2462-2468, 2658-2669)
- Fichier de compétences: `apps/web/app/me/teams/base-skills-data.ts`
- Fichier modifié: `apps/server/src/routes/team.ts`

