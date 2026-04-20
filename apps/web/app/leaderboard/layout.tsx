import type { ReactNode } from "react";
import { OnlinePlayGate } from "../components/OnlinePlayGate";

export default function LeaderboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <OnlinePlayGate>{children}</OnlinePlayGate>;
}
