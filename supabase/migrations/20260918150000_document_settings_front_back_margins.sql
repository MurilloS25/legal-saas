-- Formato documental: márgenes independientes para Frente y Vuelto.
--
-- Los márgenes existentes (`margin_*_cm`) pasan a ser el perfil "Frente".
-- Se agregan cuatro columnas para "Vuelto". Son nullable a propósito: una
-- fila anterior a este cambio (los cuatro NULL) se interpreta en la app como
-- "Vuelto = Frente", de modo que ningún Workspace pierde sus márgenes actuales
-- y no hace falta reescribir datos. Al guardar Configuración se persisten los
-- ocho valores.
--
-- `line_spacing` deja de ser una preferencia (el DOCX usa siempre interlineado
-- exacto de 24 pt); la columna se conserva y recibe un default para que la app
-- ya no tenga que enviarla.

alter table public.document_settings
  add column back_margin_top_cm numeric(5, 2),
  add column back_margin_bottom_cm numeric(5, 2),
  add column back_margin_left_cm numeric(5, 2),
  add column back_margin_right_cm numeric(5, 2),
  add constraint document_settings_back_margins_complete check (
    num_nonnulls(
      back_margin_top_cm,
      back_margin_bottom_cm,
      back_margin_left_cm,
      back_margin_right_cm
    ) in (0, 4)
  ),
  add constraint document_settings_back_margins_non_negative check (
    back_margin_top_cm >= 0
    and back_margin_bottom_cm >= 0
    and back_margin_left_cm >= 0
    and back_margin_right_cm >= 0
  ),
  alter column line_spacing set default 1.5;
