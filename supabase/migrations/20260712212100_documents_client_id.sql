-- Relación opcional de una escritura con un cliente principal.
--
-- Decisiones:
-- * `client_id` es nullable: asociar un cliente NO es obligatorio.
-- * FK compuesta (client_id, owner_id) -> clients(id, owner_id): garantiza
--   que el cliente pertenezca al mismo dueño de la escritura (no se puede
--   asociar un cliente ajeno) y, de paso, no revela clientes de otros.
-- * ON DELETE SET NULL (client_id): al borrar el cliente, la escritura
--   permanece y su client_id pasa a NULL. La lista de columnas (PG15+)
--   evita que también se nulifique owner_id, que es NOT NULL.
-- * No hay cascada destructiva desde clients hacia documents.

alter table public.documents
  add column client_id uuid;

alter table public.documents
  add constraint documents_client_owner_fk
    foreign key (client_id, owner_id)
    references public.clients (id, owner_id)
    on delete set null (client_id);

create index documents_client_id_idx on public.documents (client_id);

comment on column public.documents.client_id is
  'Cliente principal opcional de la escritura. FK compuesta con owner_id para forzar el mismo dueño; ON DELETE SET NULL deja la escritura sin cliente al borrarlo.';
