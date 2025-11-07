"use client";
import { useEffect } from "react";

export default function MePage() {
  useEffect(() => {
    // Rediriger vers la gestion d'équipes
    window.location.href = "/me/teams";
  }, []);

  return (
    <div className="w-full p-6 space-y-6">
      <h1 className="text-2xl font-bold">Redirection...</h1>
      <p className="text-gray-600">Redirection vers la gestion d'équipes...</p>
    </div>
  );
}
