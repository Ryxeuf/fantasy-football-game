"use client";

import { useParams } from "next/navigation";
import CompetitionPostForm from "../../../../components/competition-blog/CompetitionPostForm";

const KIND = "cup" as const;

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <CompetitionPostForm competition={{ kind: KIND, id }} />;
}
