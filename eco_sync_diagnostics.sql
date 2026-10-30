-- HIVE EcoPoints sync diagnostics (READ ONLY)
-- Run in Supabase SQL Editor in the SAME project used by HIVE.
-- This file only reports object/column status. It does not create, alter or delete anything.

-- 1) Required functions and tables.
select object_name,
       case when present then 'OK' else 'MISSING' end as status
from (
  select 'public.admin_check(text) — HIVE admin prerequisite'::text as object_name,
         to_regprocedure('public.admin_check(text)') is not null as present
  union all select 'public.ops_eco_get(text,text) — EcoPoints admin read RPC',
         to_regprocedure('public.ops_eco_get(text,text)') is not null
  union all select 'public.ops_eco_do(text,text,jsonb) — EcoPoints admin write RPC',
         to_regprocedure('public.ops_eco_do(text,text,jsonb)') is not null
  union all select 'public.eco_activities_public() — student activity catalogue RPC',
         to_regprocedure('public.eco_activities_public()') is not null
  union all select 'public.eco_submit_proof(text,jsonb) — shared proof submission RPC',
         to_regprocedure('public.eco_submit_proof(text,jsonb)') is not null
  union all select 'public.eco_review_proof(text,text,text) — verifier review RPC',
         to_regprocedure('public.eco_review_proof(text,text,text)') is not null
  union all select 'public.profiles — HIVE profiles table',
         to_regclass('public.profiles') is not null
  union all select 'public.eco_activities — activity catalogue table',
         to_regclass('public.eco_activities') is not null
  union all select 'public.eco_profiles_public — shared public profiles',
         to_regclass('public.eco_profiles_public') is not null
  union all select 'public.eco_profiles_private — private profile details',
         to_regclass('public.eco_profiles_private') is not null
  union all select 'public.eco_proofs — submitted eco proofs',
         to_regclass('public.eco_proofs') is not null
  union all select 'public.eco_reviews — reviews',
         to_regclass('public.eco_reviews') is not null
  union all select 'public.eco_problem_box — feedback',
         to_regclass('public.eco_problem_box') is not null
) AS required_objects
order by object_name;

-- 2) Important expected columns. A MISSING result usually means an older migration/schema is present.
with expected(table_name, column_name) as (
  values
    ('profiles','id'),('profiles','name'),('profiles','email'),('profiles','role'),
    ('profiles','is_admin'),('profiles','is_blocked'),('profiles','is_approved'),
    ('profiles','access_granted'),('profiles','roll_no'),
    ('eco_activities','id'),('eco_activities','cat'),('eco_activities','emoji'),
    ('eco_activities','title'),('eco_activities','description'),('eco_activities','points'),
    ('eco_activities','difficulty'),('eco_activities','image_url'),('eco_activities','active'),('eco_activities','sort_order'),
    ('eco_profiles_public','id'),('eco_profiles_public','name'),('eco_profiles_public','college'),
    ('eco_profiles_public','role'),('eco_profiles_public','desig'),('eco_profiles_public','joined'),
    ('eco_profiles_public','pic'),('eco_profiles_public','avt'),('eco_profiles_public','emo'),
    ('eco_profiles_private','id'),('eco_profiles_private','email'),('eco_profiles_private','phone'),('eco_profiles_private','roll'),
    ('eco_proofs','id'),('eco_proofs','user_id'),('eco_proofs','status'),('eco_proofs','reviewer_id'),('eco_proofs','reason'),('eco_proofs','payload'),
    ('eco_reviews','id'),('eco_reviews','user_id'),('eco_reviews','payload'),
    ('eco_problem_box','id'),('eco_problem_box','user_id'),('eco_problem_box','payload')
), actual as (
  select table_name, column_name
  from information_schema.columns
  where table_schema='public'
)
select e.table_name, e.column_name,
       case when a.column_name is null then 'MISSING' else 'OK' end as status
from expected e
left join actual a on a.table_name=e.table_name and a.column_name=e.column_name
order by e.table_name, e.column_name;

-- 3) Confirm the current database/project context from Supabase SQL Editor.
select current_database() as database_name, current_schema() as current_schema;
