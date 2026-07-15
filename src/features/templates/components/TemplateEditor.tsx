"use client";

/**
 * Editor enriquecido del machote (Tiptap Community).
 *
 * La edición (negrita, cursiva, subrayado, deshacer, rehacer) usa los
 * comandos oficiales del editor; este componente solo construye una
 * interfaz accesible alrededor: toolbar con botones reales, estados
 * activos, foco visible y el diálogo de inserción de variables.
 */

import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { buildEditorExtensions } from "@/lib/editor/tiptap";
import type { TemplateDocument } from "@/lib/editor/types";
import type { TemplateWorkspaceVariable } from "../model/template-workspace";
import { InsertVariableDialog } from "./InsertVariableDialog";

// ------------------------------------------------------------------ styles

const toolbarButtonClass =
  "flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm " +
  "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none " +
  "focus:ring-2 focus:ring-teal-500 disabled:opacity-40 " +
  "disabled:hover:bg-transparent transition-colors " +
  "aria-pressed:bg-teal-50 aria-pressed:text-teal-800";

// ------------------------------------------------------------------ toolbar icons

function BoldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function UnderlineIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 14 20 9 15 4" />
      <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
    </svg>
  );
}

// ------------------------------------------------------------------ editor

type Props = {
  initialDocument: TemplateDocument;
  variables: TemplateWorkspaceVariable[];
  onDocumentChange: (document: unknown) => void;
  /** Crea la configuración local de una variable nueva insertada. */
  onCreateVariable: (variable: TemplateWorkspaceVariable) => void;
  "aria-label"?: string;
};

export function TemplateEditor({
  initialDocument,
  variables,
  onDocumentChange,
  onCreateVariable,
  "aria-label": ariaLabel = "Contenido del machote",
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const insertButtonRef = useRef<HTMLButtonElement | null>(null);

  const editor = useEditor({
    extensions: buildEditorExtensions(),
    content: initialDocument,
    // Evita render inmediato en SSR (hidratación de Next.js).
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel,
        class:
          "tiptap-editor min-h-[20rem] px-4 py-3 text-sm leading-relaxed " +
          "text-slate-900 focus:outline-none whitespace-pre-wrap",
      },
    },
    onUpdate: ({ editor }) => {
      onDocumentChange(editor.getJSON());
    },
  });

  const editorState = useEditorState({
    editor,
    selector: (context) => ({
      bold: context.editor?.isActive("bold") ?? false,
      italic: context.editor?.isActive("italic") ?? false,
      underline: context.editor?.isActive("underline") ?? false,
      canUndo: context.editor?.can().undo() ?? false,
      canRedo: context.editor?.can().redo() ?? false,
    }),
  });

  function insertVariable(key: string, label?: string) {
    editor?.chain().focus().insertTemplateVariable({ key, label }).run();
    setDialogOpen(false);
  }

  function closeDialog() {
    setDialogOpen(false);
    window.setTimeout(() => insertButtonRef.current?.focus(), 0);
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 overflow-hidden">
      <div
        role="toolbar"
        aria-label="Formato del contenido"
        className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50/80 px-2 py-1.5 overflow-x-auto"
      >
        <button
          type="button"
          aria-label="Negrita"
          aria-pressed={editorState?.bold ?? false}
          title="Negrita (Ctrl+B)"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={toolbarButtonClass}
        >
          <BoldIcon />
        </button>
        <button
          type="button"
          aria-label="Cursiva"
          aria-pressed={editorState?.italic ?? false}
          title="Cursiva (Ctrl+I)"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={toolbarButtonClass}
        >
          <ItalicIcon />
        </button>
        <button
          type="button"
          aria-label="Subrayado"
          aria-pressed={editorState?.underline ?? false}
          title="Subrayado (Ctrl+U)"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          className={toolbarButtonClass}
        >
          <UnderlineIcon />
        </button>

        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

        <button
          type="button"
          aria-label="Deshacer"
          title="Deshacer (Ctrl+Z)"
          disabled={!editorState?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
          className={toolbarButtonClass}
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          aria-label="Rehacer"
          title="Rehacer (Ctrl+Y)"
          disabled={!editorState?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
          className={toolbarButtonClass}
        >
          <RedoIcon />
        </button>

        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

        <button
          type="button"
          ref={insertButtonRef}
          disabled={!editor}
          onClick={() => setDialogOpen(true)}
          className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-teal-700 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-40 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Insertar variable
        </button>
      </div>

      <EditorContent editor={editor} />

      {dialogOpen && (
        <InsertVariableDialog
          variables={variables}
          onInsertExisting={(variable) =>
            insertVariable(variable.field_key, variable.label)
          }
          onInsertNew={(key, label) => {
            onCreateVariable({ field_key: key, label, required: false });
            insertVariable(key, label);
          }}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
