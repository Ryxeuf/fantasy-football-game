"use client";

/**
 * Éditeur riche RÉDUIT pour les articles des coachs : titres, gras,
 * italique, listes, citation, lien et image uploadée sur le blog de LA
 * compétition. Pas d'image par URL (le serveur ne garderait que les images de
 * la compétition) ni de médiathèque (outil d'admin).
 */

import { useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { BLOG_IMAGE_ACCEPT } from "../../lib/competition-blog";

interface RichTextEditorProps {
  readonly value: string;
  readonly onChange: (html: string) => void;
  /** Upload d'une image ; renvoie son URL publique. */
  readonly onUploadImage: (file: File) => Promise<string>;
  readonly placeholder?: string;
}

const BTN =
  "px-2 py-1 rounded text-sm font-medium border border-gray-300 hover:bg-gray-100 transition-colors";
const BTN_ACTIVE = "bg-nuffle-gold/20 border-nuffle-gold text-nuffle-bronze";

function ToolbarButton({
  editor,
  active,
  onClick,
  label,
  title,
}: {
  readonly editor: Editor;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly label: string;
  readonly title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={!editor.isEditable}
      className={`${BTN} ${active ? BTN_ACTIVE : "bg-white"}`}
    >
      {label}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  onUploadImage,
  placeholder,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        // Le lien est configuré ci-dessous (rel « ugc »).
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "nofollow ugc noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Racontez votre match…" }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[280px] px-4 py-3",
        "aria-label": "Contenu de l'article",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    immediatelyRender: false,
  });

  if (!editor) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-gray-300 bg-gray-50 text-gray-400">
        Chargement de l'éditeur…
      </div>
    );
  }

  const promptForLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL du lien (vide pour retirer) :", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await onUploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Échec de l'envoi de l'image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white">
      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 bg-gray-50 p-2">
        <ToolbarButton editor={editor} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="H2" title="Titre" />
        <ToolbarButton editor={editor} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="H3" title="Sous-titre" />
        <ToolbarButton editor={editor} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="B" title="Gras" />
        <ToolbarButton editor={editor} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="I" title="Italique" />
        <ToolbarButton editor={editor} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="• Liste" title="Liste à puces" />
        <ToolbarButton editor={editor} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="1. Liste" title="Liste numérotée" />
        <ToolbarButton editor={editor} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="❝" title="Citation" />
        <ToolbarButton editor={editor} active={editor.isActive("link")} onClick={promptForLink} label="🔗" title="Lien" />
        <button
          type="button"
          title="Ajouter une image"
          aria-label="Ajouter une image"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className={`${BTN} bg-white disabled:opacity-50`}
        >
          {uploading ? "⏳" : "🖼️"}
        </button>
        <input ref={fileInputRef} type="file" accept={BLOG_IMAGE_ACCEPT} className="hidden" onChange={onFile} data-testid="editor-image-input" />
      </div>
      <EditorContent editor={editor} />
      {uploadError && <p className="px-4 pb-2 text-sm text-red-600">{uploadError}</p>}
    </div>
  );
}
