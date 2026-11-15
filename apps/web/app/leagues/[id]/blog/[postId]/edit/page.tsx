"use client";

import { useParams } from "next/navigation";
import CompetitionPostForm from "../../../../../components/competition-blog/CompetitionPostForm";

const KIND = "league" as const;

export default function Page() {
  const { id, postId } = useParams<{ id: string; postId: string }>();
  return <CompetitionPostForm competition={{ kind: KIND, id }} postId={postId} />;
}
