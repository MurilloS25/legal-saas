"use client";

/**
 * Editor enriquecido del machote (Tiptap Community).
 *
 * La edición (negrita, cursiva, subrayado, deshacer, rehacer) usa los
 * comandos oficiales del editor; este componente solo construye una
 * interfaz accesible alrededor: toolbar con botones reales, estados
 * activos, foco visible y el diálogo de inserción de variables.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { buildEditorExtensions } from "@/lib/editor/tiptap";
import type { TemplateDocument, TemplateOptionBlockAttrs } from "@/lib/editor/types";
import { detectLegacyVariables } from "@/lib/editor/legacy-variables";
import type { TemplateWorkspaceVariable } from "../model/template-workspace";
import { suggestAutofillSource } from "../model/variable-autofill";
import { InsertVariableDialog } from "./InsertVariableDialog";
import { OptionBlockDialog } from "./OptionBlockDialog";
import {
  LegacyVariablesReviewDialog,
  type LegacyVariableSelection,
} from "./LegacyVariablesReviewDialog";

// ------------------------------------------------------------------ styles

const toolbarButtonClass =
  "flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm " +
  "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none " +
  "focus:ring-2 focus:ring-accent-500 disabled:opacity-40 " +
  "disabled:hover:bg-transparent transition-colors " +
  "aria-pressed:bg-accent-50 aria-pressed:text-accent-800";

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
  /** templates.write — sin este permiso, el editor es completamente de
   * solo lectura: Tiptap no acepta pulsaciones/comandos (`editable: false`,
   * bloquea insertar, borrar o reordenar contenido por teclado) y la
   * toolbar entera queda deshabilitada. */
  editable?: boolean;
};

/**
 * Acciones imperativas que el workspace necesita disparar sobre el
 * contenido del editor desde fuera. Ambas mutan el documento en vivo
 * (dispara `onUpdate` → `onDocumentChange`, igual que cualquier edición del
 * usuario) — la persistencia real sigue pasando por el guardado normal del
 * Machote, no por una llamada de red separada.
 *
 * `updateVariableLabel`: el nodo Tiptap guarda su propia copia de `label`
 * para poder mostrarla sin depender de la configuración externa (fichas
 * pegadas/legacy sin configurar todavía) — por eso, cuando la etiqueta
 * configurada cambia (desde la pestaña Variables), hay que empujar el
 * cambio a los nodos existentes en vez de dejarlos con una copia obsoleta.
 *
 * `updateOptionBlockStructuredOutput`: el mapeo Hora/Minutos de un Bloque de
 * opciones (`optionBlock.attrs.structuredOutput`) se configura desde la
 * pestaña Índice (`TemplateIndexConfigurationSection`), no desde el diálogo
 * del bloque — ver `option-blocks.ts`. Vive en el mismo `content_json` del
 * documento aunque se edite desde otra pestaña, así que se escribe aquí, no
 * en una tabla/RPC separada.
 */
export type TemplateEditorHandle = {
  updateVariableLabel: (key: string, label: string) => void;
  updateOptionBlockStructuredOutput: (
    blockId: string,
    structuredOutput: TemplateOptionBlockAttrs["structuredOutput"],
  ) => void;
};

export const TemplateEditor = forwardRef<TemplateEditorHandle, Props>(
  function TemplateEditor(
    {
      initialDocument,
      variables,
      onDocumentChange,
      onCreateVariable,
      "aria-label": ariaLabel = "Contenido del machote",
      editable = true,
    },
    ref,
  ) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const insertButtonRef = useRef<HTMLButtonElement | null>(null);
  const [legacyMatches, setLegacyMatches] = useState<
    ReturnType<typeof detectLegacyVariables>
  >([]);
  const insertOptionBlockButtonRef = useRef<HTMLButtonElement | null>(null);
  const [optionBlockDialog, setOptionBlockDialog] = useState<
    "closed" | "insert" | { mode: "edit"; pos: number; attrs: TemplateOptionBlockAttrs }
  >("closed");

  const editor = useEditor({
    extensions: buildEditorExtensions(),
    content: initialDocument,
    editable,
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
      // No intercepta el pegado: lo deja seguir su curso normal (el texto
      // se pega tal cual, no hay regla de pegado que convierta nada en
      // silencio). Solo observa el texto plano pegado para detectar TODO
      // placeholder `{{...}}` válido —cualquier mayúscula/minúscula— y
      // programa el diálogo de revisión para después de que el pegado real
      // ya se haya aplicado al documento.
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const matches = detectLegacyVariables(text);
        if (matches.length > 0) {
          window.setTimeout(() => setLegacyMatches(matches), 0);
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onDocumentChange(editor.getJSON());
    },
  });

  const editorState = useEditorState({
    editor,
    selector: (context) => {
      const selection = context.editor?.state.selection;
      const selectedOptionBlock =
        selection instanceof NodeSelection &&
        selection.node.type.name === "optionBlock"
          ? {
              pos: selection.from,
              attrs: selection.node.attrs as TemplateOptionBlockAttrs,
            }
          : null;
      return {
        bold: context.editor?.isActive("bold") ?? false,
        italic: context.editor?.isActive("italic") ?? false,
        underline: context.editor?.isActive("underline") ?? false,
        canUndo: context.editor?.can().undo() ?? false,
        canRedo: context.editor?.can().redo() ?? false,
        selectedOptionBlock,
      };
    },
  });

  // `emitUpdate=false`: setEditable por sí solo no debe disparar onUpdate
  // (que marca el workspace como "sucio") — solo cambia si se puede
  // escribir, no el contenido del documento.
  useEffect(() => {
    editor?.setEditable(editable, false);
  }, [editor, editable]);

  function insertVariable(key: string, label?: string) {
    editor?.chain().focus().insertTemplateVariable({ key, label }).run();
    setDialogOpen(false);
  }

  function closeDialog() {
    setDialogOpen(false);
    window.setTimeout(() => insertButtonRef.current?.focus(), 0);
  }

  function closeOptionBlockDialog() {
    setOptionBlockDialog("closed");
    window.setTimeout(() => insertOptionBlockButtonRef.current?.focus(), 0);
  }

  function saveOptionBlock(attrs: TemplateOptionBlockAttrs) {
    if (!editor) return;
    if (optionBlockDialog !== "closed" && optionBlockDialog !== "insert") {
      // Edición: reemplaza los attrs del nodo en su posición capturada.
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.setNodeMarkup(optionBlockDialog.pos, undefined, attrs);
          return true;
        })
        .run();
    } else {
      editor.chain().focus().insertOptionBlock(attrs).run();
    }
    closeOptionBlockDialog();
  }

  function deleteOptionBlock() {
    if (!editor || optionBlockDialog === "closed" || optionBlockDialog === "insert") {
      return;
    }
    const { pos } = optionBlockDialog;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const node = tr.doc.nodeAt(pos);
        if (!node) return false;
        tr.delete(pos, pos + node.nodeSize);
        return true;
      })
      .run();
    closeOptionBlockDialog();
  }

  /**
   * Convierte las variables pegadas que el usuario incluyó: busca el texto
   * literal `{{RAW}}` de cada una en los nodos de texto del documento (tal
   * como quedó tras el pegado normal) y lo reemplaza por una variable real.
   * Las candidatas excluidas, o si el usuario cancela, quedan como texto
   * literal sin ningún cambio — no hay sustitución parcial.
   *
   * Se aplican en orden de posición descendente sobre la misma transacción
   * para que los reemplazos previos no invaliden las posiciones siguientes.
   *
   * La configuración confirmada en el diálogo (clave, etiqueta, obligatoria,
   * transformación de salida) es la fuente real: además de crear el nodo,
   * cada clave nueva (que no esté ya configurada) se registra vía
   * `onCreateVariable` — el mismo camino que usa "Insertar variable" — para
   * que quede `Configurada` de inmediato, con la misma configuración
   * completa que una variable creada a mano, en vez de reaparecer como
   * pendiente sin etiqueta.
   */
  function convertLegacyVariables(
    selections: Map<string, LegacyVariableSelection>,
  ) {
    if (!editor) return;
    const { state, view } = editor;
    const variableType = state.schema.nodes.templateVariable;
    if (!variableType) return;

    type Replacement = {
      from: number;
      to: number;
      key: string;
      label: string;
      required: boolean;
      output_transform: LegacyVariableSelection["output_transform"];
    };
    const replacements: Replacement[] = [];

    state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      for (const [raw, selection] of selections) {
        if (!selection.included) continue;
        const needle = `{{${raw}}}`;
        let idx = node.text.indexOf(needle);
        while (idx !== -1) {
          replacements.push({
            from: pos + idx,
            to: pos + idx + needle.length,
            key: selection.key.trim(),
            label: selection.label.trim(),
            required: selection.required,
            output_transform: selection.output_transform,
          });
          idx = node.text.indexOf(needle, idx + needle.length);
        }
      }
    });

    if (replacements.length === 0) return;
    replacements.sort((a, b) => b.from - a.from);

    let tr = state.tr;
    for (const replacement of replacements) {
      tr = tr.replaceWith(
        replacement.from,
        replacement.to,
        variableType.create({
          key: replacement.key,
          label: replacement.label || null,
        }),
      );
    }
    // `view.dispatch` es el dispatch del propio editor Tiptap: dispara
    // `onUpdate` igual que cualquier otra edición, sin llamada manual aquí.
    view.dispatch(tr);

    const alreadyConfigured = new Set(variables.map((v) => v.field_key));
    const registered = new Set<string>();
    for (const replacement of replacements) {
      if (alreadyConfigured.has(replacement.key)) continue;
      if (registered.has(replacement.key)) continue;
      registered.add(replacement.key);
      onCreateVariable({
        field_key: replacement.key,
        label: replacement.label || replacement.key,
        required: replacement.required,
        autofill_source: suggestAutofillSource(replacement.key),
        output_transform: replacement.output_transform,
      });
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      updateVariableLabel(key: string, label: string) {
        if (!editor) return;
        const { state, view } = editor;
        let tr = state.tr;
        let changed = false;

        state.doc.descendants((node, pos) => {
          if (node.type.name !== "templateVariable") return;
          if (node.attrs.key !== key) return;
          if (node.attrs.label === label) return;
          tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, label });
          changed = true;
        });

        if (changed) view.dispatch(tr);
      },
      updateOptionBlockStructuredOutput(
        blockId: string,
        structuredOutput: TemplateOptionBlockAttrs["structuredOutput"],
      ) {
        if (!editor) return;
        const { state, view } = editor;
        let tr = state.tr;
        let changed = false;

        state.doc.descendants((node, pos) => {
          if (node.type.name !== "optionBlock") return;
          if (node.attrs.blockId !== blockId) return;
          tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, structuredOutput });
          changed = true;
        });

        if (changed) view.dispatch(tr);
      },
    }),
    [editor],
  );

  return (
    <div className="rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-accent-500 focus-within:border-accent-500 overflow-hidden">
      {!editable && (
        <div
          role="status"
          className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600"
        >
          Tu rol no permite editar este machote. Lo ves en modo lectura.
        </div>
      )}
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
          disabled={!editor || !editable}
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
          disabled={!editor || !editable}
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
          disabled={!editor || !editable}
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
          disabled={!editable || !editorState?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
          className={toolbarButtonClass}
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          aria-label="Rehacer"
          title="Rehacer (Ctrl+Y)"
          disabled={!editable || !editorState?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
          className={toolbarButtonClass}
        >
          <RedoIcon />
        </button>

        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

        <button
          type="button"
          ref={insertButtonRef}
          disabled={!editor || !editable}
          onClick={() => setDialogOpen(true)}
          className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-accent-700 hover:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-40 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Insertar variable
        </button>

        <button
          type="button"
          ref={insertOptionBlockButtonRef}
          disabled={!editor || !editable}
          onClick={() => setOptionBlockDialog("insert")}
          className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-accent-700 hover:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-40 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 2" />
          </svg>
          Insertar bloque de opciones
        </button>
      </div>

      {editable && editorState?.selectedOptionBlock && optionBlockDialog === "closed" && (
        <div className="flex items-center justify-between gap-2 border-b border-accent-200 bg-accent-50 px-4 py-2">
          <p className="text-xs text-accent-800">
            Bloque seleccionado: <strong>{editorState.selectedOptionBlock.attrs.name}</strong>
          </p>
          <button
            type="button"
            onClick={() => {
              if (!editorState.selectedOptionBlock) return;
              setOptionBlockDialog({
                mode: "edit",
                pos: editorState.selectedOptionBlock.pos,
                attrs: editorState.selectedOptionBlock.attrs,
              });
            }}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-accent-800 hover:bg-accent-100 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
          >
            Editar bloque
          </button>
        </div>
      )}

      <EditorContent editor={editor} />

      {dialogOpen && (
        <InsertVariableDialog
          variables={variables}
          onInsertExisting={(variable) =>
            insertVariable(variable.field_key, variable.label)
          }
          onInsertNew={(key, label) => {
            onCreateVariable({
              field_key: key,
              label,
              required: false,
              autofill_source: suggestAutofillSource(key),
              output_transform: "none",
            });
            insertVariable(key, label);
          }}
          onClose={closeDialog}
        />
      )}

      {optionBlockDialog !== "closed" && (
        <OptionBlockDialog
          initialAttrs={
            optionBlockDialog === "insert" ? undefined : optionBlockDialog.attrs
          }
          onSave={saveOptionBlock}
          onDelete={optionBlockDialog === "insert" ? undefined : deleteOptionBlock}
          onClose={closeOptionBlockDialog}
        />
      )}

      {legacyMatches.length > 0 && (
        <LegacyVariablesReviewDialog
          matches={legacyMatches}
          configuredKeys={new Set(variables.map((v) => v.field_key))}
          onConvert={(selections) => {
            convertLegacyVariables(selections);
            setLegacyMatches([]);
          }}
          onCancel={() => setLegacyMatches([])}
        />
      )}
    </div>
  );
  },
);
