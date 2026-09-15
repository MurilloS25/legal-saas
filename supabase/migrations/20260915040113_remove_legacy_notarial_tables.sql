-- Remove two unused tables from the initial schema. They were superseded by
-- documents/document_notarial_metadata and were never consumed by the app.
-- Refuse to discard data: any rows require an explicit reconciliation first.

do $$
begin
  if to_regclass('public.notarial_records') is null then
    raise exception 'cannot remove legacy tables: public.notarial_records does not exist';
  end if;

  if to_regclass('public.document_metadata') is null then
    raise exception 'cannot remove legacy tables: public.document_metadata does not exist';
  end if;

  -- Check the child first so a populated, referentially valid pair reports the
  -- table that must be reconciled before its parent can be considered.
  if exists (select 1 from public.notarial_records) then
    raise exception 'cannot remove legacy table public.notarial_records: table contains data';
  end if;

  if exists (select 1 from public.document_metadata) then
    raise exception 'cannot remove legacy table public.document_metadata: table contains data';
  end if;
end;
$$;

drop table public.notarial_records;
drop table public.document_metadata;
