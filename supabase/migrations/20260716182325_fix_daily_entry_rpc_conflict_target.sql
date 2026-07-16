create or replace function public.get_or_create_daily_entry(
  p_entry_id uuid,
  p_mission_id uuid,
  p_date_key date
)
returns table (
  id uuid,
  user_id uuid,
  mission_id uuid,
  date_key date,
  note text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_date_key > (now() at time zone 'Asia/Seoul')::date then
    raise exception 'Future daily entries cannot be created';
  end if;

  insert into public.daily_entries (id, user_id, mission_id, date_key)
  values (p_entry_id, current_user_id, p_mission_id, p_date_key)
  on conflict on constraint daily_entries_user_date_key do nothing;

  if not exists (
    select 1
    from public.daily_entries as existing_entry
    where existing_entry.user_id = current_user_id
      and existing_entry.date_key = p_date_key
      and existing_entry.mission_id = p_mission_id
  ) then
    raise exception 'The entry mission does not match the daily mission';
  end if;

  return query
  select
    entry.id,
    entry.user_id,
    entry.mission_id,
    entry.date_key,
    entry.note,
    entry.created_at,
    entry.updated_at
  from public.daily_entries as entry
  where entry.user_id = current_user_id
    and entry.date_key = p_date_key;
end;
$$;

revoke all on function public.get_or_create_daily_entry(uuid, uuid, date) from public;
revoke all on function public.get_or_create_daily_entry(uuid, uuid, date) from anon;
revoke all on function public.get_or_create_daily_entry(uuid, uuid, date) from authenticated;
grant execute on function public.get_or_create_daily_entry(uuid, uuid, date) to authenticated;
