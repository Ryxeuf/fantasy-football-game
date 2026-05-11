# SPRINT R — International + monetisation + mobile release

> **Statut** : PLANIFIE — demarre apres Sprint Q.
> **Duree estimee** : 3-6 mois (multi-streams en parallele possible).
> **Pre-requis** : Sprint O + P + Q.

## Contexte

A ce stade, Nuffle Arena est techniquement solide (bugs fixes), prete
ops (admin tooling, sinks Crowns), et fan-friendly (clips, vote, mini-
leagues, career pages). Reste 3 leviers pour devenir **"le futur
incontournable du BB en ligne en France et a l'etranger"** :

1. **Internationalisation EN/DE/PL/ES complete** — FR-only plafonne a
   ~5k MAU. DE + PL = 2× le marche FR en tabletop BB.
2. **Monetisation ethique sans pay-to-win** — runway financier pour
   recruter, scaler, sponsoriser des tournois.
3. **Mobile release App Store + Play Store** — push notifications
   mardi 21h Pro League = retention x2 prouvee.

Plus 4 leviers strategiques :

4. **Discord officiel + bot Gazette auto-post**.
5. **Programme ambassadeur 5 casters Twitch/YT BB**.
6. **NAF integration** (resultats tournois IRL → fiches joueurs).
7. **PvP async tours-par-jour** (FUMBBL-killer feature).

**Objectif :** atteindre **10 000 MAU** + reconnaissance dans le **top 3
BB online** (FR + EN + DE) a 12 mois.

## Definition of done sprint

- [ ] Site complement traduit EN + DE + PL (Gazette LLM multi-langue).
- [ ] Patreon "Founders Club" lance (5/10/20€/mois tier).
- [ ] Season Pass cosmetique 10€/saison disponible (skins terrain,
  blasons custom, dice 3D, Gazette avatar perso).
- [ ] App iOS + Android publiees sur stores (registration, Pro League,
  paris mobile).
- [ ] Discord officiel cree + bot Gazette auto-post quotidien.
- [ ] 5 casters Twitch/YT BB en programme ambassadeur.
- [ ] NAF API integration : import resultats tournois IRL.
- [ ] PvP async tours-par-jour deploye (alpha minimum).

## Decoupage en lots

### Lot R.A — Internationalisation complete (~6 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| R.A.1 | Routing i18n native Next.js | Frontend | L | [ ] | Migration de `localStorage lang switch` vers `/fr/*`, `/en/*`, `/de/*`, `/pl/*` segments. `middleware.ts` route auto selon Accept-Language. Sitemap genere par locale. Hreflang inject auto sur chaque page. |
| R.A.2 | Traductions EN/DE/PL completes | Frontend + Content | XL | [ ] | Externaliser `apps/web/app/i18n/translations.ts` vers fichier JSON par locale (`fr.json`, `en.json`, `de.json`, `pl.json`). Traduire les ~800 cles existantes. Outils : DeepL Pro pour 1ere passe, relecture humaine native par locale (3 freelances 1 sem chacun). |
| R.A.3 | Gazette LLM multi-langue | Backend | M | [ ] | Extend `pro-gazette-llm.ts` : prompt template par locale, persona adaptee (cynic FR vs cynic DE), prefixage "Date FR" → "Date DE". Generation parallele : 1 edition × 4 langues = 4 API calls. Coup ~4× existant, ajuster prompt cache aggressif. |
| R.A.4 | SEO multi-langue | Frontend | M | [ ] | Hreflang complet (FR/EN/DE/PL/x-default). Meta title/description par locale. Sitemap par locale. Robots.txt update. JSON-LD Schema localized. Test : Google Search Console verifie indexation par locale. |

**DoD lot R.A** : 100% UI + Gazette traduit. Site indexable Google
DE/PL avec hreflang. 4 locales en prod.

### Lot R.B — Monetisation Patreon + Season Pass (~4 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| R.B.1 | Integration Patreon API | Backend | M | [ ] | OAuth Patreon + webhook subscription events. Modele Prisma `UserPatreonLink {userId, patreonUserId, tier, since, until}`. Service `apps/server/src/services/patreon-sync.ts` qui sync 1x/jour les statuses tier. Badge profil "Founders Club" pour patrons actifs. |
| R.B.2 | Season Pass cosmetique | DB + Backend + Frontend | L | [ ] | Modeles `CosmeticPack {id, slug, name, priceCrowns, priceEur}`, `UserCosmeticUnlock {userId, cosmeticId, since}`. Cosmetics initiaux : 5 skins terrain (BB classic / Khorne fire / Nurgle rot / Skaven sewer / Wood Elf forest), 30 blasons custom, 3 dice 3D variants, 10 Gazette persona avatars. Payment Stripe checkout 10€. Equivalent 5000 Crowns earnable in-game (alt path). UI shop `/me/cosmetics`. |
| R.B.3 | Ad-free + early replay access | Backend + Frontend | S | [ ] | Tier "Supporter" 3€/mois : ad-free (no Google AdSense banners if added later), early replay access (peut voir replays archived 0-7j avant les free users). Patreon webhook sync. |

**DoD lot R.B** : 50+ paying supporters / patrons dans le 1er mois,
revenu mensuel 200€+ minimum (signal floor).

### Lot R.C — Mobile release App Store + Play Store (~5 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| R.C.1 | Mobile registration + auth | Mobile + Backend | M | [ ] | Implementer `/register` page mobile (placeholder actuellement). OAuth Google + Apple Sign-In. Email verification flow native. |
| R.C.2 | Pro League mobile parity | Mobile | L | [ ] | Pages mobile : Pro League hub, standings, matchs live (SSE via EventSource polyfill), Gazette articles, wallet, paris (avec BetSlip mobile). Reuse logique business du web. |
| R.C.3 | Push notifications strategiques | Mobile + Backend | M | [ ] | Notifications : (a) Pro League match dans 1h, (b) ton equipe favorite joue maintenant, (c) daily bonus claimable, (d) badge debloque, (e) advancement en attente, (f) ami a place un pari. Service `apps/server/src/services/push-notifications.ts` deja existant — etendre avec ces 6 types. |
| R.C.4 | EAS Build + store metadata | Mobile + DevOps | M | [ ] | `eas.json` configure (dev/preview/production). App icons, splash, screenshots iPhone/iPad/Android. Description Apple Store + Google Play. Privacy policy URL (page web a creer). Compliance review GW IP (cf. risques). |
| R.C.5 | Release v1.0 + TestFlight + Play Console | Mobile | M | [ ] | Submit Apple App Store + Google Play. Beta TestFlight 50 testeurs. Iterer crashes/feedback. Public release apres validation. |

**DoD lot R.C** : app disponible iOS + Android, ≥ 100 downloads 1ere
semaine, crash-free rate > 99%.

### Lot R.D — Communaute + ambassadeurs + NAF (~4 sem)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| R.D.1 | Discord officiel + bot Gazette | DevOps + Backend | M | [ ] | Creer serveur Discord officiel `Nuffle Arena`. Bot Node.js qui auto-post : Gazette daily edition (avec OG image), match results (avec scores), Hall of Fame inductions, badges majeurs. Channels : #general, #pro-league, #ligues-humaines, #tournois, #feedback. Recrute 3-5 moderateurs benevoles. |
| R.D.2 | Programme ambassadeur casters | Marketing | M | [ ] | Brief 1 page : valeur prop, deliverables (1 stream/mois minimum, 1 video YT/trimestre), recompenses (compte Patreon Supporter offert, 5000 Crowns/mois, badge "Ambassador", early access features). Identifier 10 candidats (Bonehead Podcast, Iron Mike, Both Down, Eat Da Rookie, etc.). Contact email + Discord. Onboarding kit (logos, brand guide). |
| R.D.3 | NAF API integration | Backend | L | [ ] | NAF (Naffinity Federation) expose API resultats tournois IRL. Service `apps/server/src/services/naf-sync.ts` : import resultats par joueur NAF ID, link a profile Nuffle Arena via opt-in (`User.nafId` champ). Fiche joueur publique enrichie "Tournois IRL : 3 wins NAF 2025". Differenciateur unique vs FUMBBL/Cyanide. |

**DoD lot R.D** : Discord 500+ membres en 2 mois, 5 casters actifs en
programme ambassadeur, 100+ joueurs NAF link a leur profile.

### Lot R.E — PvP async tours-par-jour (~6 sem, FUMBBL-killer)

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| R.E.1 | Game mode "async" backend | Backend | L | [ ] | Etendre `Match` model avec `mode enum(realtime/async)`. En mode async, pas de socket required : `POST /match/:id/move` accept un move avec deadline auto-calcule (24h par tour). Cron deadline-check : si timeout, force-end-turn + notif. |
| R.E.2 | UI mobile + web async | Frontend + Mobile | L | [ ] | UI difference : afficher countdown "X heures restantes pour jouer". Notifications push quand c'est ton tour. Joueurs peuvent jouer plusieurs matches async en parallele. |
| R.E.3 | Migration ligues v2 vers async | Backend | M | [ ] | Ligues v2 existing : option "async league" au create. Matches schedules avec deadline auto. Compatible BB rules existing (replay deterministe). |

**DoD lot R.E** : 50+ matches async termines en alpha. Format public
launch a Sprint S.

## Calendrier indicatif (6 mois)

| Mois | Lots | Livrables |
|------|------|-----------|
| 1-2 | R.A.1 + R.A.2 + R.D.2 | Routing i18n + traductions FR-only → 4 locales partial. Programme caster brief. |
| 2-3 | R.A.3 + R.A.4 + R.B.1 + R.D.1 | Gazette multi-langue. SEO i18n. Patreon launch. Discord launch. |
| 3-4 | R.C.1-3 + R.B.2 | Mobile registration + Pro League parite + push. Season Pass cosmetique. |
| 4-5 | R.C.4 + R.C.5 + R.B.3 + R.D.3 | App stores release. Ad-free tier. NAF integration. |
| 5-6 | R.E | PvP async tours-par-jour alpha. |

## Risques

| Risque | Mitigation |
|--------|------------|
| **GW IP cease-and-desist** (Blood Bowl, Nuffle, Spike marques GW) | Audit legal AVANT R.B (monetisation). Considerer rebrand partiel si necessaire. Approcher GW pour partenariat / licence (modele Cyanide). |
| Coup LLM Gazette × 4 langues exploser | Prompt cache aggressif (deja documente CLAUDE.md), batch API, fallback templates si budget depasse. |
| Apple App Store reject (BB IP, dice/casualty content) | Compliance review interne avant submit. Rating 12+ minimum. Pas de bet real money (Crowns earnable only). |
| Casters ambassadeurs pas adopter | Iteration brief, ajouter incentives, demarrer avec micro-influencers (500-2k followers) plus accessibles. |
| Async PvP cannibalise realtime PvP existant | Communication claire : async = competitions longue distance, realtime = fast matches. |

## Dependances

- **Sprint O + P + Q termines.**
- **Service Stripe configure** (R.B.2 Season Pass).
- **Compte Patreon creator** (R.B.1).
- **Compte Apple Developer + Google Play Console** (R.C.5).
- **NAF API key + accord** (R.D.3).
- **Service mail SMTP** (R.A si confirm email i18n, R.C registration).

## Sources

- Audit strategique : section "Personas cibles", "Gaps strategiques",
  "Strategic bets 12 mois", "Modele de monetisation recommande".
- Audit mobile : section "Gaps critiques mobile" + "Strategic bets".
- Audit Pro League : positionnement "ESPN/Sorare/MPG de Blood Bowl".

## Verdict business

Win condition a 12 mois : **10 000 MAU + top 3 reconnaissance BB
online FR/EN/DE**. Si R.A (i18n) + R.C (mobile) + R.D.1-2 (Discord +
ambassadeurs) livres en 6 mois, base 5-10× plus large est atteignable.
Si R.B (monetisation) livre = runway financier pour Sprint S+.
