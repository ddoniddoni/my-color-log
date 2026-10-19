-- Disposable database only: simulated Auth users and Storage metadata.
begin;
create table if not exists public.profiles(id uuid primary key references auth.users(id), nickname text);
insert into storage.buckets(id,name) values ('other-app','other-app') on conflict(id) do nothing;
create policy cl_test_other_app_open on storage.objects for all to authenticated using (true) with check (true);
create policy cl_test_other_app_anon_open on storage.objects for select to anon using (true);
insert into auth.users(id) values ('20000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000002');
-- Other app's colliding profile table must survive Color Log deletion.
insert into public.profiles(id,nickname) values ('20000000-0000-0000-0000-000000000001','다른앱사용자');
insert into public.cl_profiles(id,nickname) values ('20000000-0000-0000-0000-000000000001','컬러사용자'), ('20000000-0000-0000-0000-000000000002','컬러친구');
insert into public.cl_rooms(id,name,created_by,status) values ('20000000-0000-0000-0000-000000000010','유지할 방','20000000-0000-0000-0000-000000000001','active');
insert into public.cl_room_members(room_id,user_id,role) values
 ('20000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000001','owner'),
 ('20000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000002','member');
insert into storage.objects(bucket_id,name) values ('cl-entry-photos','20000000-0000-0000-0000-000000000001/private.jpg'), ('other-app','shared.jpg');

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='cl-entry-photos') then
  raise exception 'other_app_permissive_policy_exposed_colorlog_photo';
 end if;
 if not exists(select 1 from storage.objects where bucket_id='other-app') then
  raise exception 'colorlog_changed_other_bucket_access';
 end if;
 begin
  insert into storage.objects(bucket_id,name) values ('cl-entry-photos','20000000-0000-0000-0000-000000000001/forged.jpg');
  raise exception 'foreign_photo_insert_allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.cl_delete_account_data('20000000-0000-0000-0000-000000000001');
  raise exception 'client_account_deletion_allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='cl-entry-photos') then
  raise exception 'anonymous_photo_access_allowed';
 end if;
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select public.cl_delete_account_data('20000000-0000-0000-0000-000000000001');
reset role;
do $$ begin
 if not exists(select 1 from auth.users where id='20000000-0000-0000-0000-000000000001')
   or not exists(select 1 from public.profiles where id='20000000-0000-0000-0000-000000000001' and nickname='다른앱사용자') then
  raise exception 'shared_identity_or_other_app_profile_deleted';
 end if;
 if exists(select 1 from public.cl_profiles where id='20000000-0000-0000-0000-000000000001')
   or exists(select 1 from public.cl_room_members where user_id='20000000-0000-0000-0000-000000000001') then
  raise exception 'colorlog_profile_or_membership_not_deleted';
 end if;
 if not exists(select 1 from public.cl_room_members where user_id='20000000-0000-0000-0000-000000000002' and role='owner' and status='active') then
  raise exception 'room_ownership_not_transferred';
 end if;
end $$;
rollback;
