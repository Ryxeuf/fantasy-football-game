"use client";

/**
 * Génération d'article via IA — encapsule le formulaire n8n
 * (https://n8n.ryxeuf.fr/form/nuffle-blog-gen-v2) dans une iframe.
 *
 * Note : si l'iframe reste vide, c'est que l'embed est bloqué côté navigateur
 * (CSP `frame-src` du middleware Traefik `secure-headers-embed`, ou en-tête
 * `X-Frame-Options`/`frame-ancestors` renvoyé par n8n). Le lien « ouvrir dans
 * un nouvel onglet » sert alors de repli toujours fonctionnel.
 */

import Link from "next/link";

const N8N_FORM_URL = "https://n8n.ryxeuf.fr/form/nuffle-blog-gen-v2";

export default function GenerateBlogPostPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            🤖 Générer un article via IA
          </h1>
          <p className="text-sm text-gray-600">
            Formulaire n8n de création d&apos;article assistée par IA. L&apos;article
            généré apparaîtra ensuite dans la liste (en brouillon).
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a
            href={N8N_FORM_URL}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          >
            ↗ Ouvrir dans un nouvel onglet
          </a>
          <Link
            href={"/admin/blog" as never}
            className="text-gray-600 hover:text-gray-900 underline"
          >
            ← Retour à la liste
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <iframe
          src={N8N_FORM_URL}
          title="Formulaire de génération d'article (n8n)"
          className="w-full h-[80vh] border-0"
          loading="lazy"
        />
      </div>
    </div>
  );
}
