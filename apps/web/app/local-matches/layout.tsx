import type { ReactNode } from "react";
import { OfflineMatchGate } from "../components/OfflineMatchGate";

export default function LocalMatchesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <OfflineMatchGate>{children}</OfflineMatchGate>;
}
