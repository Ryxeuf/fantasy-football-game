"use client";

import { useEffect } from "react";

interface SkillsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SkillsError({ error, reset }: SkillsErrorProps) {
  useEffect(() => {
    console.error("[skills] render error", error);
  }, [error]);

  return (
    <div className="w-full p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-[50vh]">
      <h1 className="text-2xl font-bold text-gray-900">
        Les compétences sont momentanément indisponibles
      </h1>
      <p className="text-gray-600 max-w-prose">
        Notre serveur met trop de temps à répondre ou est injoignable.
        Réessaie dans quelques secondes.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        Réessayer
      </button>
    </div>
  );
}
