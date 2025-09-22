import fs from "fs";
import path from "path";

function extractIntro(md: string) {
  const lines = md.split(/\r?\n/);
  return lines.slice(0, 10).join("\n");
}

export default function HowToPlay() {
  const mdPath = path.join(process.cwd(), "data", "cheat-sheet.md");
  let excerpt = "";
  try {
    const content = fs.readFileSync(mdPath, "utf-8");
    excerpt = extractIntro(content);
  } catch {
    excerpt = "Consultez les règles complètes dans la section data/.";
  }

  return (
    <div className="prose max-w-none">
      <h2>Comment jouer</h2>
      <pre className="whitespace-pre-wrap bg-gray-50 border border-gray-200 p-4 rounded">{excerpt}</pre>
      <p>
        Pour aller plus loin, consultez les documents de règles dans <code>data/</code>.
      </p>
    </div>
  );
}


