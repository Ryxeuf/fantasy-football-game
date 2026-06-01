import type { ReactNode } from "react";
import { LeagueGate } from "../../components/LeagueGate";

export default function LeagueDetailLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <LeagueGate>{children}</LeagueGate>;
}
