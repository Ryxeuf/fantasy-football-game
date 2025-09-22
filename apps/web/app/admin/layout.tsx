import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto p-0 md:p-6">
      <div className="md:flex">
        <aside className="w-full md:w-60 bg-gray-50 border-r p-4 space-y-3">
          <div className="text-lg font-bold">Admin</div>
          <nav className="text-sm space-y-2">
            <a className="block hover:underline" href="/admin">Aperçu</a>
            <a className="block hover:underline" href="/admin/users">Utilisateurs</a>
            <a className="block hover:underline" href="/admin/matches">Parties</a>
          </nav>
        </aside>
        <main className="flex-1 p-6 space-y-8">{children}</main>
      </div>
    </div>
  );
}


