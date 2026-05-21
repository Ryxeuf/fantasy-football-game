## [1.138.5](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.138.4...v1.138.5) (2026-05-21)


### 🐛 Bug Fixes

* **deploy:** bypass corrupted global git config for deployment ([f87e049](https://github.com/Ryxeuf/fantasy-football-game/commit/f87e049cce95ae0d2cfbce1563997f9de57a6097))

## [1.138.4](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.138.3...v1.138.4) (2026-05-21)


### 🐛 Bug Fixes

* **e2e-ui:** stabilise gazette empty/archive avec .or() au lieu de isVisible ([d1ebf2c](https://github.com/Ryxeuf/fantasy-football-game/commit/d1ebf2c3ff05b0bc74d417cde4ada4dac6e5fb36)), closes [#1](https://github.com/Ryxeuf/fantasy-football-game/issues/1)

## [1.138.3](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.138.2...v1.138.3) (2026-05-21)


### 🐛 Bug Fixes

* **e2e-ui:** scope replay-player routes a l'API (port 18002) ([8d6ce4b](https://github.com/Ryxeuf/fantasy-football-game/commit/8d6ce4bd15bb18a3094dec4af845cbdf86973b43))

## [1.138.2](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.138.1...v1.138.2) (2026-05-21)


### 🐛 Bug Fixes

* **web:** hub /pro-league traite 404 comme empty-state (E2E) ([24709cb](https://github.com/Ryxeuf/fantasy-football-game/commit/24709cb9ad6bb49e1d15c1d04b763e38d686196a))

## [1.138.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.138.0...v1.138.1) (2026-05-21)


### 🐛 Bug Fixes

* **e2e-ui:** 5 specs Playwright en echec (regressions pre-existantes) ([7bc19ff](https://github.com/Ryxeuf/fantasy-football-game/commit/7bc19fffd8d0d92088d5fe9620dacdbb190fb498)), closes [#766](https://github.com/Ryxeuf/fantasy-football-game/issues/766)
* **web:** ouvre GameChat des le pre-match (regression E2E chat) ([b389a22](https://github.com/Ryxeuf/fantasy-football-game/commit/b389a22350356bed3b3d47436f620c3b4c1a0407))

## [1.138.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.137.0...v1.138.0) (2026-05-21)


### ✨ Features

* **server:** script bootstrap-nfl-prod (Phase 5.E) ([9be8929](https://github.com/Ryxeuf/fantasy-football-game/commit/9be8929ba3582e6368a46434c6e73fb0a1a9bbad))


### 🐛 Bug Fixes

* **server:** types explicites sur queries Prisma NFL fantasy (CI typecheck) ([2d1a7c4](https://github.com/Ryxeuf/fantasy-football-game/commit/2d1a7c4946ce0eccb488fbd61958e879c9f17026))


### 📝 Documentation

* **nfl-fantasy:** Phase 5.E bootstrap-nfl-prod workflow ([1bba9e8](https://github.com/Ryxeuf/fantasy-football-game/commit/1bba9e806b6b0964e4411ba33e210df4bc5199ed))

## [1.137.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.136.0...v1.137.0) (2026-05-21)


### ✨ Features

* **nfl-mapper:** pseudonyms uniques via surname BB-flavored (Phase 5.D) ([5fe8660](https://github.com/Ryxeuf/fantasy-football-game/commit/5fe8660e3070d615c91322020cb990aafdfbe962)), closes [#15](https://github.com/Ryxeuf/fantasy-football-game/issues/15) [#0](https://github.com/Ryxeuf/fantasy-football-game/issues/0) [#0](https://github.com/Ryxeuf/fantasy-football-game/issues/0)
* **web:** bloc PublicProfilePreview dans admin player detail (Phase 5.D) ([cf48d2a](https://github.com/Ryxeuf/fantasy-football-game/commit/cf48d2ab7fb9cca223c74a7d5e6cc210e13cf224))


### 📝 Documentation

* **nfl-fantasy:** Phase 5.D pseudonyms uniques + apercu profil public ([d6a0417](https://github.com/Ryxeuf/fantasy-football-game/commit/d6a041792922c0a78295d9f9761e8a03ccdbf06d))

## [1.136.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.135.0...v1.136.0) (2026-05-21)


### ✨ Features

* **server:** backfill scores ESPN par week (Phase 5.B) ([51f4a95](https://github.com/Ryxeuf/fantasy-football-game/commit/51f4a95ac9dc3f44b775a647ed651b6812f2e2a7))
* **server:** backfillScoresFromSchedules (nflverse games.csv) (Phase 5.B+) ([1a5cb8b](https://github.com/Ryxeuf/fantasy-football-game/commit/1a5cb8b5332cf00d8c5d3a85fe805320ad5c9dc6))
* **server:** bio + categoryStats + seasons dans getNflPlayerDetail (Phase 5.C) ([9fab40a](https://github.com/Ryxeuf/fantasy-football-game/commit/9fab40ada78d1a46caf0b34b8540c20308889002))
* **server:** ingestNflverseRosters (jersey + bio) Phase 5.A ([3bff931](https://github.com/Ryxeuf/fantasy-football-game/commit/3bff93143c2fd8032cb3787dbe89c0f2503ab8db))
* **server:** Nuffle Gazette par matchup via Claude Haiku (Phase 3.H) ([178f3c1](https://github.com/Ryxeuf/fantasy-football-game/commit/178f3c13a7aeb25bc0e52c716211f893d7a1f69b))
* **web:** card Nuffle Gazette sur page matchup detail admin (Phase 3.H) ([8e05a44](https://github.com/Ryxeuf/fantasy-football-game/commit/8e05a44f01c3fc82991de5b4ffe8b1ac9c3c9a18))
* **web:** page joueur ESPN-style (Phase 5.C) ([74b5c6f](https://github.com/Ryxeuf/fantasy-football-game/commit/74b5c6f5e00914711db5b1825d4acdf961d95b2d))


### 📝 Documentation

* **nfl-fantasy:** Phase 3.H Nuffle Gazette par matchup ([0fa3728](https://github.com/Ryxeuf/fantasy-football-game/commit/0fa3728afeec7788bda83f2f09839fc68a1a0dbb))
* **nfl-fantasy:** Phase 5.A+B+C rosters bio + backfill scores + page joueur ([f4bfdd6](https://github.com/Ryxeuf/fantasy-football-game/commit/f4bfdd66a314f6becb1bebd4958ec155e6465872))

## [1.135.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.134.0...v1.135.0) (2026-05-20)


### ✨ Features

* **server:** admin matchup detail + cleanup replays + optimal lineup (Phase 3.I+J+K) ([4a05dbd](https://github.com/Ryxeuf/fantasy-football-game/commit/4a05dbd98ddea152039d390230504e6c12bce3ee))
* **server:** recomputeSeasonSpp + reDeriveAllPlayersBb bulk (Phase 3.F) ([7718fde](https://github.com/Ryxeuf/fantasy-football-game/commit/7718fde5012cbd8ec866e36a998c8e3bd82ddc81))
* **server:** replaySeason service Phase 3.G ([d90c033](https://github.com/Ryxeuf/fantasy-football-game/commit/d90c033d6ef78fb04e5153c75df90dc4871d4d58))
* **server:** routes admin bulk SPP/BB + replay saison (Phase 3.F+G) ([81fc3c3](https://github.com/Ryxeuf/fantasy-football-game/commit/81fc3c30ea284351033c796940dc9f7bf7982a72))
* **web:** page matchup detail + cleanup card + lineupMode select (Phase 3.I+J+K) ([8c64057](https://github.com/Ryxeuf/fantasy-football-game/commit/8c640570f9d8325dca67d891a3e91b0eb96d71c5))
* **web:** UI bulk actions saison + replay + re-derive BB (Phase 3.F+G) ([d12c400](https://github.com/Ryxeuf/fantasy-football-game/commit/d12c40000c001931f3063664dae3af01768a77b1))


### 📝 Documentation

* **nfl-fantasy:** Phase 3.F+G bulk actions + replay ([c36cfac](https://github.com/Ryxeuf/fantasy-football-game/commit/c36cfac25a5c70f90cd0e5672db44b0561bfd507))
* **nfl-fantasy:** Phase 3.I+J+K matchup detail + cleanup + optimal lineup ([24fbb83](https://github.com/Ryxeuf/fantasy-football-game/commit/24fbb83bc726c905c6cfe6d8c55e8ada890041eb))

## [1.134.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.133.0...v1.134.0) (2026-05-20)


### ✨ Features

* **server:** backfillNflSeason avec CSV cache + idempotent (Phase 3.E) ([ec07f17](https://github.com/Ryxeuf/fantasy-football-game/commit/ec07f178da8c0eed3fc89d8c465d3f40788c3f61))
* **server:** computeStandings + getLeagueStandings (Phase A.3) ([e5495a9](https://github.com/Ryxeuf/fantasy-football-game/commit/e5495a9fd136a36c497751471fcea47cc1134707))
* **server:** explorer service admin NFL Fantasy (Phase 3.C) ([e7f231a](https://github.com/Ryxeuf/fantasy-football-game/commit/e7f231ac7b43ed17fcd4bb50e88a3654d87d5568))
* **server:** explorer service ingest-runs + weeks + leagues (Phase 3.D) ([e72e09c](https://github.com/Ryxeuf/fantasy-football-game/commit/e72e09c8683b367b9067cd87d846a1a94ac783d0))
* **server:** GET roster joint NflPlayer pour l'UI lineup ([262d268](https://github.com/Ryxeuf/fantasy-football-game/commit/262d2682c5b28fa4435c297cb0210ba917a20959))
* **server:** nfl-error-mapper util (Phase 2.G) ([9ae4911](https://github.com/Ryxeuf/fantasy-football-game/commit/9ae4911b1e5b31fb028ea69a2433a5b1a1f62e60))
* **server:** nfl-fantasy-cron service Phase 2.H (orchestrateur 5min) ([c2d7c16](https://github.com/Ryxeuf/fantasy-football-game/commit/c2d7c16c7397b8c6b5ee461c9d43b990c9613ded))
* **server:** nfl-fantasy-draft service Phase A.1 ([54e88d3](https://github.com/Ryxeuf/fantasy-football-game/commit/54e88d33dd9e752016c819ba30ccaad06e430fb0))
* **server:** routes admin draft (auto-fill + finalize) + mapper Phase A ([d8fceca](https://github.com/Ryxeuf/fantasy-football-game/commit/d8fceca0fb4f6ba690d1d14e79f052f6bda653d0))
* **server:** routes admin explorer + mapper NflFantasyAdminError (Phase 3.C) ([bb58aa7](https://github.com/Ryxeuf/fantasy-football-game/commit/bb58aa74bc156c9a778e5852ad4e54d3338c2085))
* **server:** routes admin ingest-runs + weeks + leagues (Phase 3.D) ([a0a2701](https://github.com/Ryxeuf/fantasy-football-game/commit/a0a27016ae1048624f01dffb017be2fc06c22179))
* **server:** routes Express NFL Fantasy Phase 2.G (admin + user) ([05b77d9](https://github.com/Ryxeuf/fantasy-football-game/commit/05b77d95b8c4f10adcc34ed5f137101913a89f50))
* **server:** routes user-facing /matchups + /standings (Phase A.3) ([1a8599c](https://github.com/Ryxeuf/fantasy-football-game/commit/1a8599c0e76c510157037e84ce7c330bdfa247e3))
* **server:** wire NFL Fantasy cron Phase 2.H dans index.ts ([5b7a022](https://github.com/Ryxeuf/fantasy-football-game/commit/5b7a022e61f751755069bc10db1c0f5ed46cea44))
* **server:** wire NFL Fantasy routes Phase 2.G dans index.ts ([d39aac7](https://github.com/Ryxeuf/fantasy-football-game/commit/d39aac74df7f3ff33ae0ad2525c528d414576d15))
* **web:** cartes admin auto-fill + finalize (Phase A) ([17c681b](https://github.com/Ryxeuf/fantasy-football-game/commit/17c681b1e8e08bd536c9bd1c1cba3aa05aee7e3d))
* **web:** console admin /admin/nfl-fantasy (Phase 3.B) ([aa5fe7d](https://github.com/Ryxeuf/fantasy-football-game/commit/aa5fe7d607713540ad47a4cbe3f816f8a624ca3a))
* **web:** dashboard /nfl-fantasy "Mes leagues" (Phase 3.A) ([1671c69](https://github.com/Ryxeuf/fantasy-football-game/commit/1671c69ffa87f1d996afa87199566311ef2a0f29))
* **web:** enhance admin layout with dynamic navigation sections ([5bea705](https://github.com/Ryxeuf/fantasy-football-game/commit/5bea705912683d020a0682e06790cd7ab1482d99))
* **web:** layout admin NFL Fantasy + season picker + sub-nav (Phase 3.C) ([7559cf3](https://github.com/Ryxeuf/fantasy-football-game/commit/7559cf3b0c56efc8e8dd3ed26e25b960f9498156))
* **web:** lineup builder + CTA "Régler mon lineup" Phase A ([bde8448](https://github.com/Ryxeuf/fantasy-football-game/commit/bde8448aed5d96c2e52fc0ec7ee51f05e62f5f8c))
* **web:** nav item NFL Fantasy dans admin layout (Phase 3.B) ([275354e](https://github.com/Ryxeuf/fantasy-football-game/commit/275354ebc981c1146d02a498517f210526ccce6b))
* **web:** NFL Fantasy layout + types partages (Phase 3.A) ([676f952](https://github.com/Ryxeuf/fantasy-football-game/commit/676f9527d3da86237a21d2e3a2e540ae574b0f13))
* **web:** page /nfl-fantasy/leagues/[id]/matchups (Phase A.3) ([b3aaff5](https://github.com/Ryxeuf/fantasy-football-game/commit/b3aaff5bb03a3ee2dd2db63a02ba37f7ca0ab5b8))
* **web:** page detail league NFL Fantasy (Phase 3.A) ([c7bf706](https://github.com/Ryxeuf/fantasy-football-game/commit/c7bf706fbe8dfacceaf745c88df5c1f891813596))
* **web:** pages admin ingest-runs + weeks + leagues (Phase 3.D) ([abece58](https://github.com/Ryxeuf/fantasy-football-game/commit/abece581233eeb9c7867debf3101e78376dbb70d))
* **web:** pages admin players + resync actions (Phase 3.C.2) ([6b78e31](https://github.com/Ryxeuf/fantasy-football-game/commit/6b78e3137f33f0202b633fa3fce1fbffa6b3552c))
* **web:** pages admin teams index + detail (Phase 3.C.1) ([17832aa](https://github.com/Ryxeuf/fantasy-football-game/commit/17832aa7feb601a20780083aa9a803efc145b680))
* **web:** pages create + join NFL Fantasy (Phase 3.A) ([6d64956](https://github.com/Ryxeuf/fantasy-football-game/commit/6d649564ee1e3be4cdbd34637b87ff4b95f4b281))
* **web:** types NflFantasyMatchup + StandingsRow (Phase A.3) ([bb4ec98](https://github.com/Ryxeuf/fantasy-football-game/commit/bb4ec98f7c6697b92ba8fc3a53e6758dc2df3826))


### 🐛 Bug Fixes

* **server:** backfill skipExisting accepte aussi status=partial ([3a97a25](https://github.com/Ryxeuf/fantasy-football-game/commit/3a97a25c8c3b0abcf6e9cc242517207af123e26f))
* **server:** ingest fallback schedules.csv pour saison 2024 (Phase 3.E) ([d53ddaa](https://github.com/Ryxeuf/fantasy-football-game/commit/d53ddaa246fe3ae01911894e0a1fd9cc26d07796))
* **web:** sync-auth-cookie utilise SERVER_API_BASE (TLS dev OrbStack) ([cd3a2a5](https://github.com/Ryxeuf/fantasy-football-game/commit/cd3a2a58ce971cfc289aad2797f1f60774970550))


### 📝 Documentation

* **nfl-fantasy:** Phase 2.G routes Express ([21a6755](https://github.com/Ryxeuf/fantasy-football-game/commit/21a67556ed9cde61709354ff2969316b7357188a))
* **nfl-fantasy:** Phase 2.H crons + cloture Phase 2 ([17d788c](https://github.com/Ryxeuf/fantasy-football-game/commit/17d788c4b3f902e7b5f467b8650da7f863572f87))
* **nfl-fantasy:** Phase 3.A frontend V1 ([f2c115d](https://github.com/Ryxeuf/fantasy-football-game/commit/f2c115db5de1ec30e692b8116b8dc11c40ddb093))
* **nfl-fantasy:** Phase 3.B console admin ([e5e28fb](https://github.com/Ryxeuf/fantasy-football-game/commit/e5e28fbf422c9fe1433848881737fe1f79a03d8c))
* **nfl-fantasy:** Phase 3.C admin data explorer ([cc64a26](https://github.com/Ryxeuf/fantasy-football-game/commit/cc64a26bf90681a91dd900a509aae51c2f5fe7ff))
* **nfl-fantasy:** Phase 3.E backfill + 3.D admin audit/weeks/leagues ([96bc7b1](https://github.com/Ryxeuf/fantasy-football-game/commit/96bc7b137c93d01ec0bec03696bdf2d421c100b3))
* **nfl-fantasy:** Phase A draft + gameplay V1 ([39c2d0c](https://github.com/Ryxeuf/fantasy-football-game/commit/39c2d0cff49bb1d3fba237c78c36097dd26b9afe))
* **nfl-fantasy:** Phase A.3 matchups + standings ([7a605df](https://github.com/Ryxeuf/fantasy-football-game/commit/7a605df4e1e21f41982f0f96e76fb8b9ba507f68))


### ♻️ Code Refactoring

* export buildStatLineFromRow ([b4aec77](https://github.com/Ryxeuf/fantasy-football-game/commit/b4aec7754001399b1a736a4f7a63354cf13f66b3))

## [1.133.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.132.0...v1.133.0) (2026-05-20)


### ✨ Features

* **prisma:** schema NflFantasyMatchup (Phase 2.E) ([eeee832](https://github.com/Ryxeuf/fantasy-football-game/commit/eeee832c0113b99397a606aee45fbb86993688fe))
* **prisma:** schema NflFantasyReroll + NflFantasyInducement (Phase 2.F) ([5faf276](https://github.com/Ryxeuf/fantasy-football-game/commit/5faf276b6d654955a8aba6ecb4de99b156998b02))
* **prisma:** schema NflFantasyRoster + NflFantasyLineup + LineupStarter (Phase 2.D) ([3d17387](https://github.com/Ryxeuf/fantasy-football-game/commit/3d17387a1e6b06411ece57df84a395d92e13b89e))
* **server:** nfl-fantasy-lineup service Phase 2.D (set + lock) ([5a5b289](https://github.com/Ryxeuf/fantasy-football-game/commit/5a5b2893e1b94bc0fe5fb0241366482236aef156))
* **server:** nfl-fantasy-mercato service Phase 2.F (rerolls + inducements) ([eebdcb4](https://github.com/Ryxeuf/fantasy-football-game/commit/eebdcb433ab4d2ab28ac8f11dc2ac24af2a2a2fb))
* **server:** nfl-fantasy-roster service (Phase 2.D) ([04bf43a](https://github.com/Ryxeuf/fantasy-football-game/commit/04bf43a27bc5b06ea73ec60734569205c655c81d))
* **server:** nfl-fantasy-scoring service Phase 2.E (matchups + settle) ([6045e70](https://github.com/Ryxeuf/fantasy-football-game/commit/6045e701a506a9492bb92be9eb174aba6649111c))


### 📝 Documentation

* **nfl-fantasy:** Phase 2.D roster + lineup ([a756dea](https://github.com/Ryxeuf/fantasy-football-game/commit/a756dea08b3c0816010ca77cc4da4b9388cb4c90))
* **nfl-fantasy:** Phase 2.E matchups + scoring/settle ([492465c](https://github.com/Ryxeuf/fantasy-football-game/commit/492465c54d9311cf4c8fd1ceb93415757ff02d16))
* **nfl-fantasy:** Phase 2.F mercato (rerolls + inducements) ([7e09452](https://github.com/Ryxeuf/fantasy-football-game/commit/7e09452abd5cfd6ddea85b526007ce288969e9ef))

## [1.132.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.131.0...v1.132.0) (2026-05-20)


### ✨ Features

* **prisma:** schema NflFantasyLeague + NflFantasyEntry (Phase 2.C) ([c269326](https://github.com/Ryxeuf/fantasy-football-game/commit/c26932689fc35bc185488bc2887e39a3a891e81b))
* **server:** nfl-fantasy-league service Phase 2.C (CRUD + join/leave) ([c5b37e0](https://github.com/Ryxeuf/fantasy-football-game/commit/c5b37e0ff1998cd46d040d576f11f6ce0407199f))


### 📝 Documentation

* **nfl-fantasy:** Phase 2.C league CRUD ([6370f43](https://github.com/Ryxeuf/fantasy-football-game/commit/6370f433f585941206d80358204aaaff48e83055))

## [1.131.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.130.0...v1.131.0) (2026-05-20)


### ✨ Features

* **server:** CLI nfl-ingest gameday + rosters commands ([643e522](https://github.com/Ryxeuf/fantasy-football-game/commit/643e5221d2389c270a5f211b62e80835fd0c1c68))
* **server:** nfl-ingest-espn service Phase 2.B (gameday + rosters) ([d514b37](https://github.com/Ryxeuf/fantasy-football-game/commit/d514b37a8bc186456a74e7d441957489b59970fa))


### 🐛 Bug Fixes

* **nfl-ingest:** normalize legacy LA team code in nflverse game_id ([a8862ce](https://github.com/Ryxeuf/fantasy-football-game/commit/a8862ce128ed036566b3497a001db42df45b7d4b))


### 📝 Documentation

* **nfl-fantasy:** document Phase 2.A/2.B ingestion pipeline ([8d3b9fd](https://github.com/Ryxeuf/fantasy-football-game/commit/8d3b9fd54367a7b94ab26ecef6a4d315b94d661f))

## [1.130.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.129.0...v1.130.0) (2026-05-20)


### ✨ Features

* **server:** nfl-ingest service (Phase 2.A) ([dd27c98](https://github.com/Ryxeuf/fantasy-football-game/commit/dd27c98c8488181bb91854f6bf46fc4d17706312))
* **server:** script CLI d'invocation nfl-ingest pour validation manuelle ([30f93cb](https://github.com/Ryxeuf/fantasy-football-game/commit/30f93cbadfd0ba9b3f7241bc433c9031e073437b))

## [1.129.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.128.1...v1.129.0) (2026-05-19)


### ✨ Features

* **nfl-mapper:** position-to-bb mapping NFL pos x race -> BB pos (Phase 1.B) ([e8b3e54](https://github.com/Ryxeuf/fantasy-football-game/commit/e8b3e54ac63ff36d5992a5a4c01dc35ef871690d))
* **nfl-mapper:** pseudonymisation BB-flavored (Phase 1.D, Q8) ([53471c6](https://github.com/Ryxeuf/fantasy-football-game/commit/53471c672afe61c8ea4e3f24b3e980ad989a032e)), closes [#15](https://github.com/Ryxeuf/fantasy-football-game/issues/15)
* **nfl-mapper:** stats-to-spp + applyCaptainMultiplier (Phase 1.C) ([5d1ba05](https://github.com/Ryxeuf/fantasy-football-game/commit/5d1ba0546d1a7fc01f1967d1165e9b3ad3adc106))
* **prisma:** schema NFL Fantasy module (Phase 1.E) ([d86d0a2](https://github.com/Ryxeuf/fantasy-football-game/commit/d86d0a29e8e4da0f6a7147fc2d07eb16c0f4702b))


### 📝 Documentation

* **nfl-fantasy:** bump README pour Phase 1.B-1.E ([3e6c9b8](https://github.com/Ryxeuf/fantasy-football-game/commit/3e6c9b8ac9b8aef040f14d1c70ce5dbd13200962))

## [1.128.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.128.0...v1.128.1) (2026-05-19)


### ⚡ Performance Improvements

* **game-engine:** cache evaluatePosition and team-active scans ([05fad36](https://github.com/Ryxeuf/fantasy-football-game/commit/05fad366c4006f7bdd90157ecaf7fedada0b9926))
* **game-engine:** hoist constant filters and DIRS in getLegalMoves ([8d2405e](https://github.com/Ryxeuf/fantasy-football-game/commit/8d2405e482c323aab279a3e351cdb6a69abe843d))
* **game-engine:** replace structuredClone with tailored cloneGameState ([d50de42](https://github.com/Ryxeuf/fantasy-football-game/commit/d50de42493a2f465f23cc810c62c3a5dc9d37e6d))


### 📝 Documentation

* mark Sprint Perf complete in audit 2026-05-19 ([57d6ca9](https://github.com/Ryxeuf/fantasy-football-game/commit/57d6ca91e2b9b1eaae3a6a16a90b648773dc0c8e))

## [1.128.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.127.0...v1.128.0) (2026-05-19)


### ✨ Features

* **ai:** skill awareness on block knockdown estimation ([4f826ba](https://github.com/Ryxeuf/fantasy-football-game/commit/4f826badc58bea494596b3be0d800477ff5d62af)), closes [#2](https://github.com/Ryxeuf/fantasy-football-game/issues/2) [#1](https://github.com/Ryxeuf/fantasy-football-game/issues/1)
* **game-engine:** rejectMove helper for silent move rejections ([c01a382](https://github.com/Ryxeuf/fantasy-football-game/commit/c01a382727e02de948b5a31a26a3f6d767f7e71f))
* **game-engine:** runtime guard for pendingX mutual exclusivity ([28cd13d](https://github.com/Ryxeuf/fantasy-football-game/commit/28cd13d2e2e0338ee924a627b0325bb4b41853ca))
* **replay:** enhance replay functionality with DICE event and overlay support ([a3c2068](https://github.com/Ryxeuf/fantasy-football-game/commit/a3c2068403b73e0789c325e75b621a3fc3e5f624))


### 🐛 Bug Fixes

* **admin:** ban optimistic-lock pour eviter le clobber concurrent ([#868](https://github.com/Ryxeuf/fantasy-football-game/issues/868)) ([2d73fce](https://github.com/Ryxeuf/fantasy-football-game/commit/2d73fcea99f25b65f13cc3fbddcd08886031f7d7))
* **engine:** Brilliant Coaching kickoff event adds assistant coaches ([#873](https://github.com/Ryxeuf/fantasy-football-game/issues/873)) ([21f0b5c](https://github.com/Ryxeuf/fantasy-football-game/commit/21f0b5c6105edc58861062d8171af7bc2e9d8899))
* **engine:** Pass skill ne relance pas un Fumble (naturel 1) ([#877](https://github.com/Ryxeuf/fantasy-football-game/issues/877)) ([bf9086a](https://github.com/Ryxeuf/fantasy-football-game/commit/bf9086aef72a00f44bae7cb31670b7e08b145367))
* **game-engine:** clear all pendingX on drive transitions ([34f7e1f](https://github.com/Ryxeuf/fantasy-football-game/commit/34f7e1f70ea4c446d714d0cbd09543bfc48290c7)), closes [#2](https://github.com/Ryxeuf/fantasy-football-game/issues/2)
* **game-engine:** forbid FOUL during kickoffBlitzTurn ([5b32ef1](https://github.com/Ryxeuf/fantasy-football-game/commit/5b32ef110e24e396fc8f8120d0cb336494cb6c46)), closes [#3](https://github.com/Ryxeuf/fantasy-football-game/issues/3)
* **game-engine:** immutable PM update in handleBlockChoose ([da17cf8](https://github.com/Ryxeuf/fantasy-football-game/commit/da17cf8101f63c7a5d0befb8d6ede4b736406ec1)), closes [#4](https://github.com/Ryxeuf/fantasy-football-game/issues/4)
* **game-engine:** tolerant replay parsing with shape guard ([56775df](https://github.com/Ryxeuf/fantasy-football-game/commit/56775df10b3b4c270cf029f022b5541f4908ca07))
* leap type + season factory guards (reset + cancel races) ([#866](https://github.com/Ryxeuf/fantasy-football-game/issues/866)) ([49edc80](https://github.com/Ryxeuf/fantasy-football-game/commit/49edc809fa715acfd55baca4e4d3e71e0ae78f09))
* **perf:** seer leaderboard groupBy + rivalry scan cap + ProMatchPrediction indexes ([#872](https://github.com/Ryxeuf/fantasy-football-game/issues/872)) ([94ec1d2](https://github.com/Ryxeuf/fantasy-football-game/commit/94ec1d2780f0bcdb1dd5bbcc74ca4d32fb94825b))
* **perf:** single-flight lock sur getCareerSnapshot (thunder-herd) ([#870](https://github.com/Ryxeuf/fantasy-football-game/issues/870)) ([3c1b25c](https://github.com/Ryxeuf/fantasy-football-game/commit/3c1b25c698810e6e203ac72898a3c280fb8981eb))
* **security:** forgot-password origin allowlist + metrics auth + join code CSPRNG ([#871](https://github.com/Ryxeuf/fantasy-football-game/issues/871)) ([cf57a44](https://github.com/Ryxeuf/fantasy-football-game/commit/cf57a44efae8e077f2f44b83bd340eb3f052157d))
* **security:** share-token PII + settlePredictions tx + JSON-LD XSS escape ([#869](https://github.com/Ryxeuf/fantasy-football-game/issues/869)) ([2647253](https://github.com/Ryxeuf/fantasy-football-game/commit/2647253729e7a9278cfcdd01ba6ab8e08c489aa8))
* **server:** cron overlap guards sur les sweeps Pro League ([#864](https://github.com/Ryxeuf/fantasy-football-game/issues/864)) ([f25fc84](https://github.com/Ryxeuf/fantasy-football-game/commit/f25fc84bf57ac4790a33c4cf92260c94d38e54a2))
* **server:** DoS guards sur pro-badges + listComments ([#867](https://github.com/Ryxeuf/fantasy-football-game/issues/867)) ([2a017de](https://github.com/Ryxeuf/fantasy-football-game/commit/2a017de0bd0ed08ca4a2d32137d41dc8409a150e))
* **server:** friendship + kofi-claim race conditions (optimistic-lock) ([#865](https://github.com/Ryxeuf/fantasy-football-game/issues/865)) ([8d01004](https://github.com/Ryxeuf/fantasy-football-game/commit/8d01004c3936ca9e1060a5a53ac8bd9ae31c1d29))
* **socket/security:** spectator bypass + chat broadcast membership check ([d318942](https://github.com/Ryxeuf/fantasy-football-game/commit/d31894261adec5cc7cfdc4ab32a1574b8ea6fd8e))
* **web/security:** admin middleware bypass + open redirect + JSON-LD XSS + SW URL guard ([#875](https://github.com/Ryxeuf/fantasy-football-game/issues/875)) ([29d454e](https://github.com/Ryxeuf/fantasy-football-game/commit/29d454eb3347e5be7178e4ca2e7d76edec56ce14))


### 📝 Documentation

* add game-engine + AI audit 2026-05-19 ([f110c77](https://github.com/Ryxeuf/fantasy-football-game/commit/f110c77c8e84cc8d2f58e8b682ac4ef6d99d2a1b))
* Add NFL Fantasy module documentation (10 files) ([#874](https://github.com/Ryxeuf/fantasy-football-game/issues/874)) ([fd9ac36](https://github.com/Ryxeuf/fantasy-football-game/commit/fd9ac36d3c2b30b05712d77afca32d254386e7dc))
* update engine audit with QW + ST sprint completion status ([028e20f](https://github.com/Ryxeuf/fantasy-football-game/commit/028e20f4e7cbc5a07b2a36b0c2792053ab84d352))

## [1.127.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.126.2...v1.127.0) (2026-05-19)


### ✨ Features

* **replay:** enhance MatchReplayPlayer with active team display ([286b838](https://github.com/Ryxeuf/fantasy-football-game/commit/286b8385b736d33d3a6cb576e48a46fa9bc485e8))


### 🐛 Bug Fixes

* password reset TOCTOU + bounceBall recursion guard ([#862](https://github.com/Ryxeuf/fantasy-football-game/issues/862)) ([341b068](https://github.com/Ryxeuf/fantasy-football-game/commit/341b068fda1ea39c55a084ef8d637e68a4f14d9a))
* **server:** tournament entry + forceForfeit race conditions ([#863](https://github.com/Ryxeuf/fantasy-football-game/issues/863)) ([4b9fab4](https://github.com/Ryxeuf/fantasy-football-game/commit/4b9fab4700fd9fa88e51a97fb4137c393e213695))

## [1.126.2](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.126.1...v1.126.2) (2026-05-19)


### 🐛 Bug Fixes

* **security:** admin bet refund double-credit + Kofi token timing-safe ([#861](https://github.com/Ryxeuf/fantasy-football-game/issues/861)) ([b17fa84](https://github.com/Ryxeuf/fantasy-football-game/commit/b17fa841d4b9ec3a0178c83ac67dc579ccfaba44))


### ♻️ Code Refactoring

* **replay:** enhance layout and responsiveness of match replay components ([897535c](https://github.com/Ryxeuf/fantasy-football-game/commit/897535c6b3bd1fffe2b16b00a35dee8ccae24a9f))

## [1.126.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.126.0...v1.126.1) (2026-05-19)


### 🐛 Bug Fixes

* **cup:** drop email PII from 17 select sites in cup endpoints ([36cffd0](https://github.com/Ryxeuf/fantasy-football-game/commit/36cffd0f1093fb0efffa0d2c1dd7469d5af08d0f)), closes [#855](https://github.com/Ryxeuf/fantasy-football-game/issues/855)

## [1.126.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.125.0...v1.126.0) (2026-05-19)


### ✨ Features

* **kickoff:** enhance pre-match coin toss mechanics ([a024b6d](https://github.com/Ryxeuf/fantasy-football-game/commit/a024b6dbd6b899c216fc9d0372dc166e9129fd78))

## [1.125.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.124.0...v1.125.0) (2026-05-19)


### ✨ Features

* **kickoff:** implement headless kickoff sequence for BB 2025 ([6fd1f84](https://github.com/Ryxeuf/fantasy-football-game/commit/6fd1f84c6f8558486f98916c26bd6d0eebc7eadc))

## [1.124.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.123.0...v1.124.0) (2026-05-19)


### ✨ Features

* **replay:** enhance replay UI and game mechanics ([03b31a7](https://github.com/Ryxeuf/fantasy-football-game/commit/03b31a7c974da168179a176bd2c0f9ff99361ba9))

## [1.123.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.122.0...v1.123.0) (2026-05-19)


### ✨ Features

* **admin:** implement openNarration function for authenticated text narration ([82d24b2](https://github.com/Ryxeuf/fantasy-football-game/commit/82d24b272b17c6e901cc8180ba54e8daf4320c81))

## [1.122.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.121.5...v1.122.0) (2026-05-19)


### ✨ Features

* **admin:** add engine versions endpoint and display in admin UI ([e99c552](https://github.com/Ryxeuf/fantasy-football-game/commit/e99c55206189e1305ec2dbdccf14428d821d8645))


### 🐛 Bug Fixes

* **game-engine:** apothecary + regeneration revert lasting injury stats ([#859](https://github.com/Ryxeuf/fantasy-football-game/issues/859)) ([bb39f2d](https://github.com/Ryxeuf/fantasy-football-game/commit/bb39f2d5095da88535641410919bf4ffdabc6236))

## [1.121.5](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.121.4...v1.121.5) (2026-05-19)


### 🐛 Bug Fixes

* **engine:** weather Fisher-Yates + foul Stunty + blitz Chebyshev + DP one-or-other ([2def90b](https://github.com/Ryxeuf/fantasy-football-game/commit/2def90b96978bd3e30fc9affc8ec6dfef339f156))

## [1.121.4](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.121.3...v1.121.4) (2026-05-19)


### 🐛 Bug Fixes

* **ai:** scoring foul/pass via weights + opening book 19 races + case-insensitive ([#846](https://github.com/Ryxeuf/fantasy-football-game/issues/846)) ([ccf5e93](https://github.com/Ryxeuf/fantasy-football-game/commit/ccf5e9378ee8fcff91e67044b6b9d6f93a881efc))
* **auth:** redact PII dans les logs (emails, roles) — GDPR ([#853](https://github.com/Ryxeuf/fantasy-football-game/issues/853)) ([c4a921b](https://github.com/Ryxeuf/fantasy-football-game/commit/c4a921b7e60810ebe5fd79bdea24dabcdfd0070a))
* **game-engine:** changing-weather re-roll + hypnotic-gaze GFI lock ([#849](https://github.com/Ryxeuf/fantasy-football-game/issues/849)) ([7abce4a](https://github.com/Ryxeuf/fantasy-football-game/commit/7abce4a1a7734df119689d8a3d7845e2290d2ee5))
* **game-engine:** cleanup blitzingPlayerId + helper reset dice notifications ([#847](https://github.com/Ryxeuf/fantasy-football-game/issues/847)) ([1dad76b](https://github.com/Ryxeuf/fantasy-football-game/commit/1dad76b9c84b9de968364e740675963a675fbfd7))
* **game-engine:** clear pending* a la mi-temps + GFI reroll Blizzard target ([#844](https://github.com/Ryxeuf/fantasy-football-game/issues/844)) ([6e22f9d](https://github.com/Ryxeuf/fantasy-football-game/commit/6e22f9d2b8b292e620e50e2a67b8fc8e8b2f4529))
* **game-engine:** determinisme replay du gameLog et type GFI ([#843](https://github.com/Ryxeuf/fantasy-football-game/issues/843)) ([9d4365d](https://github.com/Ryxeuf/fantasy-football-game/commit/9d4365dfb5cf10e2384f92181d864f408517f554))
* **pro-league:** 3 transactions critiques (casualty, first-time bonus, advancement) ([#848](https://github.com/Ryxeuf/fantasy-football-game/issues/848)) ([49160be](https://github.com/Ryxeuf/fantasy-football-game/commit/49160beb0e00ee9c694573f028116945a6f4890d))
* **pro-league:** atomicité wallet/bet/settlement transactions (CRITICAL) ([#842](https://github.com/Ryxeuf/fantasy-football-game/issues/842)) ([5993029](https://github.com/Ryxeuf/fantasy-football-game/commit/5993029fde114cb96c08eab6170509b031a8d65d))
* **pro-league:** MVP eligibility par participants + applyLevelUps tx ([#854](https://github.com/Ryxeuf/fantasy-football-game/issues/854)) ([25ca1fc](https://github.com/Ryxeuf/fantasy-football-game/commit/25ca1fc3afada4aeb21cd38db1409b888e788420))
* **pro-league:** SPP transactionnel + odds calculator driverKind/roster ([#845](https://github.com/Ryxeuf/fantasy-football-game/issues/845)) ([562091b](https://github.com/Ryxeuf/fantasy-football-game/commit/562091bed8a2ec23e79c984c46e38fd2b4d76426))
* **pro-league:** standings TD diff tiebreaker + PII leak + settle picks tx ([#851](https://github.com/Ryxeuf/fantasy-football-game/issues/851)) ([e83f518](https://github.com/Ryxeuf/fantasy-football-game/commit/e83f5182ace11c067a52d1d8f786bd54ebac0d03))
* **server:** drop email PII from public APIs (round 6) ([#855](https://github.com/Ryxeuf/fantasy-football-game/issues/855)) ([2bade47](https://github.com/Ryxeuf/fantasy-football-game/commit/2bade47101e1a67dbd9ab62e3a4225961d0a0f9b))
* **server:** ELO update + async-match force-end-turn dans $transaction ([#857](https://github.com/Ryxeuf/fantasy-football-game/issues/857)) ([34df26f](https://github.com/Ryxeuf/fantasy-football-game/commit/34df26f82175ee951ad867d37addb14cdb3f754b))
* **server:** persist ordering BB + winnings transaction + structured logs ([#852](https://github.com/Ryxeuf/fantasy-football-game/issues/852)) ([7e0e3f1](https://github.com/Ryxeuf/fantasy-football-game/commit/7e0e3f139c5b645fb557c71a7de4d2c80e718720))
* **sim-engine:** full driver casualty outcome + yardline + cause + TD scorer ([#850](https://github.com/Ryxeuf/fantasy-football-game/issues/850)) ([ee224f2](https://github.com/Ryxeuf/fantasy-football-game/commit/ee224f2f579f2b6da856a100ac8a850d8621c7e1))
* **team:** atomic treasury/count updates + star-player hire tx (round 6) ([#856](https://github.com/Ryxeuf/fantasy-football-game/issues/856)) ([5fa21c0](https://github.com/Ryxeuf/fantasy-football-game/commit/5fa21c01d014380fd91b5a90d823df12b2b545b1))

## [1.121.3](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.121.2...v1.121.3) (2026-05-18)


### 🐛 Bug Fixes

* **game-engine:** ensure ball follows player during dodge, leap, and normal moves ([375c6be](https://github.com/Ryxeuf/fantasy-football-game/commit/375c6bed58ebbe98d8f6c2f16e28b7ad3fc72136))
* **game-engine:** immutabilité ball-pickup + failure-helpers (CRITICAL) ([#837](https://github.com/Ryxeuf/fantasy-football-game/issues/837)) ([0a84306](https://github.com/Ryxeuf/fantasy-football-game/commit/0a84306350144fab532e170984cb7542a5099c11))
* **game-engine:** immutabilité move handlers (HIGH anti-pattern) ([#840](https://github.com/Ryxeuf/fantasy-football-game/issues/840)) ([88e6a68](https://github.com/Ryxeuf/fantasy-football-game/commit/88e6a6802897b884b42cb3fbc071ccdcb6519215))
* **sim-engine:** full driver — ball carrier idx variable + ballYardline initial ([#839](https://github.com/Ryxeuf/fantasy-football-game/issues/839)) ([7146fef](https://github.com/Ryxeuf/fantasy-football-game/commit/7146fef372a47d4c2bc7df06022acff4624bb110))
* **sim-engine:** halftime softlock + stale-detection (CRITICAL) ([#836](https://github.com/Ryxeuf/fantasy-football-game/issues/836)) ([ff6841f](https://github.com/Ryxeuf/fantasy-football-game/commit/ff6841fd9eb6c5af4c33b0f52009411c8b68c4e0))
* **sim-engine:** hybrid driver — recordBlock + casualty team + pass-TD clip ([#838](https://github.com/Ryxeuf/fantasy-football-game/issues/838)) ([2ed6d05](https://github.com/Ryxeuf/fantasy-football-game/commit/2ed6d055456ca266f7b32c8639fb47cc25377b55))
* **sim-engine:** hybrid tuning — B12 disruption + B4 momentCount + B8 luck RNG ([6a69015](https://github.com/Ryxeuf/fantasy-football-game/commit/6a69015b6ca0f2497a70b26110a1f2ea9ffea3b7))

## [1.121.2](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.121.1...v1.121.2) (2026-05-18)


### 🐛 Bug Fixes

* **game-engine:** bribes sur foul send-off + Officious Ref drive flag ([#829](https://github.com/Ryxeuf/fantasy-football-game/issues/829)) ([b1a49be](https://github.com/Ryxeuf/fantasy-football-game/commit/b1a49be6e858e3b7a4569ab1814230f0e5c90706))
* **game-engine:** combat misc BB3 S3 — Stab+MB exclusif + Wrestle turnover ([#831](https://github.com/Ryxeuf/fantasy-football-game/issues/831)) ([77137c3](https://github.com/Ryxeuf/fantasy-football-game/commit/77137c3f5bca1d2889f8738b4706de828b085c03))
* **game-engine:** déterminisme push chain + Wandering Apothecary cumulatif (CRITICAL) ([#828](https://github.com/Ryxeuf/fantasy-football-game/issues/828)) ([6416d0d](https://github.com/Ryxeuf/fantasy-football-game/commit/6416d0d985096310c29ce96fef5393a02830ed74))
* **game-engine:** edge cases BB3 S3 — PA=0 + Pitch Invasion réserves ([#833](https://github.com/Ryxeuf/fantasy-football-game/issues/833)) ([8e9112d](https://github.com/Ryxeuf/fantasy-football-game/commit/8e9112d135ee4d1412923f6f1600ccc50bd80579))
* **game-engine:** lasting injury stat reduction immediate (BB3 S3) ([a9f6fc1](https://github.com/Ryxeuf/fantasy-football-game/commit/a9f6fc18227378b922879cb673bcb208eefe5db6))
* **game-engine:** once-per-match consumption élargi + Diving Tackle Prone (BB3 S3) ([#832](https://github.com/Ryxeuf/fantasy-football-game/issues/832)) ([dccec13](https://github.com/Ryxeuf/fantasy-football-game/commit/dccec1311adf11d54bfd82a8c46ec236db1378fb))
* **game-engine:** règles core BB3 S3 — Dauntless, Frenzy/Fend, Hypnotic Gaze, Bloodlust ([#830](https://github.com/Ryxeuf/fantasy-football-game/issues/830)) ([3d71891](https://github.com/Ryxeuf/fantasy-football-game/commit/3d71891445d1d31c3d1801dffc8396fd95f79fec))
* **sim-engine:** resolver corrections BB3 — sent_off + pa pour passes ([94577fa](https://github.com/Ryxeuf/fantasy-football-game/commit/94577fa18d4c47ef23ce84c9a525e4ce8d53d734)), closes [#823](https://github.com/Ryxeuf/fantasy-football-game/issues/823) [#824](https://github.com/Ryxeuf/fantasy-football-game/issues/824) [#834](https://github.com/Ryxeuf/fantasy-football-game/issues/834)

## [1.121.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.121.0...v1.121.1) (2026-05-18)


### 🐛 Bug Fixes

* **replay:** synchronize visual and textual logs by implementing external clock support ([079a366](https://github.com/Ryxeuf/fantasy-football-game/commit/079a36614ebfe66daeedc0b3c4aca94f6c5b554c))

## [1.121.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.120.3...v1.121.0) (2026-05-18)


### ✨ Features

* **deploy:** add GitHub Container Registry authentication support ([37a1864](https://github.com/Ryxeuf/fantasy-football-game/commit/37a18645ecbf7e8c631f26603de70ef626a8a58a))


### 🐛 Bug Fixes

* **game-engine:** filtre TZ défensif sur trois sites manquants ([#824](https://github.com/Ryxeuf/fantasy-football-game/issues/824)) ([6ba6b8f](https://github.com/Ryxeuf/fantasy-football-game/commit/6ba6b8fa9998fbb1fe44f45f4592e3c8d87cc4ca))
* **game-engine:** Get the Ref! → +1 Bribe + dedup Star Player ([#826](https://github.com/Ryxeuf/fantasy-football-game/issues/826)) ([6e10a72](https://github.com/Ryxeuf/fantasy-football-game/commit/6e10a72250e50b86b50b7c105aebb79e610c5117))
* **game-engine:** skills/utils — Stunty apothecary reroll + team value clamp + Armored Skull prayer ([#827](https://github.com/Ryxeuf/fantasy-football-game/issues/827)) ([3c07381](https://github.com/Ryxeuf/fantasy-football-game/commit/3c073811505b9c385641e8d2f7667b550ed36e40))

## [1.120.3](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.120.2...v1.120.3) (2026-05-18)


### 🐛 Bug Fixes

* **game-engine,sim-engine:** corrections BB2020 sur les fouls ([#823](https://github.com/Ryxeuf/fantasy-football-game/issues/823)) ([7f2913f](https://github.com/Ryxeuf/fantasy-football-game/commit/7f2913f9751a1add484d9105058dbd5dcbae265c)), closes [#822](https://github.com/Ryxeuf/fantasy-football-game/issues/822) [post-#822](https://github.com/Ryxeuf/post-/issues/822)
* **game-engine:** corrections combat misc BB2020 ([60d521f](https://github.com/Ryxeuf/fantasy-football-game/commit/60d521f96787b4f423ece8b03f0f63b8be1add9a))
* **game-engine:** Frenzy chain limitée + handleBlitz immutable (CRITICAL) ([#822](https://github.com/Ryxeuf/fantasy-football-game/issues/822)) ([59f60fe](https://github.com/Ryxeuf/fantasy-football-game/commit/59f60fef30e031e200708dde58a000d615ca6b25))

## [1.120.2](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.120.1...v1.120.2) (2026-05-18)


### 🐛 Bug Fixes

* **game-engine/skills:** star player rules once-per-match marquées comme utilisées (Crushing Blow) ([#820](https://github.com/Ryxeuf/fantasy-football-game/issues/820)) ([1d3be5e](https://github.com/Ryxeuf/fantasy-football-game/commit/1d3be5e618dba520a2c9f101fad57a9497f4e7ce))
* **game-engine:** Always Hungry eaten + Prayer 14 donnent leur chance à l'apothicaire ([#819](https://github.com/Ryxeuf/fantasy-football-game/issues/819)) ([2a0a781](https://github.com/Ryxeuf/fantasy-football-game/commit/2a0a7810eeda024ddfa040d94ebbafef564d6fac))
* **game-engine:** Bloodweiser Kegs +1 KO recovery + getGfiCap honore rulesConfig ([#817](https://github.com/Ryxeuf/fantasy-football-game/issues/817)) ([af332ba](https://github.com/Ryxeuf/fantasy-football-game/commit/af332ba61895c54cb9f31480cc2a89e0ec1c01de))
* **game-engine:** Stunty +1 casualty + Chainsaw bonus non bloqué par Iron Hard Skin ([#818](https://github.com/Ryxeuf/fantasy-football-game/issues/818)) ([c3599c0](https://github.com/Ryxeuf/fantasy-football-game/commit/c3599c0d737aac4a938cb29cf7e34588b98367d4))
* **game-engine:** turnover gate softlock + referee validateMove order + armor target min clamp ([e01a8d6](https://github.com/Ryxeuf/fantasy-football-game/commit/e01a8d618073abd9442555ac97c04145b0cb977a))

## [1.120.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.120.0...v1.120.1) (2026-05-17)


### 🐛 Bug Fixes

* **game-engine/blitz:** coût PM diagonal = 1 (Chebyshev) au lieu de 2 (Manhattan) ([4619a57](https://github.com/Ryxeuf/fantasy-football-game/commit/4619a5707456e63c84d4b79e07e908b9286067ad))
* **game-engine/mechanics:** Mighty Blow exclus de Projectile Vomit + bombardier self-credit ([#814](https://github.com/Ryxeuf/fantasy-football-game/issues/814)) ([1d229fc](https://github.com/Ryxeuf/fantasy-football-game/commit/1d229fcee3cf3ff490822923243ab42eeca45320))
* **game-engine/skills:** hasSkill normalise séparateurs (cohérent avec getSkillEffect) ([#813](https://github.com/Ryxeuf/fantasy-football-game/issues/813)) ([a43224c](https://github.com/Ryxeuf/fantasy-football-game/commit/a43224c44ac4538bc4b61da490b4e36c3b03b053))
* **game-engine:** 4 bugs BB rules critiques (block dice, pass fumble, turn counter, GFI weather) ([#811](https://github.com/Ryxeuf/fantasy-football-game/issues/811)) ([92271d1](https://github.com/Ryxeuf/fantasy-football-game/commit/92271d150847adeb9f555aa9e04c7f562697c803))
* **game-engine:** joueurs KO récupérés deviennent state='active' à la mi-temps ([#805](https://github.com/Ryxeuf/fantasy-football-game/issues/805)) ([d86647e](https://github.com/Ryxeuf/fantasy-football-game/commit/d86647e1d3725d58d9f4092e2baab6686009fdf3))
* **game-engine:** post-touchdown fallback scoringTeam + handleEndTurn clear pending* states ([87b9736](https://github.com/Ryxeuf/fantasy-football-game/commit/87b9736c75afda1f89840468bb90b4fd270b98dc))
* **game-engine:** TZ + secret-weapon + disturbing-presence pour joueurs hors-terrain ([#812](https://github.com/Ryxeuf/fantasy-football-game/issues/812)) ([ae3410d](https://github.com/Ryxeuf/fantasy-football-game/commit/ae3410dcce79fde551393014b713a6768aed0445))
* **pro-league-replay:** vue terrain par défaut + résolution playerIds en noms ([#804](https://github.com/Ryxeuf/fantasy-football-game/issues/804)) ([4bd28c8](https://github.com/Ryxeuf/fantasy-football-game/commit/4bd28c8a0d38122a993ebdf7f4b26348523c71bb))
* **sim-engine/ai:** 3 bugs tactique (momentum decay, blitz-train, fallback offense) ([#809](https://github.com/Ryxeuf/fantasy-football-game/issues/809)) ([8374568](https://github.com/Ryxeuf/fantasy-football-game/commit/837456821b27b6874319c4bc3a3d9af1f5d4f8aa))
* **sim-engine/driver:** emit events for appliedMove, stale-detect on fallback ([#807](https://github.com/Ryxeuf/fantasy-football-game/issues/807)) ([1f9c106](https://github.com/Ryxeuf/fantasy-football-game/commit/1f9c1066cfe66390265904fd3031ba4a1962da33))
* **sim-engine/resolvers:** 6 bugs BB rules (wrestle, GFI, foul, pass) ([#806](https://github.com/Ryxeuf/fantasy-football-game/issues/806)) ([a3703d6](https://github.com/Ryxeuf/fantasy-football-game/commit/a3703d6049a04acf9384c8756ab3cbbcc349d497))
* **sim-engine/rng:** fork re-forks distincts + seedToState gère seed > 2^32 ([#810](https://github.com/Ryxeuf/fantasy-football-game/issues/810)) ([4d98b3a](https://github.com/Ryxeuf/fantasy-football-game/commit/4d98b3a97b0f5643b4315593b9c1109e0055d50b))
* **sim-engine:** 4 bugs replay/bench (narrator parens, fumbbl cas, Infinity → critical) ([#808](https://github.com/Ryxeuf/fantasy-football-game/issues/808)) ([bc736c5](https://github.com/Ryxeuf/fantasy-football-game/commit/bc736c5db054dc8e94cb07d4f52df7124300d8f1))

## [1.120.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.119.0...v1.120.0) (2026-05-13)


### ✨ Features

* **pro-league-replay:** admin narration endpoint with real player names (Lot 3.E.4) ([31cafd1](https://github.com/Ryxeuf/fantasy-football-game/commit/31cafd1a78a4baf31fa9550e6c7f0d6f2b8625e7)), closes [#3](https://github.com/Ryxeuf/fantasy-football-game/issues/3)
* **pro-league-replay:** highlight active player on full-replay field (Lot 3.E.1) ([9febd4e](https://github.com/Ryxeuf/fantasy-football-game/commit/9febd4e6518e44c1a7cdaca58b5072f6a3ab6a72))
* **pro-league-replay:** on-pitch SVG annotations overlay (Lot 3.E.3) ([3e0bece](https://github.com/Ryxeuf/fantasy-football-game/commit/3e0becedf81129d9b6308255f4b95286b00de0f8)), closes [#22c55](https://github.com/Ryxeuf/fantasy-football-game/issues/22c55) [#f97316](https://github.com/Ryxeuf/fantasy-football-game/issues/f97316)
* **pro-league-replay:** skip filler moves to densify full-replay (Lot 3.E.2) ([13885f2](https://github.com/Ryxeuf/fantasy-football-game/commit/13885f244d9e1409dc3536535e1e9f32c97cca9c))


### 🐛 Bug Fixes

* **pro-league-replay:** expose states[] in full-replay endpoint ([02cbe0e](https://github.com/Ryxeuf/fantasy-football-game/commit/02cbe0e9019c06df4654f21818a0e4eadbdbbae6))


### 📝 Documentation

* récap Lots 3.E.1 → 3.E.4 (replay polish) ([f1d7553](https://github.com/Ryxeuf/fantasy-football-game/commit/f1d75531e43ed13acfb1ee0e95a9257c3d71576b))

## [1.119.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.118.0...v1.119.0) (2026-05-13)


### ✨ Features

* **pro-league:** test seasons full sim + cascade delete (admin) ([b45ef0a](https://github.com/Ryxeuf/fantasy-football-game/commit/b45ef0a90d76661ee10bf6c5096bcd1c53a0516e))

## [1.118.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.117.1...v1.118.0) (2026-05-13)


### ✨ Features

* **blog:** implement admin blog management routes and functionality ([70758c9](https://github.com/Ryxeuf/fantasy-football-game/commit/70758c980b505ce2479d210561f225677304f246))


### 🐛 Bug Fixes

* **i18n:** update skill category keys for consistency ([a1ec1c9](https://github.com/Ryxeuf/fantasy-football-game/commit/a1ec1c907e1b78e1478e038f5b3ca63d87edff76))

## [1.117.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.117.0...v1.117.1) (2026-05-13)


### 🐛 Bug Fixes

* **i18n:** update beta banner translations for clarity ([e65918e](https://github.com/Ryxeuf/fantasy-football-game/commit/e65918eac57339d8b57ee08f36f809487eb2e142))

## [1.117.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.116.2...v1.117.0) (2026-05-13)


### ✨ Features

* **ops:** daily backup script with 5-day rotation ([d07ae0d](https://github.com/Ryxeuf/fantasy-football-game/commit/d07ae0d79aba1cbebe16c0a3d70f90f818d1ab04))

## [1.116.2](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.116.1...v1.116.2) (2026-05-13)


### 🐛 Bug Fixes

* **deploy:** disable auto-seed in production deploy pipeline ([29a2251](https://github.com/Ryxeuf/fantasy-football-game/commit/29a2251190c95aa6019408270cb79991335cd77b))

## [1.116.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.116.0...v1.116.1) (2026-05-13)


### 🐛 Bug Fixes

* **team:** prevent player duplication on seed reruns and protect creation atomicity ([beb3a84](https://github.com/Ryxeuf/fantasy-football-game/commit/beb3a8443928013f4aebefdff42011c37ae9640e))

## [1.116.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.115.0...v1.116.0) (2026-05-13)


### ✨ Features

* **naf:** Sprint R.D.3 — NAF tournaments integration (opt-in) ([#799](https://github.com/Ryxeuf/fantasy-football-game/issues/799)) ([670fd6b](https://github.com/Ryxeuf/fantasy-football-game/commit/670fd6b6c054b68c460159417ad0302cabdb2e19))


### 🐛 Bug Fixes

* **match-summary:** extract real score from last gameState ([#800](https://github.com/Ryxeuf/fantasy-football-game/issues/800)) ([97f4552](https://github.com/Ryxeuf/fantasy-football-game/commit/97f455266898fd69f865efe1eb1f56518741ccb2))
* **star-players:** implement roster filter using engine data ([4d518cc](https://github.com/Ryxeuf/fantasy-football-game/commit/4d518cc4e8a8c9f54856b84bb40928fb68e727fb))

## [1.115.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.114.0...v1.115.0) (2026-05-12)


### ✨ Features

* **supporter:** Sprint R.B.3 — supporter status (ad-free + early access) ([459666d](https://github.com/Ryxeuf/fantasy-football-game/commit/459666d8f2ed34e3a5c7b0107439b28dbd3d4410))

## [1.114.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.113.0...v1.114.0) (2026-05-12)


### ✨ Features

* **admin:** responsive layout pour mobile ([c37d35a](https://github.com/Ryxeuf/fantasy-football-game/commit/c37d35aefe013a96078671ef030c6be56baa4844))
* **auth:** Sprint P.C.1 — password reset self-service ([#790](https://github.com/Ryxeuf/fantasy-football-game/issues/790)) ([c06b119](https://github.com/Ryxeuf/fantasy-football-game/commit/c06b1193630ed71d5b4da88ac907e76432eed3ac))
* **i18n:** Sprint R.A.1 — i18n routing + locale auto-detection ([#795](https://github.com/Ryxeuf/fantasy-football-game/issues/795)) ([d56f27a](https://github.com/Ryxeuf/fantasy-football-game/commit/d56f27ac23d6442ea2bb0235941e512489ef4f8e))
* **leagues:** Sprint R.E.3 — ligues v2 mode async par ligue ([#794](https://github.com/Ryxeuf/fantasy-football-game/issues/794)) ([11382fb](https://github.com/Ryxeuf/fantasy-football-game/commit/11382fb8a57545482e9c79dcb71501017c3e4e03))
* **match:** Sprint R.E.1 — game mode async backend (FUMBBL-killer) ([#792](https://github.com/Ryxeuf/fantasy-football-game/issues/792)) ([39269ae](https://github.com/Ryxeuf/fantasy-football-game/commit/39269ae661f1babf8c30f218e9e0b71d0039243f))
* **match:** Sprint R.E.2 — UI async web (countdown + listing) ([#793](https://github.com/Ryxeuf/fantasy-football-game/issues/793)) ([e93c73a](https://github.com/Ryxeuf/fantasy-football-game/commit/e93c73a71d7311d17c5897cdbd15a0f40907ff82))
* **pro-league:** Sprint P.B.2 — tournois Pro League payants (sink Crowns) ([#791](https://github.com/Ryxeuf/fantasy-football-game/issues/791)) ([cc020be](https://github.com/Ryxeuf/fantasy-football-game/commit/cc020be05ebd77f5e6e735714a33bf4dfb216302))
* **seo:** Sprint R.A.4 — SEO multi-langue (hreflang + sitemap) ([#796](https://github.com/Ryxeuf/fantasy-football-game/issues/796)) ([3f51656](https://github.com/Ryxeuf/fantasy-football-game/commit/3f51656ce315dc9512f5e7951e590223f3fa79e4))

## [1.113.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.112.0...v1.113.0) (2026-05-12)


### ✨ Features

* **skill-tooltip:** integrate skill category icons in tooltip and skills client ([d259fc8](https://github.com/Ryxeuf/fantasy-football-game/commit/d259fc8eb69abf62648d3d41fe6b17ca72cfd262))

## [1.112.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.111.0...v1.112.0) (2026-05-12)


### ✨ Features

* **admin:** edition branding teams Pro League ([#773](https://github.com/Ryxeuf/fantasy-football-game/issues/773)) ([6ebef6f](https://github.com/Ryxeuf/fantasy-football-game/commit/6ebef6f479efcb267ecd30ce3b68e1b0eec936eb))
* **admin:** gestion rosters Pro League (replenish/regenerate/retire) ([#774](https://github.com/Ryxeuf/fantasy-football-game/issues/774)) ([331ded5](https://github.com/Ryxeuf/fantasy-football-game/commit/331ded5a7c337b4460945d9f167960e4945999f0))
* **images:** add new competence images for web application ([c0f418f](https://github.com/Ryxeuf/fantasy-football-game/commit/c0f418ff3b08f451e067f8e62ba057d6af7125de))
* **pro-league:** career stats persistees joueur (Sprint Q lot Q.A.1) ([#777](https://github.com/Ryxeuf/fantasy-football-game/issues/777)) ([dff6d84](https://github.com/Ryxeuf/fantasy-football-game/commit/dff6d846c88140b421b7e98378138349aebd5018))
* **pro-league:** commentaires Gazette + moderation (Sprint Q lot Q.B.2) ([#783](https://github.com/Ryxeuf/fantasy-football-game/issues/783)) ([a4550a5](https://github.com/Ryxeuf/fantasy-football-game/commit/a4550a5356e6d66ff684a3599ff0775902cf2d9b))
* **pro-league:** fan predictions thread (Sprint Q lot Q.B.3) ([#784](https://github.com/Ryxeuf/fantasy-football-game/issues/784)) ([95ed53c](https://github.com/Ryxeuf/fantasy-football-game/commit/95ed53c781df2df9aa4cdc1acc282929f0cfebee))
* **pro-league:** mini-leagues de pronostics privees (Sprint Q lot Q.D.1) ([#775](https://github.com/Ryxeuf/fantasy-football-game/issues/775)) ([13b8849](https://github.com/Ryxeuf/fantasy-football-game/commit/13b88497913568ecf84b485e0305583d36098b6d))
* **pro-league:** page career joueur dediee (Sprint Q lot Q.A.2) ([#778](https://github.com/Ryxeuf/fantasy-football-game/issues/778)) ([dec9b3b](https://github.com/Ryxeuf/fantasy-football-game/commit/dec9b3b16585f9c6fb147323fac4245929cfac5a))
* **pro-league:** Player-of-the-week vote (Sprint Q lot Q.B.1) ([#782](https://github.com/Ryxeuf/fantasy-football-game/issues/782)) ([a7244f8](https://github.com/Ryxeuf/fantasy-football-game/commit/a7244f8d757bdb367439e90d547aa715d3a54005))
* **pro-league:** rivalry narrative dans la Gazette (Sprint Q lot Q.A.4) ([#781](https://github.com/Ryxeuf/fantasy-football-game/issues/781)) ([d1e5949](https://github.com/Ryxeuf/fantasy-football-game/commit/d1e5949dd7fa32513b8e3da82feb7748fe4a2835))
* **pro-league:** Survivor Pick'em hebdo (Sprint Q lot Q.D.2) ([#776](https://github.com/Ryxeuf/fantasy-football-game/issues/776)) ([a78ee8b](https://github.com/Ryxeuf/fantasy-football-game/commit/a78ee8bec8994692cbfd1d38168af30bd780c25d))
* **pro-league:** team head-to-head card + page detail (Sprint Q lot Q.A.3) ([#779](https://github.com/Ryxeuf/fantasy-football-game/issues/779)) ([88e7c2c](https://github.com/Ryxeuf/fantasy-football-game/commit/88e7c2c2629b2be24d55b24587b6eb3c864e07db))
* **sim-engine:** engine 0.17.0 — tune TDs (option F combo C+D) ([#787](https://github.com/Ryxeuf/fantasy-football-game/issues/787)) ([bf648a3](https://github.com/Ryxeuf/fantasy-football-game/commit/bf648a326c094c5019dbc4ceff8b5a3aa2e73d41))
* **sim-engine:** engine 0.18.0 — starting yardline 4→6 (option A) ([#788](https://github.com/Ryxeuf/fantasy-football-game/issues/788)) ([303f42d](https://github.com/Ryxeuf/fantasy-football-game/commit/303f42d64b81f0eef6068bd693b5e7e73a31421c))


### 🐛 Bug Fixes

* **ci:** deploy workflow filter unit tests metier (drop E2E packages) ([#770](https://github.com/Ryxeuf/fantasy-football-game/issues/770)) ([131c1c9](https://github.com/Ryxeuf/fantasy-football-game/commit/131c1c93325bbd8e9cd5cfc93b66f3b7461f0f91))
* **ci:** deploy workflow GHCR auth + permissions deployments + retire script_stop ([#771](https://github.com/Ryxeuf/fantasy-football-game/issues/771)) ([a50acd0](https://github.com/Ryxeuf/fantasy-football-game/commit/a50acd006ce0338207311e05ec0a37201be32c1a))
* **web:** live button respecte le kickoff pour status='ready' ([#789](https://github.com/Ryxeuf/fantasy-football-game/issues/789)) ([3b6a2de](https://github.com/Ryxeuf/fantasy-football-game/commit/3b6a2dee8f08e7eb69da900dad73b5301a502169))


### 📝 Documentation

* **session:** Sprint Q 9/13 livre + patterns recurrents ([#785](https://github.com/Ryxeuf/fantasy-football-game/issues/785)) ([4914320](https://github.com/Ryxeuf/fantasy-football-game/commit/49143203408f2ba59515c293c82e7c64a2c240a8)), closes [#772](https://github.com/Ryxeuf/fantasy-football-game/issues/772) [-#784](https://github.com/Ryxeuf/-/issues/784)
* **sim-engine:** investigation matchs 0-0 + script debug-match ([#786](https://github.com/Ryxeuf/fantasy-football-game/issues/786)) ([1701f2a](https://github.com/Ryxeuf/fantasy-football-game/commit/1701f2a31a2fdee53cd57e812ac3af38defcfc02)), closes [#2](https://github.com/Ryxeuf/fantasy-football-game/issues/2)

## [1.111.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.110.1...v1.111.0) (2026-05-11)


### ✨ Features

* **admin:** bootstrap Pro League — create season + hub + season detail ([#765](https://github.com/Ryxeuf/fantasy-football-game/issues/765)) ([15eb024](https://github.com/Ryxeuf/fantasy-football-game/commit/15eb0246d95ce58551a7880c480490e664042d94))
* **admin:** bulk simulate tous les matchs d'un round ([b1c30a1](https://github.com/Ryxeuf/fantasy-football-game/commit/b1c30a13dab202027c9edd60773bff78c4fb3447))
* **admin:** gestion des matchs Pro League (simulate + list + detail) ([#767](https://github.com/Ryxeuf/fantasy-football-game/issues/767)) ([4af5b91](https://github.com/Ryxeuf/fantasy-football-game/commit/4af5b917f916a2a5cdba5d28b6f3d337fb03e643))
* **admin:** masquage admin du classement ELO + badge "Non classe" ([#766](https://github.com/Ryxeuf/fantasy-football-game/issues/766)) ([d1f316e](https://github.com/Ryxeuf/fantasy-football-game/commit/d1f316ef1e4c2f8b4644d12262495f32bb0f95a4))
* **admin:** season factory Pro League (Lot P.B.3) ([#764](https://github.com/Ryxeuf/fantasy-football-game/issues/764)) ([7233b05](https://github.com/Ryxeuf/fantasy-football-game/commit/7233b0598b82dc82fc97ce072a2811c27d0e16e2))


### 🐛 Bug Fixes

* **engine:** retire season_4 + page admin utilities (debloque seed prod) ([#763](https://github.com/Ryxeuf/fantasy-football-game/issues/763)) ([e072103](https://github.com/Ryxeuf/fantasy-football-game/commit/e072103086412da58b704243bf73368f44a002fa))


### ♻️ Code Refactoring

* Phase A deployment (pull-only, CI builds images) ([#768](https://github.com/Ryxeuf/fantasy-football-game/issues/768)) ([61dcb16](https://github.com/Ryxeuf/fantasy-football-game/commit/61dcb1669e2664481c0d8023a8f603e06f9ee577))

## [1.110.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.110.0...v1.110.1) (2026-05-11)


### 🐛 Bug Fixes

* **admin:** sandbox test-match resolve team slug → id Prisma + cache lien Ligues si online_play OFF ([b8efa83](https://github.com/Ryxeuf/fantasy-football-game/commit/b8efa8305339eca5c6038c22e424d202418fe9c4))

## [1.110.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.109.0...v1.110.0) (2026-05-11)


### ✨ Features

* **admin:** admin password reset override (Lot P.C.2) ([#759](https://github.com/Ryxeuf/fantasy-football-game/issues/759)) ([52d46f4](https://github.com/Ryxeuf/fantasy-football-game/commit/52d46f4848e417533bf75173d1f013c3246770d7))
* **admin:** moderation matchs humains + ban users (Lot P.B.4) ([#758](https://github.com/Ryxeuf/fantasy-football-game/issues/758)) ([f53470c](https://github.com/Ryxeuf/fantasy-football-game/commit/f53470cc748410072a1752155f62fa7c91fe1d5c))
* **admin:** soft-delete users + restore (Lot P.A.2) ([f491024](https://github.com/Ryxeuf/fantasy-football-game/commit/f49102461dcb9d22bb8db2226913a33bf0a803ad))
* **admin:** wallet UI + endpoints (Lot P.B.1) ([#760](https://github.com/Ryxeuf/fantasy-football-game/issues/760)) ([1bb7ccb](https://github.com/Ryxeuf/fantasy-football-game/commit/1bb7ccbebe60b3c365ab9d06d9980a963e0f8be0))

## [1.109.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.108.0...v1.109.0) (2026-05-11)


### ✨ Features

* **admin:** dashboard analytics business (Lot P.C.3) ([#755](https://github.com/Ryxeuf/fantasy-football-game/issues/755)) ([65a24cf](https://github.com/Ryxeuf/fantasy-football-game/commit/65a24cf9477c4f52777b6c73e418044dbdb07de9))
* **ops:** mode maintenance global toggleable (Lot P.A.1) ([#753](https://github.com/Ryxeuf/fantasy-football-game/issues/753)) ([c785cfa](https://github.com/Ryxeuf/fantasy-football-game/commit/c785cfaddcc8189eef19490bb7bcd07dec7c4867))
* **privacy:** GDPR data export self-service (Lot P.A.3) ([fb13117](https://github.com/Ryxeuf/fantasy-football-game/commit/fb131174cc0a41978cd7eae345175551513373f2))
* **pro-league:** Hall of Fame dedications — Crowns sink (Lot P.B.2) ([#754](https://github.com/Ryxeuf/fantasy-football-game/issues/754)) ([4830c10](https://github.com/Ryxeuf/fantasy-football-game/commit/4830c105de5aed479fe99df4970dd4c4946d3011))


### 📝 Documentation

* session log Sprint O 2026-05-11 + patterns CLAUDE.md ([#752](https://github.com/Ryxeuf/fantasy-football-game/issues/752)) ([7a696b3](https://github.com/Ryxeuf/fantasy-football-game/commit/7a696b30307c8feeab3dbcf3863b0291ba96e662)), closes [#744](https://github.com/Ryxeuf/fantasy-football-game/issues/744) [-#751](https://github.com/Ryxeuf/-/issues/751)

## [1.108.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.107.0...v1.108.0) (2026-05-11)


### ✨ Features

* **auth:** kill-switch validation admin sur /auth/register (Lot O.B.1) ([#746](https://github.com/Ryxeuf/fantasy-football-game/issues/746)) ([464a1aa](https://github.com/Ryxeuf/fantasy-football-game/commit/464a1aac101e2e0b78433c114dc5e69cc99da8ef))
* **pro-league:** badge unlock toast + provider global (Lot O.C.3) ([#749](https://github.com/Ryxeuf/fantasy-football-game/issues/749)) ([3d508dc](https://github.com/Ryxeuf/fantasy-football-game/commit/3d508dc60613a63a22364068e5b5203e5aaedc22))
* **pro-league:** daily bonus claim UI sur /me/wallet (Lot O.C.1) ([ed4201e](https://github.com/Ryxeuf/fantasy-football-game/commit/ed4201ed434f86262b3c9f6e5e885ae385f37512))
* **pro-league:** OG image dynamique + share buttons matchs (Lot O.D) ([#750](https://github.com/Ryxeuf/fantasy-football-game/issues/750)) ([805bd54](https://github.com/Ryxeuf/fantasy-football-game/commit/805bd54feeec13bb08df563f140ecf4dd98a2e3c))
* **web:** match report banner sur /me/teams/[id] (Lot O.C.2) ([ae3a2e7](https://github.com/Ryxeuf/fantasy-football-game/commit/ae3a2e731cdbcc82abd2615c3449452c75f4f5eb))
* **web:** onboarding modal post-signup sur /me/teams (Lot O.B.3) ([#747](https://github.com/Ryxeuf/fantasy-football-game/issues/747)) ([1934873](https://github.com/Ryxeuf/fantasy-football-game/commit/1934873e601d871be7036e1ef6d7a7a9a3005e2c))


### 🐛 Bug Fixes

* **game-engine:** regeneration / apothecary order BB Season 2/3 (Lot O.A.1) ([#745](https://github.com/Ryxeuf/fantasy-football-game/issues/745)) ([05b4aaf](https://github.com/Ryxeuf/fantasy-football-game/commit/05b4aafb845fc793f00cfa73f354804becdaf5ba))


### 📝 Documentation

* **roadmap:** sprints O/P/Q/R post-audit 7 agents (2026-05-10) ([#744](https://github.com/Ryxeuf/fantasy-football-game/issues/744)) ([2dd13f5](https://github.com/Ryxeuf/fantasy-football-game/commit/2dd13f58c17d641965d1e0178e09df4769c0aeca))
* session UI polish Pro League 2026-05-10 (12 lots livrés) ([#743](https://github.com/Ryxeuf/fantasy-football-game/issues/743)) ([b45047c](https://github.com/Ryxeuf/fantasy-football-game/commit/b45047c1094ed4b5ddccf6c45358eb2ba2280e49)), closes [#728](https://github.com/Ryxeuf/fantasy-football-game/issues/728) [-#742](https://github.com/Ryxeuf/-/issues/742)

## [1.107.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.106.0...v1.107.0) (2026-05-10)


### ✨ Features

* **pro-league:** wallet page avec ledger transactions (Lot N) ([e374b01](https://github.com/Ryxeuf/fantasy-football-game/commit/e374b01fc22e86f36f08f5ad354961d7d0482aac))

## [1.106.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.105.0...v1.106.0) (2026-05-10)


### ✨ Features

* **pro-league:** top earners widget sur team detail (Lot M) ([8ff3fa7](https://github.com/Ryxeuf/fantasy-football-game/commit/8ff3fa72416232f419fc3fae27f3e5216da60cfe))

## [1.105.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.104.0...v1.105.0) (2026-05-10)


### ✨ Features

* **pro-league:** player match history avec SPP delta (Lot L) ([96c1b36](https://github.com/Ryxeuf/fantasy-football-game/commit/96c1b36ed2b307bd189688abf5d42cf2b1d6c46a))


### 🐛 Bug Fixes

* **pro-league:** readyToLevelUp flag — phantom badge dans Lot H (Lot K) ([#739](https://github.com/Ryxeuf/fantasy-football-game/issues/739)) ([bcff4dc](https://github.com/Ryxeuf/fantasy-football-game/commit/bcff4dc9c0ef836d998e0fd96cdbeb467e55fc2d))

## [1.104.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.103.0...v1.104.0) (2026-05-10)


### ✨ Features

* **admin:** sim health = drift + alerts + last-sim + cross-links (Lot 2.B.3+) ([#732](https://github.com/Ryxeuf/fantasy-football-game/issues/732)) ([429db17](https://github.com/Ryxeuf/fantasy-football-game/commit/429db17aa6d44c0503ca815cf7d6e01cdf2e8a2a)), closes [#673](https://github.com/Ryxeuf/fantasy-football-game/issues/673)
* **admin:** UI broadcaster load test (Lot J) ([#735](https://github.com/Ryxeuf/fantasy-football-game/issues/735)) ([2835505](https://github.com/Ryxeuf/fantasy-football-game/commit/283550595da416665d57a2fa3bc7da64b09b5cb8))
* **pro-league:** player detail page (Lot G) ([#736](https://github.com/Ryxeuf/fantasy-football-game/issues/736)) ([a0d8b52](https://github.com/Ryxeuf/fantasy-football-game/commit/a0d8b522dc1207f7f692be35106fed423d8cc00e))
* **pro-league:** roster filters/sort + ready-to-level-up badge (Lot H) ([#737](https://github.com/Ryxeuf/fantasy-football-game/issues/737)) ([10bee24](https://github.com/Ryxeuf/fantasy-football-game/commit/10bee24d32eae14010d5c3fbffefc6cadfc5fefb))
* **pro-league:** standings TV column + sort by TV (Lot I) ([ff216fc](https://github.com/Ryxeuf/fantasy-football-game/commit/ff216fc4b8140d7f7f1e563b910c9d3557ba6ccd))

## [1.103.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.102.0...v1.103.0) (2026-05-10)


### ✨ Features

* **admin:** UI cross-version compare + replay diff (Lot 4.F) ([#731](https://github.com/Ryxeuf/fantasy-football-game/issues/731)) ([9e16dbb](https://github.com/Ryxeuf/fantasy-football-game/commit/9e16dbb1e860df0e565c6990fbd6765d99be0cba)), closes [#722](https://github.com/Ryxeuf/fantasy-football-game/issues/722) [#725](https://github.com/Ryxeuf/fantasy-football-game/issues/725)
* **broadcaster:** pnpm sim:loadtest:broadcaster — scaling probe (Lot 4.C.1) ([#733](https://github.com/Ryxeuf/fantasy-football-game/issues/733)) ([9306376](https://github.com/Ryxeuf/fantasy-football-game/commit/93063761a9eac648cdab181392741efb38d91dce))
* **pro-league:** niggling TV malus + cron sweepRecomputeTvs (Lot 4.D.3) ([#728](https://github.com/Ryxeuf/fantasy-football-game/issues/728)) ([4570c37](https://github.com/Ryxeuf/fantasy-football-game/commit/4570c376ee927c233da1ea25fcb613f00a085ff5))
* **pro-league:** pools S/A/P/M par position + pricing primary/secondary (Lot 4.D.2) ([#730](https://github.com/Ryxeuf/fantasy-football-game/issues/730)) ([51e41ff](https://github.com/Ryxeuf/fantasy-football-game/commit/51e41ff4cba674e70b134bb73cf512237391cd12))
* **pro-league:** roster coach UI — level / SPP / TV / bonuses (Lot E) ([19e2dbc](https://github.com/Ryxeuf/fantasy-football-game/commit/19e2dbc77a72cd8a35d31470ca176eabd43f305b))
* **pro-league:** stat increases on doubles + TV propagation (Lot 4.D.1) ([#729](https://github.com/Ryxeuf/fantasy-football-game/issues/729)) ([b99c85b](https://github.com/Ryxeuf/fantasy-football-game/commit/b99c85b6d4a046ab004c49b4f64d0edf1f213616))
* **sim-engine:** hybrid driver attribue scorerId pondere par position (Lot 4.D.4) ([#727](https://github.com/Ryxeuf/fantasy-football-game/issues/727)) ([7ad26ae](https://github.com/Ryxeuf/fantasy-football-game/commit/7ad26aee926042facee981d40ab177a19939e3c2))
* **sim-engine:** replay diff tool event-by-event + pnpm sim:diff-replays (Lot 4.B.2) ([#725](https://github.com/Ryxeuf/fantasy-football-game/issues/725)) ([f262945](https://github.com/Ryxeuf/fantasy-football-game/commit/f262945c7f0cc448daad33ce8980e4d45e91a29a))

## [1.102.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.101.0...v1.102.0) (2026-05-10)


### ✨ Features

* **pro-league:** alertes drift par race + bornes BB-realistes (Lot 4.A.3) ([da2b131](https://github.com/Ryxeuf/fantasy-football-game/commit/da2b1319c50185ed2efe268e49e3a72c0455573c))
* **pro-league:** opt-in CPU profile capture pour les slow sims (Lot 4.A.2) ([#721](https://github.com/Ryxeuf/fantasy-football-game/issues/721)) ([2ad9e02](https://github.com/Ryxeuf/fantasy-football-game/commit/2ad9e024fc9a3999e5763361909dccc78b9fac79))
* **pro-league:** TV recalculation from learned skills (Lot 3.C.5) ([#723](https://github.com/Ryxeuf/fantasy-football-game/issues/723)) ([f1b38d5](https://github.com/Ryxeuf/fantasy-football-game/commit/f1b38d58a6f08c9b9734571acd4c6f3a6993c982))
* **sim-engine:** cross-version baseline comparator + pnpm sim:compare-versions (Lot 4.B.1) ([#722](https://github.com/Ryxeuf/fantasy-football-game/issues/722)) ([f017beb](https://github.com/Ryxeuf/fantasy-football-game/commit/f017beb3b93f3071e9d7dd1bd55b276d4b72c5e2))


### 📝 Documentation

* **sprint:** consigne Lot 4.D (stat increases, pools S/A/P/M, niggling TV malus, hybrid scorerId) ([#724](https://github.com/Ryxeuf/fantasy-football-game/issues/724)) ([5a854c8](https://github.com/Ryxeuf/fantasy-football-game/commit/5a854c8eac5fe88b89752cab81897bf58511821e))

## [1.101.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.100.0...v1.101.0) (2026-05-09)


### ✨ Features

* **pro-league:** level-up applier (skill rolls aux seuils BB) (Lot 3.C.4) ([524635f](https://github.com/Ryxeuf/fantasy-football-game/commit/524635f1dcc1fb01d5178bd6a22ad4115a4212d8))
* **pro-league:** SPP attribution + career counters + progression cron (Lot 3.C.2) ([#717](https://github.com/Ryxeuf/fantasy-football-game/issues/717)) ([9e74218](https://github.com/Ryxeuf/fantasy-football-game/commit/9e74218dbf589e864bc939c8008edd2342f6abb6))
* **pro-league:** structured sim error logs + slow sim warn + drift alerts (Lot 4.A) ([#720](https://github.com/Ryxeuf/fantasy-football-game/issues/720)) ([242e3cf](https://github.com/Ryxeuf/fantasy-football-game/commit/242e3cf0f55481dc97b90370951ef0ce3ee7b0eb))
* **pro-league:** wire casualty sweep + roster-aware applier (Lot 3.C.1) ([#716](https://github.com/Ryxeuf/fantasy-football-game/issues/716)) ([060b4fe](https://github.com/Ryxeuf/fantasy-football-game/commit/060b4fe6211429e1b8b87c48940d3d007eb1a0af))
* **sim-engine:** comparator hybrid vs full + EngineComparison + Prometheus (Lot 3.B.2) ([#713](https://github.com/Ryxeuf/fantasy-football-game/issues/713)) ([d0d6563](https://github.com/Ryxeuf/fantasy-football-game/commit/d0d65632fda64be6fff1ed5601d44e7f4f4da26a))
* **sim-engine:** perf baseline + verbose trace pour le full driver (Lot 3.B.3) ([#715](https://github.com/Ryxeuf/fantasy-football-game/issues/715)) ([d90d475](https://github.com/Ryxeuf/fantasy-football-game/commit/d90d47520400e4adc6bc0404682dcdf5ecbb7c8c))
* **sim-engine:** TD scorerId in events + 3 SPP per TD attribution (Lot 3.C.3) ([#718](https://github.com/Ryxeuf/fantasy-football-game/issues/718)) ([85dbeaa](https://github.com/Ryxeuf/fantasy-football-game/commit/85dbeaa56088df82c682189c174db61f36e6031c))
* **sim-engine:** toggle hybrid/full driver par saison + override match (Lot 3.B.1) ([#712](https://github.com/Ryxeuf/fantasy-football-game/issues/712)) ([61dcf6b](https://github.com/Ryxeuf/fantasy-football-game/commit/61dcf6b2eeecdf356e608647e4e2e8ed5bea394b))

## [1.100.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.99.0...v1.100.0) (2026-05-08)


### ✨ Features

* **sandbox:** create test matches from admin (Lot 2.C.2 + 2.C.4 + 2.C.5) ([#678](https://github.com/Ryxeuf/fantasy-football-game/issues/678)) ([b45dca3](https://github.com/Ryxeuf/fantasy-football-game/commit/b45dca3401a5aa1737ff215bc00e1d8dd9fa606b))
* **sandbox:** exclude isTest matches from aggregators (Lot 2.C.3) ([#679](https://github.com/Ryxeuf/fantasy-football-game/issues/679)) ([91680d2](https://github.com/Ryxeuf/fantasy-football-game/commit/91680d23fe78fda5426b0640c0a224ce7ce031f8))

## [1.99.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.98.0...v1.99.0) (2026-05-08)


### ✨ Features

* **sim-engine:** full driver emits MatchEvent[] via state diff (Lot 3.A.2.b) ([#687](https://github.com/Ryxeuf/fantasy-football-game/issues/687)) ([985f08d](https://github.com/Ryxeuf/fantasy-football-game/commit/985f08d0c01e99bad17433a7869a7df2d96cfa95))
* **sim-engine:** full driver MVP orchestrator (Lot 3.A.2.a) ([#685](https://github.com/Ryxeuf/fantasy-football-game/issues/685)) ([f97f3a5](https://github.com/Ryxeuf/fantasy-football-game/commit/f97f3a5468dd3cf3bd88495d2a96023f0e99716a))
* **sim-engine:** roster-aware GameState builder for full driver (Lot 3.A.2.c) ([#688](https://github.com/Ryxeuf/fantasy-football-game/issues/688)) ([d42741f](https://github.com/Ryxeuf/fantasy-football-game/commit/d42741f47dc8806709375fbbec1debf81b1c1edb))

## [1.98.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.97.0...v1.98.0) (2026-05-08)


### ✨ Features

* **ai:** 2-ply minimax lookahead for END_TURN (Lot 3.A.0.b) ([#683](https://github.com/Ryxeuf/fantasy-football-game/issues/683)) ([61d84e4](https://github.com/Ryxeuf/fantasy-football-game/commit/61d84e4258c56ba7a79af9c2d6a9e3fa5859df92))
* **ai:** per-race opening book bonus (Lot 3.A.0.c) ([#684](https://github.com/Ryxeuf/fantasy-football-game/issues/684)) ([1fe4f24](https://github.com/Ryxeuf/fantasy-football-game/commit/1fe4f24eeb6b7163f734418900c95749a4cbff41))
* **ai:** tactical profile modulates AI weights (Lot 3.A.0.a) ([#682](https://github.com/Ryxeuf/fantasy-football-game/issues/682)) ([10ec5f7](https://github.com/Ryxeuf/fantasy-football-game/commit/10ec5f7fec30c532c12ebc5617f49b47ddc6b767)), closes [#4](https://github.com/Ryxeuf/fantasy-football-game/issues/4)

## [1.97.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.96.0...v1.97.0) (2026-05-08)


### ✨ Features

* **admin:** sim health + broadcaster live UIs (Lot 2.B.3 + 2.B.4) ([#673](https://github.com/Ryxeuf/fantasy-football-game/issues/673)) ([920e58e](https://github.com/Ryxeuf/fantasy-football-game/commit/920e58ec371d236c88eebdd8ebd2a4d0d3a7104e))
* **metrics:** instrument sim-runner + broadcaster (Lot 2.A.3 + 2.A.4) ([#670](https://github.com/Ryxeuf/fantasy-football-game/issues/670)) ([e9d6988](https://github.com/Ryxeuf/fantasy-football-game/commit/e9d69881d8ef323e7657199bdaaf3dc00ca6289b))
* **metrics:** Pro League sim engine metrics (Lot 2.A.1 + 2.A.2) ([#668](https://github.com/Ryxeuf/fantasy-football-game/issues/668)) ([b2a7786](https://github.com/Ryxeuf/fantasy-football-game/commit/b2a77869ca507d7270a924ecb404cba3fba4b4cb))
* **schema:** isTest flag on ProLeagueMatch (Lot 2.C.1) ([#675](https://github.com/Ryxeuf/fantasy-football-game/issues/675)) ([b39b04d](https://github.com/Ryxeuf/fantasy-football-game/commit/b39b04d94faf2f01ead480bf349066c13dfd8ea6))
* **web:** i18n Pro League components + feed + me (sprint i18n.5) ([#677](https://github.com/Ryxeuf/fantasy-football-game/issues/677)) ([dfc10e6](https://github.com/Ryxeuf/fantasy-football-game/commit/dfc10e6a98d60c8783dc2d552660894b156c0e1d)), closes [#661](https://github.com/Ryxeuf/fantasy-football-game/issues/661) [#662](https://github.com/Ryxeuf/fantasy-football-game/issues/662) [#664](https://github.com/Ryxeuf/fantasy-football-game/issues/664) [#671](https://github.com/Ryxeuf/fantasy-football-game/issues/671)
* **web:** i18n Pro League gazette + hall-of-fame (sprint i18n.3) ([#664](https://github.com/Ryxeuf/fantasy-football-game/issues/664)) ([e14be21](https://github.com/Ryxeuf/fantasy-football-game/commit/e14be21386f252432e44dfe0861026fae35b92fe))
* **web:** i18n Pro League matches detail + live + replay (sprint i18n.4) ([#671](https://github.com/Ryxeuf/fantasy-football-game/issues/671)) ([a26fdaf](https://github.com/Ryxeuf/fantasy-football-game/commit/a26fdaf3ddf4e9e115033fce819a73ca8d009735))


### 📝 Documentation

* **audit:** Lot 3.A.1 — AI game-engine assessment for full driver ([#680](https://github.com/Ryxeuf/fantasy-football-game/issues/680)) ([34f4ad4](https://github.com/Ryxeuf/fantasy-football-game/commit/34f4ad49df1ceee672171471de7fea99f498f6c4))
* **roadmap:** sprint sim-engine — observability + full driver + sandbox ([#667](https://github.com/Ryxeuf/fantasy-football-game/issues/667)) ([b13f083](https://github.com/Ryxeuf/fantasy-football-game/commit/b13f0837c098311adabefb87f50b949b717c023a)), closes [#655](https://github.com/Ryxeuf/fantasy-football-game/issues/655) [#658](https://github.com/Ryxeuf/fantasy-football-game/issues/658)


### ♻️ Code Refactoring

* **game-engine:** extract choice handlers (S27.8.7) ([#669](https://github.com/Ryxeuf/fantasy-football-game/issues/669)) ([169abe5](https://github.com/Ryxeuf/fantasy-football-game/commit/169abe5d2c064b88acacbe6cf1f7beca4e1b0b48))
* **game-engine:** extract failure helpers (S27.8.4) ([#663](https://github.com/Ryxeuf/fantasy-football-game/issues/663)) ([8b1bd20](https://github.com/Ryxeuf/fantasy-football-game/commit/8b1bd20c8abce5922e8bc091672477fd7f487bf5))
* **game-engine:** extract getLegalMoves to legal-moves.ts (S27.8.11) ([#689](https://github.com/Ryxeuf/fantasy-football-game/issues/689)) ([203716b](https://github.com/Ryxeuf/fantasy-football-game/commit/203716be4f7c5af4740d00763077acea3e620990))
* **game-engine:** extract handleBallPickup + canUseTeamReroll (S27.8.5) ([#665](https://github.com/Ryxeuf/fantasy-football-game/issues/665)) ([907b9d6](https://github.com/Ryxeuf/fantasy-football-game/commit/907b9d658205fabcb129c6543bf6ce412162143e))
* **game-engine:** extract handleBlitz to blitz-handler.ts (S27.8.13) — DoD <=600 atteint ([#691](https://github.com/Ryxeuf/fantasy-football-game/issues/691)) ([c358918](https://github.com/Ryxeuf/fantasy-football-game/commit/c3589184544272f545704aecc67efcb4f27d6b9d))
* **game-engine:** extract handleBlock + import cleanup (S27.8.8) ([#674](https://github.com/Ryxeuf/fantasy-football-game/issues/674)) ([b1b9c85](https://github.com/Ryxeuf/fantasy-football-game/commit/b1b9c851b8090ce50f6209acc2bf857358c10627))
* **game-engine:** extract handleLeap/Move/Dodge + handleDumpOffChoose (S27.8.12) ([#690](https://github.com/Ryxeuf/fantasy-football-game/issues/690)) ([562d4a9](https://github.com/Ryxeuf/fantasy-football-game/commit/562d4a90f7858506a9b7927708cdabb1e6982144))
* **game-engine:** extract move sub-handlers (S27.8.6) ([#666](https://github.com/Ryxeuf/fantasy-football-game/issues/666)) ([c779e0c](https://github.com/Ryxeuf/fantasy-football-game/commit/c779e0c37674959993022d3b32fd551f313a0e9c))
* **game-engine:** extract multi-block + frenzy from actions.ts (S27.8.10) ([#686](https://github.com/Ryxeuf/fantasy-football-game/issues/686)) ([a6aecbd](https://github.com/Ryxeuf/fantasy-football-game/commit/a6aecbdfdee038394f327fabe6d2f89d308ee639))
* **game-engine:** split block-action — extract handleBlock (S27.8.15) ([#693](https://github.com/Ryxeuf/fantasy-football-game/issues/693)) ([7a12a1e](https://github.com/Ryxeuf/fantasy-football-game/commit/7a12a1ee48b0df208e4538a03b7f04ef0976e013)), closes [#683](https://github.com/Ryxeuf/fantasy-football-game/issues/683)
* **game-engine:** split choice-handlers — extract handleRerollChoose (S27.8.14) ([#692](https://github.com/Ryxeuf/fantasy-football-game/issues/692)) ([22491f3](https://github.com/Ryxeuf/fantasy-football-game/commit/22491f3252220d3125c4297540b2078070945dfd))
* **server:** extract handleGetMatchSummary to dedicated module (S27.8.32) ([#710](https://github.com/Ryxeuf/fantasy-football-game/issues/710)) ([78c29e9](https://github.com/Ryxeuf/fantasy-football-game/commit/78c29e900e06cdcd4e2a7c29a425a1b3b05545ac))
* **server:** extract handleHireStarPlayer to dedicated module (S27.8.31) ([#709](https://github.com/Ryxeuf/fantasy-football-game/issues/709)) ([08c26bd](https://github.com/Ryxeuf/fantasy-football-game/commit/08c26bd3aa32e760a4e0e3079d4a1024ce551678))
* **server:** extract handleUpdatePlayerSkills to dedicated module (S27.8.30) ([#708](https://github.com/Ryxeuf/fantasy-football-game/issues/708)) ([b2f8f48](https://github.com/Ryxeuf/fantasy-football-game/commit/b2f8f48cd14c0eec66258eadedd10a7f31c977d0))
* **server:** split match.ts — extract 3 kickoff handlers (S27.8.21) ([#699](https://github.com/Ryxeuf/fantasy-football-game/issues/699)) ([6d83669](https://github.com/Ryxeuf/fantasy-football-game/commit/6d83669701c48611440b3426e625251d262edd2a))
* **server:** split match.ts — extract 3 readonly handlers (S27.8.17) ([#695](https://github.com/Ryxeuf/fantasy-football-game/issues/695)) ([3035a9c](https://github.com/Ryxeuf/fantasy-football-game/commit/3035a9c0d37de980bafcd2754cdbbba5213f90d1))
* **server:** split match.ts — extract 4 lifecycle handlers (S27.8.20) ([#698](https://github.com/Ryxeuf/fantasy-football-game/issues/698)) ([815b648](https://github.com/Ryxeuf/fantasy-football-game/commit/815b6486dbe5606c095ff029891c20ea956d2479))
* **server:** split match.ts — extract 5 details/list handlers (S27.8.19) ([#697](https://github.com/Ryxeuf/fantasy-football-game/issues/697)) ([57b133f](https://github.com/Ryxeuf/fantasy-football-game/commit/57b133f1e6d5b9cad77e53e6e89e02984def6671))
* **server:** split match.ts — extract handleGetMatchState (S27.8.18) ([#696](https://github.com/Ryxeuf/fantasy-football-game/issues/696)) ([2881508](https://github.com/Ryxeuf/fantasy-football-game/commit/2881508aeb8d9387c78b3b207e30c55b110a4f9e))
* **server:** split match.ts — extract handleValidateSetup (S27.8.29) ([#707](https://github.com/Ryxeuf/fantasy-football-game/issues/707)) ([43b7345](https://github.com/Ryxeuf/fantasy-football-game/commit/43b7345514e53991b3f1c4b37c8715646afc562b))
* **server:** split match.ts — extract spectate + replay handlers (S27.8.16) ([#694](https://github.com/Ryxeuf/fantasy-football-game/issues/694)) ([04b58ad](https://github.com/Ryxeuf/fantasy-football-game/commit/04b58ad2f5356c24150fe7afd4cfb4640296e182))
* **server:** split team.ts — extract 2 selection handlers (S27.8.26) ([#704](https://github.com/Ryxeuf/fantasy-football-game/issues/704)) ([1a936e2](https://github.com/Ryxeuf/fantasy-football-game/commit/1a936e2f6ccf4ce6c5531ed9118e7c2e8054eb97))
* **server:** split team.ts — extract 3 mutation handlers (S27.8.25) ([#703](https://github.com/Ryxeuf/fantasy-football-game/issues/703)) ([18c6949](https://github.com/Ryxeuf/fantasy-football-game/commit/18c6949ad88eb77d20d20787bd4e01fa610a5dc8))
* **server:** split team.ts — extract 4 player handlers (S27.8.24) ([#702](https://github.com/Ryxeuf/fantasy-football-game/issues/702)) ([17c31a3](https://github.com/Ryxeuf/fantasy-football-game/commit/17c31a3f28cf235085799daf3df84a9614dc11f9))
* **server:** split team.ts — extract 4 readonly handlers (S27.8.22) ([#700](https://github.com/Ryxeuf/fantasy-football-game/issues/700)) ([f477ad8](https://github.com/Ryxeuf/fantasy-football-game/commit/f477ad80f50dce9a4052272328b473ab15a06b26))
* **server:** split team.ts — extract 4 star-player handlers (S27.8.23) ([#701](https://github.com/Ryxeuf/fantasy-football-game/issues/701)) ([94b1fc2](https://github.com/Ryxeuf/fantasy-football-game/commit/94b1fc2a6c811d726038888864ca6a3e061727f1))
* **server:** split team.ts — extract handleBuildTeam (S27.8.27) ([#705](https://github.com/Ryxeuf/fantasy-football-game/issues/705)) ([c07eeee](https://github.com/Ryxeuf/fantasy-football-game/commit/c07eeeedd2f8501d55421a0ec44aa0af76e263d6))
* **server:** split team.ts — extract handlePurchase (S27.8.28) ([#706](https://github.com/Ryxeuf/fantasy-football-game/issues/706)) ([3c72e19](https://github.com/Ryxeuf/fantasy-football-game/commit/3c72e19fe2e24c94a15d0bbe5e03d8c556cc0511))
* **server:** split team.ts — final extraction + S27 TERMINE (S27.8.33) ([#711](https://github.com/Ryxeuf/fantasy-football-game/issues/711)) ([ad94c1e](https://github.com/Ryxeuf/fantasy-football-game/commit/ad94c1ee1117d9a79cd1b0a93e172db9319e0524))

## [1.96.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.95.0...v1.96.0) (2026-05-07)


### ✨ Features

* **web:** i18n Pro League standings + leaderboard (sprint i18n.2) ([ccec376](https://github.com/Ryxeuf/fantasy-football-game/commit/ccec37684de7dc9c2d2f332071947bff3c6b5cfd))

## [1.95.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.94.1...v1.95.0) (2026-05-07)


### ✨ Features

* **server:** wire audit log into admin-data routes (S27.6.4) ([#652](https://github.com/Ryxeuf/fantasy-football-game/issues/652)) ([4b3727d](https://github.com/Ryxeuf/fantasy-football-game/commit/4b3727db9fbb2412c6885294cb3bc518dc575fc7))
* **sim-engine:** every yard the ball moves is a narrated MOVE event ([fbd9b40](https://github.com/Ryxeuf/fantasy-football-game/commit/fbd9b40d66f40b06fd2f8b93737a1d5f833a6bd2))
* **web:** /pro-league/about marketing page (sprint 1.F.4) ([#660](https://github.com/Ryxeuf/fantasy-football-game/issues/660)) ([926d6d2](https://github.com/Ryxeuf/fantasy-football-game/commit/926d6d24a91e5fad341bcb1994775b7acbc3fbe8)), closes [#630](https://github.com/Ryxeuf/fantasy-football-game/issues/630) [#631](https://github.com/Ryxeuf/fantasy-football-game/issues/631) [#632](https://github.com/Ryxeuf/fantasy-football-game/issues/632)
* **web:** i18n Pro League hub + about pages (sprint i18n.1) ([#661](https://github.com/Ryxeuf/fantasy-football-game/issues/661)) ([41602c4](https://github.com/Ryxeuf/fantasy-football-game/commit/41602c40edd07b0aeb650c8266e8257a5a0008f3))


### ♻️ Code Refactoring

* **game-engine:** extract turn + foul handlers (S27.8.3) ([ebc46c4](https://github.com/Ryxeuf/fantasy-football-game/commit/ebc46c41a451ffa795df55ea175d45e5de65d10a))

## [1.94.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.94.0...v1.94.1) (2026-05-07)


### ♻️ Code Refactoring

* **game-engine:** extract pass family handlers (S27.8.2) ([f7e6ed4](https://github.com/Ryxeuf/fantasy-football-game/commit/f7e6ed42e04ae8e0152e35c9da56035d14609def))

## [1.94.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.93.0...v1.94.0) (2026-05-07)


### ✨ Features

* **sim-engine:** space key-moment events inside the turn window ([5bdcb70](https://github.com/Ryxeuf/fantasy-football-game/commit/5bdcb70ba3b189c738997ac26199dc115aef75c4))
* **sim-engine:** successful passes advance the drive (and can score) ([6bd8642](https://github.com/Ryxeuf/fantasy-football-game/commit/6bd8642dcd73a1f80654ac828fe47ee5826dc0b9)), closes [#1](https://github.com/Ryxeuf/fantasy-football-game/issues/1)


### 🐛 Bug Fixes

* **sim-engine:** cap single-turn yards so TDs span multiple turns ([d1d7f81](https://github.com/Ryxeuf/fantasy-football-game/commit/d1d7f8102ddfde4602604cf590cacbb11fdff12d)), closes [#2](https://github.com/Ryxeuf/fantasy-football-game/issues/2)
* **sim-engine:** turnovers no longer chain into a same-turn TD ([daaedb9](https://github.com/Ryxeuf/fantasy-football-game/commit/daaedb937c7fa5208a8c1df27adfcf59cc593407)), closes [#2](https://github.com/Ryxeuf/fantasy-football-game/issues/2)


### ♻️ Code Refactoring

* **sim-engine:** drop dead hasPossession field on DriveState ([6ad385d](https://github.com/Ryxeuf/fantasy-football-game/commit/6ad385d8af778e2a72961dd7a7863345cdfed2b1))

## [1.93.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.92.0...v1.93.0) (2026-05-07)


### ✨ Features

* **web,e2e:** replay keyboard shortcuts + Playwright spec (sprint 1.G.5) ([e662751](https://github.com/Ryxeuf/fantasy-football-game/commit/e6627515d24fb4b9fab0a5a30da668d2790abc23))
* **web:** auto LIVE vs REPLAY mode redirect (sprint 1.G.3) ([#651](https://github.com/Ryxeuf/fantasy-football-game/issues/651)) ([5316969](https://github.com/Ryxeuf/fantasy-football-game/commit/5316969c461d4d8d0f6b176558adac570809abbb))
* **web:** TD/CASUALTY/NUFFLE markers on replay scrub bar (sprint 1.G.4) ([#653](https://github.com/Ryxeuf/fantasy-football-game/issues/653)) ([4f4f8d8](https://github.com/Ryxeuf/fantasy-football-game/commit/4f4f8d83df8fbed71cc01f4e42d3fba7f6c2cd9f))


### ♻️ Code Refactoring

* **game-engine:** extract special-action handlers (S27.8.1) ([#650](https://github.com/Ryxeuf/fantasy-football-game/issues/650)) ([de3b20e](https://github.com/Ryxeuf/fantasy-football-game/commit/de3b20e36da7335d8392fa03518039fb6314d4a2))

## [1.92.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.91.0...v1.92.0) (2026-05-07)


### ✨ Features

* **game-engine,server:** skeleton Saison 4 BB3 (S27.5) ([#642](https://github.com/Ryxeuf/fantasy-football-game/issues/642)) ([0cff968](https://github.com/Ryxeuf/fantasy-football-game/commit/0cff9684fed3e111dcbdba317248a9ce9e6b1041))
* **mobile:** a11y board PixiBoardNative (S27.4.1) ([#639](https://github.com/Ryxeuf/fantasy-football-game/issues/639)) ([0e31865](https://github.com/Ryxeuf/fantasy-football-game/commit/0e318651d189aa5e0b792bd13d09bb0f83f8bda7))
* **mobile:** hook composite useGameMatch (S27.4.2, cloture S27.4) ([#641](https://github.com/Ryxeuf/fantasy-football-game/issues/641)) ([6910531](https://github.com/Ryxeuf/fantasy-football-game/commit/6910531c525d36934dd5d1b9c0bd794b3a03ac7b))
* **mobile:** i18n des ecrans cups (S27.3.16) ([#635](https://github.com/Ryxeuf/fantasy-football-game/issues/635)) ([23fa839](https://github.com/Ryxeuf/fantasy-football-game/commit/23fa839fdc8156f0574805c1919bb7fa9abde9e2))
* **mobile:** i18n des ecrans leagues (S27.3.15) ([#633](https://github.com/Ryxeuf/fantasy-football-game/issues/633)) ([4444915](https://github.com/Ryxeuf/fantasy-football-game/commit/44449156543218b57d0f3422c1773be754b8671d))
* **mobile:** i18n des ecrans match + replay (S27.3.18) ([#637](https://github.com/Ryxeuf/fantasy-football-game/issues/637)) ([dbc2660](https://github.com/Ryxeuf/fantasy-football-game/commit/dbc266015f4a64c75f7938baa3cc2a20cd6f3552))
* **mobile:** i18n des ecrans star-players (S27.3.17) ([#636](https://github.com/Ryxeuf/fantasy-football-game/issues/636)) ([f5a6274](https://github.com/Ryxeuf/fantasy-football-game/commit/f5a627458a8051d9bb5532e9d1dc310e6fc321fa))
* **mobile:** i18n des titres de navigation (S27.3.19, cloture S27.3) ([#638](https://github.com/Ryxeuf/fantasy-football-game/issues/638)) ([975d1fd](https://github.com/Ryxeuf/fantasy-football-game/commit/975d1fd7e2edf86672a8e5b7abc73a9e3713a2ea))
* **server,db:** audit log admin foundation (S27.6.1) ([#643](https://github.com/Ryxeuf/fantasy-football-game/issues/643)) ([ca57808](https://github.com/Ryxeuf/fantasy-football-game/commit/ca57808e27d618531fbc00a80a59677716de2f03))
* **server,web:** UI lecture du journal d'audit (S27.6.3, cloture S27.6) ([#645](https://github.com/Ryxeuf/fantasy-football-game/issues/645)) ([7b84502](https://github.com/Ryxeuf/fantasy-football-game/commit/7b84502b5e4ddc8768a06417257e57e0bf122858))
* **server:** replay dump endpoint for completed matches (sprint 1.G.1) ([#640](https://github.com/Ryxeuf/fantasy-football-game/issues/640)) ([00fb4a3](https://github.com/Ryxeuf/fantasy-football-game/commit/00fb4a30af66213b52cca1b5bb5b0fe9f1d207fe))
* **server:** wire audit log into admin routes (S27.6.2) ([#644](https://github.com/Ryxeuf/fantasy-football-game/issues/644)) ([99301b6](https://github.com/Ryxeuf/fantasy-football-game/commit/99301b649db74d075e1db726d42b5f78c85ee372))
* **sim-engine:** enriched narrator + regen 50 panel replays on 0.13.0 ([#634](https://github.com/Ryxeuf/fantasy-football-game/issues/634)) ([f6e9b6f](https://github.com/Ryxeuf/fantasy-football-game/commit/f6e9b6fee945975bf8aa4d040c66e735a587d31c))
* **web:** MatchReplayPlayer with scrub bar + speed controls (sprint 1.G.2) ([2c01743](https://github.com/Ryxeuf/fantasy-football-game/commit/2c0174387dceadc31f496335c33f5a7d5571fd47))
* **web:** Pro League sitemap + JSON-LD SportsLeague/FAQ (sprint 1.F.3) ([#632](https://github.com/Ryxeuf/fantasy-football-game/issues/632)) ([60f292e](https://github.com/Ryxeuf/fantasy-football-game/commit/60f292eb3d30624c059610bf3999c0dae2f6a4c4))


### 📝 Documentation

* **panel:** regenerate 50 panel replays on engineVer 0.13.0 (post iter [#12](https://github.com/Ryxeuf/fantasy-football-game/issues/12)-16) ([#596](https://github.com/Ryxeuf/fantasy-football-game/issues/596)) ([01154c6](https://github.com/Ryxeuf/fantasy-football-game/commit/01154c6d8714c0caede63f4626ffedb291db63dd)), closes [#12-16](https://github.com/Ryxeuf/fantasy-football-game/issues/12-16) [#12-16](https://github.com/Ryxeuf/fantasy-football-game/issues/12-16) [#12-16](https://github.com/Ryxeuf/fantasy-football-game/issues/12-16) [#13-14](https://github.com/Ryxeuf/fantasy-football-game/issues/13-14) [#15-16](https://github.com/Ryxeuf/fantasy-football-game/issues/15-16) [#12-16](https://github.com/Ryxeuf/fantasy-football-game/issues/12-16) [#594](https://github.com/Ryxeuf/fantasy-football-game/issues/594) [#12-16](https://github.com/Ryxeuf/fantasy-football-game/issues/12-16) [#594](https://github.com/Ryxeuf/fantasy-football-game/issues/594) [#595](https://github.com/Ryxeuf/fantasy-football-game/issues/595)


### ♻️ Code Refactoring

* **game-engine:** Horns/PileDriver/SneakyGit via registry (S27.7.3, cloture S27.7) ([#649](https://github.com/Ryxeuf/fantasy-football-game/issues/649)) ([b732eeb](https://github.com/Ryxeuf/fantasy-football-game/commit/b732eeb0df67cff54b8023fafe545cb2fd589845))
* **game-engine:** Sprint GFI cap via skill registry (S27.7.2) ([#647](https://github.com/Ryxeuf/fantasy-football-game/issues/647)) ([43f8ea0](https://github.com/Ryxeuf/fantasy-football-game/commit/43f8ea0118d8fedd58578341e0e00df627fb4a1a))
* **game-engine:** Stunty AV via skill registry (S27.7.1) ([#646](https://github.com/Ryxeuf/fantasy-football-game/issues/646)) ([ddbc5b1](https://github.com/Ryxeuf/fantasy-football-game/commit/ddbc5b1ce19f20e005cb882deba04ee1fbc7a2a4))

## [1.91.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.90.0...v1.91.0) (2026-05-07)


### ✨ Features

* **server,db:** casualties post-process roster (sprint 1.E.4) ([#626](https://github.com/Ryxeuf/fantasy-football-game/issues/626)) ([a8e3184](https://github.com/Ryxeuf/fantasy-football-game/commit/a8e318455420e8c4d42367f287fd95237f4921d8))
* **server,db:** Pro League badges/titres (sprint 1.D.9) ([#623](https://github.com/Ryxeuf/fantasy-football-game/issues/623)) ([96ac911](https://github.com/Ryxeuf/fantasy-football-game/commit/96ac91137868bccc8f2e990308ca01440bd7b29c)), closes [#614](https://github.com/Ryxeuf/fantasy-football-game/issues/614) [#615](https://github.com/Ryxeuf/fantasy-football-game/issues/615) [#616](https://github.com/Ryxeuf/fantasy-football-game/issues/616) [#617](https://github.com/Ryxeuf/fantasy-football-game/issues/617) [#618](https://github.com/Ryxeuf/fantasy-football-game/issues/618) [#619](https://github.com/Ryxeuf/fantasy-football-game/issues/619) [#621](https://github.com/Ryxeuf/fantasy-football-game/issues/621) [#622](https://github.com/Ryxeuf/fantasy-football-game/issues/622)
* **server,web,db:** Pro League Hall of Fame light (sprint 1.E.5) ([#628](https://github.com/Ryxeuf/fantasy-football-game/issues/628)) ([796f0af](https://github.com/Ryxeuf/fantasy-football-game/commit/796f0af02fc6b672852f734e989428a827c5aa47))
* **server,web:** Pro League bet leaderboard (sprint 1.D.8) ([#622](https://github.com/Ryxeuf/fantasy-football-game/issues/622)) ([5508c2b](https://github.com/Ryxeuf/fantasy-football-game/commit/5508c2b89612d3dd7e653aaa644e2e9b5872fa08))
* **server,web:** Pro League Gazette models + UI (sprint 1.E.2) ([#625](https://github.com/Ryxeuf/fantasy-football-game/issues/625)) ([23cd25a](https://github.com/Ryxeuf/fantasy-football-game/commit/23cd25a359264cec452c4f397f06971e72ba9205))
* **server,web:** SEO metadata + Pro League healthcheck (sprint 1.F.2) ([#631](https://github.com/Ryxeuf/fantasy-football-game/issues/631)) ([bafb5ff](https://github.com/Ryxeuf/fantasy-football-game/commit/bafb5ff12bc6c6a12c0539d14e419244ea7fd3d8))
* **server:** Pro League LLM Gazette daily generation (sprint 1.E.1) ([#629](https://github.com/Ryxeuf/fantasy-football-game/issues/629)) ([53415d0](https://github.com/Ryxeuf/fantasy-football-game/commit/53415d0e8f7722168025854754f408b429b472fa))
* **server:** Pro League rookie generator + seed + replenish (sprint 1.E.6) ([#627](https://github.com/Ryxeuf/fantasy-football-game/issues/627)) ([41ae06f](https://github.com/Ryxeuf/fantasy-football-game/commit/41ae06fee8df2a73d6d780ff28b9997b9fc11c7a))
* **server:** Pro League storyline detector + Gazette daily recap (sprint 1.E.3) ([#624](https://github.com/Ryxeuf/fantasy-football-game/issues/624)) ([cd68eb1](https://github.com/Ryxeuf/fantasy-football-game/commit/cd68eb10490057f8e468f3d1001986218eec4a5d))
* **turnstile:** injecte NEXT_PUBLIC_TURNSTILE_SITE_KEY au build Next.js ([d888d6d](https://github.com/Ryxeuf/fantasy-football-game/commit/d888d6dbe60244192835130a093b48492abd628c))
* **web:** Pro League betting UI (sprint 1.D.7) ([#621](https://github.com/Ryxeuf/fantasy-football-game/issues/621)) ([78d3d01](https://github.com/Ryxeuf/fantasy-football-game/commit/78d3d01283f85262674591997e3a186566cefc0f))

## [1.90.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.89.1...v1.90.0) (2026-05-07)


### ✨ Features

* **admin:** UI lecture des replays panel pour validation C6-C9 ([#607](https://github.com/Ryxeuf/fantasy-football-game/issues/607)) ([67b5eaf](https://github.com/Ryxeuf/fantasy-football-game/commit/67b5eaf3cdcd245b44949115a19f4f960d01d46b))
* **db:** Pro League bet markets + bets + settlements (sprint 1.D.2) ([#615](https://github.com/Ryxeuf/fantasy-football-game/issues/615)) ([8540a80](https://github.com/Ryxeuf/fantasy-football-game/commit/8540a80796a765b62bced5db6682600330efb82f))
* **db:** Pro League Prisma models (sprint 1.A.1) ([#597](https://github.com/Ryxeuf/fantasy-football-game/issues/597)) ([07fe395](https://github.com/Ryxeuf/fantasy-football-game/commit/07fe39576c8e26f75b6f330b713cae82c965016a))
* **mobile:** i18n des popups in-match (S27.3.14) ([#619](https://github.com/Ryxeuf/fantasy-football-game/issues/619)) ([1f71a34](https://github.com/Ryxeuf/fantasy-football-game/commit/1f71a3488db8794e7e03a0ae6944d86e92ed3fdb))
* **mobile:** i18n play/[id] screen (sprint S27.3.13) ([#605](https://github.com/Ryxeuf/fantasy-football-game/issues/605)) ([8217410](https://github.com/Ryxeuf/fantasy-football-game/commit/82174101f679a28aff6bba8f3a9968fc026c45e1))
* **mobile:** S27.3.12 — i18n migration of player detail screen ([#592](https://github.com/Ryxeuf/fantasy-football-game/issues/592)) ([eb4a77a](https://github.com/Ryxeuf/fantasy-football-game/commit/eb4a77abb550f9dccca72c700fac939b05388204))
* **server,db:** Pro League wallet + transaction ledger (sprint 1.D.1) ([#614](https://github.com/Ryxeuf/fantasy-football-game/issues/614)) ([2936c29](https://github.com/Ryxeuf/fantasy-football-game/commit/2936c292387b91f8945627036365299a09cb0c25))
* **server,web:** Pro League detailed standings page (sprint 1.C.5) ([#610](https://github.com/Ryxeuf/fantasy-football-game/issues/610)) ([c9477f5](https://github.com/Ryxeuf/fantasy-football-game/commit/c9477f537e605d6192a185210a31014838b798bd))
* **server,web:** Pro League fan follow + feed (sprint 1.C.4) ([#613](https://github.com/Ryxeuf/fantasy-football-game/issues/613)) ([57e68c9](https://github.com/Ryxeuf/fantasy-football-game/commit/57e68c9d04b9e50bbc6e3f9b8e41534f857afb4c)), closes [#609](https://github.com/Ryxeuf/fantasy-football-game/issues/609) [#611](https://github.com/Ryxeuf/fantasy-football-game/issues/611) [#612](https://github.com/Ryxeuf/fantasy-football-game/issues/612) [#610](https://github.com/Ryxeuf/fantasy-football-game/issues/610)
* **server,web:** Pro League hub page (sprint 1.C.1) ([#609](https://github.com/Ryxeuf/fantasy-football-game/issues/609)) ([9b46ed8](https://github.com/Ryxeuf/fantasy-football-game/commit/9b46ed8eedef2fa71c602def61a6efa43fb196b3))
* **server,web:** Pro League match detail page (sprint 1.C.3) ([#612](https://github.com/Ryxeuf/fantasy-football-game/issues/612)) ([9e8973e](https://github.com/Ryxeuf/fantasy-football-game/commit/9e8973ec9e26a32825d810f929f07ea4c06c28bc))
* **server,web:** Pro League team detail page (sprint 1.C.2) ([#611](https://github.com/Ryxeuf/fantasy-football-game/issues/611)) ([fc26012](https://github.com/Ryxeuf/fantasy-football-game/commit/fc26012649605b39d2dd3f0b33ebda8a1eaf40b5))
* **server:** activate Pro League sim runner cron at boot ([#602](https://github.com/Ryxeuf/fantasy-football-game/issues/602)) ([7aa9940](https://github.com/Ryxeuf/fantasy-football-game/commit/7aa9940b0a4fdc6b1bbfe5c41ed493b649138e20)), closes [#600](https://github.com/Ryxeuf/fantasy-football-game/issues/600)
* **server:** engine version policy + replay freeze (sprint 1.A.5) ([#601](https://github.com/Ryxeuf/fantasy-football-game/issues/601)) ([7d58320](https://github.com/Ryxeuf/fantasy-football-game/commit/7d583206339eac47e91a1be894208cb987f1680d))
* **server:** Pro League bet endpoints (sprint 1.D.4) ([#617](https://github.com/Ryxeuf/fantasy-football-game/issues/617)) ([0b234a4](https://github.com/Ryxeuf/fantasy-football-game/commit/0b234a4368ed6564788bf61773af27d8921d8af0))
* **server:** Pro League bet settlement + cron (sprint 1.D.5) ([#618](https://github.com/Ryxeuf/fantasy-football-game/issues/618)) ([56ea0df](https://github.com/Ryxeuf/fantasy-football-game/commit/56ea0df47b01c517eee83c79ae89fc35f06cbbbb))
* **server:** Pro League match broadcaster (sprint 1.B.1) ([#603](https://github.com/Ryxeuf/fantasy-football-game/issues/603)) ([df0099f](https://github.com/Ryxeuf/fantasy-football-game/commit/df0099f9ce0c4c7faf3c7e94b0de8cb2dfd4b42f))
* **server:** Pro League odds calculator (sprint 1.D.3) ([#616](https://github.com/Ryxeuf/fantasy-football-game/issues/616)) ([374aed8](https://github.com/Ryxeuf/fantasy-football-game/commit/374aed8722b52aefdd14f187ac66f2aa34599253))
* **server:** Pro League scheduler service (sprint 1.A.3) ([#599](https://github.com/Ryxeuf/fantasy-football-game/issues/599)) ([29d7277](https://github.com/Ryxeuf/fantasy-football-game/commit/29d72777f9edef143ed25cdbc6ed6b0844b046d8))
* **server:** Pro League sim runner service (sprint 1.A.4) ([#600](https://github.com/Ryxeuf/fantasy-football-game/issues/600)) ([f4d440f](https://github.com/Ryxeuf/fantasy-football-game/commit/f4d440f5b92ed47dfeeb4845e9148c74f93ee84e))
* **server:** Pro League wallet rewards + endpoints (sprint 1.D.6) ([4fee8f9](https://github.com/Ryxeuf/fantasy-football-game/commit/4fee8f9d6f8f85a4fb328ecbe3108b4b913f420d))
* **server:** SSE endpoint /pro-league/matches/:id/stream (sprint 1.B.2) ([#604](https://github.com/Ryxeuf/fantasy-football-game/issues/604)) ([41adf40](https://github.com/Ryxeuf/fantasy-football-game/commit/41adf40fd36f275d30749c7d98e60efd506206a3))
* **sim-engine,db:** Replay storage + compression CBOR + gzip (sprint 1.A.2) ([#598](https://github.com/Ryxeuf/fantasy-football-game/issues/598)) ([2ebff67](https://github.com/Ryxeuf/fantasy-football-game/commit/2ebff67165ff6bf1659b601951a3d4554a23402c))
* **sim-engine:** tuning iter [#10](https://github.com/Ryxeuf/fantasy-football-game/issues/10) — engineVer 0.11.0 (breakthrough 16% + 8 Nuffle casualty events) — pause user ([#591](https://github.com/Ryxeuf/fantasy-football-game/issues/591)) ([f827440](https://github.com/Ryxeuf/fantasy-football-game/commit/f827440a1e9172d23f969f4bce20deba07861b52))
* **sim-engine:** tuning iter [#11](https://github.com/Ryxeuf/fantasy-football-game/issues/11) — engineVer 0.12.0 (breakthrough 18% + TV delta bonus → C1 5/5 ✓) ([#593](https://github.com/Ryxeuf/fantasy-football-game/issues/593)) ([0661dda](https://github.com/Ryxeuf/fantasy-football-game/commit/0661dda84ce9d05c4906eb28bdf43aa942fc596d))
* **sim-engine:** tuning iter [#12](https://github.com/Ryxeuf/fantasy-football-game/issues/12)-16 — engineVer 0.13.0 (TV recalibration → C2 atteint sur Ogres vs Halflings) ([#595](https://github.com/Ryxeuf/fantasy-football-game/issues/595)) ([10c70ed](https://github.com/Ryxeuf/fantasy-football-game/commit/10c70ed3da2118ca98b1d88f8c56998cf55b514f)), closes [#12-16](https://github.com/Ryxeuf/fantasy-football-game/issues/12-16) [#12-16](https://github.com/Ryxeuf/fantasy-football-game/issues/12-16) [#13-14](https://github.com/Ryxeuf/fantasy-football-game/issues/13-14) [#15-16](https://github.com/Ryxeuf/fantasy-football-game/issues/15-16)
* **sim-engine:** tuning iter [#6](https://github.com/Ryxeuf/fantasy-football-game/issues/6) — engineVer 0.7.0 (breakthrough 8% + nemesis_clash casualty) ([#587](https://github.com/Ryxeuf/fantasy-football-game/issues/587)) ([67e68db](https://github.com/Ryxeuf/fantasy-football-game/commit/67e68dbc2e99fc69e6cac0ef3b47876b7ed65811))
* **sim-engine:** tuning iter [#7](https://github.com/Ryxeuf/fantasy-football-game/issues/7) — engineVer 0.8.0 (breakthrough 10% + +40 vs soft D + tantrum/cocky casualties) ([#588](https://github.com/Ryxeuf/fantasy-football-game/issues/588)) ([346d6ae](https://github.com/Ryxeuf/fantasy-football-game/commit/346d6ae34051795d36cb35e1ae0b09a53ea97f2f))
* **sim-engine:** tuning iter [#8](https://github.com/Ryxeuf/fantasy-football-game/issues/8) — engineVer 0.9.0 (breakthrough 12% + crowd_riot 50% + Halflings tv 850) ([#589](https://github.com/Ryxeuf/fantasy-football-game/issues/589)) ([78c71a1](https://github.com/Ryxeuf/fantasy-football-game/commit/78c71a130b89082ca5688d450eac82d1ffc35d7f))
* **sim-engine:** tuning iter [#9](https://github.com/Ryxeuf/fantasy-football-game/issues/9) — engineVer 0.10.0 (breakthrough 14% + TV gap cap 200) — 2 matchups en cible C1 ([#590](https://github.com/Ryxeuf/fantasy-football-game/issues/590)) ([e78c68e](https://github.com/Ryxeuf/fantasy-football-game/commit/e78c68ebca09b2d15162b3486140067ce7328af4))
* **web:** Pro League Pixi field visualization (sprint 1.B.3) ([#608](https://github.com/Ryxeuf/fantasy-football-game/issues/608)) ([d49d6cb](https://github.com/Ryxeuf/fantasy-football-game/commit/d49d6cb7bdcfc8141cb06ac9d05b6523cbac8847)), closes [#606](https://github.com/Ryxeuf/fantasy-football-game/issues/606) [#606](https://github.com/Ryxeuf/fantasy-football-game/issues/606) [#606](https://github.com/Ryxeuf/fantasy-football-game/issues/606)


### 📝 Documentation

* **panel:** regenerate 50 panel replays on engineVer 0.12.0 ([#594](https://github.com/Ryxeuf/fantasy-football-game/issues/594)) ([b209e7f](https://github.com/Ryxeuf/fantasy-football-game/commit/b209e7f4e14faa3c5a2e51721fc19c810d3f3003)), closes [#11](https://github.com/Ryxeuf/fantasy-football-game/issues/11) [#11](https://github.com/Ryxeuf/fantasy-football-game/issues/11)

## [1.89.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.89.0...v1.89.1) (2026-05-06)


### 🐛 Bug Fixes

* **nav:** Soutenir en nuffle-red ([#7](https://github.com/Ryxeuf/fantasy-football-game/issues/7)A1F1F) au lieu du gris ([84b3b2f](https://github.com/Ryxeuf/fantasy-football-game/commit/84b3b2fc94ab413aa9a7b0619308ad08d3045228)), closes [#7A1F1](https://github.com/Ryxeuf/fantasy-football-game/issues/7A1F1)

## [1.89.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.88.0...v1.89.0) (2026-05-06)


### ✨ Features

* **sim-engine:** tuning iter [#4](https://github.com/Ryxeuf/fantasy-football-game/issues/4) — engineVer 0.5.0 (defensive disruption + bash /25 + breakthrough +30) ([#584](https://github.com/Ryxeuf/fantasy-football-game/issues/584)) ([6ddbda8](https://github.com/Ryxeuf/fantasy-football-game/commit/6ddbda8366aecb371f1d988ddf2f7dd521e3d97b)), closes [#3](https://github.com/Ryxeuf/fantasy-football-game/issues/3) [#5](https://github.com/Ryxeuf/fantasy-football-game/issues/5)
* **sim-engine:** tuning iter [#5](https://github.com/Ryxeuf/fantasy-football-game/issues/5) — engineVer 0.6.0 (Nuffle casualty injection + bash /28 + breakthrough 6%) ([#586](https://github.com/Ryxeuf/fantasy-football-game/issues/586)) ([c32dd11](https://github.com/Ryxeuf/fantasy-football-game/commit/c32dd11c290fc535929f4a71d1f1aa0ba5016772))


### 🐛 Bug Fixes

* **admin:** conditionne le lien Ligues au feature flag leagues_v2_ui ([f49d5ff](https://github.com/Ryxeuf/fantasy-football-game/commit/f49d5ff2a721dfe6f6b86186fb889ec0a5368a23))

## [1.88.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.87.0...v1.88.0) (2026-05-06)


### ✨ Features

* **mobile:** S27.3.11 i18n teams detail screen (FR/EN) ([#581](https://github.com/Ryxeuf/fantasy-football-game/issues/581)) ([24d71f7](https://github.com/Ryxeuf/fantasy-football-game/commit/24d71f759c66856afc3738df8244076b0f542035))
* **nav:** refonte menus principal et utilisateur (Option A) ([0012991](https://github.com/Ryxeuf/fantasy-football-game/commit/00129916f2a67e0bf8f92f4af59af510cfaddb5d))
* **sim-engine:** tuning iter [#2](https://github.com/Ryxeuf/fantasy-football-game/issues/2) — engineVer 0.3.0 (block→armor + tv per team + bash counter + fat-tails) ([#582](https://github.com/Ryxeuf/fantasy-football-game/issues/582)) ([9d987ed](https://github.com/Ryxeuf/fantasy-football-game/commit/9d987ed8819b2824cceff0a898ed7f9d182bd4db))
* **sim-engine:** tuning iter [#3](https://github.com/Ryxeuf/fantasy-football-game/issues/3) — engineVer 0.4.0 (upset metric fix + bash recalibration) ([#583](https://github.com/Ryxeuf/fantasy-football-game/issues/583)) ([759d8f5](https://github.com/Ryxeuf/fantasy-football-game/commit/759d8f56b69679950ecc6deb50e13fa57acab300)), closes [#2](https://github.com/Ryxeuf/fantasy-football-game/issues/2)

## [1.87.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.86.0...v1.87.0) (2026-05-06)


### ✨ Features

* **sim-engine:** tuning iteration [#1](https://github.com/Ryxeuf/fantasy-football-game/issues/1) — race-aware LOS + pace yards (0.E.1) ([#578](https://github.com/Ryxeuf/fantasy-football-game/issues/578)) ([9a77532](https://github.com/Ryxeuf/fantasy-football-game/commit/9a77532a66630c8a19990926b9a835b9172816c0))


### 🐛 Bug Fixes

* **admin:** add missing Ligues link in admin sidebar nav ([4612548](https://github.com/Ryxeuf/fantasy-football-game/commit/461254848114163578424211d410a7123f244f20))


### 📝 Documentation

* **pro-league:** gate Phase 0 → Phase 1 — closes Phase 0 (0.E.4) ([#580](https://github.com/Ryxeuf/fantasy-football-game/issues/580)) ([e5359f4](https://github.com/Ryxeuf/fantasy-football-game/commit/e5359f418a8f529a6dea2e51d91c1997b674244e))
* **pro-league:** kit panel BB experts (sprint 0.E.3) ([#579](https://github.com/Ryxeuf/fantasy-football-game/issues/579)) ([20ad022](https://github.com/Ryxeuf/fantasy-football-game/commit/20ad02202f815924462c4e2a9e3f4a61d2535928))

## [1.86.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.85.0...v1.86.0) (2026-05-06)


### ✨ Features

* **sim-engine:** replay sampling tool — pnpm sim:replay (0.E.2) ([349e4bb](https://github.com/Ryxeuf/fantasy-football-game/commit/349e4bb6b72c5d5c893dfa586959780452756d84))

## [1.85.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.84.0...v1.85.0) (2026-05-06)


### ✨ Features

* **admin:** petit utilitaire admin pour simuler des paires Pro League ([#576](https://github.com/Ryxeuf/fantasy-football-game/issues/576)) ([9c169f9](https://github.com/Ryxeuf/fantasy-football-game/commit/9c169f9a4ef3b77b3d241e39d9bd064cd2782c1a))
* initialize @bb/sim-engine package with public API ([#551](https://github.com/Ryxeuf/fantasy-football-game/issues/551)) ([24f7ebf](https://github.com/Ryxeuf/fantasy-football-game/commit/24f7ebfaa52475bdca1af8201b936864b6daf897))
* **mobile:** i18n auth screens (login/register) — S27.3.5 ([#562](https://github.com/Ryxeuf/fantasy-football-game/issues/562)) ([b4d4e23](https://github.com/Ryxeuf/fantasy-football-game/commit/b4d4e23a9fc9fc51a2a728f741e4db6629add05d))
* **mobile:** i18n leaderboard screen — S27.3.7 ([#565](https://github.com/Ryxeuf/fantasy-football-game/issues/565)) ([93404a2](https://github.com/Ryxeuf/fantasy-football-game/commit/93404a24d7eeeeb0e1beffe4b3f915eb0ec9efb9))
* **mobile:** i18n matchmaking screen — S27.3.6 ([#564](https://github.com/Ryxeuf/fantasy-football-game/issues/564)) ([3e13640](https://github.com/Ryxeuf/fantasy-football-game/commit/3e136405a64c258a1dca18aaaf0aa0da50504f89))
* **mobile:** i18n teams list screen — S27.3.8 ([#566](https://github.com/Ryxeuf/fantasy-football-game/issues/566)) ([bf8a3ab](https://github.com/Ryxeuf/fantasy-football-game/commit/bf8a3ab44726138b5b54fc9d07cb7ab3a3c85354))
* **mobile:** i18n teams new screen — S27.3.9 ([#567](https://github.com/Ryxeuf/fantasy-football-game/issues/567)) ([acac244](https://github.com/Ryxeuf/fantasy-football-game/commit/acac2448d79ded12891605a4a156e99ff2a4b120))
* **mobile:** S27.3.10 — script audit i18n (baseline 42 strings) ([#572](https://github.com/Ryxeuf/fantasy-football-game/issues/572)) ([09452c7](https://github.com/Ryxeuf/fantasy-football-game/commit/09452c776fe1b70199bd9b12c0dfa0ec8bc5b666))
* **mobile:** S27.3.3 i18n sub-components settings/* ([#550](https://github.com/Ryxeuf/fantasy-football-game/issues/550)) ([32105c3](https://github.com/Ryxeuf/fantasy-football-game/commit/32105c3fed1c218851730700705daecd6f573009))
* **mobile:** S27.3.4 refactor lobby.tsx + i18n lobby.* complet ([#556](https://github.com/Ryxeuf/fantasy-football-game/issues/556)) ([256fb07](https://github.com/Ryxeuf/fantasy-football-game/commit/256fb07b6029514a5a58a0016a6b0c5cfd650c52))
* **shared-types:** typed MatchEvent format with EventType catalogue (Pro League 0.A.3) ([#553](https://github.com/Ryxeuf/fantasy-football-game/issues/553)) ([7001f74](https://github.com/Ryxeuf/fantasy-football-game/commit/7001f748bb6f0458a761dd8af2f0b2f2d317eff0))
* **sim-engine:** 16 profils raciaux Pro League (0.B.3) ([#558](https://github.com/Ryxeuf/fantasy-football-game/issues/558)) ([2d348a7](https://github.com/Ryxeuf/fantasy-football-game/commit/2d348a7103e4f4b7ec5dfa21eb1d148407613135))
* **sim-engine:** BB action resolvers (block/dodge/pass/pickup/gfi/foul) — Pro League 0.A.5 ([#554](https://github.com/Ryxeuf/fantasy-football-game/issues/554)) ([84301e3](https://github.com/Ryxeuf/fantasy-football-game/commit/84301e3e55e3864b94882a500aaf9b0195423322))
* **sim-engine:** behavior tree 3-passes + 6 strategies + 5 patterns — closes lot B (0.B.1) ([#561](https://github.com/Ryxeuf/fantasy-football-game/issues/561)) ([f3826ce](https://github.com/Ryxeuf/fantasy-football-game/commit/f3826ce2f4f95271f6162c6794df04dad8bc9310))
* **sim-engine:** bibliothèque Eye of Nuffle (28 events scriptés) (0.C.1) ([#563](https://github.com/Ryxeuf/fantasy-football-game/issues/563)) ([14874a7](https://github.com/Ryxeuf/fantasy-football-game/commit/14874a7bd8b92d74c985d7ed797ee05439167ab6))
* **sim-engine:** CI bench regression gate — closes lot D (0.D.4) ([#575](https://github.com/Ryxeuf/fantasy-football-game/issues/575)) ([edc7d13](https://github.com/Ryxeuf/fantasy-football-game/commit/edc7d1300f96c4bbbf1d71a178b5ed17a1137c24))
* **sim-engine:** CLI pnpm sim:bench (runner + formatter + report) (0.D.1) ([#574](https://github.com/Ryxeuf/fantasy-football-game/issues/574)) ([4f5a139](https://github.com/Ryxeuf/fantasy-football-game/commit/4f5a139b2e2cd820e7f7a6de48169152c83eafc0))
* **sim-engine:** cross-match PlayerForm avec decay sur 3 matchs — closes lot C (0.C.4) ([#570](https://github.com/Ryxeuf/fantasy-football-game/issues/570)) ([9d2c10f](https://github.com/Ryxeuf/fantasy-football-game/commit/9d2c10fc06143dbd0c398bc6bffd3a017e31d564))
* **sim-engine:** dataset référence FUMBBL versionné (0.D.2) ([#573](https://github.com/Ryxeuf/fantasy-football-game/issues/573)) ([ffcaa5b](https://github.com/Ryxeuf/fantasy-football-game/commit/ffcaa5bb9cc2972fb0c58ec8f80401a4800a16d0))
* **sim-engine:** hooks injection Nuffle events dans le driver (0.C.2) ([#568](https://github.com/Ryxeuf/fantasy-football-game/issues/568)) ([4a9cc84](https://github.com/Ryxeuf/fantasy-football-game/commit/4a9cc84083e53becd0abd116ce31503b205a4d4d))
* **sim-engine:** hybrid driver — closes lot A (Pro League 0.A.2) ([#555](https://github.com/Ryxeuf/fantasy-football-game/issues/555)) ([3d1f817](https://github.com/Ryxeuf/fantasy-football-game/commit/3d1f817ab4cf8c4769b7fc2ea1aad65866048f9f))
* **sim-engine:** IA temperature softmax pilotée par riskAppetite (0.B.5) ([#559](https://github.com/Ryxeuf/fantasy-football-game/issues/559)) ([dbd480d](https://github.com/Ryxeuf/fantasy-football-game/commit/dbd480d7dbb31e366d3690e253b82d3496c09f2a))
* **sim-engine:** métriques vivacité (variance, fat-tails, Gini, upset rate) (0.D.3) ([#571](https://github.com/Ryxeuf/fantasy-football-game/issues/571)) ([6fdbdd3](https://github.com/Ryxeuf/fantasy-football-game/commit/6fdbdd36f70df63346f6f9a03c60b1a014b35539))
* **sim-engine:** per-player momentum tracker hot/normal/cold (0.B.4) ([#560](https://github.com/Ryxeuf/fantasy-football-game/issues/560)) ([f554007](https://github.com/Ryxeuf/fantasy-football-game/commit/f554007b03fed38962f05e9ed21cecfd9da47864))
* **sim-engine:** seeded xoroshiro PRNG + ban Math.random (Pro League 0.A.4) ([#552](https://github.com/Ryxeuf/fantasy-football-game/issues/552)) ([b8d64d9](https://github.com/Ryxeuf/fantasy-football-game/commit/b8d64d9f9636b3b87b724849b3f1e7005ed87a4a))
* **sim-engine:** TacticalProfile + Zod schema (Pro League 0.B.2) ([#557](https://github.com/Ryxeuf/fantasy-football-game/issues/557)) ([97f619a](https://github.com/Ryxeuf/fantasy-football-game/commit/97f619a17bf6e8f9951d09caae11daeaca65cbd4))
* **sim-engine:** underdog variance boost (TV gap > 200, +10%) (0.C.3) ([#569](https://github.com/Ryxeuf/fantasy-football-game/issues/569)) ([0214c90](https://github.com/Ryxeuf/fantasy-football-game/commit/0214c9036e5bf1405bd04175667ac41858e9ec03))


### 🐛 Bug Fixes

* **docker:** add sim-engine and shared-types package.json to server Dockerfile ([c4b68d5](https://github.com/Ryxeuf/fantasy-football-game/commit/c4b68d54a65a1e9f393fc9497ddced33e51ed8d1))


### 📝 Documentation

* archive Ligues v2 optional extensions to future-ideas ([#549](https://github.com/Ryxeuf/fantasy-football-game/issues/549)) ([b636634](https://github.com/Ryxeuf/fantasy-football-game/commit/b636634b605311515934808a10820fbc8e68b73b))

## [1.84.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.83.0...v1.84.0) (2026-05-05)


### ✨ Features

* Add admin leagues management console (L2.C.6) ([#544](https://github.com/Ryxeuf/fantasy-football-game/issues/544)) ([9fc74cf](https://github.com/Ryxeuf/fantasy-football-game/commit/9fc74cfe2c609801a4ee6c9ea8ecb135ee3d8aa8))


### 📝 Documentation

* add new sprints for leagues v2 and Pro League ([a2f93e5](https://github.com/Ryxeuf/fantasy-football-game/commit/a2f93e5191e62886cde89f397428d0e61899895e))
* add Pro League sprint and future ideas backlog ([#547](https://github.com/Ryxeuf/fantasy-football-game/issues/547)) ([bf1e313](https://github.com/Ryxeuf/fantasy-football-game/commit/bf1e3136009c150e13a6a36b683964e3c4fcad08))
* Update TODO roadmap — Ligues v2 sprint completion ([#546](https://github.com/Ryxeuf/fantasy-football-game/issues/546)) ([29329b1](https://github.com/Ryxeuf/fantasy-football-game/commit/29329b1fb5bdbe491ecde0b9b258d018e04e61b1))

## [1.83.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.82.0...v1.83.0) (2026-05-05)


### ✨ Features

* **server:** update skill descriptions for Season 3 in French and English ([781538c](https://github.com/Ryxeuf/fantasy-football-game/commit/781538c1212beb54fd327edd69ca75e3038832f3))

## [1.82.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.81.0...v1.82.0) (2026-05-04)


### ✨ Features

* Add player advancement UI (level-up page & banner) ([#539](https://github.com/Ryxeuf/fantasy-football-game/issues/539)) ([9c53949](https://github.com/Ryxeuf/fantasy-football-game/commit/9c53949223334cd80a109442aab8fa292abf820b))
* **leagues:** PR6 Bagarreurs Brutaux override + integration tests (L2.B.8-B.9) ([238fdd2](https://github.com/Ryxeuf/fantasy-football-game/commit/238fdd2534181ced6fa5fae02f41e6cb307e76a7))

## [1.81.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.80.0...v1.81.0) (2026-05-04)


### ✨ Features

* **coach-profile:** CoachEloChart inline SVG curve on /coach/{slug} (S26.3n) ([#511](https://github.com/Ryxeuf/fantasy-football-game/issues/511)) ([4d4189b](https://github.com/Ryxeuf/fantasy-football-game/commit/4d4189b9de4a002dbbd2757c7eb9ed19b649b96d))
* **coach-profile:** export PDF coach-card on /coach/{slug} (S26.3o, closes S26.3) ([#512](https://github.com/Ryxeuf/fantasy-football-game/issues/512)) ([9c15be7](https://github.com/Ryxeuf/fantasy-football-game/commit/9c15be7471599945aad25d6bf78fb793b25ff2e3))
* **coach-profile:** monthly Nuffle Cup champion badge backend (S27.1d) ([#524](https://github.com/Ryxeuf/fantasy-football-game/issues/524)) ([a522898](https://github.com/Ryxeuf/fantasy-football-game/commit/a5228983ec137ea656ac868119c3374bd85009e0))
* **coach-profile:** monthly Nuffle Cup champion badge UI (S27.1e) ([#525](https://github.com/Ryxeuf/fantasy-football-game/issues/525)) ([8f6fd09](https://github.com/Ryxeuf/fantasy-football-game/commit/8f6fd09b2fe39f90291993909826084750971175))
* **coach-profile:** themed championships badge backend (S26.6d) ([#517](https://github.com/Ryxeuf/fantasy-football-game/issues/517)) ([4121c71](https://github.com/Ryxeuf/fantasy-football-game/commit/4121c71c5a1d2ee90db0de741da6efb652999a45))
* **coach-profile:** themed championships UI banner on /coach/[slug] (S26.6e) ([#518](https://github.com/Ryxeuf/fantasy-football-game/issues/518)) ([2188dd0](https://github.com/Ryxeuf/fantasy-football-game/commit/2188dd0b8f01be439f2b5b8fb3b689709d627260))
* **cups:** admin can create monthly Nuffle Cups via POST /cup (S27.1i) ([#529](https://github.com/Ryxeuf/fantasy-football-game/issues/529)) ([81d5330](https://github.com/Ryxeuf/fantasy-football-game/commit/81d533041d635c0bfe171e67530be177bb144016))
* **cups:** admin pick endpoint for match-of-the-week (S27.1g) ([#527](https://github.com/Ryxeuf/fantasy-football-game/issues/527)) ([3ff1616](https://github.com/Ryxeuf/fantasy-football-game/commit/3ff16164c057406baabfce45b3d142b73431e6fc))
* **cups:** match-of-the-week public read foundation (S27.1f) ([#526](https://github.com/Ryxeuf/fantasy-football-game/issues/526)) ([443ab4a](https://github.com/Ryxeuf/fantasy-football-game/commit/443ab4adcedd306494e3215e04b80b6358e59225))
* **cups:** match-of-the-week UI banner on /cups/monthly (S27.1h) ([#528](https://github.com/Ryxeuf/fantasy-football-game/issues/528)) ([88282dd](https://github.com/Ryxeuf/fantasy-football-game/commit/88282dd21bb4712f888aecd9527e2377df8ce793))
* **cups:** monthly Nuffle Cup slot foundation (S27.1a) ([#521](https://github.com/Ryxeuf/fantasy-football-game/issues/521)) ([6f05ed6](https://github.com/Ryxeuf/fantasy-football-game/commit/6f05ed61bb2ee797f01aac43feaf9ccdf64de2ed))
* **cups:** public listing of monthly Nuffle Cups (S27.1b) ([#522](https://github.com/Ryxeuf/fantasy-football-game/issues/522)) ([3137070](https://github.com/Ryxeuf/fantasy-football-game/commit/31370706c0c5fd68412caa1f15364d6c0dc1aa34))
* **cups:** public monthly Nuffle Cup calendar UI /cups/monthly (S27.1c) ([#523](https://github.com/Ryxeuf/fantasy-football-game/issues/523)) ([d2258c3](https://github.com/Ryxeuf/fantasy-football-game/commit/d2258c36ea1a8abef6e20b49e73f17855d2869a4))
* **cups:** visual bracket view on /cups/[id] (S27.1j, closes S27.1) ([#530](https://github.com/Ryxeuf/fantasy-football-game/issues/530)) ([6339e34](https://github.com/Ryxeuf/fantasy-football-game/commit/6339e34ab66a51422034f16656273c0125b74a3c))
* **leagues:** PR2 UI — flag-gated UI for league management (L2.A.6-A.10) ([13ba0e0](https://github.com/Ryxeuf/fantasy-football-game/commit/13ba0e0034455a12e87c1d73f3b2275af155300b))
* **leagues:** seasonal themes foundation on LeagueSeason (S26.6a) ([#514](https://github.com/Ryxeuf/fantasy-football-game/issues/514)) ([e9b1825](https://github.com/Ryxeuf/fantasy-football-game/commit/e9b18259aa6480342cd5446cb8e294de7de6e0de))
* **leagues:** theme read endpoints + season creation propagation (S26.6b) ([#515](https://github.com/Ryxeuf/fantasy-football-game/issues/515)) ([c547ba9](https://github.com/Ryxeuf/fantasy-football-game/commit/c547ba96ec364caa3131d1b91e112a4358e618fb))
* **leagues:** themed season closure hook (S26.6f, closes S26.6) ([#519](https://github.com/Ryxeuf/fantasy-football-game/issues/519)) ([f7cc242](https://github.com/Ryxeuf/fantasy-football-game/commit/f7cc2429d56a88d0a8c94bcb95a4b4924ddabe68))
* **leagues:** themed seasons calendar UI /leagues/seasons (S26.6c) ([#516](https://github.com/Ryxeuf/fantasy-football-game/issues/516)) ([2ae09fd](https://github.com/Ryxeuf/fantasy-football-game/commit/2ae09fdaf9e2c2e3335fcccce6cc3e2796ba3dab))
* **mobile:** i18n foundation (FR/EN) without external dep (S27.3.1) ([#533](https://github.com/Ryxeuf/fantasy-football-game/issues/533)) ([201bc6e](https://github.com/Ryxeuf/fantasy-football-game/commit/201bc6ec3689999691ab89e02862b9aa4bb99b41))
* **mobile:** integrate Throw Team-Mate flow on play screen (S27.2.2, closes S27.2) ([#532](https://github.com/Ryxeuf/fantasy-football-game/issues/532)) ([666dde2](https://github.com/Ryxeuf/fantasy-football-game/commit/666dde2ac357a464c54938bf223f5c4680cc23eb))
* **mobile:** port Throw Team-Mate click helper foundation (S27.2.1) ([#531](https://github.com/Ryxeuf/fantasy-football-game/issues/531)) ([3e1a878](https://github.com/Ryxeuf/fantasy-football-game/commit/3e1a8781d5ff1caf0f80eab76459a6768d212089))
* **mobile:** useTranslation hook + i18n settings.tsx (S27.3.2) ([#534](https://github.com/Ryxeuf/fantasy-football-game/issues/534)) ([2d183c7](https://github.com/Ryxeuf/fantasy-football-game/commit/2d183c750deea5a83e81a4a0877f4cc6b463ee4b))
* **notifications:** friend-match-started notification + user pref (S26.5) ([#513](https://github.com/Ryxeuf/fantasy-football-game/issues/513)) ([bc3f4fb](https://github.com/Ryxeuf/fantasy-football-game/commit/bc3f4fb071bcef6fc28ead1a28485720d455a9e7))
* **s3-data:** apply OCR-canonical Saison 3 data (skills, special rules, leagues) ([#510](https://github.com/Ryxeuf/fantasy-football-game/issues/510)) ([379e14e](https://github.com/Ryxeuf/fantasy-football-game/commit/379e14ed573023140ec91a3b083f465536ff1cce))


### 🐛 Bug Fixes

* **leagues:** mirror LeaguePairing model + Match league fields in SQLite schema ([8075999](https://github.com/Ryxeuf/fantasy-football-game/commit/807599932387cd875c567473f74daf0fe31246b7)), closes [#536](https://github.com/Ryxeuf/fantasy-football-game/issues/536)


### 📝 Documentation

* **roadmap:** S26 termine ([#520](https://github.com/Ryxeuf/fantasy-football-game/issues/520)) ([8fa8747](https://github.com/Ryxeuf/fantasy-football-game/commit/8fa8747be43b9231072bbb28b5a52890b515582c))

## [1.80.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.79.0...v1.80.0) (2026-04-30)


### ✨ Features

* **extraction:** add OCR transcriptions for Blood Bowl rules, skills, and traits ([7ff9a48](https://github.com/Ryxeuf/fantasy-football-game/commit/7ff9a4811ac19ac004ca5fb111d88e8230bc143e))
* **friends:** listAcceptedFriendIds helper (S26.5b) ([#508](https://github.com/Ryxeuf/fantasy-football-game/issues/508)) ([26c2fb8](https://github.com/Ryxeuf/fantasy-football-game/commit/26c2fb8689e22d756ead743640e8a6054d5ce853))

## [1.79.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.78.0...v1.79.0) (2026-04-29)


### ✨ Features

* **coach-profile:** EloSnapshot model + persist on match end (S26.3l) ([#503](https://github.com/Ryxeuf/fantasy-football-game/issues/503)) ([5b31753](https://github.com/Ryxeuf/fantasy-football-game/commit/5b3175304377a1cad3e8298af6ef98d3a9fa7645))
* **coach-profile:** GET /coach/:slug/elo-history endpoint (S26.3m) ([#507](https://github.com/Ryxeuf/fantasy-football-game/issues/507)) ([a642614](https://github.com/Ryxeuf/fantasy-football-game/commit/a642614bb20459014c83493473c8265c976e9bb4))
* **friends:** suggestFriendsByElo + /friends/suggestions route (S26.5a) ([a20212c](https://github.com/Ryxeuf/fantasy-football-game/commit/a20212c06f60599210b51b582214a25e5743e4de))

## [1.78.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.77.1...v1.78.0) (2026-04-29)


### ✨ Features

* **achievements:** celebration banner + NEW badge on lazy unlock (S26.2b) ([#487](https://github.com/Ryxeuf/fantasy-football-game/issues/487)) ([7a82a93](https://github.com/Ryxeuf/fantasy-football-game/commit/7a82a932a18daddeef726ff082f6325dce2127f6))
* **achievements:** expose newlyUnlocked slugs on lazy read (S26.2a) ([#486](https://github.com/Ryxeuf/fantasy-football-game/issues/486)) ([a5ef07c](https://github.com/Ryxeuf/fantasy-football-game/commit/a5ef07c0ffbcbe351cae476c981c2d5b7aa83df4))
* **achievements:** match-end celebration panel + CTA (S26.2c) ([#488](https://github.com/Ryxeuf/fantasy-football-game/issues/488)) ([705890c](https://github.com/Ryxeuf/fantasy-football-game/commit/705890cad24d17a1b7581ca1423695a6a51d2035))
* **coach-profile:** coach-slug derivation utility (S26.3a) ([#489](https://github.com/Ryxeuf/fantasy-football-game/issues/489)) ([f56e0b1](https://github.com/Ryxeuf/fantasy-football-game/commit/f56e0b14aa0d117973d878c5753e515e95272272))
* **coach-profile:** getCoachPublicProfile service (S26.3b) ([#490](https://github.com/Ryxeuf/fantasy-football-game/issues/490)) ([4683021](https://github.com/Ryxeuf/fantasy-football-game/commit/4683021c229dd0ba899693969adc2355a38680ff))
* **coach-profile:** list public coach slugs + sitemap integration (S26.3g) ([#495](https://github.com/Ryxeuf/fantasy-football-game/issues/495)) ([2043fba](https://github.com/Ryxeuf/fantasy-football-game/commit/2043fbaa9aa0b94fa1f48bbf11a0549912c9d6c2))
* **coach-profile:** privacy toggle endpoint + GET /me exposes privateProfile (S26.3j) ([#498](https://github.com/Ryxeuf/fantasy-football-game/issues/498)) ([5a4d458](https://github.com/Ryxeuf/fantasy-football-game/commit/5a4d458b94454dd51b72ce9292cb1b97b0cddb61))
* **coach-profile:** private profile toggle on /me/profile (S26.3k) ([#499](https://github.com/Ryxeuf/fantasy-football-game/issues/499)) ([8ae376d](https://github.com/Ryxeuf/fantasy-football-game/commit/8ae376d98b57600c99b8fd2a9f39959c79bfed46))
* **coach-profile:** public /coach/[slug] page with header (S26.3d) ([#492](https://github.com/Ryxeuf/fantasy-football-game/issues/492)) ([cf60824](https://github.com/Ryxeuf/fantasy-football-game/commit/cf60824c74720f4b8afd593d414b8d3c338828ff))
* **coach-profile:** public GET /coach/:slug route (S26.3c) ([#491](https://github.com/Ryxeuf/fantasy-football-game/issues/491)) ([8452cd4](https://github.com/Ryxeuf/fantasy-football-game/commit/8452cd47391a3d1be448fc276ca3683da4454559))
* **coach-profile:** recent teams section (S26.3h) ([#496](https://github.com/Ryxeuf/fantasy-football-game/issues/496)) ([7cc640d](https://github.com/Ryxeuf/fantasy-football-game/commit/7cc640de0052aa68c8ff3ac35374dfdfa0af2721))
* **coach-profile:** RGPD private profile opt-in (S26.3i) ([#497](https://github.com/Ryxeuf/fantasy-football-game/issues/497)) ([c5c747b](https://github.com/Ryxeuf/fantasy-football-game/commit/c5c747bc8b142223aa32edaf8e30cc748bc1b55e))
* **coach-profile:** showcase achievements service (S26.3e) ([#493](https://github.com/Ryxeuf/fantasy-football-game/issues/493)) ([bf451c4](https://github.com/Ryxeuf/fantasy-football-game/commit/bf451c447551a984591ec577061102c1c5170ca6))
* **coach-profile:** wire showcase achievements end-to-end (S26.3f) ([#494](https://github.com/Ryxeuf/fantasy-football-game/issues/494)) ([b6100c3](https://github.com/Ryxeuf/fantasy-football-game/commit/b6100c38c46d4e25aaefed779f483018b3a08eea))
* **friends:** autocomplete search endpoint /friends/search (S26.4c) ([#502](https://github.com/Ryxeuf/fantasy-football-game/issues/502)) ([5d11532](https://github.com/Ryxeuf/fantasy-football-game/commit/5d11532c38e128c6f917628982e2ef50c449ff1e))
* **friends:** findUserByCoachName resolver for [@username](https://github.com/username) (S26.4a) ([#500](https://github.com/Ryxeuf/fantasy-football-game/issues/500)) ([41f75dc](https://github.com/Ryxeuf/fantasy-football-game/commit/41f75dca96b76212170394bdfb0e820cc2f1ef35))
* **friends:** FriendUsernameAutocomplete reusable component (S26.4d) ([f235ba0](https://github.com/Ryxeuf/fantasy-football-game/commit/f235ba0785c531ec3c781e23445f520587dd9288))
* **friends:** POST /friends accepts {username} via @-resolver (S26.4b) ([#501](https://github.com/Ryxeuf/fantasy-football-game/issues/501)) ([65c87ef](https://github.com/Ryxeuf/fantasy-football-game/commit/65c87efeb7af709c3112c3344ecb91346ccd1415))
* **tutoriel:** badge unlock + completion timestamp (S26.1a) ([#483](https://github.com/Ryxeuf/fantasy-football-game/issues/483)) ([9fc2f9f](https://github.com/Ryxeuf/fantasy-football-game/commit/9fc2f9fa44594d8f7248dba3467334d186ae1d68))
* **tutoriel:** global XP progression bar on listing page (S26.1c) ([#485](https://github.com/Ryxeuf/fantasy-football-game/issues/485)) ([485ecbf](https://github.com/Ryxeuf/fantasy-football-game/commit/485ecbf2deb37e9d2a96f5f40673ae36000d78b6))
* **tutoriel:** recommended teams panel after completion (S26.1b) ([#484](https://github.com/Ryxeuf/fantasy-football-game/issues/484)) ([690ee21](https://github.com/Ryxeuf/fantasy-football-game/commit/690ee21d0dc26c044624d1bb40f267b854627de6))


### ♻️ Code Refactoring

* **match:** migrate POST /:id/move to ApiResponse (S25.5m) ([#436](https://github.com/Ryxeuf/fantasy-football-game/issues/436)) ([37cfa76](https://github.com/Ryxeuf/fantasy-football-game/commit/37cfa764a8577b23fb5bd5f24631cd7b80b5647b))
* **play:** extract BlockingOverlays + MatchOverlays (S26.0x, DoD < 600 lignes ATTEINT) ([#482](https://github.com/Ryxeuf/fantasy-football-game/issues/482)) ([b1aad8e](https://github.com/Ryxeuf/fantasy-football-game/commit/b1aad8e8d8f18a79c112630db9ef20c8aab69351))
* **play:** extract BoardSection (S26.0v, ~70 lignes restantes vers 600) ([#480](https://github.com/Ryxeuf/fantasy-football-game/issues/480)) ([8226298](https://github.com/Ryxeuf/fantasy-football-game/commit/82262980acce5ec839810d0c43a19d3c3cc3be5d))
* **play:** extract ChoicePopups (5 popups, -121 lignes) (S26.0u) ([#479](https://github.com/Ryxeuf/fantasy-football-game/issues/479)) ([520f8bc](https://github.com/Ryxeuf/fantasy-football-game/commit/520f8bcaf07a6d34100d2b91fcd76f021ca1e766))
* **play:** extract getAvailableActions util (S26.0j) ([#468](https://github.com/Ryxeuf/fantasy-football-game/issues/468)) ([a5fc76c](https://github.com/Ryxeuf/fantasy-football-game/commit/a5fc76c9b30746d68f6459ffc7a0d24967a692eb))
* **play:** extract handleBlockClick branch (S26.0r) ([#476](https://github.com/Ryxeuf/fantasy-football-game/issues/476)) ([004cebe](https://github.com/Ryxeuf/fantasy-football-game/commit/004cebe3766f5564b30734d15270150fd5e43ee6))
* **play:** extract handleMoveClick branch (S26.0s) ([#477](https://github.com/Ryxeuf/fantasy-football-game/issues/477)) ([aaf8c9b](https://github.com/Ryxeuf/fantasy-football-game/commit/aaf8c9b33f5552c912508f4c65c7fcc80bcefb14))
* **play:** extract handlePlayerClick util (S26.0m) ([#471](https://github.com/Ryxeuf/fantasy-football-game/issues/471)) ([5bae69f](https://github.com/Ryxeuf/fantasy-football-game/commit/5bae69f5b6368b9717d556a7412178eea6a6103d))
* **play:** extract handleSetupCellClick branch (S26.0p) ([#474](https://github.com/Ryxeuf/fantasy-football-game/issues/474)) ([5b1fa3d](https://github.com/Ryxeuf/fantasy-football-game/commit/5b1fa3d11cfdfc59bbbbc3e9005f70b427da5b26))
* **play:** extract handleSetupDragStart util (S26.0n) ([#472](https://github.com/Ryxeuf/fantasy-football-game/issues/472)) ([2d47f96](https://github.com/Ryxeuf/fantasy-football-game/commit/2d47f9658d1f42a7a5d3530b3d5b0c7f38a06279))
* **play:** extract handleSetupDrop util (S26.0o, < 1000 lignes) ([#473](https://github.com/Ryxeuf/fantasy-football-game/issues/473)) ([2ad6815](https://github.com/Ryxeuf/fantasy-football-game/commit/2ad6815e1a2db8d64d74cbce7515efbe37574e5f))
* **play:** extract handleThrowTeamMateClick branch (S26.0q) ([#475](https://github.com/Ryxeuf/fantasy-football-game/issues/475)) ([57a317c](https://github.com/Ryxeuf/fantasy-football-game/commit/57a317c7881b4b2f17c58ef83f47727f070334c3))
* **play:** extract InducementsPhaseUI + normalizeState (S26.0a) ([#458](https://github.com/Ryxeuf/fantasy-football-game/issues/458)) ([5f20c18](https://github.com/Ryxeuf/fantasy-football-game/commit/5f20c18dfde984f94ffa843b6dde225dced76417))
* **play:** extract InGameListeners components (S26.0b) ([#459](https://github.com/Ryxeuf/fantasy-football-game/issues/459)) ([8f09130](https://github.com/Ryxeuf/fantasy-football-game/commit/8f09130616b79e3805041b902e6ed08f83db4a15))
* **play:** extract kickoff-actions API helpers (S26.0d) ([#461](https://github.com/Ryxeuf/fantasy-football-game/issues/461)) ([c57d63d](https://github.com/Ryxeuf/fantasy-football-game/commit/c57d63dbcc68f92fb9f0b6334e0c5c8a85daf2eb))
* **play:** extract KickoffSequencePanel component (S26.0g) ([#464](https://github.com/Ryxeuf/fantasy-football-game/issues/464)) ([ac110d2](https://github.com/Ryxeuf/fantasy-football-game/commit/ac110d25c20154669328f31af933e49e0369e8e8))
* **play:** extract MatchLogAndSpp section (S26.0w, ~46 lignes restantes) ([#481](https://github.com/Ryxeuf/fantasy-football-game/issues/481)) ([2de06fc](https://github.com/Ryxeuf/fantasy-football-game/commit/2de06fc1f3a1bb972ff86bc1fdcd74af3b6f1523))
* **play:** extract PlayerActivationBar component (S26.0k) ([#469](https://github.com/Ryxeuf/fantasy-football-game/issues/469)) ([e999733](https://github.com/Ryxeuf/fantasy-football-game/commit/e9997334866648f776b48cb08129c50c89821a14))
* **play:** extract PreMatchPanel composite (S26.0t, > 50% reduction) ([#478](https://github.com/Ryxeuf/fantasy-football-game/issues/478)) ([9c07ebd](https://github.com/Ryxeuf/fantasy-football-game/commit/9c07ebd9af52f139c74d3a07beef8f046f784dc4))
* **play:** extract setup-validation utils (S26.0c) ([#460](https://github.com/Ryxeuf/fantasy-football-game/issues/460)) ([1f7d167](https://github.com/Ryxeuf/fantasy-football-game/commit/1f7d16710bc01ecbaa8d140b645b0b6ab6371ee5))
* **play:** extract SetupPhasePanel component (S26.0h) ([#465](https://github.com/Ryxeuf/fantasy-football-game/issues/465)) ([02304b0](https://github.com/Ryxeuf/fantasy-football-game/commit/02304b04c79b06239409ea956f3ec7cbc668f947))
* **play:** extract ThrowTeamMateIndicator + applyOrSubmitMove (S26.0i) ([#467](https://github.com/Ryxeuf/fantasy-football-game/issues/467)) ([6dd4f25](https://github.com/Ryxeuf/fantasy-football-game/commit/6dd4f25e53d4410ce0d772d1fbba4c0b8372a20e))
* **play:** extract TopStatusBanners components (S26.0l) ([#470](https://github.com/Ryxeuf/fantasy-football-game/issues/470)) ([1318e23](https://github.com/Ryxeuf/fantasy-football-game/commit/1318e236bb2d32643408d1c9d4a29f032213ea3b))
* **play:** extract validateSetupPlacement helper (S26.0e) ([#462](https://github.com/Ryxeuf/fantasy-football-game/issues/462)) ([e184241](https://github.com/Ryxeuf/fantasy-football-game/commit/e184241945eadc8804e477b22d0869ad0a9ad7cc))
* **play:** introduce LegalAction, eliminate all 13 as any (S26.0f) ([#463](https://github.com/Ryxeuf/fantasy-football-game/issues/463)) ([13927ca](https://github.com/Ryxeuf/fantasy-football-game/commit/13927cab58857b346d8e62201c426123e9edaf9f))
* **team:** migrate /name-generator + /rosters/:id to ApiResponse (S25.5n) ([#438](https://github.com/Ryxeuf/fantasy-football-game/issues/438)) ([6035edd](https://github.com/Ryxeuf/fantasy-football-game/commit/6035eddb01bfd719f6f1a6c1619f8b718b971c26))
* **team:** migrate /team/:id/available-positions to ApiResponse (S25.5s) ([#444](https://github.com/Ryxeuf/fantasy-football-game/issues/444)) ([67f3e70](https://github.com/Ryxeuf/fantasy-football-game/commit/67f3e701736460c98c729350ba540641e5e20e9e))
* **team:** migrate /team/:id/recalculate to ApiResponse (S25.5r) ([#443](https://github.com/Ryxeuf/fantasy-football-game/issues/443)) ([c75e912](https://github.com/Ryxeuf/fantasy-football-game/commit/c75e9129f1318c774807f8edc293fa34107322f7))
* **team:** migrate /team/:id/star-players to ApiResponse (S25.5q) ([#442](https://github.com/Ryxeuf/fantasy-football-game/issues/442)) ([4a3ab30](https://github.com/Ryxeuf/fantasy-football-game/commit/4a3ab30cd69c0c9cb554fd6178c8e576d09912b9))
* **team:** migrate /team/available to ApiResponse (S25.5o) ([#440](https://github.com/Ryxeuf/fantasy-football-game/issues/440)) ([3400d79](https://github.com/Ryxeuf/fantasy-football-game/commit/3400d79d151faee5658a17d234de7a093431ef17))
* **team:** migrate /team/mine paginated to ApiResponse (S25.5p) ([#441](https://github.com/Ryxeuf/fantasy-football-game/issues/441)) ([803414d](https://github.com/Ryxeuf/fantasy-football-game/commit/803414df8f6c2d1818fce6b95cb31008574cc3bc))
* **team:** migrate DELETE /:id/players/:playerId to ApiResponse (S25.5t) ([#445](https://github.com/Ryxeuf/fantasy-football-game/issues/445)) ([143e44c](https://github.com/Ryxeuf/fantasy-football-game/commit/143e44c13f833dbf5fc0df868c8a68dcab315f07))
* **team:** migrate DELETE /:id/star-players/:starPlayerId to ApiResponse (S25.5v) ([#448](https://github.com/Ryxeuf/fantasy-football-game/issues/448)) ([e6fd151](https://github.com/Ryxeuf/fantasy-football-game/commit/e6fd151a0c65808b0c3e66c8e8622b8ba7046837))
* **team:** migrate GET /:id/available-star-players to ApiResponse (S25.5aa) ([#453](https://github.com/Ryxeuf/fantasy-football-game/issues/453)) ([729abe2](https://github.com/Ryxeuf/fantasy-football-game/commit/729abe211654c4e5fe4da9aa6f6f7e2d169831f3))
* **team:** migrate GET /team/:id + close S25.5 + S25 TERMINE (S25.5ae) ([#457](https://github.com/Ryxeuf/fantasy-football-game/issues/457)) ([76020a2](https://github.com/Ryxeuf/fantasy-football-game/commit/76020a2474d4f284e2686a000bb13a6c399e7e6d))
* **team:** migrate POST /:id/players to ApiResponse (S25.5z) ([#452](https://github.com/Ryxeuf/fantasy-football-game/issues/452)) ([4e4caeb](https://github.com/Ryxeuf/fantasy-football-game/commit/4e4caeb79fa9e95deccb7a4865c1935060f380fb))
* **team:** migrate POST /:id/purchase to ApiResponse (S25.5w) ([#449](https://github.com/Ryxeuf/fantasy-football-game/issues/449)) ([482b383](https://github.com/Ryxeuf/fantasy-football-game/commit/482b3831026f797508adc2e05b76e140024179dd))
* **team:** migrate POST /:id/star-players to ApiResponse (S25.5ab) ([#454](https://github.com/Ryxeuf/fantasy-football-game/issues/454)) ([a81f171](https://github.com/Ryxeuf/fantasy-football-game/commit/a81f171589e0731e0e16d8eb9201d4ea423c9acb))
* **team:** migrate POST /team/build to ApiResponse (S25.5ad) ([#456](https://github.com/Ryxeuf/fantasy-football-game/issues/456)) ([c4d1818](https://github.com/Ryxeuf/fantasy-football-game/commit/c4d1818821143a4c44ad2d20ccb0fd53165318ce))
* **team:** migrate POST /team/choose to ApiResponse (S25.5x) ([#450](https://github.com/Ryxeuf/fantasy-football-game/issues/450)) ([058549e](https://github.com/Ryxeuf/fantasy-football-game/commit/058549e518095bf4a38930e27b2f64ae378e8701))
* **team:** migrate PUT /:id/info to ApiResponse (S25.5u) ([#447](https://github.com/Ryxeuf/fantasy-football-game/issues/447)) ([2d82393](https://github.com/Ryxeuf/fantasy-football-game/commit/2d823930f91b838ca92c6108b6725110411ee3b0))
* **team:** migrate PUT /:id/players/:playerId/skills to ApiResponse (S25.5ac) ([#455](https://github.com/Ryxeuf/fantasy-football-game/issues/455)) ([439d127](https://github.com/Ryxeuf/fantasy-football-game/commit/439d12798fd14bec5f003edf4beafefb50129373))
* **team:** migrate PUT /team/:id to ApiResponse (S25.5y) ([#451](https://github.com/Ryxeuf/fantasy-football-game/issues/451)) ([847886c](https://github.com/Ryxeuf/fantasy-football-game/commit/847886ca395b500b524698aed6c3a32f299ff018))

## [1.77.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.77.0...v1.77.1) (2026-04-28)


### 🐛 Bug Fixes

* **server,engine:** adapt setup checks to placeable count below 11 ([ca714eb](https://github.com/Ryxeuf/fantasy-football-game/commit/ca714eb71e7e7787007ad1d1431fc640be17bf89))


### ♻️ Code Refactoring

* **match:** migrate /:id/state to ApiResponse (S25.5l) ([#435](https://github.com/Ryxeuf/fantasy-football-game/issues/435)) ([a8074c1](https://github.com/Ryxeuf/fantasy-football-game/commit/a8074c177dcd3057290ae1168959aa03c742a492))

## [1.77.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.76.3...v1.77.0) (2026-04-28)


### ✨ Features

* **auth:** wire access+refresh rotation into login/register/logout (S24.3e) ([#431](https://github.com/Ryxeuf/fantasy-football-game/issues/431)) ([e1758f9](https://github.com/Ryxeuf/fantasy-football-game/commit/e1758f9b587612ada018abf268c2a6ee4e751c60))


### 🐛 Bug Fixes

* keep KO/sent-off/casualty out of post-TD setup, allow validate <11 ([0a83053](https://github.com/Ryxeuf/fantasy-football-game/commit/0a8305324fddd386b157138cb539f2973cec9731))


### ♻️ Code Refactoring

* **match:** migrate /:id/summary to ApiResponse (S25.5k) ([#432](https://github.com/Ryxeuf/fantasy-football-game/issues/432)) ([090ce87](https://github.com/Ryxeuf/fantasy-football-game/commit/090ce87ae8cedc06466e69f06483086111152f19))
* **match:** migrate /details, /:id/details, /:id/teams to ApiResponse<T> (S25.5j) ([#430](https://github.com/Ryxeuf/fantasy-football-game/issues/430)) ([80ec54d](https://github.com/Ryxeuf/fantasy-football-game/commit/80ec54d7956c3d9f7a56aebc8d3a1dedcb975bbf))

## [1.76.3](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.76.2...v1.76.3) (2026-04-28)


### 🐛 Bug Fixes

* **engine:** compute legalSetupPositions on post-touchdown ([6a0442f](https://github.com/Ryxeuf/fantasy-football-game/commit/6a0442f58462d551cadc88d98f5b86cc1160b4c5))

## [1.76.2](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.76.1...v1.76.2) (2026-04-28)


### ♻️ Code Refactoring

* **match:** migrate GET routes to ApiResponse<T> envelope (S25.5i) ([95a0f37](https://github.com/Ryxeuf/fantasy-football-game/commit/95a0f37640b09a7cd127b4d418c0fd8fac905344))

## [1.76.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.76.0...v1.76.1) (2026-04-28)


### 🐛 Bug Fixes

* **server:** route AI to setup/kickoff helpers instead of gameplay loop ([1a9317c](https://github.com/Ryxeuf/fantasy-football-game/commit/1a9317c9e038487af598ec6309c93f3ade41d47d))

## [1.76.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.75.0...v1.76.0) (2026-04-28)


### ✨ Features

* **api:** migrate /match/create|join|accept to ApiResponse&lt;T&gt; (S25.5f) ([#424](https://github.com/Ryxeuf/fantasy-football-game/issues/424)) ([8a7cbe8](https://github.com/Ryxeuf/fantasy-football-game/commit/8a7cbe87669a17d36e79c102431033a72a59c3f0))
* **api:** migrate /match/my-matches and /match/live to ApiResponse<T> (S25.5h) ([#426](https://github.com/Ryxeuf/fantasy-football-game/issues/426)) ([a26048b](https://github.com/Ryxeuf/fantasy-football-game/commit/a26048b59d1f645896f6349b33d19b4fa2c5bfc2))
* **api:** migrate /match/practice and /match/:id/cancel to ApiResponse&lt;T&gt; (S25.5g) ([#425](https://github.com/Ryxeuf/fantasy-football-game/issues/425)) ([9182a30](https://github.com/Ryxeuf/fantasy-football-game/commit/9182a30674548d201a4e340b80d65e0d15f6ac16)), closes [#424](https://github.com/Ryxeuf/fantasy-football-game/issues/424)
* **engine:** resolve kickoff ball landing with touchback and auto-catch ([45b04ed](https://github.com/Ryxeuf/fantasy-football-game/commit/45b04ed0daf4db16e40f7e0aea324b78b0dd611a))
* **web:** clarify kickoff ball placement panel ([4d1f189](https://github.com/Ryxeuf/fantasy-football-game/commit/4d1f189c9184d1acc8fcc4d05eeae057723bb3c8))


### 🐛 Bug Fixes

* **server:** GET /:id/state returns latest turn for active matches ([9fced19](https://github.com/Ryxeuf/fantasy-football-game/commit/9fced19126c3b81635bc805bba0cbfad7abb0049))

## [1.75.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.74.0...v1.75.0) (2026-04-28)


### ✨ Features

* **auth:** cookie auth_token httpOnly + sameSite=strict + secure (S24.1) ([#395](https://github.com/Ryxeuf/fantasy-football-game/issues/395)) ([eb9c87e](https://github.com/Ryxeuf/fantasy-football-game/commit/eb9c87eb16ed7d618780e54def539ec58c423c39))
* **auth:** JWT access/refresh helpers (S24.3a, slice 1/4) ([#398](https://github.com/Ryxeuf/fantasy-football-game/issues/398)) ([d1184b2](https://github.com/Ryxeuf/fantasy-football-game/commit/d1184b27661bea16ba9229004fd7b81e7eb08bef))
* **auth:** POST /auth/refresh endpoint with rotation (S24.3d) ([#401](https://github.com/Ryxeuf/fantasy-football-game/issues/401)) ([9b2511c](https://github.com/Ryxeuf/fantasy-football-game/commit/9b2511c978ebda1c83c9e4c606a199e5c0d7a68f))
* **auth:** refresh token Prisma persistence + async store (S24.3c) ([#400](https://github.com/Ryxeuf/fantasy-football-game/issues/400)) ([309e767](https://github.com/Ryxeuf/fantasy-football-game/commit/309e7670482f31f13a62b6952beb58cdcbec709c))
* **auth:** refresh-token jti + in-memory store rotation (S24.3b) ([#399](https://github.com/Ryxeuf/fantasy-football-game/issues/399)) ([10d228e](https://github.com/Ryxeuf/fantasy-football-game/commit/10d228e055bbc2e429112f7d5b7494f74d1ae7a9))
* **devops:** docker hot-reload + 5 daily-dev make targets (S24.9) ([#408](https://github.com/Ryxeuf/fantasy-football-game/issues/408)) ([d909169](https://github.com/Ryxeuf/fantasy-football-game/commit/d909169103f8fdc2e025c8697e0e7ac1c333edca))
* **server:** Helmet + HSTS + CSP + X-Frame-Options DENY (S24.2) ([#397](https://github.com/Ryxeuf/fantasy-football-game/issues/397)) ([ff0f21c](https://github.com/Ryxeuf/fantasy-football-game/commit/ff0f21c06878ffb93cb3f7003864f6ebafb47112))
* **server:** paginate listLeagues + audit unbounded findMany (S25.6) ([#419](https://github.com/Ryxeuf/fantasy-football-game/issues/419)) ([5a6d536](https://github.com/Ryxeuf/fantasy-football-game/commit/5a6d536f6e83e59e16092ad2ad14b30ab506e1b0))
* **server:** pino logger + correlation IDs + deep healthcheck (S25.1) ([#409](https://github.com/Ryxeuf/fantasy-football-game/issues/409)) ([4759740](https://github.com/Ryxeuf/fantasy-football-game/commit/4759740b00f0929d73731b67ec24f955a19c5c94))
* **server:** Prometheus /metrics endpoint + 5 custom metrics (S25.3) ([#411](https://github.com/Ryxeuf/fantasy-football-game/issues/411)) ([3d9f48a](https://github.com/Ryxeuf/fantasy-football-game/commit/3d9f48afb01aebeb83a11d6ea56b8199029d748d))
* **web:** @sentry/nextjs DSN-gated init + 10% prod sample rate (S25.2) ([#410](https://github.com/Ryxeuf/fantasy-football-game/issues/410)) ([5756cd4](https://github.com/Ryxeuf/fantasy-football-game/commit/5756cd48a4550dc1930ad488a2ac095eab55517c))
* **web:** shared apiRequest<T> helper unwrapping ApiResponse (S25.5b) ([#414](https://github.com/Ryxeuf/fantasy-football-game/issues/414)) ([c269b7b](https://github.com/Ryxeuf/fantasy-football-game/commit/c269b7b32a0ce6eb780d4212107045cad3ee7ede))


### 🐛 Bug Fixes

* **e2e:** leagues spec uses envelope after sendSuccess migration (S25.5f) ([#418](https://github.com/Ryxeuf/fantasy-football-game/issues/418)) ([5da3d62](https://github.com/Ryxeuf/fantasy-football-game/commit/5da3d62f5cdbd74e6e1e228b6617b68a47f18efd)), closes [#417](https://github.com/Ryxeuf/fantasy-football-game/issues/417)
* **server:** introduce serverLog wrapper for console.* (S24.8) ([#407](https://github.com/Ryxeuf/fantasy-football-game/issues/407)) ([36c8182](https://github.com/Ryxeuf/fantasy-football-game/commit/36c81827413eeea962ed07ea0eceeac34e60adb0))
* **web:** polling fallback 10s + exponential backoff (S24.5) ([#404](https://github.com/Ryxeuf/fantasy-football-game/issues/404)) ([8d4fe57](https://github.com/Ryxeuf/fantasy-football-game/commit/8d4fe57d09067d2196f7573954681f74d430869f))
* **web:** silence debug console.log in prod via webLog wrapper (S24.7) ([#406](https://github.com/Ryxeuf/fantasy-football-game/issues/406)) ([006e807](https://github.com/Ryxeuf/fantasy-football-game/commit/006e807f529550e6beb0ef447f3ce439f12ea29b))
* **web:** WebSocket cleanup defensive removeAllListeners (S24.4) ([#402](https://github.com/Ryxeuf/fantasy-football-game/issues/402)) ([ea1d3c4](https://github.com/Ryxeuf/fantasy-football-game/commit/ea1d3c473f681cb10293fe1988d3d4fd98e1ca43))


### ⚡ Performance Improvements

* **engine:** truncate gameLog at end-of-turn (S25.9) ([#422](https://github.com/Ryxeuf/fantasy-football-game/issues/422)) ([fc15d93](https://github.com/Ryxeuf/fantasy-football-game/commit/fc15d9392d6afa1a7829572ededa732104953071))
* **web:** lazy-load Pixi board on /replay, /spectate, /dugout-demo (S25.7) ([#420](https://github.com/Ryxeuf/fantasy-football-game/issues/420)) ([979d067](https://github.com/Ryxeuf/fantasy-football-game/commit/979d0672408d0a4ff00a5e7a3a0be6567ac33442))
* **web:** use next/image for star player detail (S25.8) ([#421](https://github.com/Ryxeuf/fantasy-football-game/issues/421)) ([07cf1d1](https://github.com/Ryxeuf/fantasy-football-game/commit/07cf1d157feb627664eff9625751dfbab6dd77e4))


### 📝 Documentation

* add deployment incident documentation and improve rollback logic ([5adbd3b](https://github.com/Ryxeuf/fantasy-football-game/commit/5adbd3bee328b46ba506b13fef6f06111f191cd3))
* **prompts:** cron dev loop aligne avec roadmap v2 ([ca3aaab](https://github.com/Ryxeuf/fantasy-football-game/commit/ca3aaaba7088c6beb9e4221a8c4b63beb528b10a))
* **roadmap:** archive v1 (Sprints 0-23 / Phases A-Q) et page blanche v2 ([99515e7](https://github.com/Ryxeuf/fantasy-football-game/commit/99515e74cf37801b7bc6d0c9a95068e665411ed6))
* **roadmap:** plan sprints 24-27 derive d'un audit a 10 agents ([48c7cce](https://github.com/Ryxeuf/fantasy-football-game/commit/48c7ccefb0bb03f4ee12a81f8a2a3df293721a5a))


### ♻️ Code Refactoring

* **server:** league.ts success paths -> sendSuccess (S25.5e) ([#417](https://github.com/Ryxeuf/fantasy-football-game/issues/417)) ([219ec1e](https://github.com/Ryxeuf/fantasy-football-game/commit/219ec1e6fb3124ee6a507efa28942fef6467f0f0))
* **server:** standardize error envelope on league.ts (S25.5a) ([#413](https://github.com/Ryxeuf/fantasy-football-game/issues/413)) ([e0b9c72](https://github.com/Ryxeuf/fantasy-football-game/commit/e0b9c72493ec7ef364b5e4795c2985778b9310f8))
* **web:** leagues page uses shared apiRequest helper (S25.5c) ([#415](https://github.com/Ryxeuf/fantasy-football-game/issues/415)) ([f453328](https://github.com/Ryxeuf/fantasy-football-game/commit/f45332895a9b134cb34d36793a4e2283c5e749f4))
* **web:** leagues/[id] page uses shared apiRequest helper (S25.5d) ([#416](https://github.com/Ryxeuf/fantasy-football-game/issues/416)) ([ccd757b](https://github.com/Ryxeuf/fantasy-football-game/commit/ccd757b8e7be09ae64213ab6e3dd99155ba86787))

## [1.74.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.73.0...v1.74.0) (2026-04-27)


### ✨ Features

* **b2.4:** UI Throw Team-Mate cote web ([28c31e4](https://github.com/Ryxeuf/fantasy-football-game/commit/28c31e415032768d5d9285cb334a05bcef098ef1))


### 📝 Documentation

* **b0.1:** note de suivi pour les hardcodes residuels du skill registry ([e469bb4](https://github.com/Ryxeuf/fantasy-football-game/commit/e469bb4b6158fb3970b183fd1267da3f58f8f2e6))


### ♻️ Code Refactoring

* **b0.1:** passing.ts via skill-registry collectModifiers ([97e063b](https://github.com/Ryxeuf/fantasy-football-game/commit/97e063bb8454964da388fb1e9781daedc58b909c))

## [1.73.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.72.1...v1.73.0) (2026-04-27)


### ✨ Features

* **a11y:** WCAG AA helpers + focus rings + skip-link (Q.21) ([#386](https://github.com/Ryxeuf/fantasy-football-game/issues/386)) ([d468a67](https://github.com/Ryxeuf/fantasy-football-game/commit/d468a67870f71115a28aad0756bf444439cfae7e)), closes [#CBA135](https://github.com/Ryxeuf/fantasy-football-game/issues/CBA135) [#E9E2D0](https://github.com/Ryxeuf/fantasy-football-game/issues/E9E2D0)
* **analytics:** dashboards personnel et global (O.10) ([#379](https://github.com/Ryxeuf/fantasy-football-game/issues/379)) ([260cce8](https://github.com/Ryxeuf/fantasy-football-game/commit/260cce8a765e80c2339f50c2742a6f3a36d8eb00))
* **analytics:** Umami events cles (Q.19) ([#384](https://github.com/Ryxeuf/fantasy-football-game/issues/384)) ([d1bdef7](https://github.com/Ryxeuf/fantasy-football-game/commit/d1bdef72dbae65f0ad82a1cf21e46c80c520b450))
* **community:** match of the week + Discord helpers (O.9) ([#378](https://github.com/Ryxeuf/fantasy-football-game/issues/378)) ([5d8494e](https://github.com/Ryxeuf/fantasy-football-game/commit/5d8494ee821b7165f3cadb56dd77e0fc243a8137))
* **cosmetics:** logos d'equipe SVG programmatiques (O.8b) ([#377](https://github.com/Ryxeuf/fantasy-football-game/issues/377)) ([09ab105](https://github.com/Ryxeuf/fantasy-football-game/commit/09ab105d1d0b09734645865b204061a9f47d0a7e))
* generateur de noms d'equipe par roster (O.8a) ([#371](https://github.com/Ryxeuf/fantasy-football-game/issues/371)) ([d19b672](https://github.com/Ryxeuf/fantasy-football-game/commit/d19b672cb5d0967985f91eea7c235a4072a59162))
* **perf:** Core Web Vitals monitoring + budget (Q.20) ([#385](https://github.com/Ryxeuf/fantasy-football-game/issues/385)) ([258df18](https://github.com/Ryxeuf/fantasy-football-game/commit/258df18d37b0ef109cf53ed2a4a0645f7a933c4f))
* **seo:** /humans.txt + /.well-known/security.txt (Q.22) ([#387](https://github.com/Ryxeuf/fantasy-football-game/issues/387)) ([32802a1](https://github.com/Ryxeuf/fantasy-football-game/commit/32802a17acb72d6269c83926d8e2d0d1bdf664d1))
* **seo:** BreadcrumbList JSON-LD sur /tutoriel + helper partage (Q.13) ([#375](https://github.com/Ryxeuf/fantasy-football-game/issues/375)) ([9497e3b](https://github.com/Ryxeuf/fantasy-football-game/commit/9497e3b0abb4818101a39c208bd2ad95f611f5f9))
* **seo:** builder schema.org Event pour ligues publiques (Q.24) ([#388](https://github.com/Ryxeuf/fantasy-football-game/issues/388)) ([081281e](https://github.com/Ryxeuf/fantasy-football-game/commit/081281e0df22b512c74ebeb0a1a24df04c2d3b94))
* **seo:** codes verification webmasters (Q.17) ([#382](https://github.com/Ryxeuf/fantasy-football-game/issues/382)) ([cef2562](https://github.com/Ryxeuf/fantasy-football-game/commit/cef2562ff347963a1ff7369481482ccbfb11ff85))
* **seo:** helper hreflang centralise + split i18n ready (Q.27) ([#392](https://github.com/Ryxeuf/fantasy-football-game/issues/392)) ([61da4b7](https://github.com/Ryxeuf/fantasy-football-game/commit/61da4b77bd21885b7d13a0de9460ac178e963db3))
* **seo:** IndexNow protocol — soumission auto Bing/Yandex/Naver (Q.18) ([#383](https://github.com/Ryxeuf/fantasy-football-game/issues/383)) ([5da63dc](https://github.com/Ryxeuf/fantasy-football-game/commit/5da63dc825963e5b9fa9a7f7d9752966d1f25152))
* **seo:** JSON-LD DefinedTermSet/ItemList + metadata sur /skills (Q.12) ([#374](https://github.com/Ryxeuf/fantasy-football-game/issues/374)) ([69f591a](https://github.com/Ryxeuf/fantasy-football-game/commit/69f591a10f3af5fbcbd901ac530f2f2fdd26c282))
* **seo:** JSON-LD Person/SportsAthlete + canonical/hreflang sur /star-players/[slug] (Q.11) ([#373](https://github.com/Ryxeuf/fantasy-football-game/issues/373)) ([7c0d2f7](https://github.com/Ryxeuf/fantasy-football-game/commit/7c0d2f7f26f1f7fac58a32643f0d61746ede1375))
* **seo:** JSON-LD SportsTeam + canonical/hreflang sur /teams/[slug] (Q.10) ([#372](https://github.com/Ryxeuf/fantasy-football-game/issues/372)) ([e146230](https://github.com/Ryxeuf/fantasy-football-game/commit/e146230690a748ad0c6ded4720eac3a0fa10a14a))
* **seo:** Open Graph images dynamiques par page (Q.14) ([#393](https://github.com/Ryxeuf/fantasy-football-game/issues/393)) ([46b6758](https://github.com/Ryxeuf/fantasy-football-game/commit/46b6758d9f511b770e11bbd82cd4d2c08bab1d53))
* **seo:** page /a-propos citable (Q.15) ([#380](https://github.com/Ryxeuf/fantasy-football-game/issues/380)) ([9ed8282](https://github.com/Ryxeuf/fantasy-football-game/commit/9ed8282743684f72b9f0eb9a6c76a5948a46199b))
* **seo:** page /changelog publique + flux RSS /feed.xml (Q.16) ([#381](https://github.com/Ryxeuf/fantasy-football-game/issues/381)) ([8907f53](https://github.com/Ryxeuf/fantasy-football-game/commit/8907f5391b56e70455b468019a6eeeca400150de))
* **seo:** protocole de test presence IA (Q.25) ([#390](https://github.com/Ryxeuf/fantasy-football-game/issues/390)) ([a30f24f](https://github.com/Ryxeuf/fantasy-football-game/commit/a30f24f7dc0deebc0b5c0a14cc581ea298e6b6ad))
* **seo:** strategie liens entrants - templates outreach (Q.26) ([#391](https://github.com/Ryxeuf/fantasy-football-game/issues/391)) ([7d9abda](https://github.com/Ryxeuf/fantasy-football-game/commit/7d9abda2b08421328674a218ce2a93d332da124e))
* **seo:** support Wikidata QID + Wikipedia sameAs (Q.23) ([#389](https://github.com/Ryxeuf/fantasy-football-game/issues/389)) ([dea1667](https://github.com/Ryxeuf/fantasy-football-game/commit/dea1667a1dc69e612997ba677c864504c77b8375))


### ⚡ Performance Improvements

* pagination + bornes sur queries DB non bornees (O.7) ([#370](https://github.com/Ryxeuf/fantasy-football-game/issues/370)) ([88179ce](https://github.com/Ryxeuf/fantasy-football-game/commit/88179ce61d1649c0a9ddc3eeb437b48304c9adfa))
* truncate gameLog in WebSocket broadcasts (O.5) ([#368](https://github.com/Ryxeuf/fantasy-football-game/issues/368)) ([923a4ff](https://github.com/Ryxeuf/fantasy-football-game/commit/923a4ffdd51416ab478202439ab52ddbb89f5abd))


### ♻️ Code Refactoring

* standardize ApiResponse&lt;T&gt; envelope with helpers (O.6) ([#369](https://github.com/Ryxeuf/fantasy-football-game/issues/369)) ([43843f1](https://github.com/Ryxeuf/fantasy-football-game/commit/43843f130c74eabef56073e6ddffa92fec905932))

## [1.72.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.72.0...v1.72.1) (2026-04-24)


### 🐛 Bug Fixes

* **docker:** cap Node V8 heap to 2GB during web build to prevent OOM ([42f902e](https://github.com/Ryxeuf/fantasy-football-game/commit/42f902e3f44f69e8eaa8c384ebbdae2c887a21e4))

## [1.72.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.71.0...v1.72.0) (2026-04-24)


### ✨ Features

* **auth:** add discordUserId to user profile updates and validation ([d425697](https://github.com/Ryxeuf/fantasy-football-game/commit/d425697822b80bf491811cac23ea26a6f32c0742))
* **game-engine:** O.3 — audit S2 vs S3 rules + register running-pass-2025 ([#338](https://github.com/Ryxeuf/fantasy-football-game/issues/338)) ([664664a](https://github.com/Ryxeuf/fantasy-football-game/commit/664664ae11fa507aa05dedb48b7f2374de7df039))

## [1.71.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.70.1...v1.71.0) (2026-04-24)


### ✨ Features

* **game-engine:** O.1 batch 3p - hit-and-run + my-ball + plague-ridden ([#331](https://github.com/Ryxeuf/fantasy-football-game/issues/331)) ([52d0737](https://github.com/Ryxeuf/fantasy-football-game/commit/52d0737f2b2a36d12cdda76b2ece6cb222be175c))
* **game-engine:** O.1 batch 3q — contagieux + fork + hate + insignifiant + pick-me-up ([#332](https://github.com/Ryxeuf/fantasy-football-game/issues/332)) ([74ea04e](https://github.com/Ryxeuf/fantasy-football-game/commit/74ea04e5cd33213c9ac19934e5dc566ff4b2c22f))
* **game-engine:** O.1 batch 3r — breathe-fire + clearance + pile-on + provocation + surefoot + trickster ([#334](https://github.com/Ryxeuf/fantasy-football-game/issues/334)) ([6b289c3](https://github.com/Ryxeuf/fantasy-football-game/commit/6b289c3bf5311f8811d0672fc8e12e620ce3bc08))
* **game-engine:** O.1 batch 3s — star player traits registry (6 skills) ([#335](https://github.com/Ryxeuf/fantasy-football-game/issues/335)) ([878fef1](https://github.com/Ryxeuf/fantasy-football-game/commit/878fef1b79b64ee8940e3609c8709cd34a1a6958))
* **game-engine:** O.1 batch 3t — star player + scelerate S3 traits registry (6 skills) ([#336](https://github.com/Ryxeuf/fantasy-football-game/issues/336)) ([90d02f5](https://github.com/Ryxeuf/fantasy-football-game/commit/90d02f5442f37b94c27245ec6e89573cafcd7aa3))
* **game-engine:** O.1 batch 3u — final niche skills registry (closes O.1) ([#337](https://github.com/Ryxeuf/fantasy-football-game/issues/337)) ([b506829](https://github.com/Ryxeuf/fantasy-football-game/commit/b50682996e93cc6f55599cfab1c08373da850a39))
* **prisma:** update User and KofiTransaction models for currency tracking and Discord integration ([dd9943c](https://github.com/Ryxeuf/fantasy-football-game/commit/dd9943c652b1fda4c6814d18b4a64a44c5c6887b))

## [1.70.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.70.0...v1.70.1) (2026-04-24)


### 🐛 Bug Fixes

* **web:** update start script port from 3000 to 3100 in package.json ([df551bb](https://github.com/Ryxeuf/fantasy-football-game/commit/df551bbb5bd0c801637817c643afdaa4183ff646))

## [1.70.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.69.0...v1.70.0) (2026-04-24)


### ✨ Features

* **game-engine:** O.1 batch 3o - drunkard + timmm-ber + fumblerooskie ([#329](https://github.com/Ryxeuf/fantasy-football-game/issues/329)) ([617b3f2](https://github.com/Ryxeuf/fantasy-football-game/commit/617b3f2a84d17b7e4c9b63b84ffb13cfc920785a))

## [1.69.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.68.0...v1.69.0) (2026-04-24)


### ✨ Features

* **logging:** enable HTTP request logging for better observability ([08fd171](https://github.com/Ryxeuf/fantasy-football-game/commit/08fd17141c8da985a04ffd936f04cd9ad08bf830))

## [1.68.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.67.1...v1.68.0) (2026-04-24)


### ✨ Features

* **game-engine:** K.11 hail-mary legal moves + tests complementaires ([#324](https://github.com/Ryxeuf/fantasy-football-game/issues/324)) ([be51d4a](https://github.com/Ryxeuf/fantasy-football-game/commit/be51d4ac6554754e69106622318c134a35142440))
* **game-engine:** O.1 batch 3g - cloud-burster + titchy ([#320](https://github.com/Ryxeuf/fantasy-football-game/issues/320)) ([f623755](https://github.com/Ryxeuf/fantasy-football-game/commit/f623755c5da8dfa544c89bbe217a7cc7a4fd2fca))
* **game-engine:** O.1 batch 3i - leap + stab + projectile-vomit registry entries ([#322](https://github.com/Ryxeuf/fantasy-football-game/issues/322)) ([a6a03f0](https://github.com/Ryxeuf/fantasy-football-game/commit/a6a03f086d1785610d8a60d969cbae8a094c39b5))
* **game-engine:** O.1 batch 3j - on-the-ball + throw-team-mate + dump-off registry entries ([#323](https://github.com/Ryxeuf/fantasy-football-game/issues/323)) ([bc5e327](https://github.com/Ryxeuf/fantasy-football-game/commit/bc5e3273f0d82ccc3eb74c70df15aad939c065b1))
* **game-engine:** O.1 batch 3k - chainsaw + multiple-block + hypnotic-gaze ([#325](https://github.com/Ryxeuf/fantasy-football-game/issues/325)) ([364ec17](https://github.com/Ryxeuf/fantasy-football-game/commit/364ec17692776eb3713adb13805c6d3c5abf236f))
* **game-engine:** O.1 batch 3l - armored-skull + instable + running-pass ([#326](https://github.com/Ryxeuf/fantasy-football-game/issues/326)) ([c42bffb](https://github.com/Ryxeuf/fantasy-football-game/commit/c42bffb2ad9a84fa3e17361afcd3dbd0dd2beb66))
* **game-engine:** O.1 batch 3m - bloodlust + always-hungry + secret-weapon registry ([#327](https://github.com/Ryxeuf/fantasy-football-game/issues/327)) ([3a55869](https://github.com/Ryxeuf/fantasy-football-game/commit/3a55869fa02796619e0a315591c09c7c6030dd64))
* **game-engine:** O.1 batch 3n - pogo-stick + swarming + kick-team-mate ([#328](https://github.com/Ryxeuf/fantasy-football-game/issues/328)) ([32ab85b](https://github.com/Ryxeuf/fantasy-football-game/commit/32ab85b44bfe532258b600802d48086a6d12901d))


### 🐛 Bug Fixes

* **docker:** update SERVER_API_BASE to use nufflearena_server in production and development configurations ([720efd9](https://github.com/Ryxeuf/fantasy-football-game/commit/720efd9e8c6ad7e48ee85b61d642c18380061241))

## [1.67.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.67.0...v1.67.1) (2026-04-23)


### ♻️ Code Refactoring

* **layout:** replace Script component with script tag for Umami analytics integration ([700f1cc](https://github.com/Ryxeuf/fantasy-football-game/commit/700f1ccfdd13a24d514a4a86c3c0d4148a50b1ef))

## [1.67.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.66.0...v1.67.0) (2026-04-23)


### ✨ Features

* **analytics:** enable Umami analytics in production environment ([ecd4b30](https://github.com/Ryxeuf/fantasy-football-game/commit/ecd4b308ccffe4bc957a377141aaa878e205685c))

## [1.66.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.65.0...v1.66.0) (2026-04-23)


### ✨ Features

* **content:** O.2 ajouter specialRuleEn pour 21 star players ([#312](https://github.com/Ryxeuf/fantasy-football-game/issues/312)) ([a7d0d0c](https://github.com/Ryxeuf/fantasy-football-game/commit/a7d0d0c07f3d6189444196b26891aa52d1d050b4))
* **docker:** add Traefik routing for Ko-fi webhooks and integrate Umami analytics script in production layout ([326aaef](https://github.com/Ryxeuf/fantasy-football-game/commit/326aaef2609154079008b08af02071a588fec74d))
* **game-engine:** K.12 implementer ball-and-chain (Goblin Fanatic) ([#310](https://github.com/Ryxeuf/fantasy-football-game/issues/310)) ([a1bf3ce](https://github.com/Ryxeuf/fantasy-football-game/commit/a1bf3cef32a6710bd55b6dabc80d0d879b5622cd))
* **game-engine:** K.13 implementer bombardier (Goblin Bomma) ([#311](https://github.com/Ryxeuf/fantasy-football-game/issues/311)) ([7f51ce0](https://github.com/Ryxeuf/fantasy-football-game/commit/7f51ce03c6afd521735166113b3b42a36043b761))
* **game-engine:** O.1 batch 3a - nerves-of-steel, big-hand, extra-arms ([#313](https://github.com/Ryxeuf/fantasy-football-game/issues/313)) ([fe0f198](https://github.com/Ryxeuf/fantasy-football-game/commit/fe0f1980a20b5ad9c6494e559b15fb821b091f48))
* **game-engine:** O.1 batch 3b - accurate + strong-arm pass modifiers ([#314](https://github.com/Ryxeuf/fantasy-football-game/issues/314)) ([180d298](https://github.com/Ryxeuf/fantasy-football-game/commit/180d298571c462b8cd6ab8d9c8510363caa21a37))
* **game-engine:** O.1 batch 3c - strip-ball ([#315](https://github.com/Ryxeuf/fantasy-football-game/issues/315)) ([ed2afef](https://github.com/Ryxeuf/fantasy-football-game/commit/ed2afef99c86e741bd55d8facb1fd9f758b85da6))
* **game-engine:** O.1 batch 3d - diving-catch catch modifier ([#316](https://github.com/Ryxeuf/fantasy-football-game/issues/316)) ([7d2d0fb](https://github.com/Ryxeuf/fantasy-football-game/commit/7d2d0fb301d4b10ad639249ba29f6ef4198a5c6c))
* **game-engine:** O.1 batch 3e - catch + pass personal rerolls ([#317](https://github.com/Ryxeuf/fantasy-football-game/issues/317)) ([1f35b86](https://github.com/Ryxeuf/fantasy-football-game/commit/1f35b866c2068793d4a67f2d55a764dec003c4cf))
* **game-engine:** O.1 batch 3f - cannoneer + monstrous-mouth ([#318](https://github.com/Ryxeuf/fantasy-football-game/issues/318)) ([569ae46](https://github.com/Ryxeuf/fantasy-football-game/commit/569ae46ceb0cabc1481d4af4159fb26e0e5db7ba))
* **game-engine:** O.1 batch 3g - arm-bar (cle de bras) ([#319](https://github.com/Ryxeuf/fantasy-football-game/issues/319)) ([874d39b](https://github.com/Ryxeuf/fantasy-football-game/commit/874d39bbcf1d1126009eaaed27d3a509c0554965))
* **game-engine:** O.1 batch 3h - mighty-blow-1/2 + dirty-player-2 ([#321](https://github.com/Ryxeuf/fantasy-football-game/issues/321)) ([0a0832d](https://github.com/Ryxeuf/fantasy-football-game/commit/0a0832d3a5f71a5e157d8e949cd06dac249111c2))

## [1.65.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.64.0...v1.65.0) (2026-04-23)


### ✨ Features

* **game-engine:** K.10 implementer multiple-block (Ogres) ([#305](https://github.com/Ryxeuf/fantasy-football-game/issues/305)) ([be1479a](https://github.com/Ryxeuf/fantasy-football-game/commit/be1479a90f42a0e234212f30bbe5cedb745d8f93))
* **game-engine:** K.11 implementer hail-mary-pass + safe-pass ([#307](https://github.com/Ryxeuf/fantasy-football-game/issues/307)) ([dd2aa93](https://github.com/Ryxeuf/fantasy-football-game/commit/dd2aa93486f53ee6073c55f4c7c052fe7c2f91e7))
* **mobile:** M.10 ecran details joueur et progression ([#302](https://github.com/Ryxeuf/fantasy-football-game/issues/302)) ([169e658](https://github.com/Ryxeuf/fantasy-football-game/commit/169e65889e1b39e1337c324cbc4c609d7948f59f))
* **mobile:** M.11 catalogue star players ([#303](https://github.com/Ryxeuf/fantasy-football-game/issues/303)) ([20c1131](https://github.com/Ryxeuf/fantasy-football-game/commit/20c1131260be151090cae63446d5ae28622f8e64))
* **mobile:** M.12 ecran profil et settings ([#304](https://github.com/Ryxeuf/fantasy-football-game/issues/304)) ([8507e20](https://github.com/Ryxeuf/fantasy-football-game/commit/8507e204b506b2320535279fbd0c077897d71174))
* **mobile:** M.8 ecrans cups et ligues ([#299](https://github.com/Ryxeuf/fantasy-football-game/issues/299)) ([2ec295b](https://github.com/Ryxeuf/fantasy-football-game/commit/2ec295b2a8b5b2edc5457916fb2e3c0e0144ba63))
* **mobile:** M.9 push notifications natives via Expo ([#300](https://github.com/Ryxeuf/fantasy-football-game/issues/300)) ([b78c07b](https://github.com/Ryxeuf/fantasy-football-game/commit/b78c07b94979ae95e296b7a6f8af89fab53f6360))
* passage du mode alpha au mode beta ouvert à tous ([#301](https://github.com/Ryxeuf/fantasy-football-game/issues/301)) ([9c04b87](https://github.com/Ryxeuf/fantasy-football-game/commit/9c04b87da51fbad54d1267b251207181d7cf335e))

## [1.64.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.63.0...v1.64.0) (2026-04-22)


### ✨ Features

* **mobile:** M.2 écran queue matchmaking ([#290](https://github.com/Ryxeuf/fantasy-football-game/issues/290)) ([2300eeb](https://github.com/Ryxeuf/fantasy-football-game/commit/2300eebc29c97684b198f289ec9ecbf638ebd10a))
* **mobile:** M.3 integration WebSocket complete ([#291](https://github.com/Ryxeuf/fantasy-football-game/issues/291)) ([8409972](https://github.com/Ryxeuf/fantasy-football-game/commit/8409972828169e0cf569c967525d1a1a4bca78ce))
* **mobile:** M.4 popups natifs Block/Push/FollowUp/Reroll ([#292](https://github.com/Ryxeuf/fantasy-football-game/issues/292)) ([4d5a122](https://github.com/Ryxeuf/fantasy-football-game/commit/4d5a1228ddf7bad5b4fe283fa861d8d8be09393b))
* **mobile:** M.5 chat in-game mobile ([#293](https://github.com/Ryxeuf/fantasy-football-game/issues/293)) ([7f09943](https://github.com/Ryxeuf/fantasy-football-game/commit/7f09943a777108aeb9eedab53a22bbf0e1213536))
* **mobile:** M.6 ecran leaderboard ([#294](https://github.com/Ryxeuf/fantasy-football-game/issues/294)) ([d86729b](https://github.com/Ryxeuf/fantasy-football-game/commit/d86729b32b23699d706868a1d513be24e76098cb))
* **mobile:** M.7 ecran replay de match ([#296](https://github.com/Ryxeuf/fantasy-football-game/issues/296)) ([fb29366](https://github.com/Ryxeuf/fantasy-football-game/commit/fb29366599bd471f62c80ec98dbdad1397dc1960))

## [1.63.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.62.0...v1.63.0) (2026-04-21)


### ✨ Features

* **admin:** page d'avancement lisant roadmap et sprints ([#281](https://github.com/Ryxeuf/fantasy-football-game/issues/281)) ([5eb366d](https://github.com/Ryxeuf/fantasy-football-game/commit/5eb366daecb2d5eda011d4f6fe7d175197edc72f))
* ajoute les informations d'hébergement OVH aux mentions légales ([39c5aba](https://github.com/Ryxeuf/fantasy-football-game/commit/39c5aba5cff1ceddb73fe334aec603826fa8c94a))
* **league:** L.7 integration match online -> ligue (resultats auto) ([#277](https://github.com/Ryxeuf/fantasy-football-game/issues/277)) ([dbb6d41](https://github.com/Ryxeuf/fantasy-football-game/commit/dbb6d417529a4113d044c34ea0c5646938fb1e3d))
* **league:** L.8 ELO saisonnier avec reset et placements ([#278](https://github.com/Ryxeuf/fantasy-football-game/issues/278)) ([1d84d04](https://github.com/Ryxeuf/fantasy-football-game/commit/1d84d048cd04d44a381b7deb609627116836cea8))
* **league:** L.9 enforce allowedRosters restriction in service layer ([#279](https://github.com/Ryxeuf/fantasy-football-game/issues/279)) ([6f82852](https://github.com/Ryxeuf/fantasy-football-game/commit/6f8285223266a4ef199df97c1cde8dba90bc3208))
* **mobile:** M.1 écrans gestion d'équipe (liste, création, détail, édition) ([#283](https://github.com/Ryxeuf/fantasy-football-game/issues/283)) ([dc98395](https://github.com/Ryxeuf/fantasy-football-game/commit/dc9839506dc07ac7a444d5a5c9fb016052bea167))


### 🐛 Bug Fixes

* **admin:** inject JWT_SECRET into web container for /api/admin/progress ([#282](https://github.com/Ryxeuf/fantasy-football-game/issues/282)) ([d4928b2](https://github.com/Ryxeuf/fantasy-football-game/commit/d4928b2bca35c07c57be7238a3b7deadc46fd074))

## [1.62.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.61.0...v1.62.0) (2026-04-21)


### ✨ Features

* **league:** L.4 round-robin schedule generator ([#273](https://github.com/Ryxeuf/fantasy-football-game/issues/273)) ([d3f41ce](https://github.com/Ryxeuf/fantasy-football-game/commit/d3f41ce2e3c915b723b26bcbbbfa6f86f42d7053))
* **league:** L.5 page liste des ligues (frontend) ([#275](https://github.com/Ryxeuf/fantasy-football-game/issues/275)) ([711e359](https://github.com/Ryxeuf/fantasy-football-game/commit/711e359870671a07b23633e6ff1da2e88ec29ee4))
* **league:** L.6 page detail ligue (calendrier, classement, participants) ([#276](https://github.com/Ryxeuf/fantasy-football-game/issues/276)) ([ddae701](https://github.com/Ryxeuf/fantasy-football-game/commit/ddae7016c83e65c964f719525c014d7b015bb743))
* move Practice vs AI from LocalMatch to online Match flow ([#274](https://github.com/Ryxeuf/fantasy-football-game/issues/274)) ([b87e733](https://github.com/Ryxeuf/fantasy-football-game/commit/b87e733e4caca28ad69ab359521a4e9652279a68))


### 🐛 Bug Fixes

* **star-players:** filtre par ruleset et déduplication côté client ([b643ce4](https://github.com/Ryxeuf/fantasy-football-game/commit/b643ce437b37596e47fff03f3b769d2f8eab95d8))

## [1.61.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.60.0...v1.61.0) (2026-04-20)


### ✨ Features

* add L.3 league CRUD API routes (create/join/schedule/standings) ([#271](https://github.com/Ryxeuf/fantasy-football-game/issues/271)) ([f203eb8](https://github.com/Ryxeuf/fantasy-football-game/commit/f203eb84c9d0f438e86e5d0eada3399a4d6f7911))
* add online_play feature flag with server middleware and client gate ([#265](https://github.com/Ryxeuf/fantasy-football-game/issues/265)) ([bd912d9](https://github.com/Ryxeuf/fantasy-football-game/commit/bd912d977f6ed7baf748aa0408a390eb49a5f8f1))
* **league:** L.1 Prisma models for League/Season/Participant/Round ([#266](https://github.com/Ryxeuf/fantasy-football-game/issues/266)) ([92d75f7](https://github.com/Ryxeuf/fantasy-football-game/commit/92d75f74853bb7a79ec764c10c8fe7b7a6b86c27))
* **league:** L.2 seed default 'Open 5 Teams' league ([#267](https://github.com/Ryxeuf/fantasy-football-game/issues/267)) ([05932fc](https://github.com/Ryxeuf/fantasy-football-game/commit/05932fc19e7e0118ae3cd6bb4065d378f5910ad2))
* **local-match:** automate inducements processing for AI matches ([65bd2cc](https://github.com/Ryxeuf/fantasy-football-game/commit/65bd2cc20968d38ba3092e8f64f4509aa35fc49e))
* **social:** N.8 badges Maitre par equipe prioritaire ([#264](https://github.com/Ryxeuf/fantasy-football-game/issues/264)) ([16669b5](https://github.com/Ryxeuf/fantasy-football-game/commit/16669b51fc3d96e4bc1699be36aea97e904e0400))

## [1.60.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.59.0...v1.60.0) (2026-04-20)


### ✨ Features

* **social:** N.7 systeme d'achievements (succes) ([564b173](https://github.com/Ryxeuf/fantasy-football-game/commit/564b1738d1e19cd60678ac347ac50d1ec0ffcda4))

## [1.59.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.58.0...v1.59.0) (2026-04-20)


### ✨ Features

* add Ko-fi donation integration with support page and legal updates ([#233](https://github.com/Ryxeuf/fantasy-football-game/issues/233)) ([df44df2](https://github.com/Ryxeuf/fantasy-football-game/commit/df44df2f992ff6f2ff600935643297f57f04898e))
* **ai:** restrict AI opponent to 5 priority teams (N.4b) ([#255](https://github.com/Ryxeuf/fantasy-football-game/issues/255)) ([b90aae1](https://github.com/Ryxeuf/fantasy-football-game/commit/b90aae11facfc4e2349fc3b18d3820b241e19f2a))
* **ai:** three-level AI difficulty for practice mode (N.4) ([#254](https://github.com/Ryxeuf/fantasy-football-game/issues/254)) ([cd8953a](https://github.com/Ryxeuf/fantasy-football-game/commit/cd8953ae6394ea1fa7feda228cafc7ee352423a1))
* **career-stats:** N.6 historique de matchs et stats de carriere par equipe ([3ff6ba4](https://github.com/Ryxeuf/fantasy-football-game/commit/3ff6ba4babbbc64e97dc394742683f1a57261d4b))
* **content:** descriptions EN pour les star players MVP (P2.9) ([#248](https://github.com/Ryxeuf/fantasy-football-game/issues/248)) ([a1fbc30](https://github.com/Ryxeuf/fantasy-football-game/commit/a1fbc30c8f500af91386d5d5229c10d98806206b))
* **content:** enrichir special rules star players 5 equipes prioritaires (P2.8) ([#247](https://github.com/Ryxeuf/fantasy-football-game/issues/247)) ([1dbbe32](https://github.com/Ryxeuf/fantasy-football-game/commit/1dbbe32a58556a27f9c3696354469ac65ed916dc))
* **game-engine:** audit & fix frenzy + on-the-ball (P1.11) ([#229](https://github.com/Ryxeuf/fantasy-football-game/issues/229)) ([d7d1fbc](https://github.com/Ryxeuf/fantasy-football-game/commit/d7d1fbcc695baad5a30e2400fa02decf63938556))
* **game-engine:** implement break-tackle skill (P1.3) ([#215](https://github.com/Ryxeuf/fantasy-football-game/issues/215)) ([dbc2ddf](https://github.com/Ryxeuf/fantasy-football-game/commit/dbc2ddf60de1e3c243d23080ffd214337f346eaa))
* **game-engine:** implement fend skill (P1.9) ([#227](https://github.com/Ryxeuf/fantasy-football-game/issues/227)) ([906feba](https://github.com/Ryxeuf/fantasy-football-game/commit/906febaa66e625dda67fb212cabc7f68a2241f54))
* **game-engine:** implement running-pass skill (P1.10) ([#228](https://github.com/Ryxeuf/fantasy-football-game/issues/228)) ([3e2a7af](https://github.com/Ryxeuf/fantasy-football-game/commit/3e2a7afb7c4bbdbf9b5897515b1bd030415f1d33))
* **game-engine:** implement shadowing skill (P1.8) ([#226](https://github.com/Ryxeuf/fantasy-football-game/issues/226)) ([251b1b0](https://github.com/Ryxeuf/fantasy-football-game/commit/251b1b09070baeba33fa75de8dac7d96a1563cbd))
* IA — evaluation heuristique position + coup (N.3) ([#253](https://github.com/Ryxeuf/fantasy-football-game/issues/253)) ([c6acdbf](https://github.com/Ryxeuf/fantasy-football-game/commit/c6acdbf79bd9a9e29f81f3bea7bfc75bee85faa6))
* implement Defensive skill (Sprint 14 P2.2) ([#243](https://github.com/Ryxeuf/fantasy-football-game/issues/243)) ([81fbb3d](https://github.com/Ryxeuf/fantasy-football-game/commit/81fbb3dd882faf372056fd65f1ab6ca1c9916800))
* implement disturbing-presence skill (Sprint 14 P2.3) ([#244](https://github.com/Ryxeuf/fantasy-football-game/issues/244)) ([30b197a](https://github.com/Ryxeuf/fantasy-football-game/commit/30b197a68b99f8bd2ce7bf73119ed01689143a53))
* implement Kick skill (Sprint 14 P2.1) ([#242](https://github.com/Ryxeuf/fantasy-football-game/issues/242)) ([20fe072](https://github.com/Ryxeuf/fantasy-football-game/commit/20fe072c7e5b6e183771e64fbf8733206c300340))
* implement sneaky-git skill (Sprint 14 P2.6) ([#245](https://github.com/Ryxeuf/fantasy-football-game/issues/245)) ([e2f748f](https://github.com/Ryxeuf/fantasy-football-game/commit/e2f748f650143c21b593f78db5af8064bc8ca04c))
* mode simplifie pour debutants (Sprint 15 · N.2) ([#251](https://github.com/Ryxeuf/fantasy-football-game/issues/251)) ([2138468](https://github.com/Ryxeuf/fantasy-football-game/commit/213846895c9c6b12c6cb985e812a4f5d3ffa0f52))
* **P2.7:** lister les star players hirables par les 5 equipes prioritaires ([#246](https://github.com/Ryxeuf/fantasy-football-game/issues/246)) ([49a949c](https://github.com/Ryxeuf/fantasy-football-game/commit/49a949cce5faffe02b76fdf5579ce7e12d3bde37))
* **social:** systeme d'amis — fondation backend (N.5) ([#258](https://github.com/Ryxeuf/fantasy-football-game/issues/258)) ([79a9d01](https://github.com/Ryxeuf/fantasy-football-game/commit/79a9d0186dd210a92b10d9e622ef6568664e85d3))
* **teams:** season 3 par defaut et staff a la creation ([#252](https://github.com/Ryxeuf/fantasy-football-game/issues/252)) ([7c94e61](https://github.com/Ryxeuf/fantasy-football-game/commit/7c94e61c578a5ccc0a8aabb508e9b4ddb9460847))
* tutoriel interactif (Sprint 15 · N.1) ([#250](https://github.com/Ryxeuf/fantasy-football-game/issues/250)) ([52efbd5](https://github.com/Ryxeuf/fantasy-football-game/commit/52efbd5ec003dee30cf4eae95885751a1d9db26f))


### 📝 Documentation

* add Sprint 6 & 7 specs for badges/titles/rewards system ([#260](https://github.com/Ryxeuf/fantasy-football-game/issues/260)) ([7a634e2](https://github.com/Ryxeuf/fantasy-football-game/commit/7a634e2165030927ccd4897e41d89916281c2490))

## [1.58.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.57.0...v1.58.0) (2026-04-15)


### ✨ Features

* **game-engine:** generalize iron-hard-skin (P1.7) ([#217](https://github.com/Ryxeuf/fantasy-football-game/issues/217)) ([4b02f9c](https://github.com/Ryxeuf/fantasy-football-game/commit/4b02f9c4331c79916148ffb9ec14c4e5113d355b))
* **game-engine:** implement always-hungry trait (J.9) ([#200](https://github.com/Ryxeuf/fantasy-football-game/issues/200)) ([0ee0c98](https://github.com/Ryxeuf/fantasy-football-game/commit/0ee0c98b3414fee0b6ea706bbb1b1d7a91824c98))
* **game-engine:** implement armored-skull trait (P1.6) ([#216](https://github.com/Ryxeuf/fantasy-football-game/issues/216)) ([153ca81](https://github.com/Ryxeuf/fantasy-football-game/commit/153ca8102489f0784fb04aa82bad7260c697f21a))
* **game-engine:** implement break-tackle skill (P1.3) ([#208](https://github.com/Ryxeuf/fantasy-football-game/issues/208)) ([e70a362](https://github.com/Ryxeuf/fantasy-football-game/commit/e70a3627b60df1c74ba185c1c304153e77bc570f))
* **game-engine:** implement chainsaw trait (K.3) ([#204](https://github.com/Ryxeuf/fantasy-football-game/issues/204)) ([ea79736](https://github.com/Ryxeuf/fantasy-football-game/commit/ea79736b161fc6ccced25b75d43cc07a3359e6ba))
* **game-engine:** implement dauntless skill (P1.2) ([#207](https://github.com/Ryxeuf/fantasy-football-game/issues/207)) ([30e43a5](https://github.com/Ryxeuf/fantasy-football-game/commit/30e43a535d06d0e425204ccca7ae0de7d773b544))
* **game-engine:** implement dump-off skill (K.4) ([#205](https://github.com/Ryxeuf/fantasy-football-game/issues/205)) ([7485c9d](https://github.com/Ryxeuf/fantasy-football-game/commit/7485c9df9352e5434f9f98a7776833ccdc157cfb))
* **game-engine:** implement juggernaut skill (P1.4) ([#209](https://github.com/Ryxeuf/fantasy-football-game/issues/209)) ([4ac0810](https://github.com/Ryxeuf/fantasy-football-game/commit/4ac08105fd59e587c88ccf6ec0ac10289eeb1e4a))
* **game-engine:** implement on-the-ball skill (K.5) ([#219](https://github.com/Ryxeuf/fantasy-football-game/issues/219)) ([a6a65a5](https://github.com/Ryxeuf/fantasy-football-game/commit/a6a65a55c0339396c640faca1fca4ba582c000eb))
* **game-engine:** implement stab skill (K.2) ([#203](https://github.com/Ryxeuf/fantasy-football-game/issues/203)) ([0b30893](https://github.com/Ryxeuf/fantasy-football-game/commit/0b30893f6c4f5a580609f0470d8d7e72544d7a81))
* **game-engine:** implement stand-firm skill (P1.5) ([#210](https://github.com/Ryxeuf/fantasy-football-game/issues/210)) ([4513fd4](https://github.com/Ryxeuf/fantasy-football-game/commit/4513fd4c67d3ddb81517fe0b10283bfcbe4cb8b8))
* **game-engine:** implement stunty trait (P1.1) ([#206](https://github.com/Ryxeuf/fantasy-football-game/issues/206)) ([d31a892](https://github.com/Ryxeuf/fantasy-football-game/commit/d31a892dcb1d7b47aa3c3a342af35f8ddffaf44d))
* **game-engine:** skip juggernaut conversion when attacker has Block ([#213](https://github.com/Ryxeuf/fantasy-football-game/issues/213)) ([19d7f69](https://github.com/Ryxeuf/fantasy-football-game/commit/19d7f69607fbbc6480f9899a2779fa0738b91599)), closes [#209](https://github.com/Ryxeuf/fantasy-football-game/issues/209)


### 🐛 Bug Fixes

* **docker:** update NODE_ENV to development and improve healthcheck commands ([42c6fd0](https://github.com/Ryxeuf/fantasy-football-game/commit/42c6fd0e3bfd068ef611ac4e501c43d278e4928f))

## [1.57.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.56.1...v1.57.0) (2026-04-14)


### ✨ Features

* activate vitest coverage reporting (TEST-1) ([#191](https://github.com/Ryxeuf/fantasy-football-game/issues/191)) ([900d35b](https://github.com/Ryxeuf/fantasy-football-game/commit/900d35b50f19b7994cd03ff03eb6eb385c6afaad))
* **game-engine:** implement Foul Appearance (J.10) ([#198](https://github.com/Ryxeuf/fantasy-football-game/issues/198)) ([ac8c27c](https://github.com/Ryxeuf/fantasy-football-game/commit/ac8c27c27a03d55fcaca2d6ca967a31d15f6ddb0))
* **game-engine:** implement instable (Unstable) trait (J.11) ([#201](https://github.com/Ryxeuf/fantasy-football-game/issues/201)) ([deb4a4a](https://github.com/Ryxeuf/fantasy-football-game/commit/deb4a4a3537242cf723b641394595e467026fa3b))
* **game-engine:** implement Leap + Pogo Stick (K.1) ([#202](https://github.com/Ryxeuf/fantasy-football-game/issues/202)) ([86e58e0](https://github.com/Ryxeuf/fantasy-football-game/commit/86e58e01fe79eb93c85fbfe1e94d395feb0d52f7))
* implement always-hungry trait (J.9) ([#197](https://github.com/Ryxeuf/fantasy-football-game/issues/197)) ([07b1165](https://github.com/Ryxeuf/fantasy-football-game/commit/07b11658c05ff23110eea2b431ac385f255538a3))
* implement bloodlust trait with 3 variants (J.8) ([#196](https://github.com/Ryxeuf/fantasy-football-game/issues/196)) ([8cd8644](https://github.com/Ryxeuf/fantasy-football-game/commit/8cd86446a0ff34edb0f2bf705db6c0477532af79))
* implement right-stuff skill (J.7) ([#187](https://github.com/Ryxeuf/fantasy-football-game/issues/187)) ([a082d9e](https://github.com/Ryxeuf/fantasy-football-game/commit/a082d9ecdf61506270ffaf5b04ccbd4af286cd09))
* **sec:** add Zod validation to all routes (SEC-5) ([#195](https://github.com/Ryxeuf/fantasy-football-game/issues/195)) ([efc8ff3](https://github.com/Ryxeuf/fantasy-football-game/commit/efc8ff3d65bc5b6fd98cd21aa5d682061b6e959e))


### 🐛 Bug Fixes

* remove dummy DiceResult overwrite after block resolution ([#190](https://github.com/Ryxeuf/fantasy-football-game/issues/190)) ([4cdc6e7](https://github.com/Ryxeuf/fantasy-football-game/commit/4cdc6e7c737fe6df7e92d529e5615228b524363c))

## [1.56.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.56.0...v1.56.1) (2026-04-13)


### 🐛 Bug Fixes

* correct pre-existing test failures and SQLite binary target ([44544a1](https://github.com/Ryxeuf/fantasy-football-game/commit/44544a128d409f68506e77b623a8207f17385cb9))


### ♻️ Code Refactoring

* update SQLite client configuration and paths ([af1a299](https://github.com/Ryxeuf/fantasy-football-game/commit/af1a2996a851091a66bf034c51eed8fb650d351e))

## [1.56.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.55.2...v1.56.0) (2026-04-13)


### ✨ Features

* add END_PLAYER_TURN to stop player activation mid-move ([5d9e519](https://github.com/Ryxeuf/fantasy-football-game/commit/5d9e519ef55092976b85b02ad137935ecdfab77f))
* add terrain skin and turn timer options to match creation ([680278a](https://github.com/Ryxeuf/fantasy-football-game/commit/680278a2def0ca65ba9d99551e337b146ad7fdb5))
* allow block during blitz movement (blitz at contact) ([889e15f](https://github.com/Ryxeuf/fantasy-football-game/commit/889e15f9b776e4961286e63913f71040f5175135))
* display remaining movement points during player activation ([6f2e753](https://github.com/Ryxeuf/fantasy-football-game/commit/6f2e753c8c8dddc891fef11189a086f29b703f71))
* implement chain push mechanics ([d280ae9](https://github.com/Ryxeuf/fantasy-football-game/commit/d280ae9c50cae59ac37c6522b005493219c66e3c))
* post-TD phase with KO recovery and re-setup ([929859b](https://github.com/Ryxeuf/fantasy-football-game/commit/929859b203e578887fd6a5ae5450c3cef3398fc6))


### 🐛 Bug Fixes

* correct push direction calculation in blocking mechanics ([1ed103d](https://github.com/Ryxeuf/fantasy-football-game/commit/1ed103ded7b4e029b8276b631d0bf412565655a9))

## [1.55.2](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.55.1...v1.55.2) (2026-04-13)


### 🐛 Bug Fixes

* improve player action handling in game state ([4bd4dd2](https://github.com/Ryxeuf/fantasy-football-game/commit/4bd4dd2bd2ae3475db1fab52f2a4af73e7afa9da))

## [1.55.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.55.0...v1.55.1) (2026-04-13)


### 🐛 Bug Fixes

* enhance match state management during kickoff phase ([32c101e](https://github.com/Ryxeuf/fantasy-football-game/commit/32c101e80a30aac06485191033fdca21f3520077))

## [1.55.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.54.0...v1.55.0) (2026-04-13)


### ✨ Features

* **J.6:** implement no-hands trait ([#186](https://github.com/Ryxeuf/fantasy-football-game/issues/186)) ([4fdc778](https://github.com/Ryxeuf/fantasy-football-game/commit/4fdc778a3e8ba1b9d6bebd06e278d1620ea78f4f))


### 🐛 Bug Fixes

* update match state retrieval logic to include active status ([44bdd46](https://github.com/Ryxeuf/fantasy-football-game/commit/44bdd46829a3562f74710a21bd5bbd1716acfb7a))
* update match status logic to include active phase ([e500a24](https://github.com/Ryxeuf/fantasy-football-game/commit/e500a2407fc53a1724b3197669c0b34be9e8457c))


### ♻️ Code Refactoring

* streamline game state retrieval and update team value calculation ([271df74](https://github.com/Ryxeuf/fantasy-football-game/commit/271df74ed414205144c31126db3d5b7d1971fa03))

## [1.54.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.53.0...v1.54.0) (2026-04-13)


### ✨ Features

* enhance inducements phase UI for online matches ([a8d098a](https://github.com/Ryxeuf/fantasy-football-game/commit/a8d098aafc5d60e26588a035881264746a8c244b))


### 🐛 Bug Fixes

* enhance match existence verification and cleanup process ([149b6c2](https://github.com/Ryxeuf/fantasy-football-game/commit/149b6c201f3881645941972b42948ab1b5ab03ff))
* update team selection data structure in matchmaking service ([f955d98](https://github.com/Ryxeuf/fantasy-football-game/commit/f955d98ed13e45d1f47dd8d914979390e750c3e5))

## [1.53.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.52.0...v1.53.0) (2026-04-13)


### ✨ Features

* add rate limiting whitelist and trust proxy configuration ([09473e5](https://github.com/Ryxeuf/fantasy-football-game/commit/09473e507d9ebd9687c4a3a8a010e2ac5b8f74fd))

## [1.52.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.51.0...v1.52.0) (2026-04-13)


### ✨ Features

* add CORS_ORIGINS environment variable to docker-compose.yml ([bc8fdfb](https://github.com/Ryxeuf/fantasy-football-game/commit/bc8fdfb2fa6f0d99b1959a5c269f4cb7f8e57216))

## [1.51.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.50.0...v1.51.0) (2026-04-13)


### ✨ Features

* add team sprite manifest registry (H.6 sub-task 4/5) ([#171](https://github.com/Ryxeuf/fantasy-football-game/issues/171)) ([ad85cba](https://github.com/Ryxeuf/fantasy-football-game/commit/ad85cba46b363e5f052ef1ff533c90e55bf49a95))
* complete sprite sheet rendering pipeline (H.6 5/5) ([#172](https://github.com/Ryxeuf/fantasy-football-game/issues/172)) ([3676039](https://github.com/Ryxeuf/fantasy-football-game/commit/36760398bdba148ff1ddc5e6cc92c0a2d382d129))
* **e2e:** add 3 new E2E UI test scenarios + fix team-select flow ([#176](https://github.com/Ryxeuf/fantasy-football-game/issues/176)) ([1d2faaa](https://github.com/Ryxeuf/fantasy-football-game/commit/1d2faaaa569a9caa88c4530b93ef456c41888846))
* **H.6:** propagate per-roster colors through GameState ([#169](https://github.com/Ryxeuf/fantasy-football-game/issues/169)) ([0176af8](https://github.com/Ryxeuf/fantasy-football-game/commit/0176af8575d40ec4f249900764c690814cb154f1)), closes [#168](https://github.com/Ryxeuf/fantasy-football-game/issues/168)
* **H.7:** terrain skin variants (grass/ruins/snow) ([#175](https://github.com/Ryxeuf/fantasy-football-game/issues/175)) ([da194d2](https://github.com/Ryxeuf/fantasy-football-game/commit/da194d2cf444a3cc33095bade1c6622fbc0b0050))
* **I.6:** add special rules for all 52 remaining star players ([#174](https://github.com/Ryxeuf/fantasy-football-game/issues/174)) ([9421a9c](https://github.com/Ryxeuf/fantasy-football-game/commit/9421a9c971da4a203e8ddc234a1951fc879f3315))
* **I.7:** differentiate S3 star players from S2 ([#173](https://github.com/Ryxeuf/fantasy-football-game/issues/173)) ([824e766](https://github.com/Ryxeuf/fantasy-football-game/commit/824e76672cc3564a2fe758a1b2e87ee37335847f))
* **J.1:** implement bone-head activation roll ([#181](https://github.com/Ryxeuf/fantasy-football-game/issues/181)) ([cdf957d](https://github.com/Ryxeuf/fantasy-football-game/commit/cdf957d20ce501810898259911796fa6aec6c595))
* **J.2:** implement really-stupid activation roll ([#182](https://github.com/Ryxeuf/fantasy-football-game/issues/182)) ([d28fef1](https://github.com/Ryxeuf/fantasy-football-game/commit/d28fef17c573516f17aa5ce105c1722d5c0d12df))
* **J.3:** implement wild-animal activation roll ([#183](https://github.com/Ryxeuf/fantasy-football-game/issues/183)) ([df17225](https://github.com/Ryxeuf/fantasy-football-game/commit/df172256f15431900ee9d18354e2a417ba79b9ef))
* **J.4:** implement animal-savagery activation roll ([#184](https://github.com/Ryxeuf/fantasy-football-game/issues/184)) ([17d4400](https://github.com/Ryxeuf/fantasy-football-game/commit/17d4400de8e0a482d96db05ecbcc68973dca7a13))
* **J.5:** implement take-root activation roll ([#185](https://github.com/Ryxeuf/fantasy-football-game/issues/185)) ([903ffb4](https://github.com/Ryxeuf/fantasy-football-game/commit/903ffb46f5bdd90d354ba177c18ae9f9acc27cfe))
* per-roster team colors on the board (H.6 foundation) ([#168](https://github.com/Ryxeuf/fantasy-football-game/issues/168)) ([48eb677](https://github.com/Ryxeuf/fantasy-football-game/commit/48eb677f71f740b5d70a4aeb15ea39b8dcfa7b45))
* **SEC-3:** centralize JWT_SECRET/MATCH_SECRET in config.ts ([#179](https://github.com/Ryxeuf/fantasy-football-game/issues/179)) ([04fdaf1](https://github.com/Ryxeuf/fantasy-football-game/commit/04fdaf107226338beddddaa8a48e87641d28f7c0))
* **SEC-4:** restrict CORS to specific origins ([#180](https://github.com/Ryxeuf/fantasy-football-game/issues/180)) ([a4925a6](https://github.com/Ryxeuf/fantasy-football-game/commit/a4925a6cb20b767dea99a247b71d275f15bf3a4f))


### 🐛 Bug Fixes

* resolve 12 CRITICAL and HIGH bugs found by multi-agent code analysis ([#177](https://github.com/Ryxeuf/fantasy-football-game/issues/177)) ([cfc6a12](https://github.com/Ryxeuf/fantasy-football-game/commit/cfc6a12248bfe82fa072e89c8a842e6fd237faab))


### 📝 Documentation

* add evolution analysis and sprint 12-20 roadmap ([#178](https://github.com/Ryxeuf/fantasy-football-game/issues/178)) ([e8f65fe](https://github.com/Ryxeuf/fantasy-football-game/commit/e8f65fe8ba5cb9150f8ca1593894d9dbdafe0be2))


### ♻️ Code Refactoring

* remove node_modules volumes from docker-compose.yml ([de44c28](https://github.com/Ryxeuf/fantasy-football-game/commit/de44c28ae1f7a95a8061ed35b76cbd28b147533a))

## [1.50.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.49.0...v1.50.0) (2026-04-11)


### ✨ Features

* Add ELO leaderboard page with pagination ([#156](https://github.com/Ryxeuf/fantasy-football-game/issues/156)) ([da84992](https://github.com/Ryxeuf/fantasy-football-game/commit/da8499256299cda5690c49b2d13afd3965e624dc))
* add match replay functionality with playback controls ([#163](https://github.com/Ryxeuf/fantasy-football-game/issues/163)) ([0dba726](https://github.com/Ryxeuf/fantasy-football-game/commit/0dba726dae7dbf96c1787011ce3a000ad138b665))
* add tactical indicators — movement range and pass range overlays (H.4) ([#164](https://github.com/Ryxeuf/fantasy-football-game/issues/164)) ([258a9bd](https://github.com/Ryxeuf/fantasy-football-game/commit/258a9bd37663d769c8cb09689494bf83f676e72b))
* implement 4 UI-delegated kickoff events ([#155](https://github.com/Ryxeuf/fantasy-football-game/issues/155)) ([5769844](https://github.com/Ryxeuf/fantasy-football-game/commit/5769844e5193b6c103540e5008fe6e11e27de85a))


### ♻️ Code Refactoring

* rename -hidden routes to their proper names ([a30acb6](https://github.com/Ryxeuf/fantasy-football-game/commit/a30acb67704699876b59905f7ce70e1e15b0aca7))

## [1.49.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.48.0...v1.49.0) (2026-04-10)


### ✨ Features

* add basic sound effects for match events (H.5) ([#114](https://github.com/Ryxeuf/fantasy-football-game/issues/114)) ([40786cd](https://github.com/Ryxeuf/fantasy-football-game/commit/40786cd462ea166a125978f3169598033d16b3bf))
* add end-of-match results screen (C.7) ([#128](https://github.com/Ryxeuf/fantasy-football-game/issues/128)) ([778e899](https://github.com/Ryxeuf/fantasy-football-game/commit/778e899e69c0b93f01d93d2a5f07457a0e6f0629))
* add inducements UI selection pre-match (B2.2) ([#116](https://github.com/Ryxeuf/fantasy-football-game/issues/116)) ([dfef59e](https://github.com/Ryxeuf/fantasy-football-game/commit/dfef59e3e999fc3da4e19c317ddb52120984b0d1))
* add movement and ball tweens with animation queue (E.1-3) ([#112](https://github.com/Ryxeuf/fantasy-football-game/issues/112)) ([e16ec4e](https://github.com/Ryxeuf/fantasy-football-game/commit/e16ec4eac49abcf869fa849e3c03de0a13bd5978))
* add push notification infrastructure (G.1 + G.2) ([#138](https://github.com/Ryxeuf/fantasy-football-game/issues/138)) ([80c2f39](https://github.com/Ryxeuf/fantasy-football-game/commit/80c2f3929b95cc4cf8606776b301b14230a64aa9))
* add spectator mode for live match viewing (H.2) ([#143](https://github.com/Ryxeuf/fantasy-football-game/issues/143)) ([17d9461](https://github.com/Ryxeuf/fantasy-football-game/commit/17d94610c62a2ea0a824e59383ccba60f97a390d))
* add turn notification system (A.10) ([#113](https://github.com/Ryxeuf/fantasy-football-game/issues/113)) ([9c8056f](https://github.com/Ryxeuf/fantasy-football-game/commit/9c8056f06085ed8bb32e7473b89f5a77f4394fc5))
* add WebSocket connection status indicator in HUD (A.9) ([#124](https://github.com/Ryxeuf/fantasy-football-game/issues/124)) ([371acc9](https://github.com/Ryxeuf/fantasy-football-game/commit/371acc9585083414c0c30e4ad2a5514c48c5113f))
* auto-forfeit on disconnect > 2 minutes (C.8) ([#129](https://github.com/Ryxeuf/fantasy-football-game/issues/129)) ([5677a7e](https://github.com/Ryxeuf/fantasy-football-game/commit/5677a7e7d62417803700714e37f877420eefd5c1))
* automate online pre-match sequence (C.6) ([#127](https://github.com/Ryxeuf/fantasy-football-game/issues/127)) ([be7331e](https://github.com/Ryxeuf/fantasy-football-game/commit/be7331ea3deb0227d92c75470060f81e76d73624))
* implement Animosity mechanic with 5 variants ([#133](https://github.com/Ryxeuf/fantasy-football-game/issues/133)) ([63c5517](https://github.com/Ryxeuf/fantasy-football-game/commit/63c5517ae36bebf8802ac51a652e0c554c3035ba))
* implement BB3 Season 2 inducement system (B2.1) ([#115](https://github.com/Ryxeuf/fantasy-football-game/issues/115)) ([ec1122b](https://github.com/Ryxeuf/fantasy-football-game/commit/ec1122b31eb9eece3b3d2067cab753669142aae6))
* implement Hypnotic Gaze special action (B2.9) ([#136](https://github.com/Ryxeuf/fantasy-football-game/issues/136)) ([c95fd19](https://github.com/Ryxeuf/fantasy-football-game/commit/c95fd19af50cb49bcf53585764678708ee5502b8))
* implement Loner reroll limitation (B1.5) ([#104](https://github.com/Ryxeuf/fantasy-football-game/issues/104)) ([fd2eb91](https://github.com/Ryxeuf/fantasy-football-game/commit/fd2eb91fcb5432e41d14e45e97d05ba3c2f0768c))
* implement Prayers to Nuffle with 16 real effects (B2.3) ([#117](https://github.com/Ryxeuf/fantasy-football-game/issues/117)) ([a9d71de](https://github.com/Ryxeuf/fantasy-football-game/commit/a9d71ded07c536b85a4e2a58047c301cbeca9c76))
* implement Projectile Vomit special action mechanic ([#137](https://github.com/Ryxeuf/fantasy-football-game/issues/137)) ([18fc809](https://github.com/Ryxeuf/fantasy-football-game/commit/18fc809316d454d0b5a4311a6d2178b9409b21ca))
* implement Regeneration skill mechanic ([#107](https://github.com/Ryxeuf/fantasy-football-game/issues/107)) ([2e65169](https://github.com/Ryxeuf/fantasy-football-game/commit/2e65169551da0efc22d807da8cfa7a54dffe814b))
* implement special rules for top 10 star players (B3.1) ([#119](https://github.com/Ryxeuf/fantasy-football-game/issues/119)) ([dfeb008](https://github.com/Ryxeuf/fantasy-football-game/commit/dfeb008b424f0b033fdc68611950d13e4a33b583))
* implement Throw Team-Mate mechanic (B2.4) ([#135](https://github.com/Ryxeuf/fantasy-football-game/issues/135)) ([b3b726e](https://github.com/Ryxeuf/fantasy-football-game/commit/b3b726edb4f9ddbe1d631d0e61ed552a2f01d4f9))
* implement Wrestle skill effect (B1.6) ([#103](https://github.com/Ryxeuf/fantasy-football-game/issues/103)) ([66d7e55](https://github.com/Ryxeuf/fantasy-football-game/commit/66d7e55c5da498d537e505aae76c01d6acc7f7c6))
* push notification UI permission & preferences (G.5) ([#141](https://github.com/Ryxeuf/fantasy-football-game/issues/141)) ([2fba43f](https://github.com/Ryxeuf/fantasy-football-game/commit/2fba43f8b652c9ea221bdd98c3f19b9eaab0ba08))
* Secret Weapons expulsion at end of drive (B2.5) ([#132](https://github.com/Ryxeuf/fantasy-football-game/issues/132)) ([173a70f](https://github.com/Ryxeuf/fantasy-football-game/commit/173a70f80b2de2aef9fd9eabf9a8ca83587d3517))
* smart "C'est votre tour" push notification (G.3) ([#139](https://github.com/Ryxeuf/fantasy-football-game/issues/139)) ([e199a70](https://github.com/Ryxeuf/fantasy-football-game/commit/e199a707e9bd4d56dc53c0515b7fac61b141da57))
* smart "Match trouvé" push notification (G.4) ([#140](https://github.com/Ryxeuf/fantasy-football-game/issues/140)) ([87f9b40](https://github.com/Ryxeuf/fantasy-football-game/commit/87f9b40a7c2d5144b66cacb49896699afcf51041))
* WebSocket notification for matchmaking (C.4) ([#125](https://github.com/Ryxeuf/fantasy-football-game/issues/125)) ([1beddfb](https://github.com/Ryxeuf/fantasy-football-game/commit/1beddfb8418bc59d615f61ed844ecdce171a3422))


### 🐛 Bug Fixes

* add project-level MCP config and resilient next-feature prompt ([3e8e54b](https://github.com/Ryxeuf/fantasy-football-game/commit/3e8e54bd8d2b90e848c519f67fbb8927f346fcd5))
* resolve pre-match session bugs preventing player placement ([#120](https://github.com/Ryxeuf/fantasy-football-game/issues/120)) ([fd7ee22](https://github.com/Ryxeuf/fantasy-football-game/commit/fd7ee22685e97ef5309b4c3cd65e1130208243a1))
* wire missing weather conditions into game flow (I.8) ([#147](https://github.com/Ryxeuf/fantasy-football-game/issues/147)) ([78ad1c4](https://github.com/Ryxeuf/fantasy-football-game/commit/78ad1c47977dbb909754156c2d424da95e3dd9e3))

## [1.48.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.47.2...v1.48.0) (2026-04-03)


### ✨ Features

* add post-touchdown re-kickoff with KO recovery (B1.9) ([#101](https://github.com/Ryxeuf/fantasy-football-game/issues/101)) ([7d43fb4](https://github.com/Ryxeuf/fantasy-football-game/commit/7d43fb493f5290a649f372df2e6d84b78242f662))
* implement Apothecary rule (B1.2-3) ([f3c2e52](https://github.com/Ryxeuf/fantasy-football-game/commit/f3c2e5267710001d9d153ea83b94a7309b584add))
* synchronize game actions via WebSocket (A.6) ([#98](https://github.com/Ryxeuf/fantasy-football-game/issues/98)) ([06d28b2](https://github.com/Ryxeuf/fantasy-football-game/commit/06d28b25febe497906c66a4399b61a5038b2e3b2))
* wire Block/Push/FollowUp popups in online match (UI-1) ([#99](https://github.com/Ryxeuf/fantasy-football-game/issues/99)) ([d9af895](https://github.com/Ryxeuf/fantasy-football-game/commit/d9af895efca7e5cc3765dc8a035327a5ca420445))
* wire interactive Reroll popup (UI-2) ([#100](https://github.com/Ryxeuf/fantasy-football-game/issues/100)) ([61f2cdb](https://github.com/Ryxeuf/fantasy-football-game/commit/61f2cdba2ac67c3e3ca7a33c190caf0e7c0649f7))

## [1.47.2](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.47.1...v1.47.2) (2026-04-03)


### 🐛 Bug Fixes

* use workflow_run trigger to avoid auto-merge racing CI ([d65edb2](https://github.com/Ryxeuf/fantasy-football-game/commit/d65edb212a83b099080657f6c9f786a7ffc95e39))

## [1.47.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.47.0...v1.47.1) (2026-04-03)


### 🐛 Bug Fixes

* resolve markdown nesting issue in improved prompt ([dbd9af5](https://github.com/Ryxeuf/fantasy-football-game/commit/dbd9af576cad5b0d210549a4d1bbfd56244cba23))


### 📝 Documentation

* restore systematic PR creation step in improved prompt ([0ab7787](https://github.com/Ryxeuf/fantasy-football-game/commit/0ab7787b091989e700609aba26599e686e3519e1))
* review agents and prompt, add 2 missing specialized agents ([d5e3bbc](https://github.com/Ryxeuf/fantasy-football-game/commit/d5e3bbc5ae30fd9c153926868bda3057ca5f90b0))

## [1.47.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.46.0...v1.47.0) (2026-04-03)


### ✨ Features

* add useGameSocket hook for real-time WebSocket updates (A.5) ([112270d](https://github.com/Ryxeuf/fantasy-football-game/commit/112270d0490b3ab3c8fea2e2273b5d73120486ed))

## [1.46.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.45.0...v1.46.0) (2026-04-03)


### ✨ Features

* broadcast gameState via WebSocket after each action (A.4) ([fc1db14](https://github.com/Ryxeuf/fantasy-football-game/commit/fc1db14c3b11ec021f72f6fa032ff559f9964c6a))

## [1.45.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.44.2...v1.45.0) (2026-04-03)


### ✨ Features

* wire skill-registry into game engine via skill-bridge (B0.1) ([1cc7d70](https://github.com/Ryxeuf/fantasy-football-game/commit/1cc7d7000e2dd38ad284e4bd773289f082aa611b))

## [1.44.2](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.44.1...v1.44.2) (2026-04-02)


### 🐛 Bug Fixes

* crowd injury now promotes stunned to KO (BB3 rules) ([1bed237](https://github.com/Ryxeuf/fantasy-football-game/commit/1bed2377cf6b21a2ee046efae1a31fdc7d92c0cf))
* sprint 0 — critical bugfixes and security hardening ([1cbffa1](https://github.com/Ryxeuf/fantasy-football-game/commit/1cbffa1e98577b8f8f78ca83997b52e0fb1d9ad0))
* use const for resultState in blocking.ts (lint error) ([7661079](https://github.com/Ryxeuf/fantasy-football-game/commit/7661079e939afb91b8f061a6d7d51fe623a1be99))


### 📝 Documentation

* update roadmap with full audit findings (2026-04-02) ([46aca38](https://github.com/Ryxeuf/fantasy-football-game/commit/46aca384ad002d1537f9421543324291613ce740))

## [1.44.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.44.0...v1.44.1) (2026-03-31)


### ⚡ Performance Improvements

* improve website performance across images, fonts, API calls, and caching ([29cb7f7](https://github.com/Ryxeuf/fantasy-football-game/commit/29cb7f7343b9454bed68e419ce079514389f4329))

## [1.44.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.43.0...v1.44.0) (2026-03-31)


### ✨ Features

* **A.3:** authenticate WebSocket connections via JWT ([0357a0e](https://github.com/Ryxeuf/fantasy-football-game/commit/0357a0e063e66c8b9de68ee0c92ed261f3fc14e1))

## [1.43.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.42.0...v1.43.0) (2026-03-31)


### ✨ Features

* **QW.1:** wire D.5/D.6/D.8 into online match routes ([3150c71](https://github.com/Ryxeuf/fantasy-football-game/commit/3150c71f548e679c961ed5dab7845ce52ab7ef44))


### 🐛 Bug Fixes

* resolve merge conflicts with main for PR [#86](https://github.com/Ryxeuf/fantasy-football-game/issues/86) ([82dc9dc](https://github.com/Ryxeuf/fantasy-football-game/commit/82dc9dce986580d176e0407bec1a9c561df2a39a)), closes [#88](https://github.com/Ryxeuf/fantasy-football-game/issues/88)

## [1.42.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.41.0...v1.42.0) (2026-03-30)


### ✨ Features

* **A.2:** create game rooms by matchId via socket.io ([#87](https://github.com/Ryxeuf/fantasy-football-game/issues/87)) ([137f326](https://github.com/Ryxeuf/fantasy-football-game/commit/137f3263202e34a5f9a6b583c76aaa38f7a8db3a))
* **QW.1:** wire D.5/D.6/D.8 into online match routes ([#85](https://github.com/Ryxeuf/fantasy-football-game/issues/85)) ([407aefe](https://github.com/Ryxeuf/fantasy-football-game/commit/407aefe760d38ef462efde63915c67210e05f134))
* **QW.2:** wire PostMatchSPP into online match flow ([0b2962d](https://github.com/Ryxeuf/fantasy-football-game/commit/0b2962dd829b68af16b9c78a4f10432d1cacc208))


### 📝 Documentation

* audit roadmap, update statuses, reprioritize and add quick wins ([f45a50d](https://github.com/Ryxeuf/fantasy-football-game/commit/f45a50d7a6d2ba0d5f09854b78caec90d2acc4d0))

## [1.41.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.40.0...v1.41.0) (2026-03-30)


### ✨ Features

* **A.1:** install socket.io and attach to Express HTTP server ([4088878](https://github.com/Ryxeuf/fantasy-football-game/commit/408887809726b3169e557a7bf86fce0bdd521b1d))
* **D.7:** add treasury-based purchases between matches ([#82](https://github.com/Ryxeuf/fantasy-football-game/issues/82)) ([2aebcbc](https://github.com/Ryxeuf/fantasy-football-game/commit/2aebcbcc8eb1e5339fa11fc38dcc3d86342a343b))

## [1.40.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.39.0...v1.40.0) (2026-03-30)


### ✨ Features

* **D.1:** SPP tracking en match ([#71](https://github.com/Ryxeuf/fantasy-football-game/issues/71)) ([688034b](https://github.com/Ryxeuf/fantasy-football-game/commit/688034b52678de46d095edde89351f9b8a494214))
* **D.2:** add post-match SPP attribution screen ([#77](https://github.com/Ryxeuf/fantasy-football-game/issues/77)) ([348c205](https://github.com/Ryxeuf/fantasy-football-game/commit/348c20554f63f2fe81c7c0f54f6b34d214267400))
* **D.3:** implement level-up skill choice with SPP validation ([#78](https://github.com/Ryxeuf/fantasy-football-game/issues/78)) ([4cd7319](https://github.com/Ryxeuf/fantasy-football-game/commit/4cd73194c9ee5d89a983d4b9ec27b469c1919043))
* **D.5:** persist permanent injuries after match completion ([#75](https://github.com/Ryxeuf/fantasy-football-game/issues/75)) ([fdb7c36](https://github.com/Ryxeuf/fantasy-football-game/commit/fdb7c3685a74e328fb8d9089d58fd11e521edf6d))
* **D.6:** persist player deaths after match completion ([#73](https://github.com/Ryxeuf/fantasy-football-game/issues/73)) ([2550494](https://github.com/Ryxeuf/fantasy-football-game/commit/25504949433777d335e9d46d0e2301534e9d0a3f))
* **D.8:** connect journeymen auto-add to persistence layer ([#74](https://github.com/Ryxeuf/fantasy-football-game/issues/74)) ([2fef364](https://github.com/Ryxeuf/fantasy-football-game/commit/2fef364e2e2a5df9af7c2e76dcc4fe839ca794dc))


### 🐛 Bug Fixes

* apply auth rate limiter only to login/register, not all /auth routes ([11dfd79](https://github.com/Ryxeuf/fantasy-football-game/commit/11dfd79163964ba30b04b4141d83a4ceca1f1a2a))
* **D.3:** address Codex review — SQLite schema, server-side random, team values ([#80](https://github.com/Ryxeuf/fantasy-football-game/issues/80)) ([b391d93](https://github.com/Ryxeuf/fantasy-football-game/commit/b391d93fcc55dc5c94ca23869233115624ca8f3b))
* **D.5:** sync SQLite schema + reset missNextMatch ([#76](https://github.com/Ryxeuf/fantasy-football-game/issues/76)) ([223ea05](https://github.com/Ryxeuf/fantasy-football-game/commit/223ea05b66ce9d4858baad31560451aefb60bcea)), closes [#75](https://github.com/Ryxeuf/fantasy-football-game/issues/75)

## [1.39.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.38.0...v1.39.0) (2026-03-29)


### ✨ Features

* **mobile:** add login screen (task 4.1) ([#60](https://github.com/Ryxeuf/fantasy-football-game/issues/60)) ([417adcc](https://github.com/Ryxeuf/fantasy-football-game/commit/417adccb8f96885e39ac43ab1fc8f8e06791d71e))
* **mobile:** add minimal match history screen (task 4.11) ([#63](https://github.com/Ryxeuf/fantasy-football-game/issues/63)) ([868a728](https://github.com/Ryxeuf/fantasy-football-game/commit/868a7284797eea82056b0ddb95d0383cf4848cc7))
* **mobile:** add register screen (task 4.2) ([#59](https://github.com/Ryxeuf/fantasy-football-game/issues/59)) ([e229e4d](https://github.com/Ryxeuf/fantasy-football-game/commit/e229e4d6d9a27a51efd5f78ee300bccd0a8d17df))
* **mobile:** highlight playable cells on tap (task 4.6) ([#67](https://github.com/Ryxeuf/fantasy-football-game/issues/67)) ([111d1a1](https://github.com/Ryxeuf/fantasy-football-game/commit/111d1a1ce1704008d843a9895b2872210879ce25))
* **mobile:** implement login screen with SecureStore auth (task 4.1) ([#61](https://github.com/Ryxeuf/fantasy-football-game/issues/61)) ([1c904e1](https://github.com/Ryxeuf/fantasy-football-game/commit/1c904e12b28ee32cad605de6f613b8c76fc669ae))
* **mobile:** lobby screen with create/join match (task 4.3) ([#62](https://github.com/Ryxeuf/fantasy-football-game/issues/62)) ([032e040](https://github.com/Ryxeuf/fantasy-football-game/commit/032e0409df8120abf163c0c64c8992c65a5ad96d))
* **mobile:** pinch-to-zoom & pan-to-drag on board (4.4 & 4.5) ([#65](https://github.com/Ryxeuf/fantasy-football-game/issues/65)) ([309fdbd](https://github.com/Ryxeuf/fantasy-football-game/commit/309fdbd75d230ea43055ed5ce36c269fc778742c))
* **mobile:** tween animations for player & ball movement (4.8) ([#69](https://github.com/Ryxeuf/fantasy-football-game/issues/69)) ([c41316c](https://github.com/Ryxeuf/fantasy-football-game/commit/c41316c85073c8b4f385a458aa90f2d72fbd8e6c))
* tackle zone heatmap overlay + Zod input validation (P1 complete) ([#58](https://github.com/Ryxeuf/fantasy-football-game/issues/58)) ([7f0f61a](https://github.com/Ryxeuf/fantasy-football-game/commit/7f0f61ac44d9a9ee0bf7236f9e5dcbfa4e6cbcd6))


### 🐛 Bug Fixes

* **mobile:** route pending matches to history, not gameplay ([#68](https://github.com/Ryxeuf/fantasy-football-game/issues/68)) ([12ea3d7](https://github.com/Ryxeuf/fantasy-football-game/commit/12ea3d76408cacbe9b9e42d84e2d61d26900e3e8))
* normalize serialized gameState in turn summaries ([#64](https://github.com/Ryxeuf/fantasy-football-game/issues/64)) ([4185a07](https://github.com/Ryxeuf/fantasy-football-game/commit/4185a07b0f40efe0617ff9596671373eca070d56))

## [1.38.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.37.0...v1.38.0) (2026-03-23)


### ✨ Features

* **ui:** add board zoom/pan/reset and opponent turn indicator ([94b683f](https://github.com/Ryxeuf/fantasy-football-game/commit/94b683f5474093452159ff07bfc1f140a2169fff)), closes [#41](https://github.com/Ryxeuf/fantasy-football-game/issues/41)

## [1.37.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.36.1...v1.37.0) (2026-03-22)


### ✨ Features

* **server:** add rate limiting on auth and API routes ([6ef43b6](https://github.com/Ryxeuf/fantasy-football-game/commit/6ef43b6080b25ab0343b4b952d08170b82320ddd))


### 📝 Documentation

* add comprehensive agent guides for all development roles ([#53](https://github.com/Ryxeuf/fantasy-football-game/issues/53)) ([937cfee](https://github.com/Ryxeuf/fantasy-football-game/commit/937cfee9778d1ccabbf712f9a3a4e3e3860d2553))


### ♻️ Code Refactoring

* reorganize roadmap into DONE archive and prioritized TODO backlog ([#54](https://github.com/Ryxeuf/fantasy-football-game/issues/54)) ([c9cb83f](https://github.com/Ryxeuf/fantasy-football-game/commit/c9cb83f7b55b26e4dce5fb6491a35004f28f3a69))

## [1.36.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.36.0...v1.36.1) (2026-03-18)


### 🐛 Bug Fixes

* add postinstall script to generate Prisma client for typecheck ([7f168e2](https://github.com/Ryxeuf/fantasy-football-game/commit/7f168e220c8fc06d35f2778a5e2eb5b22a4f2eb9))
* handle missing prisma schema in postinstall and add checks permission to auto-merge ([4a7c849](https://github.com/Ryxeuf/fantasy-football-game/commit/4a7c8494b008c25dfeb213d2b03724d2f7373a17))

## [1.36.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.35.0...v1.36.0) (2026-03-17)


### ✨ Features

* enhance deployment commands and improve game state handling ([6fd3165](https://github.com/Ryxeuf/fantasy-football-game/commit/6fd31656feaf1a004529e4a0cbab3c8e2f2510e9))

## [1.35.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.34.0...v1.35.0) (2026-03-17)


### ✨ Features

* enhance deployment commands and improve game state handling ([a9dee76](https://github.com/Ryxeuf/fantasy-football-game/commit/a9dee76a0eb4e486926ba793b381c91f417bfe92))

## [1.34.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.33.0...v1.34.0) (2026-03-17)


### ✨ Features

* enhance deployment commands and improve game state handling ([8606877](https://github.com/Ryxeuf/fantasy-football-game/commit/86068778cccbeec01e53e2c4366380757c32dc54))

## [1.33.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.32.1...v1.33.0) (2026-03-17)


### ✨ Features

* enhance deployment commands and improve game state handling ([ed9fef1](https://github.com/Ryxeuf/fantasy-football-game/commit/ed9fef17bb144ea1640069c5a3cc49a1c1df782a))

## [1.32.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.32.0...v1.32.1) (2026-03-17)


### 🐛 Bug Fixes

* **ci:** remove explicit pnpm version, use packageManager from package.json ([6a159fc](https://github.com/Ryxeuf/fantasy-football-game/commit/6a159fcf01c1f0b27a6e4d4580b6d34bc349cbee))
* **ci:** resolve CI failures and address PR review feedback ([6c5ece1](https://github.com/Ryxeuf/fantasy-football-game/commit/6c5ece1c24735267152aa879b42e794176ebc8ee))
* **lint:** fix all lint errors in game-engine ([5b6c85d](https://github.com/Ryxeuf/fantasy-football-game/commit/5b6c85dca2c7c38120921743e49534d145e62b88))
* resolve build errors across game-engine and web app ([72658af](https://github.com/Ryxeuf/fantasy-football-game/commit/72658afa925a960587c99a332e3bb59d04f00768))

## [1.32.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.31.0...v1.32.0) (2026-03-17)


### ✨ Features

* **admin:** add full match management to admin panel ([3dbb4d4](https://github.com/Ryxeuf/fantasy-football-game/commit/3dbb4d4282fb593002029ddbfa2db2b4829a6f8a))

## [1.31.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.30.2...v1.31.0) (2026-03-17)


### ✨ Features

* redesign mobile game UI with responsive layout and player initials ([637dbe8](https://github.com/Ryxeuf/fantasy-football-game/commit/637dbe8e2191b1c48473b64b2bb211f6390427cf))


### 🐛 Bug Fixes

* single board instance for ref + dynamic cellSize for drop coords ([b27ec95](https://github.com/Ryxeuf/fantasy-football-game/commit/b27ec950cbb139781e193231be4d5f14eae8878a))

## [1.30.2](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.30.1...v1.30.2) (2026-03-16)


### 🐛 Bug Fixes

* update match route to use 'roster' instead of 'rosterName' and enhance game state retrieval ([204a477](https://github.com/Ryxeuf/fantasy-football-game/commit/204a477539b3d55b31302ccbb9751b5544ecdb5e))

## [1.30.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.30.0...v1.30.1) (2026-03-16)


### 🐛 Bug Fixes

* remove production API_BASE override that broke /match/* routes ([a15c562](https://github.com/Ryxeuf/fantasy-football-game/commit/a15c56205f823b3ba4201149fcbaa4c7137d196d))

## [1.30.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.29.0...v1.30.0) (2026-03-14)


### ✨ Features

* enhance match management and gameplay features ([fb9ebdd](https://github.com/Ryxeuf/fantasy-football-game/commit/fb9ebdd48d7cc4c8297b720b3cb2ecdbaaabf729))
* **game-engine:** complete phases 1-3 to 100% — skills, weather, kickoff, probabilities, referee ([a92697b](https://github.com/Ryxeuf/fantasy-football-game/commit/a92697b5df7f992d6b0d1592fa470659c4b23dbf))
* implement online play features and enhance navigation ([1058191](https://github.com/Ryxeuf/fantasy-football-game/commit/1058191f908950be005cdee7e8ebc15c99a1c4bf))

## [1.29.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.28.0...v1.29.0) (2025-11-27)


### ✨ Features

* enhance team filtering and translations for tiers and seasons ([4654e63](https://github.com/Ryxeuf/fantasy-football-game/commit/4654e63cc4a06304422a3b05309953c369deac56))

## [1.28.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.27.0...v1.28.0) (2025-11-26)


### ✨ Features

* add ruleset selection and fallback indicator in team detail page ([5753e93](https://github.com/Ryxeuf/fantasy-football-game/commit/5753e931de0645e2e2ef2b0a3f49c607ec6e0412))

## [1.27.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.26.0...v1.27.0) (2025-11-25)


### ✨ Features

* add script to scrape Blood Bowl team data from mordorbihan.fr ([d92fa96](https://github.com/Ryxeuf/fantasy-football-game/commit/d92fa96cf8e7bcb7ddce9286fb169db3688bb9c9))
* add Season 3 rosters from mordorbihan.fr ([73fdc7b](https://github.com/Ryxeuf/fantasy-football-game/commit/73fdc7b5f488f0d41268d694395601713b42d5c3))


### 🐛 Bug Fixes

* suppression de la catégorie Scélérates en Saison 2 ([6e66c90](https://github.com/Ryxeuf/fantasy-football-game/commit/6e66c90d0999a011b7f78b8c3645d05c336abb45))
* update seed to use ruleset for skills lookup ([ca882ea](https://github.com/Ryxeuf/fantasy-football-game/commit/ca882ea693095ae197e4ab991248c1387738b0b0))

## [1.26.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.25.0...v1.26.0) (2025-11-25)


### ✨ Features

* refactor star player management for multi-ruleset support ([2af9fc6](https://github.com/Ryxeuf/fantasy-football-game/commit/2af9fc62aea99e970ef01241e6f8d089e3cd50ed))

## [1.25.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.24.0...v1.25.0) (2025-11-25)


### ✨ Features

* ajout duplication rosters/positions et édition ruleset ([e51b715](https://github.com/Ryxeuf/fantasy-football-game/commit/e51b715645e5c74b780a883ccf56bdaa27178a4d))
* support multi-ruleset (S2/S3) avec administration complète ([7c6026a](https://github.com/Ryxeuf/fantasy-football-game/commit/7c6026a621c762579426094b4a6384373bfae3d3))


### 🐛 Bug Fixes

* add missing isValidRuleset function ([fb273c7](https://github.com/Ryxeuf/fantasy-football-game/commit/fb273c74ffcf054b0a4c55ce3306ba7429b3d43c))

## [1.24.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.23.0...v1.24.0) (2025-11-21)


### ✨ Features

* **auth:** add password change functionality with validation and error handling ([5430bf1](https://github.com/Ryxeuf/fantasy-football-game/commit/5430bf102b93b034de93360629224338da57bae9))

## [1.23.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.22.0...v1.23.0) (2025-11-20)


### ✨ Features

* **web:** affiche la version depuis le package.json racine dans le footer ([55b1263](https://github.com/Ryxeuf/fantasy-football-game/commit/55b126389e7688596ee45feccbcaa97f901b0080))

## [1.22.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.21.0...v1.22.0) (2025-11-20)


### ✨ Features

* scoring coupes et visibilité des matchs locaux ([101160a](https://github.com/Ryxeuf/fantasy-football-game/commit/101160a4746805ce7d1b9550b916541221202cdc))

## [1.21.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.20.0...v1.21.0) (2025-11-19)


### ✨ Features

* ajout de nouvelles fonctionnalités et améliorations pour les rosters et les joueurs ([7385944](https://github.com/Ryxeuf/fantasy-football-game/commit/73859443b29d800c5adb026cea526de084f53312))

## [1.20.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.19.0...v1.20.0) (2025-11-14)


### ✨ Features

* ajout des informations de pré-match (fans et météo) dans l'interface et l'export PDF ([b8a662a](https://github.com/Ryxeuf/fantasy-football-game/commit/b8a662a694ccb900ba484b48c1a7a0188b363a14))

## [1.19.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.18.0...v1.19.0) (2025-11-14)


### ✨ Features

* ajout récapitulatif match local terminé avec export PDF ([a62d1e4](https://github.com/Ryxeuf/fantasy-football-game/commit/a62d1e4dc3d0193f0729b2edb40976d23d110505))

## [1.18.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.17.0...v1.18.0) (2025-11-14)


### ✨ Features

* ajout administration équipes, action interception et gestion état joueur en cas d'échec ([39e5b7b](https://github.com/Ryxeuf/fantasy-football-game/commit/39e5b7bd5a94075e38fd0555fb39dc55176febdf))

## [1.17.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.16.0...v1.17.0) (2025-11-14)


### ✨ Features

* ajout de la gestion des matchs locaux dans l'interface admin ([3abb207](https://github.com/Ryxeuf/fantasy-football-game/commit/3abb2071dbb4bda40134217b28b4895445449552))
* système de gestion manuelle des actions pour matchs locaux ([53904c0](https://github.com/Ryxeuf/fantasy-football-game/commit/53904c0b4d71e604629c7c45e27bcede6f7d6f2b))

## [1.16.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.15.0...v1.16.0) (2025-11-13)


### ✨ Features

* amélioration de la création de matchs locaux avec validation par deux joueurs ([907a4ad](https://github.com/Ryxeuf/fantasy-football-game/commit/907a4ad819467813349c30c21742e3cd4ca3c9dd))

## [1.15.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.14.1...v1.15.0) (2025-11-13)


### ✨ Features

* amélioration du dashboard admin et gestion complète des coupes ([ace7975](https://github.com/Ryxeuf/fantasy-football-game/commit/ace7975d48f488b6c115bb8918e7de59dadc1664))

## [1.14.1](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.14.0...v1.14.1) (2025-11-13)


### 🐛 Bug Fixes

* correction des slugs de compétences dans les positions et star players ([4b0cc4e](https://github.com/Ryxeuf/fantasy-football-game/commit/4b0cc4e28a536eb7bf6cfde4ea2da65e8667c86d))

## [1.14.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.13.0...v1.14.0) (2025-11-13)


### ✨ Features

* Make it work on prod ([185f2ae](https://github.com/Ryxeuf/fantasy-football-game/commit/185f2ae6e156cd3bcbcc4972e20e5157a01ff1fa))

## [1.13.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.12.0...v1.13.0) (2025-11-10)


### ✨ Features

* enhance nufflearena service configuration in docker-compose.yml ([2085458](https://github.com/Ryxeuf/fantasy-football-game/commit/2085458bb6d2f6e9b00338f5c51fa8855de03a14))

## [1.12.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.11.0...v1.12.0) (2025-11-10)


### ✨ Features

* implement roster and skill management pages in admin panel ([68b6c2d](https://github.com/Ryxeuf/fantasy-football-game/commit/68b6c2d7fb5f709ee7d9032665c15cce923e2a6a))

## [1.11.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.10.0...v1.11.0) (2025-11-10)


### ✨ Features

* add routes management page and update admin layout ([e80f77b](https://github.com/Ryxeuf/fantasy-football-game/commit/e80f77ba3ac3d10b5c4752df89a7f29f395d2c1e))

## [1.10.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.9.0...v1.10.0) (2025-11-10)


### ✨ Features

* enhance docker-compose and auth-client configuration ([42cc27c](https://github.com/Ryxeuf/fantasy-football-game/commit/42cc27cf0f610c3a2ea5248d412cfb62dc6ee7ae))

## [1.9.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.8.0...v1.9.0) (2025-11-10)


### ✨ Features

* update nufflearena service configuration in docker-compose.yml ([ed4a285](https://github.com/Ryxeuf/fantasy-football-game/commit/ed4a2853e4dbbf3fb2613868d75c3160f697ef6c))

## [1.8.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.7.0...v1.8.0) (2025-11-10)


### ✨ Features

* ajout d'améliorations SEO pour Nuffle Arena ([fc19557](https://github.com/Ryxeuf/fantasy-football-game/commit/fc195570a5105dfde318ceb29131e7c2f2cafcb2))


### 🐛 Bug Fixes

* update PostgreSQL port mapping in docker-compose.yml ([867d02a](https://github.com/Ryxeuf/fantasy-football-game/commit/867d02a512ce61b0afbd71264cadf3dad00808ce))

## [1.7.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.6.0...v1.7.0) (2025-11-07)


### ✨ Features

* mise à jour de toutes les pages pour utiliser la largeur totale de l'écran ([342c0a1](https://github.com/Ryxeuf/fantasy-football-game/commit/342c0a1ae197edb357bfecb1e7aa94a8bc8ac3ee))

## [1.6.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.5.0...v1.6.0) (2025-11-07)


### ✨ Features

* Ajout des traductions EN pour les pages teams ([54fec86](https://github.com/Ryxeuf/fantasy-football-game/commit/54fec86e1cc5029e7df9537a47bfdf422b4c85c0))
* amélioration de la page des équipes et ajout d'exports PDF multiples ([4a21df1](https://github.com/Ryxeuf/fantasy-football-game/commit/4a21df1490938cb1949f4f83b6b301ba7daa528e))

## [1.5.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.4.0...v1.5.0) (2025-11-06)


### ✨ Features

* Ajout de la gestion des noms EN pour les rosters ([c4ce82d](https://github.com/Ryxeuf/fantasy-football-game/commit/c4ce82d5852b5f6ab16499ca53701befc9ec6983))

## [1.4.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.3.0...v1.4.0) (2025-11-06)


### ✨ Features

* ajout de nouvelles compétences et mise à jour des slugs pour les variantes loner ([afa12fc](https://github.com/Ryxeuf/fantasy-football-game/commit/afa12fc9c1e368cd259482a366916e804b911f7a))


### 🐛 Bug Fixes

* corrections roster Snotlings et amélioration affichage compétences ([2563cc3](https://github.com/Ryxeuf/fantasy-football-game/commit/2563cc39b86db94b7499ebf712a72808a84e7ce2))

## [1.3.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.2.0...v1.3.0) (2025-11-01)


### ✨ Features

* ajout de 7 nouvelles équipes (Amazones, Hauts Elfes, Khorne, Vampires, Rois des Tombes, Gnomes, Nordiques) ([7bbabdd](https://github.com/Ryxeuf/fantasy-football-game/commit/7bbabdd520b8ea64abf97ef8a2bb56a3191f070b))

## [1.2.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.1.0...v1.2.0) (2025-10-31)


### ✨ Features

* ajout des tiers et statut NAF pour les équipes + pages de consultation ([6166af2](https://github.com/Ryxeuf/fantasy-football-game/commit/6166af28974968a2035e8423e6cc9de564c4b7d9))
* ajout du champ Patreon au modèle User et mise à jour des routes associées ([161f9ec](https://github.com/Ryxeuf/fantasy-football-game/commit/161f9ec30879533288de901204c17d96540db2fa))
* ajout du support multilingue avec le contexte de langue ([8eb666c](https://github.com/Ryxeuf/fantasy-football-game/commit/8eb666c5c952702f3997895c129dd717e1b6b79c))

## [1.1.0](https://github.com/Ryxeuf/fantasy-football-game/compare/v1.0.0...v1.1.0) (2025-10-31)


### ✨ Features

* ajout des champs profil utilisateur (coachName, firstName, lastName, dateOfBirth) ([f7cce0f](https://github.com/Ryxeuf/fantasy-football-game/commit/f7cce0f7c6587a5726d4888ab3bcc8245b91e809))

## 1.0.0 (2025-10-31)


### ✨ Features

* add interactive board with selection and mobile renderer ([20adb5d](https://github.com/Ryxeuf/fantasy-football-game/commit/20adb5dff39bf7001dfc63408d3defbdfe108d9a))
* Ajout d'un lien Star Players dans le header ([53c10fb](https://github.com/Ryxeuf/fantasy-football-game/commit/53c10fb6fcc0afa3b0ef90df617456525688cb09))
* Ajout de 15 nouveaux Star Players et pages de visualisation ([117caa2](https://github.com/Ryxeuf/fantasy-football-game/commit/117caa211e47bc36478ce7ca495dc87ff6ec07b1))
* Ajout de 27 nouveaux Star Players - Liste complète de 67 joueurs ([b2500e8](https://github.com/Ryxeuf/fantasy-football-game/commit/b2500e8bb9458d32a665591f91b78711c1e8ca98))
* Ajout de l'export PDF des rosters d'équipe ([9959ac9](https://github.com/Ryxeuf/fantasy-football-game/commit/9959ac9baaffe4fa758e1cf81b4a7174366f58e2))
* ajout de la configuration TypeScript pour l'application mobile et mise à jour du serveur avec Express et CORS; ajout d'une route de santé pour l'API ([dba92f9](https://github.com/Ryxeuf/fantasy-football-game/commit/dba92f913949a0e296c370d875af3f315756f1c1))
* Ajout des tooltips des compétences pour les Star Players ([2f8ae3f](https://github.com/Ryxeuf/fantasy-football-game/commit/2f8ae3faa723c8d850a97af75403fcb0e093c9dc))
* ajout du fichier pnpm-lock.yaml et mise à jour des dépendances dans les fichiers package.json pour les applications mobile et serveur; ajustements dans les configurations TypeScript et modifications des imports dans le serveur ([84750cf](https://github.com/Ryxeuf/fantasy-football-game/commit/84750cf8f17ba3a284888f0defaaa073e26906c9))
* ajouter de nouveaux endpoints pour récupérer les équipes et l'état du jeu d'un match, améliorer la logique de démarrage de match à partir de l'état pré-match, et mettre à jour l'interface utilisateur pour gérer les noms d'équipes et l'état du jeu. ([5164e9e](https://github.com/Ryxeuf/fantasy-football-game/commit/5164e9ee19847c89fb43527a9b4550ca107bc106))
* ajouter de nouveaux fichiers de test pour les compétences et mettre à jour les données des compétences de base pour les équipes, en normalisant les noms des compétences et en améliorant l'affichage des tooltips avec des bordures colorées selon les catégories. ([e7618df](https://github.com/Ryxeuf/fantasy-football-game/commit/e7618df0bd42bbc3ac1f34d03a86ec5cacc24b00))
* ajouter de nouveaux fichiers HTML pour les tests de séquence complète, corriger les dimensions du terrain, et améliorer la logique de gestion des joueurs et des événements de kickoff dans le code du serveur. ([8ee43c3](https://github.com/Ryxeuf/fantasy-football-game/commit/8ee43c327092ceacd90b3a99dd8364ea8810d2f4))
* ajouter de nouvelles compétences pour les Skinks et les Elfes Sylvains, normaliser les noms d'équipe et de position dans les fichiers de configuration, et améliorer l'affichage des rosters dans les pages d'édition et de détails des équipes. ([5c45da8](https://github.com/Ryxeuf/fantasy-football-game/commit/5c45da8c24dfb312b7f31084ddad8eb7a601f917))
* ajouter des champs d'informations d'équipe pour Blood Bowl, y compris la gestion de la trésorerie, des relances, des cheerleaders, des assistants, et d'autres valeurs calculées, ainsi que des mises à jour des composants d'interface utilisateur pour refléter ces changements. ([64a01e4](https://github.com/Ryxeuf/fantasy-football-game/commit/64a01e43e2e1dd40d7854392c78a072cc28227af))
* ajouter des endpoints de réinitialisation de la base de données pour les tests, ainsi qu'un fichier de configuration de setup pour gérer le serveur de test ([a54d223](https://github.com/Ryxeuf/fantasy-football-game/commit/a54d223c8130b4813a1d43a16fa9ab4cd9a3fe38))
* ajouter des endpoints pour la gestion des joueurs d'équipe, incluant l'ajout, la suppression et la récupération des positions disponibles. Améliorer l'interface utilisateur pour permettre l'ajout et la suppression de joueurs, avec validation des données et gestion des erreurs. Inclut également des mises à jour pour afficher les statistiques des joueurs et les limites de l'équipe. ([60e4c28](https://github.com/Ryxeuf/fantasy-football-game/commit/60e4c2835450f8a879548e88a36d6a856609db0b))
* ajouter des fichiers de test pour l'API et améliorer la logique de démarrage de match en phase pré-match, incluant la récupération des données des équipes et la gestion des joueurs en réserves. ([05d37d2](https://github.com/Ryxeuf/fantasy-football-game/commit/05d37d28401a4f50a218e9ba2fad17ca9be228e3))
* ajouter des fichiers de test pour le dugout et mettre à jour les dimensions des zones dans le moteur de jeu, ainsi que modifier le composant DugoutZone pour améliorer l'affichage des joueurs ([3609eaf](https://github.com/Ryxeuf/fantasy-football-game/commit/3609eaf8bb7e67216a2b35420f3280eb7dfcf2fe))
* ajouter des fonctionnalités de gestion des blessures des joueurs, incluant le suivi des blessures subies et des effets sur les performances, avec des tests pour valider le comportement des joueurs blessés ([092fe7a](https://github.com/Ryxeuf/fantasy-football-game/commit/092fe7ac9e9e555bd54cb5ad6d34685db5254775))
* ajouter des routes pour la gestion des équipes, permettant aux utilisateurs de créer, sélectionner et afficher leurs équipes, ainsi que d'intégrer ces fonctionnalités dans l'interface utilisateur ([3dc8a99](https://github.com/Ryxeuf/fantasy-football-game/commit/3dc8a999e3d3b4b0e22f53cf3ef28a12e463835d))
* ajouter des routes pour purger les parties, récupérer les détails des matchs et résumer les informations des équipes et des coachs, ainsi que des améliorations dans la gestion des erreurs et l'affichage des scores ([e8a6cf4](https://github.com/Ryxeuf/fantasy-football-game/commit/e8a6cf450880c70631dc7bf14ca63fee27f98f25))
* ajouter des routes pour récupérer les détails d'un match par ID, améliorer la gestion des tokens et des utilisateurs authentifiés, et mettre à jour l'interface utilisateur pour la navigation entre les matchs ([85eee19](https://github.com/Ryxeuf/fantasy-football-game/commit/85eee196d02891cf4463d6cc009092daf5745cb7))
* ajouter des routes utilisateur pour récupérer les parties en cours et mettre à jour la navigation après l'authentification ([029dc14](https://github.com/Ryxeuf/fantasy-football-game/commit/029dc14e4bfea7e2e9965a7bbf20ff0d063b2028))
* ajouter des sections complètes sur les règles de jeu, les équipes, et les mécanismes de ligue et d'exhibition pour Blood Bowl, incluant des commentaires des concepteurs et des mises à jour des listes de niveaux des équipes ([177c470](https://github.com/Ryxeuf/fantasy-football-game/commit/177c470003e60f85695bda3aad0ef2d247955914))
* ajouter des sections détaillées sur les stades de Blood Bowl, y compris la disposition du terrain, les accessoires nécessaires et les règles de jeu, ainsi que des images explicatives pour améliorer la compréhension des joueurs ([6d3a84a](https://github.com/Ryxeuf/fantasy-football-game/commit/6d3a84aecbe79c10cb8cc7fd167d1f36bafeda86))
* ajouter des tests avec Vitest et mettre à jour la logique de calcul de la cible d'esquive pour prendre en compte les modificateurs négatifs ([467ba18](https://github.com/Ryxeuf/fantasy-football-game/commit/467ba18f963763576c92c97d5818277a1248eeee))
* ajouter des tests complets pour la simulation de jeu, incluant des scénarios réalistes avec blocages, follow-ups, et gestion des turnovers, ainsi que des tests de performance et de robustesse pour valider le comportement du système dans des conditions variées ([1fd9e03](https://github.com/Ryxeuf/fantasy-football-game/commit/1fd9e0356f27ff575373cf79feb61fd3b248e338))
* ajouter des tests d'intégration et de performance pour le moteur de jeu Blood Bowl, incluant des scénarios complets de jeu, des simulations de stress, et des vérifications des mouvements et des blocages, afin d'assurer la robustesse et la conformité avec les règles officielles ([a46a042](https://github.com/Ryxeuf/fantasy-football-game/commit/a46a042c9ef69b72afcc43c00d211173d0fd90bd))
* ajouter des tests pour la gestion des directions de poussée, incluant des scénarios d'intégration et de règles, afin de valider le comportement des choix de direction en fonction de la position des joueurs, avec des vérifications des résultats des mouvements et des interactions utilisateur ([160a761](https://github.com/Ryxeuf/fantasy-football-game/commit/160a761c56b82fad9130898756e655f2e7b7932f))
* ajouter des tests pour la limitation d'une seule action de blitz par tour d'équipe, incluant la vérification des compteurs de blitz, la réinitialisation au changement de tour, et la gestion des interactions entre équipes, afin de garantir la conformité avec les règles de Blood Bowl ([1e66483](https://github.com/Ryxeuf/fantasy-football-game/commit/1e664836bc94b4b61430a0934f4c3ec6ed0bddf2))
* ajouter des tests pour les bugs de continuation de mouvement et d'exactitude, et mettre à jour les vérifications de mouvement et de blocage pour inclure les conditions d'équipe ([9220687](https://github.com/Ryxeuf/fantasy-football-game/commit/92206873d77863b801130f0bc3e3aa8225f45c35))
* ajouter des tests pour les jets d'armure et de blessure, incluant des scénarios pour les échecs de blitz et les détections de turnover, afin d'assurer la conformité avec les règles de Blood Bowl et d'améliorer la robustesse du moteur de jeu ([72ea5d2](https://github.com/Ryxeuf/fantasy-football-game/commit/72ea5d2c6b6db52f2a022416503fe0e6be66ca9d))
* ajouter des tooltips complets pour les compétences "Loner (4+)", "Mighty Blow (+1)" et "Throw Team-mate", en mettant à jour le fichier skills-data.ts et en améliorant l'interface utilisateur pour afficher correctement les descriptions des compétences. Inclut également des tests pour valider les modifications. ([b08465a](https://github.com/Ryxeuf/fantasy-football-game/commit/b08465a7f3ce6bbb4161822e6d3a7ef8b851fa12))
* ajouter l'affichage des états du joueur, incluant le statut, la possession du ballon et les points de mouvement ([e744668](https://github.com/Ryxeuf/fantasy-football-game/commit/e744668b7c675b9b326e32425833335b10e9596c))
* ajouter l'affichage du numéro du joueur au centre du cercle et améliorer la gestion des bordures de sélection dans PixiBoard ([61eeddf](https://github.com/Ryxeuf/fantasy-football-game/commit/61eeddfa72ad947526b344ede5d514899db8b0cd))
* ajouter la configuration Prettier et ESLint pour le moteur de jeu Blood Bowl, incluant des standards de code dans un document dédié, ainsi qu'un script de formatage pour automatiser le processus de mise en forme et de vérification des erreurs de style ([140238c](https://github.com/Ryxeuf/fantasy-football-game/commit/140238cec31a45f634edb271ec5a33f807761878))
* ajouter la documentation complète de l'issue [#31](https://github.com/Ryxeuf/fantasy-football-game/issues/31) sur les jets de désquive et les turnovers, incluant les objectifs atteints, les nouvelles fonctionnalités, et les tests réalisés ([51c3007](https://github.com/Ryxeuf/fantasy-football-game/commit/51c30079927400186b82ec5da6144ccb89a5bb41))
* ajouter la documentation de l'architecture du projet BlooBowl et réorganiser les exports dans le moteur de jeu pour une meilleure structure, incluant des tests pour les actions et les mécaniques de jeu, ainsi que des améliorations dans la gestion des mouvements et des blocages ([72f25a4](https://github.com/Ryxeuf/fantasy-football-game/commit/72f25a4f22a509672472013af6a71273ea71e394))
* ajouter la fonction calculateDodgeModifiers pour gérer les malus d'esquive en fonction des adversaires adjacents et mettre à jour les tests associés ([03976d7](https://github.com/Ryxeuf/fantasy-football-game/commit/03976d768b85b5de261113eedad44b34ce4754e2))
* ajouter la fonction de lancer de dés de blocage avec enregistrement des résultats, et améliorer la gestion des choix de direction de poussée, permettant une interaction plus fluide lors des actions de blocage, avec des tests pour valider ces changements ([4f66837](https://github.com/Ryxeuf/fantasy-football-game/commit/4f66837882435144716756f2ad60dbb65c9229fe))
* ajouter la fonctionnalité d'acceptation de match sur la page d'attente, incluant la gestion des états de validation et des erreurs, ainsi qu'une mise à jour immédiate du résumé après acceptation. ([84217f3](https://github.com/Ryxeuf/fantasy-football-game/commit/84217f381a8d0d49c3c1075bf357fa9083a0d39d))
* ajouter la fonctionnalité de blitz, incluant la vérification des conditions de blitz, l'intégration dans les mouvements légaux, et la gestion des résultats de blitz avec des tests pour valider ces fonctionnalités ([009303a](https://github.com/Ryxeuf/fantasy-football-game/commit/009303a67f708cd2234ae3e0e3b8e43c7d3433ac))
* ajouter la fonctionnalité de calcul automatique des valeurs d'équipe dans le modèle Team, intégrer la mise à jour des valeurs après chaque match et lors de la modification des informations d'équipe, et améliorer l'interface utilisateur pour afficher les coûts des joueurs et les valeurs d'équipe calculées. ([45bd4d1](https://github.com/Ryxeuf/fantasy-football-game/commit/45bd4d1d69ed9a3004085b264739b57d12b2c1e1))
* ajouter la gestion de la fin de tour et de mi-temps, permettant de passer à la 2e mi-temps ou de terminer le match après 8 tours, avec des logs appropriés pour chaque événement ([d6bcaa7](https://github.com/Ryxeuf/fantasy-football-game/commit/d6bcaa729ebfc078059b4c700c98967e4fd78cd3))
* ajouter la gestion des actions des joueurs, incluant la vérification des actions effectuées, la possibilité de continuer à bouger, et la réinitialisation des actions au changement de tour, avec des tests pour valider le comportement ([a64a4e3](https://github.com/Ryxeuf/fantasy-football-game/commit/a64a4e3733a0d778d253d42d6f741b000e606d2a))
* ajouter la gestion des choix de direction de poussée, permettant à l'attaquant de sélectionner une direction parmi plusieurs options disponibles, avec des tests pour valider le comportement dans divers scénarios de blocage ([45797e3](https://github.com/Ryxeuf/fantasy-football-game/commit/45797e39432b1a90f0ab1a99b137722bbf25b1b5))
* ajouter la gestion des choix de follow-up, incluant une nouvelle popup pour permettre à l'attaquant de décider s'il souhaite suivre la cible après une poussée, avec des tests pour valider le comportement et l'intégration dans l'état du jeu ([2b34353](https://github.com/Ryxeuf/fantasy-football-game/commit/2b34353b9af1b3af7edc1046e3e490cbe7bf3359))
* ajouter la gestion des clics sur le terrain dans PixiBoard, améliorer l'affichage des mouvements légaux et la bordure de sélection des joueurs ([33567d0](https://github.com/Ryxeuf/fantasy-football-game/commit/33567d00fc628b5e558419913bf5b5e98081e03b))
* ajouter la gestion des jets d'armure après un échec d'esquive, avec des tests pour valider le comportement des joueurs et des résultats de dés ([63e6124](https://github.com/Ryxeuf/fantasy-football-game/commit/63e6124f969b9a5d60575cd0e9ef9e131a228266))
* ajouter la gestion des jets de dés, des turnovers et un nouveau composant d'affichage des résultats de dés Jets & turnovers (MVP) [#31](https://github.com/Ryxeuf/fantasy-football-game/issues/31) ([6a02f54](https://github.com/Ryxeuf/fantasy-football-game/commit/6a02f54e1f259a2c00444ff7ec49bd52ad89c647))
* ajouter la gestion des matchs avec acceptation et démarrage, ainsi que des tests d'intégration pour valider le comportement des matchs et des utilisateurs ([041d4ff](https://github.com/Ryxeuf/fantasy-football-game/commit/041d4ffaa18ed227a68d9a5fe33a3c90cbb11141))
* ajouter la gestion des mouvements diagonaux dans la fonction getLegalMoves pour respecter les règles de Blood Bowl ([706fdd0](https://github.com/Ryxeuf/fantasy-football-game/commit/706fdd0bab10a368cc90381c10f5582d1551f889))
* ajouter la gestion du drag-and-drop pour la phase de configuration des joueurs, améliorer l'état du jeu avec des mises à jour dynamiques des équipes et des joueurs, et ajuster l'interface utilisateur pour refléter les changements d'état et les interactions utilisateur. ([8c2e5e2](https://github.com/Ryxeuf/fantasy-football-game/commit/8c2e5e2136404b9f067adf3278a60ec190f5afb8))
* ajouter la gestion du drag-and-drop pour la phase de configuration des joueurs, intégrer des références de conteneur pour le plateau de jeu, et améliorer l'affichage des noms d'équipes avec des badges visuels dans l'interface utilisateur. ([b46c6d9](https://github.com/Ryxeuf/fantasy-football-game/commit/b46c6d9e4fd6fce6cb0e64b5c62b2807f83f5ee1))
* ajouter la gestion du rebond de balle lors des échecs d'esquive, avec des tests pour valider le comportement des joueurs et du ballon ([54fd307](https://github.com/Ryxeuf/fantasy-football-game/commit/54fd3076bc94133ed3307ff9705025c7d78e2b7e))
* ajouter la gestion du repositionnement des joueurs, améliorer la validation des placements en phase de configuration, et intégrer de nouvelles propriétés pour le clic sur les joueurs et la phase de configuration dans les composants de l'interface utilisateur. ([bad0d4d](https://github.com/Ryxeuf/fantasy-football-game/commit/bad0d4d4e98d284769a5d758fe6f364e1479e6b7))
* ajouter la logique de rebond de balle avec direction aléatoire et gestion des réceptions par les joueurs, incluant des tests pour valider le comportement ([81cfa08](https://github.com/Ryxeuf/fantasy-football-game/commit/81cfa08a22ec282e6da816b014549a9dd93e33bb))
* ajouter la validation des placements de joueurs lors de la phase de configuration, gérer les erreurs d'affichage pour les placements illégaux, et améliorer la logique de drag-and-drop pour restreindre les actions aux joueurs de l'équipe courante. ([823e4e4](https://github.com/Ryxeuf/fantasy-football-game/commit/823e4e478a29814c8896a0eee4cf772de8774f0a))
* ajouter le champ initialBudget au modèle Team, mettre à jour les fichiers de migration et de schéma, et intégrer la gestion du budget initial dans les routes et l'interface utilisateur pour un suivi amélioré des coûts d'équipe. ([a84a64c](https://github.com/Ryxeuf/fantasy-football-game/commit/a84a64c40f3da0a55c42a5f368712761bab907c1))
* ajouter le composant PlayerDetails pour afficher les informations des joueurs et mettre à jour la page d'accueil pour l'intégrer ([ea76b8e](https://github.com/Ryxeuf/fantasy-football-game/commit/ea76b8e876598bb618687483cffdc317d61797c0))
* ajouter le roster des Elfes Sylvains et corriger le roster des Hommes-Lézards en incluant les Chameleon Skinks. Mise à jour des fichiers de configuration et de l'interface utilisateur pour intégrer ces changements, ainsi que des ajustements pour la rétrocompatibilité des slugs. ([c5e63da](https://github.com/Ryxeuf/fantasy-football-game/commit/c5e63dadf21a0fb1558b9bca6d4b4a6c32719a49))
* ajouter le système de ramassage de balle avec calcul des modificateurs et jets de dés, ainsi que des tests associés pour valider le comportement ([f8f5485](https://github.com/Ryxeuf/fantasy-football-game/commit/f8f54854bfdcb9c431f895ff3069020ec36d0dea))
* ajouter toutes les équipes officielles de Blood Bowl, portant le total à 21 équipes jouables. Mise à jour des fichiers backend et frontend pour intégrer les nouvelles équipes, leurs positions et caractéristiques, ainsi que l'interface utilisateur pour la création et la gestion des équipes. ([944376e](https://github.com/Ryxeuf/fantasy-football-game/commit/944376e3b20085bd460d17041f9a65fb2edacaff))
* ajouter un constructeur d'équipe permettant aux utilisateurs de sélectionner un roster, de définir les joueurs et de créer une équipe avec validation des coûts et des limites de joueurs ([bcf5776](https://github.com/Ryxeuf/fantasy-football-game/commit/bcf5776d3d8b5f0c41b3e9a76a09f48ee3e1ec9d))
* ajouter un fichier complet des règles de Blood Bowl, détaillant les mécanismes de jeu, la mise en place, les actions des joueurs, et les conditions de victoire, afin d'améliorer la compréhension et l'expérience des joueurs ([71d39cb](https://github.com/Ryxeuf/fantasy-football-game/commit/71d39cbc57828aa4fee594c7b2a87a09d8f67a32))
* ajouter un fichier de documentation sur les positions des joueurs de test et mettre à jour les coordonnées des joueurs pour des tests plus réalistes près de la Line of Scrimmage ([a365a53](https://github.com/Ryxeuf/fantasy-football-game/commit/a365a53515a606811cd4bdc5d3613ddec6b7cebe))
* ajouter un fichier de règles pour Blood Bowl, décrivant le respect des règles du jeu et l'importance des tests pour chaque fonctionnalité implémentée ([ee7c50d](https://github.com/Ryxeuf/fantasy-football-game/commit/ee7c50d8d1ffe2ee47b5a879767e4e45ce4c1fca))
* ajouter un fichier de règles techniques pour l'exécution des tests, précisant de ne pas utiliser le mode watch afin d'éviter les blocages lors de l'attente des résultats ([63996cb](https://github.com/Ryxeuf/fantasy-football-game/commit/63996cb6ae395e1dcd77263a91c4bdcfd53f59ff))
* ajouter un fichier de test pour le scénario utilisateur exact dans le moteur de jeu ([f95b5f1](https://github.com/Ryxeuf/fantasy-football-game/commit/f95b5f1944c449a752a12bf493fbc43596418f1e))
* ajouter un fichier de test pour le tri des joueurs et mettre à jour le tri des joueurs dans les pages de détails et d'édition des équipes pour un affichage ordonné par numéro. ([d724b48](https://github.com/Ryxeuf/fantasy-football-game/commit/d724b480ba2817d072bf8f4587b8920d443e3293))
* ajouter un fichier TODO pour organiser les issues du projet BlooBowl Fantasy Football Game par priorité et épic ([3104a0f](https://github.com/Ryxeuf/fantasy-football-game/commit/3104a0f977c2bb4d7f6b59b247012307366daed9))
* ajouter un Makefile et un fichier de documentation pour faciliter le développement du projet BlooBowl avec des commandes utiles et des workflows ([8354f33](https://github.com/Ryxeuf/fantasy-football-game/commit/8354f33e27f802e4b8e3229758962d2186819d32))
* ajouter un nouveau système de rosters avec des slugs uniques pour les positions des joueurs, mettre à jour les fichiers de test associés, et améliorer l'interface utilisateur pour afficher les noms d'affichage des positions. Inclut également des utilitaires pour la conversion entre slugs et noms d'affichage. ([18bddb1](https://github.com/Ryxeuf/fantasy-football-game/commit/18bddb1691e75760568dab39f61e8445dd6adee6))
* ajouter un nouvel endpoint pour récupérer les équipes d'un match avec une vue absolue A/B, simplifier la logique de sélection des équipes et améliorer la gestion des états de jeu, tout en intégrant des données de démonstration pour la phase pré-match. ([f56cbd6](https://github.com/Ryxeuf/fantasy-football-game/commit/f56cbd61e64c6aacd8195ba9f65d20c411140338))
* ajouter un rapport de correction des compétences des joueurs pour aligner les compétences des Rat Ogre, Kroxigor et Skink avec les règles officielles de Blood Bowl, et mettre à jour le fichier team.ts en conséquence. Inclut également un nouveau script de vérification des compétences. ([7542e25](https://github.com/Ryxeuf/fantasy-football-game/commit/7542e25ffa1d452123020edeb67b47a87d499faf))
* ajouter un rapport de correction et de vérification des dés de blocage pour garantir la conformité avec les règles officielles de Blood Bowl, incluant des mises à jour des fonctions de lancer de dés, des tests de distribution, et une interface de test intégrée pour valider les résultats ([7967369](https://github.com/Ryxeuf/fantasy-football-game/commit/7967369cf766e005e587b52edd5c8fa3989cb65d))
* ajouter un système d'authentification avec inscription et connexion, intégration de Prisma pour la gestion des utilisateurs, et mise à jour des dépendances pour le projet ([5184b51](https://github.com/Ryxeuf/fantasy-football-game/commit/5184b51a5a4719fa56f440e4daf9b5cd4091e6fd))
* ajouter un système de blocage, incluant la détection des joueurs adjacents, la validation des actions de blocage, le calcul des assists offensifs et défensifs, ainsi que la résolution des résultats de blocage avec des tests pour valider ces fonctionnalités ([f3ec7ae](https://github.com/Ryxeuf/fantasy-football-game/commit/f3ec7ae64dd8a27dee1f3a2f34bf5666c2b7af25))
* ajouter un système de choix de blocage, incluant une popup pour sélectionner le résultat du blocage, la gestion des cibles de blocage adjacentes, et la mise à jour de l'état du jeu pour refléter les choix effectués ([0f76265](https://github.com/Ryxeuf/fantasy-football-game/commit/0f762657c2620f7680401ced59c70e1f124d3ca8))
* ajouter un système de gestion des administrateurs avec des routes pour les utilisateurs, les parties et les statistiques, ainsi qu'une interface utilisateur pour l'administration ([92b1ec2](https://github.com/Ryxeuf/fantasy-football-game/commit/92b1ec2447e8bfb86715bc30472a808de3574637))
* ajouter un système de gestion des dugouts pour Blood Bowl, incluant des zones pour les joueurs réservés, sonnés, KO, blessés et exclus, ainsi qu'une intégration dans le composant de jeu principal pour une meilleure expérience utilisateur ([3c77c22](https://github.com/Ryxeuf/fantasy-football-game/commit/3c77c22c0cb8f26a1252671b0f85e9071e697ac0))
* ajouter un système de journal de match pour enregistrer les actions, les résultats de dés et les événements clés, améliorant ainsi le suivi du jeu ([90268ee](https://github.com/Ryxeuf/fantasy-football-game/commit/90268ee483623f166bbc6315d1fd69e064aaca32))
* ajouter un système de notifications de dés pour le jeu Blood Bowl, incluant des composants pour afficher des toasts visuels pour les jets de dés, ainsi qu'une page de démonstration et des intégrations avec le moteur de jeu pour une expérience utilisateur améliorée ([b3264e2](https://github.com/Ryxeuf/fantasy-football-game/commit/b3264e2fcaafb2adbb569e4a39c13602864da829))
* ajouter un tableau de bord de jeu pour afficher le score, la mi-temps et l'équipe active, améliorant ainsi l'interface utilisateur ([381f42c](https://github.com/Ryxeuf/fantasy-football-game/commit/381f42c457e111f69445f014b62967f798fb9555))
* ajouter un test pour reproduire un bug de continuation de mouvement après un blitz, incluant des vérifications des actions disponibles et de l'état des joueurs après le blitz ([9ec8d41](https://github.com/Ryxeuf/fantasy-football-game/commit/9ec8d41d0501fb0e50a80d1d6db5952f1e998556))
* ajouter une commande de réinitialisation de la base de données Postgres dans le Makefile, modifier le modèle TeamSelection pour permettre une valeur nulle pour le champ team, et mettre à jour les types dans le client Prisma pour refléter ces changements. Améliorer la logique de sélection d'équipe dans les routes pour gérer les conflits d'unicité et valider les choix des utilisateurs. ([61ba08e](https://github.com/Ryxeuf/fantasy-football-game/commit/61ba08e62f281d137ddf0cc3588ecd2c6e29699f))
* ajouter une nouvelle page de compétences avec des descriptions détaillées, et mettre à jour la barre d'authentification pour inclure un lien vers cette page. La page permet de filtrer et rechercher des compétences, mutations et traits, tout en offrant une interface utilisateur améliorée pour la navigation. ([24fa191](https://github.com/Ryxeuf/fantasy-football-game/commit/24fa1910349282e3e5df7189e79696e75c9e80d8))
* ajouter une popup de choix de direction de poussée, permettant à l'utilisateur de sélectionner une direction parmi plusieurs options disponibles, avec gestion de l'annulation du choix ([b576e7b](https://github.com/Ryxeuf/fantasy-football-game/commit/b576e7bdb5db454953d3205d5ccf9ddfc7063ffb))
* ajouter une popup de sélection d'action pour les joueurs, intégrant la vérification si le joueur a déjà agi, afin d'améliorer l'interaction utilisateur dans le jeu ([288ffb5](https://github.com/Ryxeuf/fantasy-football-game/commit/288ffb51e5af2dc2b412c37e8326c07c51590ebc))
* ajouter une popup pour afficher les résultats des jets de dés et gérer la fin du tour en cas d'échec d'esquive ([42ebc89](https://github.com/Ryxeuf/fantasy-football-game/commit/42ebc894c7236cbda043571b2a8518d44e5ef594))
* ajuster la logique de consommation de PM pour le blitz, permettant au joueur de continuer à bouger après un blitz tout en vérifiant correctement les coûts de mouvement et de blocage, avec des tests pour valider ces changements ([6e13277](https://github.com/Ryxeuf/fantasy-football-game/commit/6e13277ab617d67f4ecfa7a5284d5f733a1cf9c2))
* ajuster la logique de touchdown pour les équipes A et B, en modifiant les coordonnées d'entrée dans l'en-but et en ajoutant des tests pour valider les nouvelles conditions de marquage ([362e33a](https://github.com/Ryxeuf/fantasy-football-game/commit/362e33a0a84f27dc9933575ed83382d9bc6fa897))
* amélioration de la page d'accueil, footer avec version et pages légales ([4559f19](https://github.com/Ryxeuf/fantasy-football-game/commit/4559f19c3711b1aa7fe7d890e0286b036ffeb27d))
* améliorer la gestion des états de jeu en intégrant des mises à jour dynamiques pour les joueurs et les équipes, optimiser la validation des placements en phase de configuration, et ajuster l'interface utilisateur pour refléter les changements d'état et les interactions utilisateur. ([72de8f7](https://github.com/Ryxeuf/fantasy-football-game/commit/72de8f7594007312f8e43a39b2a6d8ce0b229a6b))
* améliorer la gestion des matchs en ajoutant une page d'attente pour les acceptations des joueurs, mettre à jour l'interface utilisateur pour refléter l'état des validations, et restreindre l'accès aux matchs non actifs ([f76c859](https://github.com/Ryxeuf/fantasy-football-game/commit/f76c85943be63f5566e40dd271540815820ae7ed))
* améliorer la gestion des placements de joueurs en phase de configuration, intégrer des tests pour la validation des placements et la synchronisation des états, et ajouter des fonctionnalités pour la séquence de pré-match et la gestion des événements de kickoff. ([0d6eb4d](https://github.com/Ryxeuf/fantasy-football-game/commit/0d6eb4d7bbb701e746349b34a884acc00c5a72c7))
* améliorer la logique de mouvement des joueurs pour permettre la continuation après un rebond, et ajouter des tests pour valider le ramassage de ballon et le marquage des joueurs sonnés ([af63541](https://github.com/Ryxeuf/fantasy-football-game/commit/af6354123e3f92d6c8a661e20180610119640da9))
* améliorer la logique de poussée en ajoutant la gestion de plusieurs directions possibles pour le déplacement des cibles, avec des tests d'intégration pour valider le comportement dans différents scénarios de blocage ([278523d](https://github.com/Ryxeuf/fantasy-football-game/commit/278523d75505cd3eb162df8be251d5cad80eb68d))
* améliorer la logique de pré-match en ajoutant la phase de configuration des joueurs, gérer les états de jeu et les interactions utilisateur, et mettre à jour l'interface pour refléter les changements d'état et les actions possibles. ([24a517d](https://github.com/Ryxeuf/fantasy-football-game/commit/24a517dc343deb01e1ab96af118890fa489bfe22))
* améliorer la logique de redirection sur les pages de jeu et d'attente, en ajoutant la gestion des états 'prematch' et 'active' pour une meilleure expérience utilisateur lors de l'acceptation des matchs. ([40d8a39](https://github.com/Ryxeuf/fantasy-football-game/commit/40d8a39e536abb18b164a4dea45df34eb67cdd0b))
* améliorer la validation des placements de joueurs en phase de configuration, ajouter des tests pour vérifier les chevauchements et les positions légales, et permettre le repositionnement des joueurs déjà placés. ([93b38b8](https://github.com/Ryxeuf/fantasy-football-game/commit/93b38b898c944ce55bad69de407a48e7887481d3))
* améliorer le Makefile avec des commandes de redémarrage et de gestion des ports, et simplifier la logique de jet d'esquive dans la fonction requiresDodgeRoll ([ac0bdbb](https://github.com/Ryxeuf/fantasy-football-game/commit/ac0bdbb0a10926728e53aa33d61a24c34807c62b))
* améliorer le Makefile avec des commandes de redémarrage et de gestion des ports, et simplifier la logique de jet d'esquive dans la fonction requiresDodgeRoll ([7e1e27f](https://github.com/Ryxeuf/fantasy-football-game/commit/7e1e27f6e083828259474d2f527ac130800d9183))
* centraliser la gestion des compétences avec des slugs uniques, créer des fichiers de documentation et de migration, et mettre à jour les composants de l'application pour utiliser le nouveau système. Cela inclut des ajustements pour la rétrocompatibilité et l'affichage des compétences en plusieurs langues. ([377348d](https://github.com/Ryxeuf/fantasy-football-game/commit/377348de29c5ffd2757998a6a020feb9665f9f82))
* changer port web de 3000 à 3100 et mettre à jour la documentation ([6277f48](https://github.com/Ryxeuf/fantasy-football-game/commit/6277f4821cfbeb6004268c436b3355f5acf0e05b))
* implémentation complète du système de Star Players ([5c0b96e](https://github.com/Ryxeuf/fantasy-football-game/commit/5c0b96ec2e20142b9ff12dffa861e85c7443b430))
* implémentation de la sélection aléatoire de compétences avec coûts corrects ([afaabf5](https://github.com/Ryxeuf/fantasy-football-game/commit/afaabf53bc39b730435e50066fd4f0958ed0a8e1))
* implémenter la logique de touchdown, incluant la détection des touchdowns lors des mouvements et des ramassages dans l'en-but, ainsi que l'ajout de tests pour valider ces fonctionnalités ([1625e50](https://github.com/Ryxeuf/fantasy-football-game/commit/1625e50040d7d2b7ddab411ccf165f3c37993dc2))
* implémenter le moteur de jeu Blood Bowl avec gestion des actions, des mouvements, des dés, et de l'état du jeu, incluant des fonctionnalités pour les touchdowns, les blocages, et les rebonds de balle, ainsi que l'intégration avec boardgame.io pour une expérience de jeu fluide ([624c4d8](https://github.com/Ryxeuf/fantasy-football-game/commit/624c4d856bce739e56862f81a5287b373bd80538))
* implémenter un indicateur visuel de balle pour améliorer l'expérience utilisateur, avec gestion de la possession et tests associés ([e7da2bd](https://github.com/Ryxeuf/fantasy-football-game/commit/e7da2bd7f6cb393cd91f13c37396cfcdefe3e9e1))
* intégration complète de l'identité visuelle Nuffle Arena ([c80b988](https://github.com/Ryxeuf/fantasy-football-game/commit/c80b988ded5e11958c5dabc03434136b22f0aa87))
* Intégration des Star Players dans la création et modification d'équipes ([71ab11a](https://github.com/Ryxeuf/fantasy-football-game/commit/71ab11a08d3cd2dd35ec898f1e9113aeaf2054e3))
* Intégration frontend des Star Players dans la création d'équipe ([b3233ca](https://github.com/Ryxeuf/fantasy-football-game/commit/b3233ca31f6c84c5c709e186d46be4d13d64b06d))
* intégrer la phase de configuration dans la logique de jeu, améliorer la gestion des états de match pour inclure 'prematch-setup', et mettre à jour l'interface utilisateur pour gérer les redirections et les états de jeu appropriés. ([3bbf176](https://github.com/Ryxeuf/fantasy-football-game/commit/3bbf17666855a413878b04c6b27c98f86863b314))
* intégrer les images des dés de blocage dans l'interface utilisateur, avec des composants pour l'affichage des résultats, une popup de choix de blocage, et un composant de test pour vérifier le rendu des images ([31236ca](https://github.com/Ryxeuf/fantasy-football-game/commit/31236ca1089448e9765ca0287d835e5f674f4dcb))
* mettre à jour .gitignore pour inclure des fichiers de base de données, Docker, Prisma et outils de développement; suppression du fichier tsconfig.tsbuildinfo ([c0dbfe7](https://github.com/Ryxeuf/fantasy-football-game/commit/c0dbfe78d3702d90b4bd96955f2579f4df7418a9))
* mettre à jour l'affichage des joueurs pour inclure un état sonné, modifiant les couleurs et les styles en conséquence ([9e30fa9](https://github.com/Ryxeuf/fantasy-football-game/commit/9e30fa940721b2286fbd6dbb6e68c4e325771c6c))
* mettre à jour la logique de changement de tour pour que le porteur de ballon conserve le ballon, avec des tests pour valider ce comportement ([34f7698](https://github.com/Ryxeuf/fantasy-football-game/commit/34f7698149b9610452d9a669cae4b27efecea7fd))
* mettre à jour la logique de fin de tour pour inclure les échecs de ramassage, améliorant ainsi la gestion des tours en fonction des résultats des dés ([0689304](https://github.com/Ryxeuf/fantasy-football-game/commit/0689304627a0ed18e5400ce9422c6e4e78443919))
* mettre à jour la logique des jets d'armure pour refléter correctement les règles de Blood Bowl, avec des tests ajustés pour valider le comportement des résultats de dés ([96ba98c](https://github.com/Ryxeuf/fantasy-football-game/commit/96ba98c8a3b1ed3029eb7f6354bc260e872a93b9))
* mettre à jour le système de notifications de dés en ajoutant un identifiant de joueur et en modifiant le type de notification pour les dés simples, ainsi que réorganiser les exports des composants de test pour une meilleure structure ([4b1ada0](https://github.com/Ryxeuf/fantasy-football-game/commit/4b1ada0b6f6181b526c7d071762dbd140c7d22ff))
* mettre à jour les ports dans docker-compose et le Makefile, et améliorer la logique de jet d'esquive dans la fonction requiresDodgeRoll ([7a69b81](https://github.com/Ryxeuf/fantasy-football-game/commit/7a69b81ca5e29c91dfcaec3994f6240d430f4e79))
* mettre à jour les tests de blocage pour vérifier les directions de poussée, en remplaçant les assertions de longueur par des vérifications de validité, et supprimer les tests de débogage obsolètes pour améliorer la clarté et la maintenance du code ([0ccc129](https://github.com/Ryxeuf/fantasy-football-game/commit/0ccc129a8b8360ad16cd102af4b3138343dca9bd))
* mettre à jour les zones de TOUCHDOWN pour les équipes A et B avec des motifs de damier spécifiques et des commentaires explicatifs ([eb08d25](https://github.com/Ryxeuf/fantasy-football-game/commit/eb08d254b1418b68d7e669734fb829bff68523dd))
* Mise à jour complète des Star Players ([e8d351c](https://github.com/Ryxeuf/fantasy-football-game/commit/e8d351c0bee1b5363d162c780a66af8c66254f46))
* normaliser les noms d'équipe et de position dans les fonctions de récupération des compétences, améliorer le calcul des coûts des joueurs en convertissant les valeurs, et mettre à jour l'affichage des rosters dans les pages de détails et d'édition des équipes pour une meilleure clarté. ([d3ce9e6](https://github.com/Ryxeuf/fantasy-football-game/commit/d3ce9e6e3f0dc7b741da10b3a6bec90176a1fa60))
* permettre aux joueurs de se déplacer même en cas d'échec du jet d'esquive, en mettant à jour la logique de mouvement dans la fonction applyMove ([1da01e6](https://github.com/Ryxeuf/fantasy-football-game/commit/1da01e63d723efc767e5ad42c643d20b74326b08))
* refactoriser docker-compose pour ajouter les services web et serveur, mettre à jour les ports et les volumes; ajouter des scripts de développement dans package.json; simplifier le composant PixiBoard avec des améliorations visuelles et de débogage ([df4cbac](https://github.com/Ryxeuf/fantasy-football-game/commit/df4cbac658ed00ac5badbb5ea574097b6dd02d49))
* refactoriser l'initialisation des états dans NewTeamBuilder pour récupérer les valeurs directement depuis l'URL, améliorant ainsi la gestion des paramètres de l'équipe lors de la création d'une nouvelle équipe. ([b071fcf](https://github.com/Ryxeuf/fantasy-football-game/commit/b071fcf112b1762c2cf9599f5d664b8c36391cf8))
* refactoriser la navigation et l'interface utilisateur pour la gestion des équipes, en supprimant les liens obsolètes, en redirigeant vers la page de gestion des équipes, et en ajoutant une nouvelle page de lobby pour la création et la gestion des parties. Inclut également des mises à jour pour les pages de jeu et d'attente. ([9c86517](https://github.com/Ryxeuf/fantasy-football-game/commit/9c86517711b468988a602c567f16f47eaeeef2eb))
* refonte graphique de la modal d'ajout de compétence ([aef5cea](https://github.com/Ryxeuf/fantasy-football-game/commit/aef5ceaf258948ee05e35da88433c21d1f2bdba9))
* renommage de BlooBowl en Nuffle Arena ([aa0af08](https://github.com/Ryxeuf/fantasy-football-game/commit/aa0af0857d93633bb05df583fffbbcb33a665172))
* réorganiser l'affichage des détails du joueur dans la mise en page, en les intégrant dans une sidebar à droite du terrain, et ajouter une option de variante d'affichage dans le composant PlayerDetails ([2622fd6](https://github.com/Ryxeuf/fantasy-football-game/commit/2622fd647937490e5a973bcfcef865a15f046315))
* simplifier la logique de sélection d'équipe dans les routes, en exigeant uniquement le teamId, et améliorer la gestion des erreurs pour les sélections d'équipe. Mettre à jour les tests pour refléter ces changements et ajouter des tests de placeholder pour les scénarios de bugs. ([cfb0dc2](https://github.com/Ryxeuf/fantasy-football-game/commit/cfb0dc22d64f1f39d45ba27504194acc3b978574))
* track movement points and selection ([e956e21](https://github.com/Ryxeuf/fantasy-football-game/commit/e956e21645e1a5369355369af4be176fe9646f96))
* traduire et mettre à jour les descriptions des compétences et des données de base des équipes en français, en normalisant les noms et en améliorant la clarté des descriptions. Cela inclut des ajustements pour les compétences générales, d'agilité, de force et des traits, ainsi que des modifications dans l'interface utilisateur pour une meilleure expérience de navigation. ([67ab434](https://github.com/Ryxeuf/fantasy-football-game/commit/67ab4343b53190c9715d9ce915f1225453c34cfb))


### 🐛 Bug Fixes

* ajuster la largeur de la colonne "Nom" et améliorer le style des champs de saisie pour une meilleure expérience utilisateur dans la page d'édition des équipes. ([50b47b6](https://github.com/Ryxeuf/fantasy-football-game/commit/50b47b6def08eb5653c80699460a7923be6c5791))
* **ci:** ajouter la dépendance conventional-changelog-conventionalcommits pour semantic-release ([3ef37c7](https://github.com/Ryxeuf/fantasy-football-game/commit/3ef37c7e52e2e527f09cdfb98d5341b94a365fe3))
* **ci:** aligner la version de pnpm avec package.json (9.7.0) ([b192259](https://github.com/Ryxeuf/fantasy-football-game/commit/b192259bc8112abcb879848277c43bcf97ebba39))
* **ci:** corriger l'ordre d'installation de pnpm dans semantic-release ([e1d66dd](https://github.com/Ryxeuf/fantasy-football-game/commit/e1d66dd71716bb63cb2235eebb666279edde49bd))
* consolider les imports de @bb/game-engine pour corriger l'erreur getPositionCategoryAccess ([14f8732](https://github.com/Ryxeuf/fantasy-football-game/commit/14f87328895baa954ae434e1e4a23f2b8401b2cd))
* Correction de l'URL de l'API pour les Star Players ([0be820f](https://github.com/Ryxeuf/fantasy-football-game/commit/0be820f8a7ef2daf51bc1c1f3f211b17f554e195))
* Correction de la réponse API star-players/available ([2220724](https://github.com/Ryxeuf/fantasy-football-game/commit/22207244e096ca6594d3025bf753e421426cac16))
* correction du mapping des compétences Star Players avec apostrophes ([b951a72](https://github.com/Ryxeuf/fantasy-football-game/commit/b951a72936f51ada006c9a175efcb8ab56353bbc))
* corrections UI et correction erreur 404 recalcul VE ([a422abd](https://github.com/Ryxeuf/fantasy-football-game/commit/a422abde342efb59a8651d412d082b39899562d8))
* corriger l'affichage des scores dans les tests en remplaçant les références aux scores par les propriétés appropriées teamA et teamB pour une meilleure clarté et précision des résultats finaux ([a7fb294](https://github.com/Ryxeuf/fantasy-football-game/commit/a7fb294e938dc5be1a22ec3b696b35e0b25099e2))


### 📝 Documentation

* Ajout du guide de test complet pour l'intégration des Star Players ([6d8afb3](https://github.com/Ryxeuf/fantasy-football-game/commit/6d8afb309afaecd20ec5e3abca5f345df070c295))
* ajouter guide de développement complet avec structure, config et résolution de problèmes ([ea73e2d](https://github.com/Ryxeuf/fantasy-football-game/commit/ea73e2d7052a27ccef6c571d085e0e597049005a))
* Récapitulatif final complet de l'intégration des Star Players ([fcbef61](https://github.com/Ryxeuf/fantasy-football-game/commit/fcbef61ee0aca4a4ecffb745a8982f0917809558))
