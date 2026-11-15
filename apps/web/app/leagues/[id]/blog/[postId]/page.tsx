"use client";

import { useParams } from "next/navigation";
import CompetitionPostView from "../../../../components/competition-blog/CompetitionPostView";

const KIND = "league" as const;

export default function Page() {
  const { id, postId } = useParams<{ id: string; postId: string }>();
  return <CompetitionPostView competition={{ kind: KIND, id }} postId={postId} />;
}
