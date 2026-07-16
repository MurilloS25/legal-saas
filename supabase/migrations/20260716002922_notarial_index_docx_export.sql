-- Replace the retired CSV export format with the only supported format: DOCX.
-- Legacy operational rows are intentionally removed rather than relabelled;
-- changing their format would falsify historical meaning.

delete from public.notarial_index_exports;

alter table public.notarial_index_exports
  drop constraint nie_format_check,
  add constraint nie_format_check check (format in ('docx'));

create or replace function public.log_notarial_index_export(
  p_format text,
  p_from date,
  p_to date,
  p_row_count integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if p_format is null or p_format not in ('docx') then
    return;
  end if;

  insert into public.notarial_index_exports
    (owner_id, format, from_date, to_date, row_count)
  values (
    auth.uid(),
    p_format,
    p_from,
    p_to,
    greatest(coalesce(p_row_count, 0), 0)
  );
end;
$$;

revoke all on function public.log_notarial_index_export(
  text, date, date, integer
) from public, anon, authenticated;
grant execute on function public.log_notarial_index_export(
  text, date, date, integer
) to authenticated;
