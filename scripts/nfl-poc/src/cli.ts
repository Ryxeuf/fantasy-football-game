import { runNflversePoc } from "./fetch-nflverse.js";
import { runEspnPoc } from "./fetch-espn.js";
import { runNormalizePoc } from "./normalize.js";

const DEFAULT_YEAR = 2025;
const DEFAULT_WEEK = 10;
// NFL 2025 W10 Sunday slate (Nov 9 2025).
const DEFAULT_ESPN_DATE = "20251109";

interface ParsedArgs {
  readonly cmd: string;
  readonly year: number;
  readonly week: number;
  readonly date: string;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [, , cmd = "", ...rest] = argv;
  let year = DEFAULT_YEAR;
  let week = DEFAULT_WEEK;
  let date = DEFAULT_ESPN_DATE;

  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    const value = rest[i + 1];
    if (!value) continue;
    if (flag === "--year") {
      year = Number(value);
      i++;
    } else if (flag === "--week") {
      week = Number(value);
      i++;
    } else if (flag === "--date") {
      date = value;
      i++;
    }
  }

  return { cmd, year, week, date };
}

async function main(): Promise<void> {
  const { cmd, year, week, date } = parseArgs(process.argv);

  switch (cmd) {
    case "nflverse":
      await runNflversePoc(year, week);
      break;
    case "espn":
      await runEspnPoc(date);
      break;
    case "normalize":
      await runNormalizePoc(year, week);
      break;
    case "all":
      await runNflversePoc(year, week);
      console.log("");
      await runEspnPoc(date);
      console.log("");
      await runNormalizePoc(year, week);
      break;
    default:
      console.log(
        "Usage: npm run poc:<cmd> -- [--year YYYY] [--week N] [--date YYYYMMDD]\n" +
          "  cmd ∈ { nflverse, espn, normalize, all }\n\n" +
          `Defaults: year=${DEFAULT_YEAR}, week=${DEFAULT_WEEK}, date=${DEFAULT_ESPN_DATE}\n` +
          "Exemples:\n" +
          "  npm run poc:all                                # W10 2025 par defaut\n" +
          "  npm run poc:all -- --week 1 --date 20250904    # W1 2025 (TNF KC@CHI)\n" +
          "  npm run poc:all -- --week 18 --date 20260104   # W18 2025 (regular season finale)\n"
      );
  }
}

main().catch((err) => {
  console.error("[nfl-poc] fatal:", err);
  process.exit(1);
});
