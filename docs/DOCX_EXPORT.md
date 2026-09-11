# DOCX Export

Lawyers can download a saved escritura draft as an editable Word (`.docx`) file.

## Behavior

- Generation is **on demand** and **server-only**. Nothing is stored: no Supabase Storage, no disk, no database blob, no external service.
- The file always reflects the **last saved draft**. The download button is disabled while there are unsaved changes (`Guarda los cambios antes de descargar el Word`).
- Preview, editing, finalization and DOCX all consume the Escritura's immutable `template_snapshot`; later changes to the source Machote do not affect existing Escrituras. Rows created before that column use their persisted `rendered_content` as a plain-text compatibility document.
- **Pending variables stay visible.** A variable without a value appears in the Word as `{{clave}}`; it is never dropped or emptied. If the saved draft has pending variables, an accessible confirmation dialog is shown before downloading (count + cancel + "Descargar de todas formas").
- No Microsoft Graph, Office APIs, LibreOffice, external conversion, or Tiptap Cloud is used.

## Supported format

Legal paper (8.5 × 14 in) portrait, always — not a user preference, a fixed product default. Font family, font size, and the four margins come from the owner's saved `document_settings` row (`src/app/(dashboard)/dashboard/settings`), resolved through `resolveDocumentFormatting` (`src/lib/documents/docx/formatting.ts`) with product defaults (Times New Roman, 12pt, 4.7/4.7/3.2/3.2 cm margins) for anything missing or invalid — generation never fails because of a bad preference. The document body is always **justified** with **exactly 24pt line spacing** (`FIXED_BODY_ALIGNMENT`/`FIXED_BODY_LINE_SPACING`) — fixed, independent of the saved `line_spacing` preference (that field still exists in Configuración/`document_settings` but no longer affects DOCX output). Preserves paragraphs, empty lines, hard breaks, bold, italic, underline, and full Unicode (accents, `₡`, `§`, guillemets). Out of scope for now: headers/footers, page numbers, tables, images, imported `.docx` templates, per-run style overrides beyond bold/italic/underline, PDF.

### Formatting preferences → DOCX

- `src/lib/documents/docx/formatting.ts` — single source of truth: `DocumentFormattingPreferences` type, `DOCX_DEFAULT_FORMATTING`, `LEGAL_PAGE_SIZE_TWIPS`, `FIXED_BODY_LINE_SPACING`/`FIXED_BODY_ALIGNMENT` (24pt exact, justified — not derived from preferences), unit conversions (`centimetersToTwip`, `pointsToHalfPoints`, `lineSpacingToDocx`, the last now unused in production but kept as a tested pure utility), and `resolveDocumentFormatting(raw)` (saved row → validated preferences, independent per-field fallback to defaults).
- `src/lib/documents/docx/settings-loader.ts` — `loadDocumentFormattingPreferences(supabase, ownerId)`, the only place that queries `document_settings` for generation.
- `src/lib/documents/docx/config.ts` — `buildDocxSectionConfig(prefs)` translates preferences into the twips/half-points/`docx` section shape `generateDocumentDocx` consumes.
- The Índice Notarial exporter (`src/features/notarial-index/export/notarial-docx.ts`) reuses the same font/margins/page size, overriding only orientation (landscape) — see the code comments there for why its per-element table/title/footer point sizes stay fixed instead of inheriting the configured font size, and why the fixed justified/24pt-exact body formatting doesn't apply to it (no flowing body paragraphs — title, table cells, and footer are single-line and explicitly centered).

## Endpoint

```
GET /api/documents/[id]/docx   (runtime: nodejs, dynamic)
```

- Authenticates on the server; anonymous → `401`.
- Loads only the caller's own document and its stored template snapshot — does not distinguish missing from foreign (`404`), defense in depth beyond RLS.
- Accepts nothing from the client except the document ID in the path: not content, `field_values`, title, ownership, filename or status.
- Response headers: OOXML MIME, `Content-Disposition: attachment` (ASCII fallback + RFC 5987 `filename*`), `Content-Length`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- Errors are generic (`No fue posible generar el documento.`) with no SQL, stack, or document content; only a non-sensitive technical code is logged.

## Modules

- `src/lib/documents/docx/` — server-only generation layer:
  - `document.ts` — `buildEscrituraDocx({ document, fieldValues, title, formatting? })` → `{ buffer, filename, pendingVariables }`.
  - `generate.ts` — `generateDocumentDocx(model, formatting?)` (neutral `DocumentModel` → in-memory Buffer).
  - `formatting.ts` — formatting preferences type, defaults, unit conversions, `resolveDocumentFormatting`.
  - `settings-loader.ts` — `loadDocumentFormattingPreferences(supabase, ownerId)`.
  - `config.ts` — `buildDocxSectionConfig(prefs)`, translates preferences to the `docx` section shape.
  - `limits.ts` — size/complexity guardrails, unrelated to formatting.
  - `filename.ts` — safe filename (no path traversal, no reserved Windows names, no control chars/CRLF, accents kept, bounded length, fallback).
  - `http.ts` — MIME + `Content-Disposition` builder.
- `src/app/api/documents/[id]/docx/route.ts` — the Route Handler.
- `src/app/(dashboard)/dashboard/documents/_components/DownloadDocxButton.tsx` — the client button, unsaved-changes gate and pending-variables dialog.

Compatibility: new Escrituras retain variables, Option Blocks and formatting from their structured `template_snapshot`. Pre-migration rows retain the exact text of their last saved `rendered_content`; structure that was never persisted cannot be recovered and is not guessed from the current Machote.

## Privacy

Legal content may be sensitive. The feature sends nothing to third parties, adds no analytics/telemetry/API keys, and never logs `field_values`, `rendered_content`, `template_snapshot` or template text. Generated buffers live only in memory for the duration of the request. E2E downloads use temporary paths that are ignored by git.

## Dependencies

- [`docx`](https://www.npmjs.com/package/docx) `9.7.1` — MIT, actively maintained, pure JS, no external services. Chosen over alternatives: `html-docx-js` (unmaintained, HTML-based), `officegen` (older, less typed), `mammoth` (converts docx→HTML, wrong direction), and Pandoc/LibreOffice (external binaries, out of scope).
- `server-only` — MIT, marks the generation modules so they cannot be bundled into client code.
- `jszip` (devDependency) — dual licensed `(MIT OR GPL-3.0-or-later)`, used under its MIT-compatible option only in tests to inspect the generated `.docx` as a ZIP without Microsoft Word.

`pnpm audit --prod` reports no advisories introduced by these packages.

## Tests

- Unit (`src/lib/documents/docx/*.test.ts`): filename safety, generation and OOXML structure (inspected as ZIP: `[Content_Types].xml`, `_rels/.rels`, `word/document.xml`, `word/styles.xml`), marks, variable substitution, pending placeholders, Unicode, limits, `Content-Disposition` header safety (CRLF/quotes/RFC 5987), basic performance (small/medium/near-limit), unit conversions and `resolveDocumentFormatting` defaulting (`formatting.test.ts`), and end-to-end formatting applied to the generated OOXML — Legal page size, margins, font, size, line spacing (`formatting-applied.test.ts`).
- `src/features/notarial-index/export/notarial-docx.test.ts`: landscape Legal page size, configured margins, font propagation, and fixed per-element point sizes.
- E2E (`e2e/documents-docx-authenticated.spec.ts`, project `chromium-documents-docx`): button visibility, unsaved-changes gate, download + ZIP inspection, saved-snapshot regression after a later template edit, MIME/headers, pending-variables confirmation, cancel / download anyway, `404` for missing/foreign, invalid id, anonymous `401`, and mobile.
