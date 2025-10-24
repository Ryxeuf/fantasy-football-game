/**
 * Footer avec les mentions de copyright
 */
export default function CopyrightFooter() {
  return (
    <footer className="mt-12 py-6 border-t border-gray-200 bg-gray-50">
      <div className="container mx-auto px-4 text-center text-sm text-gray-600">
        <p className="mb-2">
          <strong>Blood Bowl</strong> est une marque déposée de Games Workshop Limited.
        </p>
        <p className="mb-2">
          Toutes les règles, statistiques et descriptions de joueurs sont la propriété intellectuelle de{" "}
          <strong>Games Workshop</strong>.
        </p>
        <p className="text-xs text-gray-500">
          Ceci est un site non officiel créé par des fans. Aucune affiliation avec Games Workshop.
          Les images et données sont utilisées à des fins de référence uniquement.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Sources : <a href="https://nufflezone.com" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">NuffleZone</a>, 
          Blood Bowl 2020 Rulebook, Death Zone supplements.
        </p>
      </div>
    </footer>
  );
}

