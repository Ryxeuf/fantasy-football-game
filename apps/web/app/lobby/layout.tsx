import type { ReactNode } from "react";
import { OnlinePlayGate } from "../components/OnlinePlayGate";

export default function LobbyLayout({ children }: { children: ReactNode }) {
  return <OnlinePlayGate>{children}</OnlinePlayGate>;
}
