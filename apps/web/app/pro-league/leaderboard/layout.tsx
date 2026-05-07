import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard parieurs Pro League | Nuffle Arena",
  description:
    "Classement des parieurs Pro League : profit, accuracy, plus longue serie. Triable par semaine, saison, tout temps.",
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return <>{children}</>;
}
