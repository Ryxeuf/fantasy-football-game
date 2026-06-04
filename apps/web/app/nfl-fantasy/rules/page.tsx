/**
 * Page statique de regles NFL Fantasy.
 *
 * SOURCE DE VERITE : packages/nfl-mapper/src/stats-to-spp.ts +
 * apps/server/src/services/nfl-fantasy-skill-bonus.ts +
 * apps/server/src/services/nfl-fantasy-lineup.ts (CAPTAIN_MULTIPLIER /
 * VICE_CAPTAIN_MULTIPLIER). Toute modif des regles/seuils/caps doit
 * etre repercutee ici DANS LE MEME COMMIT (cf. CLAUDE.md + memoire
 * nuffle-rules-pages-sync).
 *
 * Page server-side (pas de "use client") pour cacher facilement et
 * SEO-friendly.
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Règles de calcul des SPP — Nuffle Arena",
  description:
    "Comment sont calculés les SPP de chaque joueur en NFL Fantasy : routing par bbPosition, barème par type d'événement, bonus de compétences, multiplicateurs captain / vice.",
};

export default function NflFantasyRulesPage(): JSX.Element {
  return (
    <div className="space-y-10">
      <header>
        <Link
          href="/nfl-fantasy"
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← NFL Fantasy
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-nuffle-anthracite">
          Règles de calcul des SPP
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-nuffle-anthracite/70">
          Cette page documente exactement comment chaque joueur gagne (ou
          perd) des SPP à partir de ses statistiques NFL. Les règles ci-dessous
          reflètent fidèlement le calcul réellement appliqué par le jeu et sont
          mises à jour à chaque évolution.
        </p>
      </header>

      <Toc />

      <Section id="principes" title="Principes généraux">
        <ul className="list-disc space-y-2 pl-5 text-sm text-nuffle-anthracite/80">
          <li>
            Le scoring est <strong>purement individuel</strong>. Le score NFL
            du match (par ex. Buffalo 41-40 Baltimore) n&apos;entre <em>jamais</em>{" "}
            dans le calcul d&apos;un joueur. Seules ses stats personnelles
            comptent.
          </li>
          <li>
            Le routing s&apos;effectue par <code className="rounded bg-nuffle-ivory/60 px-1">bbPosition</code>{" "}
            (Thrower, Catcher, Blitzer, etc.). La position NFL (QB, RB, WR…)
            sert seulement à mapper le joueur vers sa <em>bbPosition</em> au
            seed.
          </li>
          <li>
            Les retours de coup de pied (kickoff returns / punt returns), les
            field goals, les transformations et les stats spéciales{" "}
            <strong>ne rapportent pas de SPP</strong>.
          </li>
          <li>
            Les bonus de compétences BB (Pass, Catch, Block, Tackle…)
            s&apos;ajoutent <em>après</em> le calcul des événements de base.
          </li>
          <li>
            Les multiplicateurs <strong>captain ×1.5</strong> et{" "}
            <strong>vice ×1.2</strong> s&apos;appliquent en dernier sur le SPP
            brut, avec troncation à l&apos;entier inférieur.
          </li>
        </ul>
      </Section>

      <Section id="bareme" title="Barème par type d'événement">
        <p className="text-sm text-nuffle-anthracite/80">
          Tous les événements de scoring se ramènent à 5 types Blood Bowl :
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-nuffle-bronze/20 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-nuffle-ivory/40 text-left text-xs uppercase tracking-wide text-nuffle-anthracite/70">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Libellé</th>
                <th className="px-3 py-2 text-right">SPP</th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nuffle-bronze/15 font-mono">
              <tr>
                <td className="px-3 py-2"><Badge type="TD" /></td>
                <td className="px-3 py-2">Touchdown</td>
                <td className="px-3 py-2 text-right font-bold">+3</td>
                <td className="px-3 py-2 text-xs">Rushing TD, receiving TD, defensive TD…</td>
              </tr>
              <tr>
                <td className="px-3 py-2"><Badge type="CP" /></td>
                <td className="px-3 py-2">Passe complète</td>
                <td className="px-3 py-2 text-right font-bold">+1</td>
                <td className="px-3 py-2 text-xs">Réception, palier de yards, pass breakup…</td>
              </tr>
              <tr>
                <td className="px-3 py-2"><Badge type="DP" /></td>
                <td className="px-3 py-2">Pass défensif</td>
                <td className="px-3 py-2 text-right font-bold">+2</td>
                <td className="px-3 py-2 text-xs">Interception, fumble forcé, fumble recovery</td>
              </tr>
              <tr>
                <td className="px-3 py-2"><Badge type="CAS" /></td>
                <td className="px-3 py-2">Casualty</td>
                <td className="px-3 py-2 text-right font-bold">+2</td>
                <td className="px-3 py-2 text-xs">Sack, gros match défensif</td>
              </tr>
              <tr>
                <td className="px-3 py-2"><Badge type="MALUS" /></td>
                <td className="px-3 py-2">Malus</td>
                <td className="px-3 py-2 text-right font-bold text-red-700">−1</td>
                <td className="px-3 py-2 text-xs">Interception (QB), drop, fumble perdu</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="thrower" title="Thrower (QB)">
        <Profile
          mapping={["NFL QB → Thrower"]}
          rules={[
            { label: "Passing TD", value: "+3 SPP par TD" },
            {
              label: "Passing yards par tranche de 75 yd",
              value: "+1 CP par tranche (cap 4 CP)",
            },
            { label: "Rushing TD du QB", value: "+3 SPP par TD" },
            { label: "Rushing yards ≥ 50 yd", value: "+1 CP bonus" },
            { label: "Interception thrown", value: "−1 SPP par INT" },
          ]}
        />
      </Section>

      <Section
        id="runner"
        title="Runner (RB, Wolf Runner, Ulfwerener, Berserker offensif…)"
      >
        <Profile
          mapping={[
            "NFL RB → Runner",
            "Ulfwerener / Berserker / Wardancer avec stats offensives → Runner",
            "GutterRunner / Werewolf avec stats offensives → Runner",
          ]}
          rules={[
            { label: "Rushing TD", value: "+3 SPP par TD" },
            { label: "Receiving TD", value: "+3 SPP par TD" },
            { label: "Rushing yards ≥ 75 yd", value: "+1 CP" },
            { label: "Rushing yards ≥ 100 yd", value: "+1 CP bonus (cumulable avec 75)" },
            { label: "Receiving yards ≥ 100 yd", value: "+1 CP bonus" },
            { label: "Réceptions", value: "+1 CP par réception (cap 3 pour RB)" },
            { label: "Fumble perdu", value: "−1 SPP par fumble lost" },
          ]}
          notes={[
            "Les positions Blitzer / Ulfwerener / Berserker / etc. sont polyvalentes : si elles ont des stats offensives (rushing/receiving yards ou TD), elles sont routées en Runner ; sinon en Defensive Blitzer.",
          ]}
        />
      </Section>

      <Section id="catcher" title="Catcher (WR / TE / Ghoul)">
        <Profile
          mapping={["NFL WR / TE → Catcher", "Ghoul (Necromantic) → Catcher"]}
          rules={[
            { label: "Réceptions", value: "+1 CP par réception (cap 5 pour WR/TE)" },
            { label: "Receiving TD", value: "+3 SPP par TD" },
            { label: "Receiving yards ≥ 100 yd", value: "+1 CP bonus" },
            { label: "Receiving yards ≥ 150 yd", value: "+1 CP bonus (cumulable avec 100)" },
            { label: "Drops", value: "−1 SPP par drop" },
          ]}
        />
      </Section>

      <Section
        id="defensive-blitzer"
        title="Defensive Blitzer (DE / EDGE / LB / Blitzer défensif)"
      >
        <Profile
          mapping={[
            "NFL DE / EDGE / LB → Defensive Blitzer",
            "Blitzer / Ulfwerener / Wardancer SANS stats offensives → Defensive Blitzer",
          ]}
          rules={[
            { label: "Tackles ≥ 10", value: "+1 CAS (gros match défensif)" },
            { label: "Sacks", value: "+1 CAS (+2 SPP) par sack" },
            { label: "Interceptions", value: "+1 DP (+2 SPP) par INT" },
            { label: "Forced fumble", value: "+1 DP par forced fumble" },
            { label: "Tackles for loss ≥ 2", value: "+1 CP bonus" },
            { label: "Defensive TD", value: "+3 SPP par TD défensif" },
          ]}
        />
      </Section>

      <Section
        id="defensive-back"
        title="Defensive Back (CB / S / Gutter Runner défensif)"
      >
        <Profile
          mapping={[
            "NFL CB / S → Defensive Back",
            "GutterRunner / Werewolf SANS stats offensives → Defensive Back",
          ]}
          rules={[
            { label: "Interceptions", value: "+1 DP (+2 SPP) par INT" },
            { label: "Pass defended (PBU)", value: "+1 CP par PBU" },
            {
              label: "Pick-six / fumble return",
              value: "+3 SPP (TD) + 2 SPP (DP bonus) = +5 SPP au total",
            },
            { label: "Forced fumble", value: "+1 DP par forced fumble" },
          ]}
        />
      </Section>

      <Section id="big-guy" title="Big Guy (DT / NT / Big Guy)">
        <Profile
          mapping={[
            "NFL DT / NT → Big Guy",
            "RatOgre / Treeman / Troll / Ogre / Yhetee / Deathroller / Bloodthirster / FleshGolem → Big Guy",
          ]}
          rules={[
            { label: "Sacks", value: "+1 CAS (+2 SPP) par sack" },
            { label: "QB Hits ÷ 3", value: "+1 CAS par tranche de 3 hits" },
            { label: "Forced fumble", value: "+1 DP par forced fumble" },
            { label: "Fumble recovery", value: "+1 DP par fumble recovery" },
            { label: "Defensive TD", value: "+3 SPP par TD défensif" },
          ]}
        />
      </Section>

      <Section id="lineman" title="Lineman OL (G, T, C, Lineman, Blocker…)">
        <Profile
          mapping={[
            "NFL G / T / C → Lineman",
            "Blocker / Zombie / Bloodseeker / Goblin → Lineman",
          ]}
          rules={[
            {
              label: "Participation (fallback)",
              value:
                "+1 CP si aucun contexte d'équipe (présent en feuille de match)",
            },
            { label: "Team passer rating > 100", value: "+1 CP bonus" },
            { label: "Team rushing yards > 150", value: "+1 CP bonus" },
            { label: "Team sacks allowed < 2", value: "+1 CP bonus" },
            { label: "Team sacks allowed > 4", value: "−1 SPP malus" },
          ]}
          notes={[
            "Le scoring des linemen est dérivé du contexte de l'équipe (pas de stat individuelle exploitable côté nflverse). Si les stats équipe sont absentes, on retombe sur 1 SPP de participation.",
          ]}
        />
      </Section>

      <Section id="skill-bonuses" title="Bonus de compétences BB">
        <p className="text-sm text-nuffle-anthracite/80">
          Si un joueur possède une compétence Blood Bowl qui matche un type
          d&apos;événement scoré, il gagne un bonus SPP additionnel. Les bonus
          s&apos;appliquent <em>après</em> le calcul des événements de base,
          mais <em>avant</em> les multiplicateurs captain/vice.
        </p>
        <p className="mt-2 text-xs text-nuffle-anthracite/60">
          {SKILL_BONUSES.length} compétences sont actuellement prises en compte,
          regroupées par famille de trigger.
        </p>

        <SkillFamilyTable
          title="Passing"
          emoji="🎯"
          rows={SKILL_BONUSES.filter((s) => s.family === "passing")}
        />
        <SkillFamilyTable
          title="Rushing"
          emoji="🏃"
          rows={SKILL_BONUSES.filter((s) => s.family === "rushing")}
        />
        <SkillFamilyTable
          title="Receiving"
          emoji="🤲"
          rows={SKILL_BONUSES.filter((s) => s.family === "receiving")}
        />
        <SkillFamilyTable
          title="Defensive"
          emoji="🛡️"
          rows={SKILL_BONUSES.filter((s) => s.family === "defensive")}
        />
        <SkillFamilyTable
          title="Lineman / OL"
          emoji="🧱"
          rows={SKILL_BONUSES.filter((s) => s.family === "lineman")}
        />
        <SkillFamilyTable
          title="Général"
          emoji="🏆"
          rows={SKILL_BONUSES.filter((s) => s.family === "general")}
        />

        <p className="mt-3 text-xs text-nuffle-anthracite/60">
          Les autres compétences Blood Bowl (Trait, Scélérates, Stunty, etc.)
          ne génèrent pas de bonus de scoring fantasy V1 — la page carrière
          d&apos;un joueur les masque automatiquement de la liste d&apos;achat.
        </p>
      </Section>

      <Section id="captain-vice" title="Multiplicateurs Captain / Vice">
        <p className="text-sm text-nuffle-anthracite/80">
          Une fois le SPP brut calculé (événements + bonus de compétences), on
          applique le multiplicateur du rôle attribué dans le lineup :
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Multiplier role="Captain" emoji="👑" factor="×1.5" />
          <Multiplier role="Vice-captain" emoji="🥈" factor="×1.2" />
          <Multiplier role="Starter classique" emoji="🛡️" factor="×1.0" />
        </div>
        <p className="mt-3 text-xs text-nuffle-anthracite/70">
          La multiplication est tronquée à l&apos;entier inférieur. Exemple : un
          joueur Captain qui a 7 SPP bruts donne <code>trunc(7 × 1.5) = 10</code>{" "}
          SPP finaux, soit +3 SPP grâce au rôle. <strong>0 × 1.5 = 0</strong> —
          un captain qui ne marque rien rapporte zéro.
        </p>
      </Section>

      <Section id="reading" title="Comment lire le détail d'un match">
        <p className="text-sm text-nuffle-anthracite/80">
          Sur la page <Link
            href="/nfl-fantasy"
            className="text-nuffle-bronze hover:underline"
          >
            détail d&apos;un matchup
          </Link>, chaque ligne joueur affiche :
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-nuffle-anthracite/80">
          <li>
            <strong>SPP final</strong> : ce qui compte pour le score du match
            (avec multiplicateur captain/vice appliqué).
          </li>
          <li>
            <strong>brut</strong> : SPP avant multiplicateur, somme des
            événements + bonus de compétences.
          </li>
          <li>
            <strong>+X (C/V)</strong> : gain ajouté par le rôle captain ou
            vice.
          </li>
          <li>
            Bouton <strong>Voir le détail SPP</strong> : déplie la liste des
            événements (Touchdown, Passe complète, etc.) qui ont produit le
            score, et les bonus de compétences appliqués.
          </li>
          <li>
            Bouton <strong>Stats NFL brutes</strong> : déplie les chiffres
            nflverse originaux (carries, rushing_yards, targets, receptions…)
            pour cross-check.
          </li>
        </ul>
      </Section>

      <footer className="border-t border-nuffle-bronze/20 pt-6 text-xs text-nuffle-anthracite/60">
        Source de vérité :{" "}
        <code className="rounded bg-nuffle-ivory/60 px-1">
          packages/nfl-mapper/src/stats-to-spp.ts
        </code>{" "}
        et{" "}
        <code className="rounded bg-nuffle-ivory/60 px-1">
          apps/server/src/services/nfl-fantasy-skill-bonus.ts
        </code>
        . Cette page est mise à jour à chaque évolution du code.
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Composants helpers
// ────────────────────────────────────────────────────────────────────

function Toc(): JSX.Element {
  const items = [
    { id: "principes", label: "Principes généraux" },
    { id: "bareme", label: "Barème par type d'événement" },
    { id: "thrower", label: "Thrower (QB)" },
    { id: "runner", label: "Runner (RB, Wolf Runner…)" },
    { id: "catcher", label: "Catcher (WR / TE)" },
    { id: "defensive-blitzer", label: "Defensive Blitzer" },
    { id: "defensive-back", label: "Defensive Back" },
    { id: "big-guy", label: "Big Guy" },
    { id: "lineman", label: "Lineman OL" },
    { id: "skill-bonuses", label: "Bonus de compétences BB" },
    { id: "captain-vice", label: "Multiplicateurs Captain / Vice" },
    { id: "reading", label: "Comment lire un match" },
  ];
  return (
    <nav className="rounded-lg border border-nuffle-bronze/20 bg-nuffle-ivory/40 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-nuffle-anthracite/70">
        Sommaire
      </p>
      <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              className="text-nuffle-bronze hover:underline"
            >
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-xl font-semibold text-nuffle-anthracite">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Profile({
  mapping,
  rules,
  notes,
}: {
  mapping: ReadonlyArray<string>;
  rules: ReadonlyArray<{ label: string; value: string }>;
  notes?: ReadonlyArray<string>;
}): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-nuffle-bronze/20 bg-nuffle-ivory/30 p-3 text-xs">
        <p className="font-semibold uppercase tracking-wide text-nuffle-anthracite/70">
          Mapping NFL → BB
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-nuffle-anthracite/80">
          {mapping.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </div>
      <div className="overflow-hidden rounded-lg border border-nuffle-bronze/20 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-nuffle-ivory/40 text-left text-xs uppercase tracking-wide text-nuffle-anthracite/70">
            <tr>
              <th className="px-3 py-2">Condition</th>
              <th className="px-3 py-2">Effet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nuffle-bronze/15">
            {rules.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-nuffle-anthracite/80">
                  {r.label}
                </td>
                <td className="px-3 py-2 font-mono text-nuffle-anthracite">
                  {r.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes && notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-nuffle-anthracite/70">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Badge({
  type,
}: {
  type: "TD" | "CP" | "DP" | "CAS" | "MALUS";
}): JSX.Element {
  const cls: Readonly<Record<string, string>> = {
    TD: "border-emerald-300 bg-emerald-100 text-emerald-800",
    CP: "border-sky-300 bg-sky-100 text-sky-800",
    DP: "border-indigo-300 bg-indigo-100 text-indigo-800",
    CAS: "border-red-300 bg-red-100 text-red-800",
    MALUS: "border-amber-300 bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[10px] font-mono ${cls[type]}`}
    >
      {type}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────
// Catalogue des bonus de compétences (DOIT MATCHER
// apps/server/src/services/nfl-fantasy-skill-bonus.ts NFL_FANTASY_SKILL_EFFECTS).
//
// MAJ obligatoire dans le meme commit que les regles cote serveur
// (cf. memoire nuffle-rules-pages-sync). Pour eviter la drift, la
// page carriere fetch directement le catalogue serveur via
// /api/nfl-fantasy/public/skill-effects ; cette page de regles
// expose les memes infos en SSR pour rester SEO-friendly et
// fonctionner hors fetch.
// ────────────────────────────────────────────────────────────────────

interface SkillBonusEntry {
  readonly slug: string;
  readonly effectFr: string;
  readonly cap: number;
  readonly family:
    | "passing"
    | "rushing"
    | "receiving"
    | "defensive"
    | "lineman"
    | "general";
}

const SKILL_BONUSES: ReadonlyArray<SkillBonusEntry> = [
  { slug: "pass", effectFr: "+1 SPP par passing TD", cap: 3, family: "passing" },
  { slug: "accurate", effectFr: "+1 SPP par CP de passing yards (palier de 75)", cap: 2, family: "passing" },
  { slug: "cannoneer", effectFr: "+1 SPP si passing yards ≥ 300 yd", cap: 1, family: "passing" },
  { slug: "strong-arm", effectFr: "+1 SPP si passing yards ≥ 225 yd", cap: 1, family: "passing" },
  { slug: "running-pass", effectFr: "+1 SPP si passing TD ET rushing TD du QB", cap: 1, family: "passing" },
  { slug: "safe-throw", effectFr: "+1 SPP si passing TD ET aucune INT lancée", cap: 1, family: "passing" },
  { slug: "nerves-of-steel", effectFr: "+1 SPP si au moins 1 passing TD (résilience)", cap: 1, family: "passing" },
  { slug: "sprint", effectFr: "+1 SPP si rushing yards ≥ 100 yd", cap: 1, family: "rushing" },
  { slug: "sure-feet", effectFr: "+1 SPP si rushing yards ≥ 75 ET aucun fumble", cap: 1, family: "rushing" },
  { slug: "break-tackle", effectFr: "+1 SPP par rushing TD (hors QB)", cap: 2, family: "rushing" },
  { slug: "juggernaut", effectFr: "+1 SPP si rushing TD ET au moins 1 CAS", cap: 1, family: "rushing" },
  { slug: "horns", effectFr: "+1 SPP si rushing yards ≥ 50 yd", cap: 1, family: "rushing" },
  { slug: "catch", effectFr: "+1 SPP si au moins 1 receiving TD", cap: 1, family: "receiving" },
  { slug: "extra-arms", effectFr: "+1 SPP par CP de réception (cap 2)", cap: 2, family: "receiving" },
  { slug: "monstrous-mouth", effectFr: "+1 SPP par CP de réception (cap 2)", cap: 2, family: "receiving" },
  { slug: "big-hand", effectFr: "+1 SPP si au moins 1 réception", cap: 1, family: "receiving" },
  { slug: "diving-catch", effectFr: "+1 SPP si receiving yards ≥ 100 yd", cap: 1, family: "receiving" },
  { slug: "very-long-legs", effectFr: "+1 SPP si receiving yards ≥ 150 yd", cap: 1, family: "receiving" },
  { slug: "safe-pair-of-hands", effectFr: "+1 SPP par drop compensé", cap: 2, family: "receiving" },
  { slug: "sure-hands", effectFr: "+1 SPP par fumble compensé", cap: 2, family: "receiving" },
  { slug: "block", effectFr: "+1 SPP par CAS (sacks)", cap: 3, family: "defensive" },
  { slug: "claws", effectFr: "+1 SPP par CAS (ignorance armure)", cap: 3, family: "defensive" },
  { slug: "arm-bar", effectFr: "+1 SPP par CAS", cap: 2, family: "defensive" },
  { slug: "wrestle", effectFr: "+1 SPP si au moins 1 CAS", cap: 1, family: "defensive" },
  { slug: "pile-driver", effectFr: "+1 SPP par CAS issu d'un sack", cap: 2, family: "defensive" },
  { slug: "frenzy", effectFr: "+1 SPP si ≥ 2 CAS dans le match", cap: 1, family: "defensive" },
  { slug: "multiple-block", effectFr: "+1 SPP si CAS issu de QB hits multiples", cap: 1, family: "defensive" },
  { slug: "mighty-blow-1", effectFr: "+1 SPP par CAS (toutes variantes +1/+2/+3)", cap: 3, family: "defensive" },
  { slug: "dodge", effectFr: "+1 SPP par INT défensive", cap: 2, family: "defensive" },
  { slug: "defensive", effectFr: "+1 SPP si au moins 1 INT", cap: 1, family: "defensive" },
  { slug: "tackle", effectFr: "+1 SPP si au moins 1 forced fumble", cap: 1, family: "defensive" },
  { slug: "strip-ball", effectFr: "+1 SPP par forced fumble", cap: 2, family: "defensive" },
  { slug: "prehensile-tail", effectFr: "+1 SPP si au moins 1 forced fumble", cap: 1, family: "defensive" },
  { slug: "tentacles", effectFr: "+1 SPP si au moins 1 forced fumble", cap: 1, family: "defensive" },
  { slug: "shadowing", effectFr: "+1 SPP par pass breakup", cap: 2, family: "defensive" },
  { slug: "side-step", effectFr: "+1 SPP si au moins 1 pass breakup", cap: 1, family: "defensive" },
  { slug: "diving-tackle", effectFr: "+1 SPP si ≥ 10 tackles dans le match", cap: 1, family: "defensive" },
  { slug: "fend", effectFr: "+1 SPP si forced fumble ET recovery dans le match", cap: 1, family: "defensive" },
  { slug: "ball-and-chain", effectFr: "+1 SPP si TD défensif (pick-six / fumble return)", cap: 1, family: "defensive" },
  { slug: "kick-team-mate", effectFr: "+1 SPP si TD défensif", cap: 1, family: "defensive" },
  { slug: "block-and-tackle", effectFr: "+1 SPP si CAS ET forced fumble dans le match", cap: 1, family: "defensive" },
  { slug: "tfl-specialist", effectFr: "+1 SPP si tackles for loss ≥ 2", cap: 1, family: "defensive" },
  { slug: "guard", effectFr: "+1 SPP si team rushing yards > 150 yd", cap: 1, family: "lineman" },
  { slug: "stand-firm", effectFr: "+1 SPP si team sacks allowed < 2", cap: 1, family: "lineman" },
  { slug: "brawler", effectFr: "+1 SPP si team passer rating > 100", cap: 1, family: "lineman" },
  { slug: "thick-skull", effectFr: "+1 SPP par participation OL (fallback no-team-context)", cap: 1, family: "lineman" },
  { slug: "leader", effectFr: "+1 SPP si au moins 1 TD (offensif, toutes natures)", cap: 1, family: "general" },
];

function SkillFamilyTable({
  title,
  emoji,
  rows,
}: {
  title: string;
  emoji: string;
  rows: ReadonlyArray<SkillBonusEntry>;
}): JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-nuffle-bronze/20 bg-white">
      <div className="border-b border-nuffle-bronze/20 bg-nuffle-ivory/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-nuffle-anthracite/70">
        {emoji} {title} <span className="font-mono text-nuffle-anthracite/50">({rows.length})</span>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-nuffle-bronze/15">
          {rows.map((r) => (
            <tr key={r.slug}>
              <td className="px-3 py-2 align-top">
                <span className="rounded border border-purple-300 bg-purple-100 px-2 py-0.5 text-xs font-mono text-purple-800">
                  ✨ {r.slug}
                </span>
              </td>
              <td className="px-3 py-2 text-sm text-nuffle-anthracite/80">
                {r.effectFr}
              </td>
              <td className="px-3 py-2 text-right font-mono text-nuffle-anthracite">
                cap {r.cap}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Multiplier({
  role,
  emoji,
  factor,
}: {
  role: string;
  emoji: string;
  factor: string;
}): JSX.Element {
  return (
    <div className="rounded-md border border-nuffle-bronze/20 bg-white p-3 text-center">
      <p className="text-2xl">{emoji}</p>
      <p className="mt-1 text-sm font-semibold text-nuffle-anthracite">
        {role}
      </p>
      <p className="mt-1 font-mono text-lg text-nuffle-gold">{factor}</p>
    </div>
  );
}
