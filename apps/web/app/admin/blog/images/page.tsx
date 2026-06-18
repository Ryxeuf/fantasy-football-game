"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "../../../auth-client";
import MediaLibrary from "../MediaLibrary";

async function fetchMe(): Promise<{ roles: string[] }> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return { roles: [] };
  const data = (await res.json()) as {
    user?: { roles?: string[]; role?: string };
  };
  const roles = Array.isArray(data.user?.roles)
    ? data.user!.roles!
    : data.user?.role
      ? [data.user.role]
      : [];
  return { roles };
}

export default function AdminBlogMediaPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const me = await fetchMe();
      if (!me.roles.includes("admin")) {
        window.location.href = "/";
        return;
      }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
          <p className="text-gray-600">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            🖼️ Médiathèque
          </h1>
          <p className="text-sm text-gray-600">
            Images uploadées pour le blog : glisser-déposer, copie d'URL, texte
            alternatif et suppression.
          </p>
        </div>
        <Link
          href={"/admin/blog" as never}
          className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-100 transition-all"
        >
          ← Retour au blog
        </Link>
      </div>

      <MediaLibrary mode="manage" />
    </div>
  );
}
