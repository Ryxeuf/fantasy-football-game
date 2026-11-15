/** Message neutre : flag éteint ou compétition introuvable. */
export default function BlogUnavailable({ message }: { readonly message?: string }) {
  return (
    <div className="mx-auto max-w-3xl p-6 text-center text-gray-600" data-testid="blog-unavailable">
      {message ?? "Ce blog n'est pas disponible."}
    </div>
  );
}
