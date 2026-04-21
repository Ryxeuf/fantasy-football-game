import { getServerApiBase } from "../lib/serverApi";
import SkillsClient, { type Skill } from "./SkillsClient";

// ISR — skill definitions change only with rules edition updates.
export const revalidate = 3600;

async function fetchSkills(ruleset: string): Promise<Skill[]> {
  const base = getServerApiBase();
  const res = await fetch(
    `${base}/api/skills?ruleset=${encodeURIComponent(ruleset)}`,
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.skills || [];
}

interface SkillsPageProps {
  searchParams: { ruleset?: string };
}

export default async function SkillsPage({ searchParams }: SkillsPageProps) {
  const selectedRuleset =
    searchParams.ruleset === "season_3" ? "season_3" : "season_2";
  const skills = await fetchSkills(selectedRuleset);

  return (
    <SkillsClient skills={skills} selectedRuleset={selectedRuleset} />
  );
}
