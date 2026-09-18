begin;

set search_path = public, extensions;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('d1111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','doc-settings-fb@example.test','x',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

-- Fila anterior a Frente/Vuelto (sin columnas back_*, sin line_spacing):
-- sigue siendo válida; los back_* quedan NULL y la app los interpreta como
-- "Vuelto = Frente".
select lives_ok(
  $$insert into public.document_settings
      (id, owner_id, workspace_id, font_family, font_size,
       margin_top_cm, margin_bottom_cm, margin_left_cm, margin_right_cm)
    values
      ('d1111111-aaaa-0000-0000-000000000001','d1111111-1111-1111-1111-111111111111','d1111111-1111-1111-1111-111111111111',
       'Times New Roman', 12, 3.66, 5.64, 2.49, 2.49)$$,
  'legacy-shaped row (no back margins, no line_spacing) is accepted'
);

select is(
  (select back_margin_top_cm from public.document_settings
    where id = 'd1111111-aaaa-0000-0000-000000000001'),
  null::numeric,
  'back margins default to NULL on legacy rows'
);

select is(
  (select line_spacing from public.document_settings
    where id = 'd1111111-aaaa-0000-0000-000000000001'),
  1.5::numeric,
  'line_spacing has a default so the app no longer has to send it'
);

select lives_ok(
  $$update public.document_settings
       set back_margin_top_cm = 3.66, back_margin_bottom_cm = 5.64,
           back_margin_left_cm = 2.49, back_margin_right_cm = 2.49
     where id = 'd1111111-aaaa-0000-0000-000000000001'$$,
  'all four Vuelto margins can be set together'
);

select throws_ok(
  $$update public.document_settings
       set back_margin_top_cm = null
     where id = 'd1111111-aaaa-0000-0000-000000000001'$$,
  '23514',
  null,
  'Vuelto margins must be all set or all NULL'
);

select throws_ok(
  $$update public.document_settings
       set back_margin_left_cm = -1
     where id = 'd1111111-aaaa-0000-0000-000000000001'$$,
  '23514',
  null,
  'negative Vuelto margins are rejected'
);

select * from finish();
rollback;
