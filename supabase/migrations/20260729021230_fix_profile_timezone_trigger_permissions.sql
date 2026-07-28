-- Timezone validation is invoked by table triggers while authenticated users
-- create or update their own profiles and rooms. Keep the IANA lookup private
-- while allowing the trigger function, not the caller, to use it.
create or replace function private.validate_iana_timezone_column()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.timezone := btrim(new.timezone);

  if not private.is_valid_time_zone(new.timezone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_iana_timezone_column() from public, anon, authenticated;
