# E-mail transactionnel

Le serveur envoie des e-mails transactionnels (invitations de ligue, digest
de réengagement, etc.). Ce document décrit l'architecture, la config dev
(Mailpit) et la config prod.

## Architecture

Deux couches volontairement découplées :

| Fichier | Rôle |
| --- | --- |
| `apps/server/src/services/mailer.ts` | API agnostique du transport : `sendEmail(msg)`, `setMailTransport(impl)`. Dégrade proprement (log only) tant qu'aucun transport n'est branché. **Ne throw jamais.** |
| `apps/server/src/services/mail-init.ts` | Lit la config SMTP de l'environnement et branche un transport **nodemailer** sur le mailer. |

Le branchement se fait au boot dans `apps/server/src/index.ts` (après
`httpServer.listen`), désactivé en environnement de test :

```ts
if (process.env.NODE_ENV !== "test" && process.env.TEST_SQLITE !== "1") {
  void import("./services/mail-init").then(({ initMailTransportFromEnv }) => {
    initMailTransportFromEnv();
  });
}
```

**Dégradation propre** : si `SMTP_HOST` est absent, aucun transport n'est
branché — les e-mails sont seulement loggés (`[mailer] aucun transport
configuré …`). Le boot ne dépend jamais du mail.

### Producteurs d'e-mails actuels

- **Invitations de ligue** — `services/league-invitation-notify.ts`
  (appelé par `createInvitation`). Push web + e-mail si le coach a une
  adresse, ou e-mail seul pour une invitation ciblée par adresse.
- **Digest de réengagement hebdo** — cron, `services/mailer.ts`.

## Variables d'environnement

| Variable | Défaut | Description |
| --- | --- | --- |
| `SMTP_HOST` | _(vide)_ | Hôte SMTP. **Vide ⇒ pas d'envoi** (log only). |
| `SMTP_PORT` | `587` | Port SMTP. |
| `SMTP_USER` | _(vide)_ | Login SMTP. Vide ⇒ pas d'auth (cas Mailpit). |
| `SMTP_PASSWORD` | _(vide)_ | Mot de passe SMTP. |
| `SMTP_SECURE` | déduit | `"true"` = TLS implicite. Sinon déduit (`true` si port 465). |
| `MAIL_FROM` | `Nuffle Arena <no-reply@nufflearena.fr>` | Expéditeur injecté sur chaque message. |

## Dev local — Mailpit

`docker-compose.yml` monte un service **Mailpit** qui capture tous les
e-mails sortants (aucun n'est réellement délivré) :

- SMTP : `mailpit:1025` (le service `server` est déjà configuré avec
  `SMTP_HOST=mailpit`, `SMTP_PORT=1025`).
- UI web : **https://mailpit.nuffle-arena.orb.local** — tous les messages capturés y sont
  listés (HTML, texte, en-têtes).

Rien à configurer : `docker compose up` démarre Mailpit et le serveur pointe
dessus automatiquement. Déclenche une invitation de ligue et le mail apparaît
dans l'UI Mailpit.

> ⚠️ Volumes `node_modules` séparés host/conteneur : après l'ajout de
> `nodemailer`, reconstruire/réinstaller dans le conteneur server
> (`docker compose build server` ou `docker compose exec server pnpm install`)
> puis `docker compose up -d`.

## Prod

`docker-compose.prod.yml` câble les variables depuis l'environnement
(`SMTP_HOST=${SMTP_HOST:-}` …). Renseigner dans le `.env` de prod le SMTP du
fournisseur transactionnel, p.ex. :

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<secret>
MAIL_FROM=Nuffle Arena <no-reply@nufflearena.fr>
```

Tant que `SMTP_HOST` n'est pas renseigné, la prod reste en mode log only
(aucun e-mail envoyé), sans erreur.

## Tests

- `mailer.test.ts` — dégradation/succès/échec du transport.
- `mail-init.test.ts` — construction du transport nodemailer depuis l'env
  (Mailpit sans auth, TLS port 465, défaut 587, injection `MAIL_FROM`) et
  branchement conditionnel sur `SMTP_HOST`.
