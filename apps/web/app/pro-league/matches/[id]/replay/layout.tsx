import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Replay du match | Pro League | Nuffle Arena",
  description:
    "Rejoue un match Pro League avec controles play/pause, scrub bar et vitesse 0.5/1/2/4/8×. Analyse les drives, retrouve un moment cle, partage un timecode.",
};

export default function ReplayLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return <>{children}</>;
}
