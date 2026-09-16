begin;

set search_path = public, extensions;
select plan(17);

-- Exact owners and execution modes stay stable while privileges and
-- resolution paths are hardened.
select is(
  (select string_agg(distinct pg_get_userbyid(proowner), ',' order by pg_get_userbyid(proowner))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'set_updated_at', 'record_document_activity',
      'log_document_word_generated', 'assert_can_manage_target_member',
      'enforce_document_notarial_index_snapshot'
    )),
  'postgres',
  'Hardened functions remain owned by postgres'
);

select is((select prosecdef from pg_proc where oid = 'public.set_updated_at()'::regprocedure), false,
  'set_updated_at remains invoker');
select is((select prosecdef from pg_proc where oid = 'public.assert_can_manage_target_member(text,text)'::regprocedure), false,
  'assert_can_manage_target_member remains invoker');
select is((select prosecdef from pg_proc where oid = 'public.record_document_activity()'::regprocedure), true,
  'record_document_activity remains definer');
select is((select prosecdef from pg_proc where oid = 'public.log_document_word_generated(uuid)'::regprocedure), true,
  'log_document_word_generated remains definer');
select is((select prosecdef from pg_proc where oid = 'public.enforce_document_notarial_index_snapshot()'::regprocedure), true,
  'enforce_document_notarial_index_snapshot remains definer');

select is((select proconfig[1] from pg_proc where oid = 'public.set_updated_at()'::regprocedure),
  'search_path=pg_catalog, public', 'set_updated_at has the pinned search_path');
select is((select proconfig[1] from pg_proc where oid = 'public.assert_can_manage_target_member(text,text)'::regprocedure),
  'search_path=pg_catalog, public', 'assert_can_manage_target_member has the pinned search_path');
select is((select proconfig[1] from pg_proc where oid = 'public.record_document_activity()'::regprocedure),
  'search_path=pg_catalog, public', 'record_document_activity has the pinned search_path');
select is((select proconfig[1] from pg_proc where oid = 'public.log_document_word_generated(uuid)'::regprocedure),
  'search_path=pg_catalog, public', 'log_document_word_generated has the pinned search_path');
select is((select proconfig[1] from pg_proc where oid = 'public.enforce_document_notarial_index_snapshot()'::regprocedure),
  'search_path=pg_catalog, public', 'enforce_document_notarial_index_snapshot keeps the pinned search_path');

select is(
  (select string_agg(coalesce(r.rolname, 'PUBLIC'), ',' order by coalesce(r.rolname, 'PUBLIC'))
     from pg_proc p cross join lateral aclexplode(p.proacl) a
     left join pg_roles r on r.oid = a.grantee
    where p.oid = 'public.set_updated_at()'::regprocedure and a.privilege_type = 'EXECUTE'),
  'postgres,service_role', 'set_updated_at has only internal execution grants');
select is(
  (select string_agg(coalesce(r.rolname, 'PUBLIC'), ',' order by coalesce(r.rolname, 'PUBLIC'))
     from pg_proc p cross join lateral aclexplode(p.proacl) a
     left join pg_roles r on r.oid = a.grantee
    where p.oid = 'public.assert_can_manage_target_member(text,text)'::regprocedure and a.privilege_type = 'EXECUTE'),
  'postgres,service_role', 'assert_can_manage_target_member has only internal execution grants');
select is(
  (select string_agg(coalesce(r.rolname, 'PUBLIC'), ',' order by coalesce(r.rolname, 'PUBLIC'))
     from pg_proc p cross join lateral aclexplode(p.proacl) a
     left join pg_roles r on r.oid = a.grantee
    where p.oid = 'public.record_document_activity()'::regprocedure and a.privilege_type = 'EXECUTE'),
  'postgres,service_role', 'record_document_activity has only internal execution grants');
select is(
  (select string_agg(coalesce(r.rolname, 'PUBLIC'), ',' order by coalesce(r.rolname, 'PUBLIC'))
     from pg_proc p cross join lateral aclexplode(p.proacl) a
     left join pg_roles r on r.oid = a.grantee
    where p.oid = 'public.enforce_document_notarial_index_snapshot()'::regprocedure and a.privilege_type = 'EXECUTE'),
  'postgres,service_role', 'snapshot trigger has only internal execution grants');
select is(
  (select string_agg(coalesce(r.rolname, 'PUBLIC'), ',' order by coalesce(r.rolname, 'PUBLIC'))
     from pg_proc p cross join lateral aclexplode(p.proacl) a
     left join pg_roles r on r.oid = a.grantee
    where p.oid = 'public.log_document_word_generated(uuid)'::regprocedure and a.privilege_type = 'EXECUTE'),
  'authenticated,postgres,service_role', 'the legitimate Word RPC keeps its authenticated grant');

select results_eq(
  $$select tgname from pg_trigger where not tgisinternal and tgfoid in (
      'public.record_document_activity()'::regprocedure,
      'public.enforce_document_notarial_index_snapshot()'::regprocedure
    ) order by tgname$$,
  $$values ('documents_notarial_index_snapshot'::name), ('documents_record_activity'::name)$$,
  'Document trigger wiring remains exact'
);

select * from finish();
rollback;
