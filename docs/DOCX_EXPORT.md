# DOCX Export

Lawyers can download a saved escritura draft as an editable Word (`.docx`) file.

## Behavior

- Generation is **on demand** and **server-only**. Nothing is stored: no Supabase Storage, no disk, no database blob, no external service.
- The file always reflects the **last saved draft**. The download button is disabled while there are unsaved changes (`Guarda los cambios antes de descargar el Word`).
- **Pending variables stay visible.** A variable without a value appears in the Word as `{{clave}}`; it is never dropped or emptied. If the saved draft has pending variables, an accessible confirmation dialog is shown before downloading (count + cancel + "Descargar de todas formas").
- No Microsoft Graph, Office APIs, LibreOffice, external conversion, or Tiptap Cloud is used.

## Supported format

A4 portrait, ~1 inch margins, Times New Roman, 1.5 line spacing. Preserves paragraphs, empty lines, hard breaks, bold, italic, underline, and full Unicode (accents, `₡`, `§`, guillemets). Out of scope for now: headers/footers, page numbers, tables, images, imported `.docx` templates, styles configuration, PDF.

## Endpoint

```
GET /api/documents/[id]/docx   (runtime: nodejs, dynamic)
```

- Authenticates on the server; anonymous → `401`.
- Loads only the caller's own document (`owner_id`) and its own template — does not distinguish missing from foreign (`404`), defense in depth beyond RLS.
- Accepts nothing from the client except the document ID in the path: not content, `field_values`, title, ownership, filename or status.
- Response headers: OOXML MIME, `Content-Disposition: attachment` (ASCII fallback + RFC 5987 `filename*`), `Content-Length`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- Errors are generic (`No fue posible generar el documento.`) with no SQL, stack, or document content; only a non-sensitive technical code is logged.

## Modules

- `src/lib/documents/docx/` — server-only generation layer:
  - `document.ts` — `buildEscrituraDocx({ contentJson, fieldValues, title })` → `{ buffer, filename, pendingVariables }`.
  - `generate.ts` — `generateDocumentDocx(model)` (neutral `DocumentModel` → in-memory Buffer).
  - `config.ts` / `limits.ts` — central format and size limits.
  - `filename.ts` — safe filename (no path traversal, no reserved Windows names, no control chars/CRLF, accents kept, bounded length, fallback).
  - `http.ts` — MIME + `Content-Disposition` builder.
- `src/app/api/documents/[id]/docx/route.ts` — the Route Handler.
- `src/app/(dashboard)/dashboard/documents/_components/DownloadDocxButton.tsx` — the client button, unsaved-changes gate and pending-variables dialog.

Compatibility: works for structured `content_json.doc` and legacy text-only machotes (converted via the shared layer), and preserves historical `field_values`.

## Privacy

Legal content may be sensitive. The feature sends nothing to third parties, adds no analytics/telemetry/API keys, and never logs `field_values`, `rendered_content` or template text. Generated buffers live only in memory for the duration of the request. E2E downloads use temporary paths that are ignored by git.

## Dependencies

- [`docx`](https://www.npmjs.com/package/docx) `9.7.1` — MIT, actively maintained, pure JS, no external services. Chosen over alternatives: `html-docx-js` (unmaintained, HTML-based), `officegen` (older, less typed), `mammoth` (converts docx→HTML, wrong direction), and Pandoc/LibreOffice (external binaries, out of scope).
- `server-only` — MIT, marks the generation modules so they cannot be bundled into client code.
- `jszip` (devDependency) — MIT, used only in tests to inspect the generated `.docx` as a ZIP without Microsoft Word.

`pnpm audit --prod` reports no advisories introduced by these packages.

## Tests

- Unit (`src/lib/documents/docx/*.test.ts`): filename safety, generation and OOXML structure (inspected as ZIP: `[Content_Types].xml`, `_rels/.rels`, `word/document.xml`), marks, variable substitution, pending placeholders, Unicode, limits, `Content-Disposition` header safety (CRLF/quotes/RFC 5987), and basic performance (small/medium/near-limit).
- E2E (`e2e/documents-docx-authenticated.spec.ts`, project `chromium-documents-docx`): button visibility, unsaved-changes gate, download + ZIP inspection, MIME/headers, pending-variables confirmation, cancel / download anyway, `404` for missing/foreign, invalid id, anonymous `401`, and mobile.
