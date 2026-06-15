# 🖼️ Guide : Ajouter des Images de Star Players

## 📍 Emplacement des images

Les images doivent être placées dans :
```
apps/web/public/images/star-players/
```

## 📝 Convention de nommage

Le nom du fichier doit correspondre au **slug** du Star Player :

| Star Player | Slug | Nom du fichier |
|-------------|------|----------------|
| Hakflem Skuttlespike | `hakflem_skuttlespike` | `hakflem_skuttlespike.jpg` |
| Grak | `grak` | `grak.jpg` |
| Morg 'n' Thorg | `morg_n_thorg` | `morg_n_thorg.jpg` |
| Akhorne l'Écureuil | `akhorne_the_squirrel` | `akhorne_the_squirrel.jpg` |

## 🎨 Format recommandé

- **Format** : JPG ou PNG
- **Taille** : 300x300px minimum (carré)
- **Poids** : < 500KB recommandé
- **Qualité** : Bonne résolution pour l'affichage web

## 📥 Sources pour obtenir les images

### 1. NuffleZone (captures d'écran)
- Site : https://nufflezone.com/fr/star-player/
- Faire des captures d'écran de chaque joueur
- Recadrer l'image pour garder uniquement le joueur

### 2. Games Workshop (officiel)
- Si vous possédez le livre de règles Blood Bowl
- Scanner ou photographier les images officielles

### 3. Blood Bowl Tactics
- Site : https://bbtactics.com/
- Vérifier les droits d'utilisation

### 4. Miniatures
- Photographier vos propres figurines Blood Bowl
- Utiliser un fond neutre
- Bonne lumière

## 🔧 Traitement des images

### Avec un outil en ligne (gratuit)
1. Aller sur https://www.iloveimg.com/ ou https://squoosh.app/
2. Redimensionner l'image en 300x300px
3. Convertir en JPG si nécessaire
4. Optimiser la taille du fichier

### Avec Photoshop / GIMP
```
1. Ouvrir l'image
2. Image → Taille de l'image → 300x300px
3. Fichier → Exporter pour le web
4. Format: JPG, Qualité: 80%
```

## 📂 Structure finale

```
apps/web/public/images/star-players/
├── README.md
├── akhorne_the_squirrel.jpg
├── barik_farblast.jpg
├── bomber_dribblesnot.jpg
├── fungus_the_loon.jpg
├── grak.jpg
├── crumbleberry.jpg
├── hakflem_skuttlespike.jpg
├── helmut_wulf.jpg
├── morg_n_thorg.jpg
├── nobbla_blackwart.jpg
├── ripper_bolgrot.jpg
├── scrappa_sorehead.jpg
├── skitter_stab_stab.jpg
└── ... (autres joueurs)
```

## 🎯 Placeholder automatique

Si une image est manquante, l'application affichera automatiquement une **icône ⭐** comme placeholder.

Vous pouvez ajouter les images progressivement !

## ⚖️ Notes légales

- Les images de Star Players appartiennent à Games Workshop
- Assurez-vous d'avoir le droit d'utiliser les images
- Usage personnel / éducatif généralement accepté
- Ne pas redistribuer commercialement

## 🚀 Test

Pour tester qu'une image fonctionne :
1. Placez l'image dans le dossier
2. Allez sur `/star-players/[slug]` (ex: `/star-players/hakflem_skuttlespike`)
3. L'image devrait s'afficher automatiquement

Si l'image ne s'affiche pas :
- ✅ Vérifiez que le nom du fichier correspond EXACTEMENT au slug
- ✅ Vérifiez que l'extension est `.jpg` ou `.png` (en minuscules)
- ✅ Vérifiez que le fichier est bien dans `apps/web/public/images/star-players/`
- ✅ Rechargez la page (Ctrl+F5)

## 📋 Checklist par joueur

```
[ ] Akhorne l'Écureuil (akhorne_the_squirrel.jpg)
[ ] Barik Farblast (barik_farblast.jpg)
[ ] Bomber Dribblesnot (bomber_dribblesnot.jpg)
[ ] Fungus le Cinglé (fungus_the_loon.jpg)
[ ] Grak (grak.jpg)
[ ] Crumbleberry (crumbleberry.jpg)
[ ] Hakflem Skuttlespike (hakflem_skuttlespike.jpg)
[ ] Helmut Wulf (helmut_wulf.jpg)
[ ] Morg 'n' Thorg (morg_n_thorg.jpg)
[ ] Nobbla La Teigne (nobbla_blackwart.jpg)
[ ] Ripper Bolgrot (ripper_bolgrot.jpg)
[ ] Scrappa Malocrâne (scrappa_sorehead.jpg)
[ ] Skitter Stab-Stab (skitter_stab_stab.jpg)
[ ] ... (autres joueurs à ajouter)
```

---

**Bon courage pour compléter la galerie ! 🎨⭐**

