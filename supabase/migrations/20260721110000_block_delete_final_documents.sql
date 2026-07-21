-- Bloquea el borrado de Escrituras finalizadas.
--
-- `documents_delete_own` no validaba `status`: el dueño podía eliminar una
-- Escritura ya finalizada (indexada en el Índice Notarial, con historial de
-- actividad) sin reabrirla primero, perdiendo permanentemente su metadata
-- notarial y su auditoría vía `on delete cascade`. La edición ya bloquea
-- este caso (`documents_update_own`/`enforce_notarial_metadata_editable`);
-- el borrado debía seguir la misma regla: reabrir antes de eliminar.

drop policy "documents_delete_own" on public.documents;

create policy "documents_delete_own"
on public.documents
for delete
to authenticated
using (owner_id = auth.uid() and status <> 'final');
