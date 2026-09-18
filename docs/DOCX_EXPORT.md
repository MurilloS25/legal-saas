# DOCX Export

Lawyers can download a saved escritura draft as an editable Word (`.docx`) file.

## Behavior

- Generation is **on demand** and **server-only**. Nothing is stored: no Supabase Storage, no disk, no database blob, no external service.
- The file always reflects the **last saved draft**. The download button is disabled while there are unsaved changes (`Guarda los cambios antes de descargar el Word`).
- Preview, editing, finalization and DOCX all consume the Escritura's immutable `template_snapshot`; later changes to the source Machote do not affect existing Escrituras. Rows created before that column use their persisted `rendered_content` as a plain-text compatibility document.
- **Pending variables stay visible.** A variable without a value appears in the Word as `{{clave}}`; it is never dropped or emptied. If the saved draft has pending variables, an accessible confirmation dialog is shown before downloading (count + cancel + "Descargar de todas formas").
- No Microsoft Graph, Office APIs, LibreOffice, external conversion, or Tiptap Cloud is used.

## Supported format

Legal paper (8.5 × 14 in) portrait, always — not a user preference, a fixed product default. Font family, font size, and the margins come from the workspace's saved `document_settings` row (`src/app/(dashboard)/settings`), resolved through `resolveDocumentFormatting` (`src/lib/documents/docx/formatting.ts`) with product defaults (Times New Roman, 12pt, Word-reference margins below) for anything missing or invalid — generation never fails because of a bad preference. Preserves paragraphs, empty lines, hard breaks, bold, italic, underline, and full Unicode (accents, `₡`, `§`, guillemets). Out of scope for now: headers/footers, page numbers, tables, images, imported `.docx` templates, per-run style overrides beyond bold/italic/underline, PDF.

The **font list and font sizes are not final**: they are preserved as they were and still pending normative validation. Do not treat them as definitive.

### Body paragraph format (fixed, not configurable)

Declared once in `FIXED_BODY_PARAGRAPH` (`formatting.ts`) and written to the document's `docDefaults` (`w:pPrDefault`), so every body paragraph inherits it and no paragraph overrides it:

| Property | Value | OOXML |
|---|---|---|
| Alignment | Justified | `<w:jc w:val="both"/>` |
| Left / right indent | 0 | `<w:ind w:left="0" w:right="0"/>` (no `firstLine`/`hanging`) |
| Spacing before / after | 0 pt | `w:before="0" w:after="0"` |
| Line spacing | **Exactly 24 pt** | `w:line="480" w:lineRule="exactly"` (480 = 24 pt × 20) |

Line spacing is a fixed absolute measure (`lineRule="exactly"`), never a multiple such as 1.5 (`auto`). The old `line_spacing` preference no longer exists in the UI or validation; the `document_settings.line_spacing` column remains (default 1.5, unused) only for compatibility.

### Margins: Frente / Vuelto

Two independent margin profiles — **Frente** (`front`) and **Vuelto** (`back`) — each with top/bottom/left/right. Gutter is always 0, orientation portrait. Both start with the Word reference values; they may diverge later.

| Side | Word | Stored (cm) | Twips |
|---|---|---|---|
| Top | 1.44" | 3.66 | 2074 |
| Bottom | 2.22" | 5.64 | 3197 |
| Left | 0.98" | 2.49 | 1411 |
| Right | 0.98" | 2.49 | 1411 |

- **Unit:** the UI and `document_settings` use centimeters (2 decimals); the DOCX uses twips. The only conversion is `centimetersToTwip` in `formatting.ts`. The cm values above convert to exactly the same twips as the inch values in Word.
- **Storage:** Frente = `margin_*_cm`; Vuelto = `back_margin_*_cm` (nullable, all-or-none). A row saved before this change has NULL Vuelto margins and is resolved as Vuelto = its Frente margins (no data rewritten); saving Configuración persists both.
- **Existing saved rows keep their margins** — only workspaces with no saved row get the new Word-reference defaults (they were 4.7/4.7/3.2/3.2 cm).
- **Selecting the profile:** the "Formato de margen" selector next to "Descargar Word" (Frente by default, not remembered) sends `?margins=front|back`; the server applies that profile's margins. The Índice Notarial export always uses Frente.

### Formatting preferences → DOCX

- `src/lib/documents/docx/formatting.ts` — single source of truth: `DocumentFormattingPreferences` type, `DOCX_DEFAULT_FORMATTING`, `LEGAL_PAGE_SIZE_TWIPS`, `FIXED_BODY_PARAGRAPH` (justified, indents 0, before/after 0, exactly 24pt — not derived from preferences), `REFERENCE_MARGINS_CM`, unit conversions (`centimetersToTwip`, `pointsToHalfPoints`), and `resolveDocumentFormatting(raw)` (saved row → validated preferences with `marginsCm.front`/`marginsCm.back`, independent per-field fallback to defaults, Vuelto falls back to Frente for legacy rows). `margin-profile.ts` holds the client-safe `MarginProfile` constants shared with the Configuración UI and the download selector.
- `src/lib/documents/docx/settings-loader.ts` — `loadDocumentFormattingPreferences(supabase, ownerId)`, the only place that queries `document_settings` for generation.
- `src/lib/documents/docx/config.ts` — `buildDocxSectionConfig(prefs, profile)` translates preferences into the twips/half-points/`docx` section shape `generateDocumentDocx` consumes.
- The Índice Notarial exporter (`src/features/notarial-index/export/notarial-docx.ts`) reuses the same font/Frente margins/page size, overriding only orientation (landscape) — see the code comments there for why its per-element table/title/footer point sizes stay fixed instead of inheriting the configured font size, and why the fixed justified/24pt-exact body formatting doesn't apply to it (no flowing body paragraphs — title, table cells, and footer are single-line and explicitly centered).

## Endpoint

```
GET  /api/documents/[id]/docx?margins=front|back   (runtime: nodejs, dynamic; no audit event)
POST /api/documents/[id]/docx?margins=front|back   (records the export activity)
```

`margins` is optional (default `front`); any other value → `400`.

- Authenticates on the server; anonymous → `401`.
- Loads only the caller's own document and its stored template snapshot — does not distinguish missing from foreign (`404`), defense in depth beyond RLS.
- Accepts nothing from the client except the document ID in the path and the optional `margins` profile (`front`/`back`): not content, `field_values`, title, ownership, filename or status.
- Response headers: OOXML MIME, `Content-Disposition: attachment` (ASCII fallback + RFC 5987 `filename*`), `Content-Length`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- Errors are generic (`No fue posible generar el documento.`) with no SQL, stack, or document content; only a non-sensitive technical code is logged.

## Modules

- `src/lib/documents/docx/` — server-only generation layer:
  - `document.ts` — `buildEscrituraDocx({ document, fieldValues, title, formatting?, marginProfile? })` → `{ buffer, filename, pendingVariables }`.
  - `generate.ts` — `generateDocumentDocx(model, formatting?, marginProfile?)` (neutral `DocumentModel` → in-memory Buffer).
  - `formatting.ts` — formatting preferences type, defaults, unit conversions, `resolveDocumentFormatting`.
  - `settings-loader.ts` — `loadDocumentFormattingPreferences(supabase, ownerId)`.
  - `config.ts` — `buildDocxSectionConfig(prefs)`, translates preferences to the `docx` section shape.
  - `limits.ts` — size/complexity guardrails, unrelated to formatting.
  - `filename.ts` — safe filename (no path traversal, no reserved Windows names, no control chars/CRLF, accents kept, bounded length, fallback).
  - `http.ts` — MIME + `Content-Disposition` builder.
- `src/app/api/documents/[id]/docx/route.ts` — the Route Handler.
- `src/app/(dashboard)/documents/_components/DownloadDocxButton.tsx` — the client button, unsaved-changes gate and pending-variables dialog.

Compatibility: new Escrituras retain variables, Option Blocks and formatting from their structured `template_snapshot`. Pre-migration rows retain the exact text of their last saved `rendered_content`; structure that was never persisted cannot be recovered and is not guessed from the current Machote.

## Privacy

Legal content may be sensitive. The feature sends nothing to third parties, adds no analytics/telemetry/API keys, and never logs `field_values`, `rendered_content`, `template_snapshot` or template text. Generated buffers live only in memory for the duration of the request. E2E downloads use temporary paths that are ignored by git.

## Dependencies

- [`docx`](https://www.npmjs.com/package/docx) `9.7.1` — MIT, actively maintained, pure JS, no external services. Chosen over alternatives: `html-docx-js` (unmaintained, HTML-based), `officegen` (older, less typed), `mammoth` (converts docx→HTML, wrong direction), and Pandoc/LibreOffice (external binaries, out of scope).
- `server-only` — MIT, marks the generation modules so they cannot be bundled into client code.
- `jszip` (devDependency) — dual licensed `(MIT OR GPL-3.0-or-later)`, used under its MIT-compatible option only in tests to inspect the generated `.docx` as a ZIP without Microsoft Word.

`pnpm audit --prod` reports no advisories introduced by these packages.

## Tests

- Unit (`src/lib/documents/docx/*.test.ts`): filename safety, generation and OOXML structure (inspected as ZIP: `[Content_Types].xml`, `_rels/.rels`, `word/document.xml`, `word/styles.xml`), marks, variable substitution, pending placeholders, Unicode, limits, `Content-Disposition` header safety (CRLF/quotes/RFC 5987), basic performance (small/medium/near-limit), unit conversions and `resolveDocumentFormatting` defaulting (`formatting.test.ts`), and end-to-end formatting applied to the generated OOXML (`formatting-applied.test.ts`): `w:pgMar` for Frente and Vuelto (independent), `w:pgSz`, `w:jc`, `w:ind` and `w:spacing` (before/after 0, exactly 24pt). E2E `document-format-front-back-authenticated.spec.ts` saves both profiles, persists them, and downloads Frente and Vuelto inspecting `w:pgMar` in the real `.docx`.
- `src/features/notarial-index/export/notarial-docx.test.ts`: landscape Legal page size, configured Frente margins, font propagation, and fixed per-element point sizes.
- E2E (`e2e/documents-docx-authenticated.spec.ts`, project `chromium-documents-docx`): button visibility, unsaved-changes gate, download + ZIP inspection, saved-snapshot regression after a later template edit, MIME/headers, pending-variables confirmation, cancel / download anyway, `404` for missing/foreign, invalid id, anonymous `401`, and mobile.
