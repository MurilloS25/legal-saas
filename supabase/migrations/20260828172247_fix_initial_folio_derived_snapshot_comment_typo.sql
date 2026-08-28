-- Reconciliación documental: esta migración ya fue aplicada directamente en
-- `lexcr-production` (Supabase Cloud) el 2026-08-28, vía el Management API,
-- para corregir un error de transcripción cometido al aplicar
-- `20260827120000_notarial_index_derived_snapshot_tracking.sql` — el
-- comentario de la columna `initial_folio_derived_snapshot` había quedado
-- como "Análogo para final_folio." en vez de "Análogo para initial_folio.".
-- Cloud ya registra esta migración con este mismo `version`
-- (20260828172247) en `supabase_migrations.schema_migrations` — este
-- archivo solo pone a Git al día con ese historial remoto ya existente, sin
-- volver a ejecutar el SQL. No aplicar manualmente de nuevo.
comment on column public.document_notarial_metadata.initial_folio_derived_snapshot is
  'Análogo para initial_folio.';
