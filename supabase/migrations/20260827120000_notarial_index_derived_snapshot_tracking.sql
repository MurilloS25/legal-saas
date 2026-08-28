-- Rastreo de "último valor derivado conocido" para los campos automáticos
-- del Índice Notarial que hoy son una sola columna (instrument_number,
-- authorized_at partido en fecha/hora, protocol_book, initial_folio,
-- final_folio) — a diferencia de act_name/parties, que ya distinguen
-- <campo>_override (manual) de <campo>_snapshot (derivado).
--
-- Problema que resuelve: `resolveNotarialMetadataPrefill` (prefill.ts) solo
-- deriva en vivo desde el Machote/Escritura cuando NO existe fila de
-- metadata todavía. En cuanto se guarda una vez, el valor efectivo queda
-- congelado para siempre — reabrir la Escritura y corregir, por ejemplo, la
-- hora fuente no vuelve a reflejarse en el Índice, y un simple "Guardar" sin
-- tocar nada puede convertir un valor ya obsoleto en un "override manual"
-- accidental (el formulario se prellena con el valor viejo, se reenvía tal
-- cual, y ya no coincide con lo recién derivado).
--
-- Estas columnas nuevas SOLO guardan "qué habría derivado la última vez que
-- se guardó" — nunca se muestran ni se exportan directamente. Comparando
-- (valor efectivo guardado) vs (snapshot derivado guardado) vs (derivación
-- en vivo ahora mismo), el código puede distinguir sin ambigüedad:
--   efectivo == snapshot Y en_vivo == snapshot  -> nunca lo tocó nadie, la
--     fuente no cambió: se sigue mostrando igual.
--   efectivo == snapshot Y en_vivo != snapshot  -> nunca lo tocó nadie, pero
--     la fuente SÍ cambió: refrescar automáticamente sin preguntar.
--   efectivo != snapshot                        -> alguien lo corrigió a
--     mano en algún momento: se preserva el valor efectivo SIEMPRE; si
--     además en_vivo != snapshot (la fuente también cambió desde esa
--     corrección), se marca revisión sugerida sin sobrescribir nada.
-- Mismo patrón conceptual que act_name_override/act_name_snapshot, aplicado
-- a los campos que no lo tenían.
alter table public.document_notarial_metadata
  add column instrument_number_derived_snapshot integer,
  add column authorized_date_derived_snapshot date,
  add column authorized_time_derived_snapshot text,
  add column protocol_book_derived_snapshot text,
  add column initial_folio_derived_snapshot text,
  add column final_folio_derived_snapshot text,
  add constraint dnm_authorized_time_derived_snapshot_format_check
    check (
      authorized_time_derived_snapshot is null
      or authorized_time_derived_snapshot ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    );

comment on column public.document_notarial_metadata.instrument_number_derived_snapshot is
  'Último valor que la derivación automática produjo para instrument_number al momento de guardar — nunca se muestra directamente, solo se usa para distinguir "todavía sin tocar" de "corregido a mano" (ver resolveNotarialMetadataPrefill).';
comment on column public.document_notarial_metadata.authorized_date_derived_snapshot is
  'Análogo para la parte de fecha de authorized_at.';
comment on column public.document_notarial_metadata.authorized_time_derived_snapshot is
  'Análogo para la parte de hora de authorized_at, en formato HH:MM (Costa Rica) — mismo formato que produce resolveOptionBlockTime.';
comment on column public.document_notarial_metadata.protocol_book_derived_snapshot is
  'Análogo para protocol_book.';
comment on column public.document_notarial_metadata.initial_folio_derived_snapshot is
  'Análogo para initial_folio.';
comment on column public.document_notarial_metadata.final_folio_derived_snapshot is
  'Análogo para final_folio.';
