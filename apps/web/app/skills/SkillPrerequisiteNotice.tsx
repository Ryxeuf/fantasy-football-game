import { Fragment } from "react";
import type { SkillPrerequisite } from "./skill-prerequisites";

interface SkillPrerequisiteNoticeProps {
  readonly skillSlug: string;
  readonly prerequisites: readonly SkillPrerequisite[];
  readonly language: "fr" | "en";
}

/** Mention « Prérequis : … » du compendium. Rien si la compétence est libre. */
export default function SkillPrerequisiteNotice({
  skillSlug,
  prerequisites,
  language,
}: SkillPrerequisiteNoticeProps) {
  if (prerequisites.length === 0) return null;
  const isFrench = language === "fr";
  return (
    <p
      className="mt-2 text-sm font-medium text-amber-800"
      data-testid={`skill-prerequisite-${skillSlug}`}
    >
      🔒 {isFrench ? "Prérequis : " : "Requires: "}
      {prerequisites.map((prerequisite, index) => (
        <Fragment key={prerequisite.slug}>
          {index > 0 && (isFrench ? " ou " : " or ")}
          <a
            href={`/skills/${prerequisite.slug}`}
            className="underline hover:text-nuffle-gold transition-colors"
          >
            {isFrench ? prerequisite.nameFr : prerequisite.nameEn}
          </a>
        </Fragment>
      ))}
    </p>
  );
}
