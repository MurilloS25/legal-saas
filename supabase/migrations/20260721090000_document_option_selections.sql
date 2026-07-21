-- Selección de variante por Bloque de opciones, por Escritura.
--
-- Mapa plano `blockId -> variantId` (mismo patrón que `field_values`).
-- La variante elegida es un dato de la propia Escritura: no persiste nada
-- en el Machote, no crea relaciones nuevas y no requiere cambios en RLS
-- (mismas políticas de `documents` ya cubren esta columna).

alter table public.documents
  add column option_selections jsonb not null default '{}'::jsonb;

alter table public.documents
  add constraint documents_option_selections_is_object check (
    jsonb_typeof(option_selections) = 'object'
  );
