import type { ReactNode } from "react";
import { OnlinePlayGate } from "../../components/OnlinePlayGate";

export default function LeagueDetailLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <OnlinePlayGate>{children}</OnlinePlayGate>;
}
