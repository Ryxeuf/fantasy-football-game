import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Donner un retour - Nuffle Arena",
  description:
    "Signalez un bug, partagez une remarque ou laissez un commentaire pour aider a ameliorer Nuffle Arena.",
  robots: { index: true, follow: true },
};

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
