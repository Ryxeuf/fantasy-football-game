"use client";

import { useParams } from "next/navigation";
import CompetitionBlogPage from "../../../components/competition-blog/CompetitionBlogPage";

const KIND = "league" as const;

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <CompetitionBlogPage competition={{ kind: KIND, id }} />;
}
