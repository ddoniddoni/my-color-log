-- `current_role` is a PostgreSQL special value (equivalent to current_user).
-- PL/pgSQL therefore resolves role checks such as `current_role <> 'owner'`
-- against the database execution role instead of the room membership value.
-- Rename the local variable in every affected room RPC without changing its
-- signature, privileges, or behavior.
do $$
declare
  affected_function record;
  corrected_definition text;
begin
  for affected_function in
    select procedure.oid
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prokind = 'f'
      and procedure.proname in (
        'create_active_room_invite',
        'create_room_invite',
        'end_active_room',
        'end_room',
        'leave_active_room',
        'leave_room',
        'remove_room_member',
        'revoke_active_room_invites',
        'revoke_room_invites',
        'transfer_active_room_ownership',
        'transfer_room_ownership',
        'update_active_room_settings',
        'update_room_settings'
      )
      and pg_catalog.pg_get_functiondef(procedure.oid) like '%current_role%'
  loop
    corrected_definition := replace(
      pg_catalog.pg_get_functiondef(affected_function.oid),
      'current_role',
      'requesting_member_role'
    );

    execute corrected_definition;
  end loop;
end;
$$;
