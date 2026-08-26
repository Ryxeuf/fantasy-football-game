/**
 * Garde anti-régression — couverture du journal d'équipe.
 *
 * Invariant : tout module de `services/` ou `routes/` qui ÉCRIT sur `Team`,
 * `TeamPlayer` ou `TeamStarPlayer` doit journaliser (`safeRecordTeamAudit`
 * / `recordTeamAudit` / `withTeamAudit`), directement ou en déléguant à un
 * module qui le fait.
 *
 * Sans cette garde, chaque nouveau flux de mutation rouvrirait un angle
 * mort — exactement ce qui rendait les écarts de trésorerie et de VE
 * impossibles à reconstituer. Le journal ne vaut que s'il est exhaustif.
 *
 * Stratégie « ratchet » : tout fichier est enforcé PAR DÉFAUT. Les modules
 * dispensés sont listés dans `AUDIT_EXEMPT` avec leur justification ; cette
 * liste ne doit que DÉCROÎTRE.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SERVICES_DIR = __dirname;
const ROUTES_DIR = join(__dirname, "..", "routes");

/**
 * Écriture Prisma sur une entité d'équipe. Couvre le client global, un
 * client de transaction, ET la forme castée `(prisma as any).teamPlayer…`
 * encore présente dans quelques services — sans elle, un module échapperait
 * à la garde juste en ajoutant un cast.
 */
const TEAM_WRITE =
  /(?:\b(?:prisma|tx|db|client)\s*\.|\bas\s+any\s*\)\s*\.)\s*(?:team|teamPlayer|teamStarPlayer)\s*\.\s*(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\b/;

/** Appel au journal, sous l'une de ses trois formes. */
const AUDIT_CALL = /\b(?:safeRecordTeamAudit|recordTeamAudit|withTeamAudit)\s*\(/;

/**
 * Modules qui écrivent sur une entité d'équipe SANS journaliser eux-mêmes,
 * avec la raison. NE DOIT QUE DÉCROÎTRE.
 */
const AUDIT_EXEMPT = new Map<string, string>([
  [
    "ai-practice.ts",
    "équipe d'entraînement jetable générée pour l'IA : jamais possédée par un coach, aucune économie à reconstituer",
  ],
  [
    "league-test-data.ts",
    "générateur de données de test (participant fictif) : hors périmètre du journal de production",
  ],
  [
    "admin.ts",
    "purge de données admin (deleteMany global) : déjà tracée par AuditLog, et le journal d'équipe disparaît avec les équipes",
  ],
  [
    "commissioner-team-edit.ts",
    "journalise via appendAudit, qui miroite chaque action commissaire dans le journal d'équipe",
  ],
  [
    "commissioner-team-settings.ts",
    "idem : les mutations passent par appendAudit (avec beforeSnapshot)",
  ],
  [
    "commissioner-team-removal.ts",
    "idem : les suppressions passent par appendAudit (avec beforeSnapshot)",
  ],
  [
    "league-offline-purchases.ts",
    "buildPurchaseReverseOps ne construit que des ops ; l'exécution et le journal sont chez l'appelant (league-offline-edit)",
  ],
  [
    "post-match-league-sequence.ts",
    "applique PSP et blessures dans la transaction de league-offline-result, qui journalise l'étape économie",
  ],
  [
    "league-sheet-advancements.ts",
    "améliorations de feuille de match appliquées dans la transaction de league-offline-result",
  ],
  [
    "cup-build-advancements.ts",
    "améliorations imposées au build d'une coupe : couvertes par l'étape team.create du handler de construction",
  ],
  [
    "spp-tracking.ts",
    "attribution de PSP en fin de match : ne touche ni la trésorerie ni la VE (les PSP seuls ne valorisent pas le joueur)",
  ],
  [
    "permanent-injuries.ts",
    "séquelles appliquées pendant la séquence d'après-match, dont l'étape économie porte déjà le résultat d'équipe",
  ],
  [
    "player-death.ts",
    "délègue la pose du statut à player-status.applyPlayerStatus, qui journalise",
  ],
  [
    "match-start.ts",
    "purge des flags missNextMatch au coup d'envoi : effet sur la VEA recalculée et journalisée par updateTeamValues",
  ],
  [
    "move-processor.ts",
    "état de match en cours (moteur), pas une mutation de roster persistante",
  ],
  [
    "team-captain.ts",
    "désignation du capitaine : ni or ni VE, et l'historique vit dans la règle spéciale",
  ],
  [
    "player-image.ts",
    "image de joueur (cosmétique)",
  ],
  [
    "team-logo.ts",
    "logo d'équipe (cosmétique)",
  ],
  [
    "team-share.ts",
    "bascule de partage public : aucun impact roster / économie",
  ],
  [
    "team-selection-handlers.ts",
    "sélection d'équipe pour un match : ne modifie ni le roster ni l'économie",
  ],
]);

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"),
  );
}

function writesToTeamEntities(content: string): boolean {
  return content
    .split("\n")
    .some((line) => !line.trim().startsWith("*") && TEAM_WRITE.test(line));
}

describe("couverture du journal d'équipe", () => {
  const offenders: string[] = [];

  for (const [dir, label] of [
    [SERVICES_DIR, "services"],
    [ROUTES_DIR, "routes"],
  ] as const) {
    for (const file of listSourceFiles(dir)) {
      const content = readFileSync(join(dir, file), "utf8");
      if (!writesToTeamEntities(content)) continue;
      if (AUDIT_CALL.test(content)) continue;
      if (AUDIT_EXEMPT.has(file)) continue;
      offenders.push(`${label}/${file}`);
    }
  }

  it("aucun module ne mute une équipe sans journaliser", () => {
    expect(
      offenders,
      `Ces modules écrivent sur Team/TeamPlayer/TeamStarPlayer sans appeler le journal d'équipe.\n` +
        `Ajoute un appel à safeRecordTeamAudit/withTeamAudit, ou inscris le fichier dans AUDIT_EXEMPT avec sa justification :\n` +
        offenders.map((f) => `  - ${f}`).join("\n"),
    ).toEqual([]);
  });

  it("la liste d'exemptions ne référence que des fichiers existants", () => {
    const known = new Set([
      ...listSourceFiles(SERVICES_DIR),
      ...listSourceFiles(ROUTES_DIR),
    ]);
    const stale = [...AUDIT_EXEMPT.keys()].filter((f) => !known.has(f));
    expect(
      stale,
      "Exemptions obsolètes (fichier supprimé ou renommé) : à retirer",
    ).toEqual([]);
  });

  it("chaque exemption porte une justification non vide", () => {
    for (const [file, reason] of AUDIT_EXEMPT) {
      expect(reason.length, `justification manquante pour ${file}`).toBeGreaterThan(
        20,
      );
    }
  });
});
