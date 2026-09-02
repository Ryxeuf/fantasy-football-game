# Design — PA nullable sur Position et TeamPlayer

## Contexte

Trois modeles portent une caracteristique `pa` (Passing) dans
`prisma/schema.prisma` :

| Modele       | Ligne | Type actuel | Role |
|--------------|-------|-------------|------|
| `TeamPlayer`     | 447   | `Int`       | Instance de joueur dans une equipe reelle (copie d'une Position) |
| `Position`   | 551   | `Int`       | Definition catalogue d'un poste de roster |
| `StarPlayer` | 593   | `Int?`      | **Deja nullable** — sert de reference de pattern |

`StarPlayer` resout deja exactement le probleme : `pa Int? // null pour -`,
formulaire admin sans `required` (`defaultValue={starPlayer.pa || ""}`,
placeholder « Laissez vide pour - »), et affichage `null → "-"`. La cible est
d'amener `Position` **et** `TeamPlayer` au meme niveau.

## Le declic : le `null` doit traverser Position → TeamPlayer

```
   Admin edite une Position             Coach cree une equipe depuis un roster
   (catalogue, slug skaven_*)                       |
          |                                          v
   Position.pa = null  ----- copie ----->  TeamPlayer.pa = <Position.pa>
          |                                          |
          v                                          v
   affichage catalogue  ->  "-"           affichage equipe  ->  "-"
```

Si on rendait seulement `Position.pa` nullable, la copie vers `TeamPlayer.pa`
(colonne `NOT NULL`) ferait echouer l'`INSERT` des qu'une position sans PA est
recrutee. D'ou le perimetre **Position + TeamPlayer** retenu. Les points de copie
identifies (grep `pa: ...pa`) :

- `apps/server/src/routes/team-create-from-roster-handler.ts:351`
- `apps/server/src/routes/team-purchase-handler.ts:187`
- `apps/server/src/utils/roster-helpers.ts:122,183`
- `apps/server/src/utils/default-lineup.ts:140`
- `apps/server/src/scripts/sync-rosters.ts:115`

Regle : ces points doivent passer `pa` **tel quel** (`number | null`), sans
`Number(pa)` / `parseInt` / `pa ?? 0` qui re-materialiserait un `0`.

## Migration

Assouplir une contrainte `NOT NULL → NULL` est **additif et non destructif** :
les lignes existantes gardent leur valeur. Pas de backfill. Postgres :
`ALTER TABLE "Position" ALTER COLUMN "pa" DROP NOT NULL;` (idem `"TeamPlayer"`).
On genere la migration via le flow Prisma habituel du repo. Le mirror sqlite
de test (`prisma-sqlite`) doit refleter le meme assouplissement.

## Saisie admin : calque StarPlayer

Avant (Position, `required`) :
```tsx
<label>PA *</label>
<input type="number" name="pa" defaultValue={position.pa} required />
```
Apres (calque exact de StarPlayer) :
```tsx
<label>PA</label>
<input type="number" name="pa"
       defaultValue={position.pa ?? ""}
       placeholder="Laissez vide pour -" />
```
A appliquer au formulaire d'**edition** ET de **creation** d'une position.

## Validation / API : `"" → null`, jamais `NaN`

Le point piege : `parseInt("")` vaut `NaN`. Le schema Zod de la position doit
accepter PA absent/vide et le normaliser en `null` (et non en `NaN`/`0`).
Pattern : champ optionnel + `preprocess` qui transforme `"" | undefined → null`,
sinon `Number`. Le handler n'ecrit plus `pa: parseInt(formData.get("pa"))`
mais `pa: <valeur Zod normalisee>` (`number | null`). Aligne sur la facon dont
StarPlayer gere deja son PA optionnel.

## Affichage : une seule regle, appliquee partout

Convention retenue (deja majoritaire dans le code) :
`pa != null ? `${pa}+` : "-"`. Certains composants utilisent `"—"` (cadratin) ;
on respecte le glyphe local existant du composant pour ne pas introduire
d'incoherence visuelle. Les sites **deja gardes** (`pa || "-"`, `pa ?? "-"`,
`pa ? ... : "—"`) sont corrects une fois la donnee nullable — rien a changer.
Restent a corriger les rendus **bruts** `{position.pa}` / `{player.pa}` et la
structured-data SEO qui ecrit `PA ${pa}+` en dur.

> Note : `pa || "-"` traite aussi `0` comme absent. C'est acceptable ici car
> `0` n'est jamais une valeur de PA valide en BB (l'echelle utile est `1+`..`6+`).
> Mais on privilegie `pa != null` la ou on ecrit du neuf, pour exprimer
> l'intention "absence" plutot que "falsy".

## Alternatives ecartees

- **Sentinel `0` (garder `Int` non-nullable, `0` = "-")** : evite la migration
  mais (a) diverge du pattern StarPlayer deja en place, (b) laisse une valeur
  "magique" en base que chaque lecteur doit connaitre, (c) le form `required`
  bloquerait quand meme la saisie de `0` proprement. Rejete : moins clair,
  incoherent avec l'existant.
- **Position seule (sans TeamPlayer)** : casse a la creation d'equipe (cf. supra).
  Rejete.
- **Generaliser a MA/ST/AG/AV** : surface bien plus large pour un besoin non
  demande aujourd'hui. Reporte (Non-Goal).

## Tests

- **Unite affichage** : un helper/format `pa=null → "-"`, `pa=2 → "2+"`,
  `pa=0 → "-"` (jamais `"null+"` ni `"NaN+"`).
- **Integration API** : `PUT/POST` position avec PA vide → persiste `null` ;
  relecture renvoie `pa: null`.
- **Non-regression chaine** : creer une equipe depuis une position `pa=null`
  → `TeamPlayer.pa === null` et rendu `-`.
- **Donnee** : le Cingle Gobelin a `pa: null` apres reseed.
- Suites server + web vertes, `tsc` exit 0, prettier clean.
