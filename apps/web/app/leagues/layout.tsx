import type { ReactNode } from "react";
import { LeagueGate } from "../components/LeagueGate";

export default function LeaguesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <LeagueGate>{children}</LeagueGate>;
}
