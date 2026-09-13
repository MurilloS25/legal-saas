-- P2-05: keep the existing function bodies, owners, execution modes, and
-- trigger wiring while removing direct Data API execution from internal
-- helpers and pinning every remaining mutable resolution path.

alter function public.set_updated_at()
  set search_path = pg_catalog, public;
revoke all on function public.set_updated_at()
  from public, anon, authenticated;

alter function public.assert_can_manage_target_member(text, text)
  set search_path = pg_catalog, public;
revoke all on function public.assert_can_manage_target_member(text, text)
  from public, anon, authenticated;

alter function public.record_document_activity()
  set search_path = pg_catalog, public;
revoke all on function public.record_document_activity()
  from public, anon, authenticated;

alter function public.enforce_document_notarial_index_snapshot()
  set search_path = pg_catalog, public;
revoke all on function public.enforce_document_notarial_index_snapshot()
  from public, anon, authenticated;

-- This function is a legitimate authenticated RPC. Its grants remain
-- unchanged; only identifier resolution is hardened.
alter function public.log_document_word_generated(uuid)
  set search_path = pg_catalog, public;
