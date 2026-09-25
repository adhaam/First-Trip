-- Catalog fingerprint used by scripts/db-upgrade-check.sh to prove the
-- production-shaped rehearsal matches supabase/tests/upgrade/production_inventory.txt.
-- An explicit NULL::numeric default is read as "no default" (identical
-- behaviour; production carries two from older DDL that ALTER cannot recreate).
select kind||'|'||obj||'|'||left(md5(detail),10) from (
  select 'col' kind, table_name obj, string_agg(column_name||':'||udt_name||':'||is_nullable||':'||coalesce(left(nullif(column_default,'NULL::numeric'),40),''), ' , ' order by column_name) detail
    from information_schema.columns where table_schema='public' group by table_name
  union all
  select 'con', conrelid::regclass::text, string_agg(conname||'='||left(pg_get_constraintdef(oid),200), ' , ' order by conname)
    from pg_constraint where connamespace='public'::regnamespace group by conrelid
  union all
  select 'idx', tablename, string_agg(indexname, ' , ' order by indexname)
    from pg_indexes where schemaname='public' group by tablename
  union all
  select 'trg', c.relname, string_agg(t.tgname, ' , ' order by t.tgname)
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and not t.tgisinternal group by c.relname
  union all
  select 'fn', p.proname, pg_get_function_identity_arguments(p.oid)||' secdef='||p.prosecdef
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
  union all
  select 'pol', tablename, string_agg(policyname||'/'||cmd, ' , ' order by policyname)
    from pg_policies where schemaname='public' group by tablename
  union all
  select 'seq', sequencename, '' from pg_sequences where schemaname='public'
) x(kind, obj, detail) order by 1;
