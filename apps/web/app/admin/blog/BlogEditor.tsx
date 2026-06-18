"use client";

import { useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { uploadBlogImage } from "./api";
import MediaLibraryModal from "./MediaLibraryModal";

interface BlogEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const TOOLBAR_BTN =
  "px-2 py-1 rounded text-sm font-medium border border-gray-300 hover:bg-gray-100 transition-colors";
const TOOLBAR_BTN_ACTIVE =
  "bg-nuffle-gold/20 border-nuffle-gold text-nuffle-bronze";

function ToolbarButton({
  editor,
  isActive,
  onClick,
  label,
  title,
}: {
  editor: Editor;
  isActive: boolean;
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={!editor.isEditable}
      className={`${TOOLBAR_BTN} ${isActive ? TOOLBAR_BTN_ACTIVE : "bg-white"}`}
    >
      {label}
    </button>
  );
}

export default function BlogEditor({
  value,
  onChange,
  placeholder,
}: BlogEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({
        placeholder: placeholder ?? "Rédigez votre article…",
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[400px] px-4 py-3",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  if (!editor) {
    return (
      <div className="border border-gray-300 rounded-lg bg-gray-50 min-h-[400px] flex items-center justify-center text-gray-400">
        Chargement de l'éditeur…
      </div>
    );
  }

  const promptForLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(
      "URL du lien (vide pour retirer) :",
      previousUrl ?? "https://",
    );
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const promptForImage = () => {
    const url = window.prompt(
      "URL de l'image (https://… ou /images/…) :",
      "https://",
    );
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset l'input pour autoriser le ré-upload du même fichier.
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const { url } = await uploadBlogImage(file, file.name);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Échec de l'upload de l'image",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap gap-1.5 p-2 border-b border-gray-200 bg-gray-50">
        <ToolbarButton
          editor={editor}
          isActive={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          label="H2"
          title="Titre niveau 2"
        />
        <ToolbarButton
          editor={editor}
          isActive={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          label="H3"
          title="Titre niveau 3"
        />
        <span className="w-px bg-gray-300 mx-1" />
        <ToolbarButton
          editor={editor}
          isActive={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="B"
          title="Gras"
        />
        <ToolbarButton
          editor={editor}
          isActive={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="I"
          title="Italique"
        />
        <ToolbarButton
          editor={editor}
          isActive={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="S"
          title="Barré"
        />
        <ToolbarButton
          editor={editor}
          isActive={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          label="</>"
          title="Code inline"
        />
        <span className="w-px bg-gray-300 mx-1" />
        <ToolbarButton
          editor={editor}
          isActive={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="• Liste"
          title="Liste à puces"
        />
        <ToolbarButton
          editor={editor}
          isActive={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="1. Liste"
          title="Liste numérotée"
        />
        <ToolbarButton
          editor={editor}
          isActive={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="❝"
          title="Citation"
        />
        <ToolbarButton
          editor={editor}
          isActive={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          label="{ }"
          title="Bloc de code"
        />
        <span className="w-px bg-gray-300 mx-1" />
        <ToolbarButton
          editor={editor}
          isActive={editor.isActive("link")}
          onClick={promptForLink}
          label="🔗"
          title="Lien"
        />
        <ToolbarButton
          editor={editor}
          isActive={false}
          onClick={promptForImage}
          label="🖼️"
          title="Image par URL"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Uploader une image"
          disabled={!editor.isEditable || uploading}
          className={`${TOOLBAR_BTN} bg-white disabled:opacity-50`}
        >
          {uploading ? "⏳" : "⬆️🖼️"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={handleFileSelected}
        />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          title="Choisir depuis la médiathèque"
          disabled={!editor.isEditable}
          className={`${TOOLBAR_BTN} bg-white disabled:opacity-50`}
        >
          📚
        </button>
        <ToolbarButton
          editor={editor}
          isActive={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          label="—"
          title="Séparateur"
        />
        <span className="w-px bg-gray-300 mx-1" />
        <ToolbarButton
          editor={editor}
          isActive={false}
          onClick={() => editor.chain().focus().undo().run()}
          label="↶"
          title="Annuler"
        />
        <ToolbarButton
          editor={editor}
          isActive={false}
          onClick={() => editor.chain().focus().redo().run()}
          label="↷"
          title="Rétablir"
        />
      </div>
      {uploadError && (
        <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-200">
          ⚠️ {uploadError}
        </div>
      )}
      <EditorContent editor={editor} />
      <MediaLibraryModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(img) =>
          editor
            .chain()
            .focus()
            .setImage({ src: img.url, alt: img.alt ?? undefined })
            .run()
        }
      />
    </div>
  );
}
