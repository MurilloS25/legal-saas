-- Ciclo de vida básico de la escritura: draft -> ready -> final.
--
-- Amplía la constraint de estado (antes solo 'draft'). El estado inicial
-- sigue siendo 'draft'. Las transiciones válidas se aplican en las Server
-- Actions (draft<->ready, ready<->final; nunca draft->final directo);
-- la constraint solo restringe el conjunto de valores permitidos.
--
-- Sin firma, envío ni archivado: 'final' no implica validez legal.

alter table public.documents drop constraint documents_status_check;

alter table public.documents
  add constraint documents_status_check
    check (status in ('draft', 'ready', 'final'));

comment on column public.documents.status is
  'Estado del ciclo de vida: draft (borrador), ready (listo para revisar), final (finalizado). No implica firma ni presentación oficial.';
