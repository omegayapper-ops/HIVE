-- HIVE + Eco Points shared identity/data migration
-- Run ONCE in Supabase SQL Editor after the existing hive_unified.sql and eco.sql.
-- Safe to re-run. This does not drop any existing table or user data.
-- Accounts remain in Supabase Auth; Eco Points uses separate, access-controlled tables
-- in the SAME Supabase project/database as HIVE.

begin;

-- If Eco Points registration happens directly from the Eco Points page, allow an account
-- to create only its own non-admin HIVE profile. Existing HIVE users are not changed.
do $$ begin
  drop policy if exists eco_profile_insert_self on public.profiles;
  create policy eco_profile_insert_self on public.profiles
    for insert to authenticated
    with check (id = auth.uid()
      and coalesce(is_admin,false) = false
      and coalesce(is_blocked,false) = false
      and coalesce(role,'student') = 'student');
exception when undefined_table then
  raise notice 'HIVE profiles table missing; run hive_unified.sql first.';
end $$;
-- Required for fresh Eco Points sign-ups to create their matching HIVE profile.
-- The insert policy above prevents self-assigning admin/staff access.
do $$ begin
  grant insert (id,name,email,role,is_admin,is_blocked) on public.profiles to authenticated;
exception when undefined_table then null;
end $$;

create table if not exists public.eco_profiles_public (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  college text not null default '',
  role text not null default 'student' check (role in ('student','verifier')),
  desig text not null default '',
  joined date not null default current_date,
  pic text not null default '',
  avt integer,
  emo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.eco_profiles_private (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  phone text not null default '',
  roll text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.eco_proofs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'review' check (status in ('review','approved','rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reason text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists eco_proofs_user_date_idx on public.eco_proofs(user_id, created_at desc);
create index if not exists eco_proofs_status_idx on public.eco_proofs(status, created_at desc);

create table if not exists public.eco_reviews (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.eco_problem_box (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.eco_profiles_public enable row level security;
alter table public.eco_profiles_private enable row level security;
alter table public.eco_proofs enable row level security;
alter table public.eco_reviews enable row level security;
alter table public.eco_problem_box enable row level security;

create or replace function public.eco_is_verifier()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.eco_profiles_public p where p.id = auth.uid() and p.role = 'verifier')
$$;
revoke all on function public.eco_is_verifier() from public, anon;
grant execute on function public.eco_is_verifier() to authenticated;

-- Public-facing profile fields are safe for the Eco Points leaderboard/gallery.
drop policy if exists eco_pub_profile_read on public.eco_profiles_public;
create policy eco_pub_profile_read on public.eco_profiles_public for select to authenticated using (true);
drop policy if exists eco_pub_profile_insert on public.eco_profiles_public;
create policy eco_pub_profile_insert on public.eco_profiles_public for insert to authenticated
  with check (id = auth.uid() and role = 'student');
drop policy if exists eco_pub_profile_update on public.eco_profiles_public;
create policy eco_pub_profile_update on public.eco_profiles_public for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.eco_profiles_public from anon, authenticated;
grant select on public.eco_profiles_public to authenticated;
grant insert (id,name,college,joined,pic,avt,emo) on public.eco_profiles_public to authenticated;
grant update (id,name,college,pic,avt,emo) on public.eco_profiles_public to authenticated;

-- Private contact details: the owner can read/update their record; approved verifiers can review it.
drop policy if exists eco_private_profile_read on public.eco_profiles_private;
create policy eco_private_profile_read on public.eco_profiles_private for select to authenticated
  using (id = auth.uid() or public.eco_is_verifier());
drop policy if exists eco_private_profile_insert on public.eco_profiles_private;
create policy eco_private_profile_insert on public.eco_profiles_private for insert to authenticated with check (id = auth.uid());
drop policy if exists eco_private_profile_update on public.eco_profiles_private;
create policy eco_private_profile_update on public.eco_profiles_private for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
grant select on public.eco_profiles_private to authenticated;
grant insert (id,email,phone,roll) on public.eco_profiles_private to authenticated;
grant update (id,email,phone,roll) on public.eco_profiles_private to authenticated;

-- Proofs are visible to the owner and verifiers; approved proofs are visible to signed-in users.
drop policy if exists eco_proof_read on public.eco_proofs;
create policy eco_proof_read on public.eco_proofs for select to authenticated
  using (user_id = auth.uid() or status = 'approved' or public.eco_is_verifier());
revoke insert, update, delete on public.eco_proofs from anon, authenticated;
grant select on public.eco_proofs to authenticated;

-- All signed-in users can read published reviews; writers can create only their own.
drop policy if exists eco_review_read on public.eco_reviews;
create policy eco_review_read on public.eco_reviews for select to authenticated using (true);
drop policy if exists eco_review_insert on public.eco_reviews;
create policy eco_review_insert on public.eco_reviews for insert to authenticated with check (user_id = auth.uid());
drop policy if exists eco_review_update on public.eco_reviews;
create policy eco_review_update on public.eco_reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.eco_reviews to authenticated;

-- Problem-box messages are private to their author and verifiers.
drop policy if exists eco_problem_read on public.eco_problem_box;
create policy eco_problem_read on public.eco_problem_box for select to authenticated
  using (user_id = auth.uid() or public.eco_is_verifier());
drop policy if exists eco_problem_insert on public.eco_problem_box;
create policy eco_problem_insert on public.eco_problem_box for insert to authenticated with check (user_id = auth.uid());
drop policy if exists eco_problem_update on public.eco_problem_box;
create policy eco_problem_update on public.eco_problem_box for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.eco_problem_box to authenticated;

-- Proof submission is an RPC so students cannot set their own proof status to approved.
create or replace function public.eco_submit_proof(p_id text, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ai int; v_activity public.eco_activities%rowtype; v_payload jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_id is null or length(p_id) < 1 or length(p_id) > 120 then raise exception 'Invalid proof ID'; end if;
  begin v_ai := (p_payload->>'ai')::int + 1; exception when others then raise exception 'Invalid activity'; end;
  select * into v_activity from public.eco_activities where id=v_ai and active=true;
  if not found then raise exception 'This Eco Points activity is not available'; end if;
  -- The server owns the activity title/category/points; a client cannot award itself points.
  v_payload := coalesce(p_payload,'{}'::jsonb) || jsonb_build_object(
    'pts',v_activity.points,'an',v_activity.title,'ae',v_activity.emoji,'cat',v_activity.cat);
  insert into public.eco_proofs(id,user_id,status,reviewer_id,reason,payload)
  values (p_id,auth.uid(),'review',null,'',v_payload)
  on conflict (id) do nothing;
  return true;
end $$;

create or replace function public.eco_review_proof(p_id text, p_status text, p_reason text default '')
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.eco_is_verifier() then raise exception 'Verifier access required'; end if;
  if p_status not in ('review','approved','rejected') then raise exception 'Invalid status'; end if;
  update public.eco_proofs set status=p_status, reviewer_id=auth.uid(), reason=coalesce(p_reason,''), updated_at=now()
    where id=p_id;
  if not found then raise exception 'Proof not found'; end if;
  return true;
end $$;
revoke all on function public.eco_submit_proof(text,jsonb) from public, anon;
revoke all on function public.eco_review_proof(text,text,text) from public, anon;
grant execute on function public.eco_submit_proof(text,jsonb) to authenticated;
grant execute on function public.eco_review_proof(text,text,text) to authenticated;

-- Private storage for original video proofs. The inline image/thumbnail remains in the proof row.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('eco-proofs','eco-proofs',false,157286400,array['video/mp4','video/webm','video/quicktime','video/x-m4v'])
on conflict (id) do update set public=false, file_size_limit=157286400;
drop policy if exists eco_video_insert_own on storage.objects;
create policy eco_video_insert_own on storage.objects for insert to authenticated
  with check (bucket_id='eco-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists eco_video_read_own_or_verifier on storage.objects;
create policy eco_video_read_own_or_verifier on storage.objects for select to authenticated
  using (bucket_id='eco-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.eco_is_verifier()));
drop policy if exists eco_video_update_own on storage.objects;
create policy eco_video_update_own on storage.objects for update to authenticated
  using (bucket_id='eco-proofs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id='eco-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists eco_video_delete_own on storage.objects;
create policy eco_video_delete_own on storage.objects for delete to authenticated
  using (bucket_id='eco-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

commit;

-- Promote a verifier explicitly as an administrator, after checking their account:
-- update public.eco_profiles_public set role='verifier', desig='Eco Club Coordinator'
-- where id=(select id from auth.users where lower(email)=lower('coordinator@example.com'));
