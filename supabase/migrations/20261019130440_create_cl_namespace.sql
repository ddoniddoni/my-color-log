-- Color Log standalone installation for a shared Supabase project.
-- Derived from the final schema of the 32 historical migrations through
-- 20261016173318. Historical files remain immutable; do NOT replay them on
-- a shared project. Apply this file alone on first installation.
-- Only cl_* objects, cl_private, and the private cl-entry-photos bucket
-- belong to this app. Auth identities, other schemas and default grants stay intact.
begin;
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('colorlog:install', 0));
set local check_function_bodies = false;

-- Refuse an occupied namespace instead of overwriting another application's objects.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cl_private')
    or exists (select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and starts_with(c.relname, 'cl_'))
    or exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and starts_with(p.proname, 'cl_'))
    or exists (select 1 from storage.buckets where id = 'cl-entry-photos') then
    raise exception 'colorlog_namespace_already_exists';
  end if;
end;
$$;

create schema cl_private;
revoke all on schema cl_private from public, anon, authenticated;
grant usage on schema cl_private to authenticated, service_role;


create table public.cl_profiles (
  "id" uuid not null,
  "nickname" text not null,
  "avatar_path" text,
  "timezone" text default 'Asia/Seoul'::text not null,
  "is_onboarded" boolean default false not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public.cl_profiles enable row level security;

create table public.cl_color_palette (
  "id" uuid default gen_random_uuid() not null,
  "slug" text not null,
  "name_ko" text not null,
  "name_en" text not null,
  "hex" text not null,
  "tint_hex" text not null,
  "shade_hex" text not null,
  "on_color_hex" text not null,
  "prompt_ko" text not null,
  "is_active" boolean default true not null
);
alter table public.cl_color_palette enable row level security;

create table public.cl_daily_missions (
  "id" uuid default gen_random_uuid() not null,
  "challenge_date" date not null,
  "mission_type" text not null,
  "color_id" uuid not null,
  "title_ko" text not null,
  "prompt_ko" text not null,
  "published_at" timestamp with time zone default now() not null,
  "source" text not null
);
alter table public.cl_daily_missions enable row level security;

create table public.cl_daily_entries (
  "id" uuid not null,
  "user_id" uuid not null,
  "mission_id" uuid not null,
  "date_key" date not null,
  "note" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public.cl_daily_entries enable row level security;

create table public.cl_entry_photos (
  "id" uuid not null,
  "entry_id" uuid not null,
  "owner_id" uuid not null,
  "date_key" date not null,
  "storage_path" text not null,
  "position" smallint not null,
  "caption" text,
  "captured_at" timestamp with time zone not null,
  "width" integer not null,
  "height" integer not null,
  "byte_size" bigint not null,
  "created_at" timestamp with time zone default now() not null
);
alter table public.cl_entry_photos enable row level security;

create table public.cl_rooms (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "emoji" text,
  "created_by" uuid,
  "status" text default 'draft'::text not null,
  "max_members" smallint default 6 not null,
  "created_at" timestamp with time zone default now() not null,
  "ended_at" timestamp with time zone,
  "timezone" text default 'Asia/Seoul'::text not null
);
alter table public.cl_rooms enable row level security;

create table public.cl_room_members (
  "room_id" uuid not null,
  "user_id" uuid not null,
  "role" text not null,
  "status" text default 'active'::text not null,
  "joined_at" timestamp with time zone default now() not null,
  "left_at" timestamp with time zone
);
alter table public.cl_room_members enable row level security;

create table public.cl_room_invites (
  "id" uuid default gen_random_uuid() not null,
  "room_id" uuid not null,
  "inviter_id" uuid,
  "token_hash" text not null,
  "display_code" text not null,
  "expires_at" timestamp with time zone not null,
  "max_uses" smallint not null,
  "use_count" smallint default 0 not null,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);
alter table public.cl_room_invites enable row level security;

create table public.cl_room_invite_uses (
  "invite_id" uuid not null,
  "user_id" uuid not null,
  "accepted_at" timestamp with time zone default now() not null
);
alter table public.cl_room_invite_uses enable row level security;

create table public.cl_room_daily_missions (
  "room_id" uuid not null,
  "challenge_date" date not null,
  "mission_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);
alter table public.cl_room_daily_missions enable row level security;

create table public.cl_entry_room_shares (
  "entry_id" uuid not null,
  "room_id" uuid not null,
  "shared_by" uuid not null,
  "shared_at" timestamp with time zone default now() not null,
  "revoked_at" timestamp with time zone,
  "updated_at" timestamp with time zone default now() not null
);
alter table public.cl_entry_room_shares enable row level security;

create table public.cl_room_photo_reactions (
  "room_id" uuid not null,
  "photo_id" uuid not null,
  "user_id" uuid not null,
  "emoji" text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public.cl_room_photo_reactions enable row level security;

create table public.cl_push_devices (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "expo_push_token" text not null,
  "platform" text not null,
  "is_enabled" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public.cl_push_devices enable row level security;

create table public.cl_room_photo_push_deliveries (
  "room_id" uuid not null,
  "recipient_user_id" uuid not null,
  "source_user_id" uuid not null,
  "date_key" date not null,
  "created_at" timestamp with time zone default now() not null
);
alter table public.cl_room_photo_push_deliveries enable row level security;

alter table public.cl_profiles add constraint "cl_profiles_nickname_check" CHECK ((((char_length(nickname) >= 2) AND (char_length(nickname) <= 12)) AND (nickname = btrim(nickname))));

alter table public.cl_profiles add constraint "cl_profiles_pkey" PRIMARY KEY (id);

alter table public.cl_color_palette add constraint "cl_color_palette_hex_check" CHECK ((hex ~ '^#[0-9A-Fa-f]{6}$'::text));

alter table public.cl_color_palette add constraint "cl_color_palette_on_color_hex_check" CHECK ((on_color_hex ~ '^#[0-9A-Fa-f]{6}$'::text));

alter table public.cl_color_palette add constraint "cl_color_palette_pkey" PRIMARY KEY (id);

alter table public.cl_color_palette add constraint "cl_color_palette_shade_hex_check" CHECK ((shade_hex ~ '^#[0-9A-Fa-f]{6}$'::text));

alter table public.cl_color_palette add constraint "cl_color_palette_slug_check" CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text));

alter table public.cl_color_palette add constraint "cl_color_palette_slug_key" UNIQUE (slug);

alter table public.cl_color_palette add constraint "cl_color_palette_tint_hex_check" CHECK ((tint_hex ~ '^#[0-9A-Fa-f]{6}$'::text));

alter table public.cl_daily_missions add constraint "cl_daily_missions_challenge_date_key" UNIQUE (challenge_date);

alter table public.cl_daily_missions add constraint "cl_daily_missions_id_challenge_date_key" UNIQUE (id, challenge_date);

alter table public.cl_daily_missions add constraint "cl_daily_missions_mission_type_check" CHECK ((mission_type = 'color'::text));

alter table public.cl_daily_missions add constraint "cl_daily_missions_pkey" PRIMARY KEY (id);

alter table public.cl_daily_missions add constraint "cl_daily_missions_source_check" CHECK ((source = ANY (ARRAY['manual'::text, 'scheduled'::text, 'fallback'::text])));

alter table public.cl_daily_entries add constraint "cl_daily_entries_id_user_date_key" UNIQUE (id, user_id, date_key);

alter table public.cl_daily_entries add constraint "cl_daily_entries_note_check" CHECK (((note IS NULL) OR (char_length(note) <= 200)));

alter table public.cl_daily_entries add constraint "cl_daily_entries_pkey" PRIMARY KEY (id);

alter table public.cl_daily_entries add constraint "cl_daily_entries_user_date_key" UNIQUE (user_id, date_key);

alter table public.cl_entry_photos add constraint "cl_entry_photos_byte_size_check" CHECK ((byte_size > 0));

alter table public.cl_entry_photos add constraint "cl_entry_photos_caption_check" CHECK (((caption IS NULL) OR (char_length(caption) <= 80)));

alter table public.cl_entry_photos add constraint "cl_entry_photos_entry_position_key" UNIQUE (entry_id, "position") DEFERRABLE;

alter table public.cl_entry_photos add constraint "cl_entry_photos_height_check" CHECK ((height > 0));

alter table public.cl_entry_photos add constraint "cl_entry_photos_pkey" PRIMARY KEY (id);

alter table public.cl_entry_photos add constraint "cl_entry_photos_position_check" CHECK ((("position" >= 1) AND ("position" <= 9)));

alter table public.cl_entry_photos add constraint "cl_entry_photos_storage_owner_check" CHECK ((split_part(storage_path, '/'::text, 1) = (owner_id)::text));

alter table public.cl_entry_photos add constraint "cl_entry_photos_storage_path_key" UNIQUE (storage_path);

alter table public.cl_entry_photos add constraint "cl_entry_photos_width_check" CHECK ((width > 0));

alter table public.cl_rooms add constraint "cl_rooms_emoji_check" CHECK (((emoji IS NULL) OR ((char_length(emoji) >= 1) AND (char_length(emoji) <= 8))));

alter table public.cl_rooms add constraint "cl_rooms_max_members_check" CHECK (((max_members >= 2) AND (max_members <= 6)));

alter table public.cl_rooms add constraint "cl_rooms_name_check" CHECK ((((char_length(name) >= 2) AND (char_length(name) <= 20)) AND (name = btrim(name))));

alter table public.cl_rooms add constraint "cl_rooms_pkey" PRIMARY KEY (id);

alter table public.cl_rooms add constraint "cl_rooms_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'ended'::text])));

alter table public.cl_room_members add constraint "cl_room_members_pkey" PRIMARY KEY (room_id, user_id);

alter table public.cl_room_members add constraint "cl_room_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])));

alter table public.cl_room_members add constraint "cl_room_members_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'left'::text, 'removed'::text])));

alter table public.cl_room_invites add constraint "cl_room_invites_check" CHECK (((use_count >= 0) AND (use_count <= max_uses)));

alter table public.cl_room_invites add constraint "cl_room_invites_display_code_check" CHECK ((display_code ~ '^[0-9]{6}$'::text));

alter table public.cl_room_invites add constraint "cl_room_invites_display_code_key" UNIQUE (display_code);

alter table public.cl_room_invites add constraint "cl_room_invites_max_uses_check" CHECK (((max_uses >= 1) AND (max_uses <= 5)));

alter table public.cl_room_invites add constraint "cl_room_invites_pkey" PRIMARY KEY (id);

alter table public.cl_room_invites add constraint "cl_room_invites_token_hash_key" UNIQUE (token_hash);

alter table public.cl_room_invite_uses add constraint "cl_room_invite_uses_pkey" PRIMARY KEY (invite_id, user_id);

alter table public.cl_room_daily_missions add constraint "cl_room_daily_missions_pkey" PRIMARY KEY (room_id, challenge_date);

alter table public.cl_entry_room_shares add constraint "cl_entry_room_shares_pkey" PRIMARY KEY (entry_id, room_id);

alter table public.cl_room_photo_reactions add constraint "cl_room_photo_reactions_emoji_check" CHECK ((emoji = ANY (ARRAY['heart'::text, 'sparkles'::text, 'wow'::text, 'palette'::text])));

alter table public.cl_room_photo_reactions add constraint "cl_room_photo_reactions_pkey" PRIMARY KEY (room_id, photo_id, user_id);

alter table public.cl_push_devices add constraint "cl_push_devices_expo_push_token_check" CHECK (((char_length(expo_push_token) >= 16) AND (char_length(expo_push_token) <= 255)));

alter table public.cl_push_devices add constraint "cl_push_devices_expo_push_token_key" UNIQUE (expo_push_token);

alter table public.cl_push_devices add constraint "cl_push_devices_pkey" PRIMARY KEY (id);

alter table public.cl_push_devices add constraint "cl_push_devices_platform_check" CHECK ((platform = ANY (ARRAY['android'::text, 'ios'::text])));

alter table public.cl_room_photo_push_deliveries add constraint "cl_room_photo_push_deliveries_pkey" PRIMARY KEY (room_id, recipient_user_id, source_user_id, date_key);

alter table public.cl_profiles add constraint "cl_profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.cl_daily_missions add constraint "cl_daily_missions_color_id_fkey" FOREIGN KEY (color_id) REFERENCES cl_color_palette(id);

alter table public.cl_daily_entries add constraint "cl_daily_entries_mission_date_fkey" FOREIGN KEY (mission_id, date_key) REFERENCES cl_daily_missions(id, challenge_date);

alter table public.cl_daily_entries add constraint "cl_daily_entries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.cl_profiles(id) ON DELETE CASCADE;

alter table public.cl_entry_photos add constraint "cl_entry_photos_entry_owner_date_fkey" FOREIGN KEY (entry_id, owner_id, date_key) REFERENCES cl_daily_entries(id, user_id, date_key) ON DELETE CASCADE;

alter table public.cl_entry_photos add constraint "cl_entry_photos_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES public.cl_profiles(id) ON DELETE CASCADE;

alter table public.cl_rooms add constraint "cl_rooms_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.cl_profiles(id) ON DELETE SET NULL;

alter table public.cl_room_members add constraint "cl_room_members_room_id_fkey" FOREIGN KEY (room_id) REFERENCES cl_rooms(id) ON DELETE CASCADE;

alter table public.cl_room_members add constraint "cl_room_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.cl_profiles(id) ON DELETE CASCADE;

alter table public.cl_room_invites add constraint "cl_room_invites_inviter_id_fkey" FOREIGN KEY (inviter_id) REFERENCES public.cl_profiles(id) ON DELETE SET NULL;

alter table public.cl_room_invites add constraint "cl_room_invites_room_id_fkey" FOREIGN KEY (room_id) REFERENCES cl_rooms(id) ON DELETE CASCADE;

alter table public.cl_room_invite_uses add constraint "cl_room_invite_uses_invite_id_fkey" FOREIGN KEY (invite_id) REFERENCES cl_room_invites(id) ON DELETE CASCADE;

alter table public.cl_room_invite_uses add constraint "cl_room_invite_uses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.cl_profiles(id) ON DELETE CASCADE;

alter table public.cl_room_daily_missions add constraint "cl_room_daily_missions_mission_id_fkey" FOREIGN KEY (mission_id) REFERENCES cl_daily_missions(id) ON DELETE RESTRICT;

alter table public.cl_room_daily_missions add constraint "cl_room_daily_missions_room_id_fkey" FOREIGN KEY (room_id) REFERENCES cl_rooms(id) ON DELETE CASCADE;

alter table public.cl_entry_room_shares add constraint "cl_entry_room_shares_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES cl_daily_entries(id) ON DELETE CASCADE;

alter table public.cl_entry_room_shares add constraint "cl_entry_room_shares_room_id_fkey" FOREIGN KEY (room_id) REFERENCES cl_rooms(id) ON DELETE CASCADE;

alter table public.cl_entry_room_shares add constraint "cl_entry_room_shares_shared_by_fkey" FOREIGN KEY (shared_by) REFERENCES public.cl_profiles(id) ON DELETE CASCADE;

alter table public.cl_room_photo_reactions add constraint "cl_room_photo_reactions_photo_id_fkey" FOREIGN KEY (photo_id) REFERENCES cl_entry_photos(id) ON DELETE CASCADE;

alter table public.cl_room_photo_reactions add constraint "cl_room_photo_reactions_room_id_fkey" FOREIGN KEY (room_id) REFERENCES cl_rooms(id) ON DELETE CASCADE;

alter table public.cl_room_photo_reactions add constraint "cl_room_photo_reactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.cl_profiles(id) ON DELETE CASCADE;

alter table public.cl_push_devices add constraint "cl_push_devices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.cl_profiles(id) ON DELETE CASCADE;

alter table public.cl_room_photo_push_deliveries add constraint "cl_room_photo_push_deliveries_recipient_user_id_fkey" FOREIGN KEY (recipient_user_id) REFERENCES public.cl_profiles(id) ON DELETE CASCADE;

alter table public.cl_room_photo_push_deliveries add constraint "cl_room_photo_push_deliveries_room_id_fkey" FOREIGN KEY (room_id) REFERENCES cl_rooms(id) ON DELETE CASCADE;

alter table public.cl_room_photo_push_deliveries add constraint "cl_room_photo_push_deliveries_source_user_id_fkey" FOREIGN KEY (source_user_id) REFERENCES public.cl_profiles(id) ON DELETE CASCADE;

CREATE INDEX cl_daily_entries_mission_date_idx ON public.cl_daily_entries USING btree (mission_id, date_key);

CREATE INDEX cl_daily_entries_mission_id_idx ON public.cl_daily_entries USING btree (mission_id);

CREATE INDEX cl_daily_missions_color_id_idx ON public.cl_daily_missions USING btree (color_id);

CREATE INDEX cl_entry_photos_entry_owner_date_idx ON public.cl_entry_photos USING btree (entry_id, owner_id, date_key);

CREATE INDEX cl_entry_photos_owner_date_idx ON public.cl_entry_photos USING btree (owner_id, date_key);

CREATE INDEX cl_entry_room_shares_room_active_idx ON public.cl_entry_room_shares USING btree (room_id, shared_at) WHERE (revoked_at IS NULL);

CREATE INDEX cl_push_devices_enabled_user_idx ON public.cl_push_devices USING btree (user_id) WHERE is_enabled;

CREATE INDEX cl_room_daily_missions_mission_id_idx ON public.cl_room_daily_missions USING btree (mission_id);

CREATE INDEX cl_room_invites_room_active_idx ON public.cl_room_invites USING btree (room_id, expires_at) WHERE (revoked_at IS NULL);

CREATE INDEX cl_room_members_active_room_idx ON public.cl_room_members USING btree (room_id, joined_at) WHERE (status = 'active'::text);

CREATE INDEX cl_room_members_active_user_idx ON public.cl_room_members USING btree (user_id, joined_at DESC) WHERE (status = 'active'::text);

CREATE UNIQUE INDEX cl_room_members_one_active_owner_per_room_idx ON public.cl_room_members USING btree (room_id) WHERE ((status = 'active'::text) AND (role = 'owner'::text));

CREATE INDEX cl_room_photo_reactions_photo_idx ON public.cl_room_photo_reactions USING btree (room_id, photo_id, emoji);

CREATE OR REPLACE FUNCTION cl_private.can_view_room_day(p_room_id uuid, p_date_key date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.cl_room_members as membership
      join public.cl_rooms as room
        on room.id = membership.room_id
        and room.status in ('draft', 'active')
      where membership.room_id = p_room_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and (membership.joined_at at time zone room.timezone)::date <= p_date_key
        and p_date_key <= cl_private.current_date_in_time_zone(room.timezone)
    );
$function$;

revoke all on function cl_private.can_view_room_day(p_room_id uuid, p_date_key date) from public, anon, authenticated, service_role;

grant execute on function cl_private.can_view_room_day(p_room_id uuid, p_date_key date) to authenticated;

CREATE OR REPLACE FUNCTION cl_private.can_view_shared_entry(p_entry_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.cl_entry_room_shares as share
      join public.cl_daily_entries as entry on entry.id = share.entry_id
      where share.entry_id = p_entry_id
        and share.revoked_at is null
        and cl_private.can_view_room_day(share.room_id, entry.date_key)
    );
$function$;

revoke all on function cl_private.can_view_shared_entry(p_entry_id uuid) from public, anon, authenticated, service_role;

grant execute on function cl_private.can_view_shared_entry(p_entry_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION cl_private.can_view_shared_storage_path(p_storage_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.cl_entry_photos as photo
      where photo.storage_path = p_storage_path
        and cl_private.can_view_shared_entry(photo.entry_id)
    );
$function$;

revoke all on function cl_private.can_view_shared_storage_path(p_storage_path text) from public, anon, authenticated, service_role;

grant execute on function cl_private.can_view_shared_storage_path(p_storage_path text) to authenticated;

CREATE OR REPLACE FUNCTION cl_private.current_date_in_time_zone(p_time_zone text, p_now timestamp with time zone DEFAULT now())
 RETURNS date
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if not cl_private.is_valid_time_zone(p_time_zone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;
  return (p_now at time zone p_time_zone)::date;
end;
$function$;

revoke all on function cl_private.current_date_in_time_zone(p_time_zone text, p_now timestamp with time zone) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION cl_private.has_active_room_membership(p_room_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.cl_room_members as membership
      join public.cl_rooms as room
        on room.id = membership.room_id
        and room.status in ('draft', 'active')
      where membership.room_id = p_room_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    );
$function$;

revoke all on function cl_private.has_active_room_membership(p_room_id uuid) from public, anon, authenticated, service_role;

grant execute on function cl_private.has_active_room_membership(p_room_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION cl_private.is_valid_time_zone(p_time_zone text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(btrim(p_time_zone), '') <> ''
    and exists (
      select 1
      from pg_catalog.pg_timezone_names() as zone
      where zone.name = btrim(p_time_zone)
    );
$function$;

revoke all on function cl_private.is_valid_time_zone(p_time_zone text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION cl_private.latest_current_date_for_user(p_user_id uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS date
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select max(candidate.date_key)
  from (
    select cl_private.current_date_in_time_zone(coalesce(profile.timezone, 'Asia/Seoul'), p_now) as date_key
    from (select 1) as seed
    left join public.cl_profiles as profile on profile.id = p_user_id

    union all

    select cl_private.current_date_in_time_zone(room.timezone, p_now)
    from public.cl_room_members as membership
    join public.cl_rooms as room
      on room.id = membership.room_id
      and room.status in ('draft', 'active')
    where membership.user_id = p_user_id
      and membership.status = 'active'
  ) as candidate;
$function$;

revoke all on function cl_private.latest_current_date_for_user(p_user_id uuid, p_now timestamp with time zone) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION cl_private.validate_iana_timezone_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  new.timezone := btrim(new.timezone);

  if not cl_private.is_valid_time_zone(new.timezone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;

  return new;
end;
$function$;

revoke all on function cl_private.validate_iana_timezone_column() from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cl_assert_active_room_capacity(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  if (
    select count(*)
    from public.cl_room_members as membership
    join public.cl_rooms as room
      on room.id = membership.room_id
      and room.status in ('draft', 'active')
    where membership.user_id = p_user_id
      and membership.status = 'active'
  ) >= 3 then
    raise exception 'active_room_limit_reached' using errcode = 'P0001';
  end if;
end;
$function$;

revoke all on function public.cl_assert_active_room_capacity(p_user_id uuid) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cl_claim_room_photo_push_delivery(p_room_id uuid, p_recipient_user_id uuid, p_source_user_id uuid, p_date_key date)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  did_claim boolean := false;
begin
  insert into public.cl_room_photo_push_deliveries (room_id, recipient_user_id, source_user_id, date_key)
  values (p_room_id, p_recipient_user_id, p_source_user_id, p_date_key)
  on conflict do nothing
  returning true into did_claim;

  return coalesce(did_claim, false);
end;
$function$;

revoke all on function public.cl_claim_room_photo_push_delivery(p_room_id uuid, p_recipient_user_id uuid, p_source_user_id uuid, p_date_key date) from public, anon, authenticated, service_role;

grant execute on function public.cl_claim_room_photo_push_delivery(p_room_id uuid, p_recipient_user_id uuid, p_source_user_id uuid, p_date_key date) to service_role;

CREATE OR REPLACE FUNCTION public.cl_create_active_room_invite()
 RETURNS TABLE(invite_code text, invite_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  requesting_member_role text;
  max_member_count smallint;
  active_member_count integer;
  generated_code text;
  invite_token text;
  created_invite_id uuid;
  expires_at timestamptz := now() + interval '24 hours';
  remaining_uses smallint;
  attempt integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.room_id, membership.role
  into target_room_id, requesting_member_role
  from public.cl_room_members as membership
  where membership.user_id = current_user_id
    and membership.status = 'active'
  for update;

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  perform 1
  from public.cl_room_invites as invite
  where invite.room_id = target_room_id
    and invite.revoked_at is null
  for update;

  select room.max_members
  into max_member_count
  from public.cl_rooms as room
  where room.id = target_room_id
    and room.status in ('draft', 'active')
  for update;

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  select count(*)::integer
  into active_member_count
  from public.cl_room_members as membership
  where membership.room_id = target_room_id
    and membership.status = 'active';

  if active_member_count >= max_member_count then
    raise exception 'room_member_limit_reached' using errcode = 'P0001';
  end if;

  update public.cl_room_invites
  set revoked_at = now()
  where room_id = target_room_id
    and revoked_at is null;

  remaining_uses := least(5, max_member_count - active_member_count)::smallint;

  for attempt in 1..50 loop
    generated_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');

    if exists (
      select 1
      from public.cl_room_invites as invite
      where invite.display_code = generated_code
    ) then
      continue;
    end if;

    invite_token := encode(extensions.gen_random_bytes(32), 'hex');

    begin
      insert into public.cl_room_invites (room_id, inviter_id, token_hash, display_code, expires_at, max_uses)
      values (
        target_room_id,
        current_user_id,
        encode(extensions.digest(invite_token, 'sha256'), 'hex'),
        generated_code,
        expires_at,
        remaining_uses
      )
      returning id into created_invite_id;
      exit;
    exception when unique_violation then
      created_invite_id := null;
    end;
  end loop;

  if created_invite_id is null then
    raise exception 'invite_code_generation_failed' using errcode = 'P0001';
  end if;

  return query select generated_code, expires_at;
end;
$function$;

revoke all on function public.cl_create_active_room_invite() from public, anon, authenticated, service_role;

grant execute on function public.cl_create_active_room_invite() to authenticated;

CREATE OR REPLACE FUNCTION public.cl_create_room_invite(p_room_id uuid)
 RETURNS TABLE(invite_code text, invite_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  requesting_member_role text;
  max_member_count smallint;
  active_member_count integer;
  generated_code text;
  invite_token text;
  created_invite_id uuid;
  expires_at timestamptz := now() + interval '24 hours';
  remaining_uses smallint;
  attempt integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.role, room.max_members
  into requesting_member_role, max_member_count
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active'
  for update of membership, room;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  perform 1
  from public.cl_room_invites as invite
  where invite.room_id = p_room_id
    and invite.revoked_at is null
  for update;

  select count(*)::integer
  into active_member_count
  from public.cl_room_members as membership
  where membership.room_id = p_room_id
    and membership.status = 'active';

  if active_member_count >= max_member_count then
    raise exception 'room_member_limit_reached' using errcode = 'P0001';
  end if;

  update public.cl_room_invites
  set revoked_at = now()
  where room_id = p_room_id
    and revoked_at is null;

  remaining_uses := least(5, max_member_count - active_member_count)::smallint;

  for attempt in 1..50 loop
    generated_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');

    if exists (
      select 1
      from public.cl_room_invites as invite
      where invite.display_code = generated_code
    ) then
      continue;
    end if;

    invite_token := encode(extensions.gen_random_bytes(32), 'hex');

    begin
      insert into public.cl_room_invites (room_id, inviter_id, token_hash, display_code, expires_at, max_uses)
      values (
        p_room_id,
        current_user_id,
        encode(extensions.digest(invite_token, 'sha256'), 'hex'),
        generated_code,
        expires_at,
        remaining_uses
      )
      returning id into created_invite_id;
      exit;
    exception when unique_violation then
      created_invite_id := null;
    end;
  end loop;

  if created_invite_id is null then
    raise exception 'invite_code_generation_failed' using errcode = 'P0001';
  end if;

  return query select generated_code, expires_at;
end;
$function$;

revoke all on function public.cl_create_room_invite(p_room_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_create_room_invite(p_room_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_create_room_with_invite(p_name text, p_emoji text DEFAULT NULL::text)
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, invite_code text, invite_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  profile_time_zone text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  select coalesce(profile.timezone, 'Asia/Seoul') into profile_time_zone
  from (select 1) as seed
  left join public.cl_profiles as profile on profile.id = current_user_id;
  return query select * from public.cl_create_room_with_invite_v2(p_name, p_emoji, profile_time_zone);
end;
$function$;

revoke all on function public.cl_create_room_with_invite(p_name text, p_emoji text) from public, anon, authenticated, service_role;

grant execute on function public.cl_create_room_with_invite(p_name text, p_emoji text) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_create_room_with_invite_v2(p_name text, p_emoji text, p_timezone text)
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, invite_code text, invite_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
  normalized_time_zone text := btrim(coalesce(p_timezone, ''));
  created_room_id uuid;
  generated_code text;
  invite_token text;
  expires_at timestamptz := now() + interval '24 hours';
  attempt integer;
  today_date date;
  today_entry_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if char_length(normalized_name) < 2 or char_length(normalized_name) > 20 then
    raise exception 'room_name_invalid' using errcode = '22023';
  end if;
  if normalized_emoji is not null and char_length(normalized_emoji) > 8 then
    raise exception 'room_emoji_invalid' using errcode = '22023';
  end if;
  if not cl_private.is_valid_time_zone(normalized_time_zone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;

  perform public.cl_assert_active_room_capacity(current_user_id);

  for attempt in 1..50 loop
    generated_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
    exit when not exists (
      select 1 from public.cl_room_invites as invite where invite.display_code = generated_code
    );
  end loop;

  if generated_code is null or exists (
    select 1 from public.cl_room_invites as invite where invite.display_code = generated_code
  ) then
    raise exception 'invite_code_generation_failed' using errcode = 'P0001';
  end if;

  insert into public.cl_rooms (name, emoji, created_by, timezone)
  values (normalized_name, normalized_emoji, current_user_id, normalized_time_zone)
  returning id into created_room_id;

  insert into public.cl_room_members (room_id, user_id, role, status)
  values (created_room_id, current_user_id, 'owner', 'active');

  today_date := cl_private.current_date_in_time_zone(normalized_time_zone);
  perform public.cl_ensure_room_daily_mission(created_room_id, today_date);

  invite_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.cl_room_invites (room_id, inviter_id, token_hash, display_code, expires_at, max_uses)
  values (
    created_room_id,
    current_user_id,
    encode(extensions.digest(invite_token, 'sha256'), 'hex'),
    generated_code,
    expires_at,
    5
  );

  select entry.id into today_entry_id
  from public.cl_daily_entries as entry
  where entry.user_id = current_user_id
    and entry.date_key = today_date;

  if today_entry_id is not null then
    perform public.cl_share_entry_to_active_room(today_entry_id);
  end if;

  return query
  select created_room_id, normalized_name, normalized_emoji, generated_code, expires_at;
end;
$function$;

revoke all on function public.cl_create_room_with_invite_v2(p_name text, p_emoji text, p_timezone text) from public, anon, authenticated, service_role;

grant execute on function public.cl_create_room_with_invite_v2(p_name text, p_emoji text, p_timezone text) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_delete_my_entry_photo(p_photo_id uuid)
 RETURNS TABLE(storage_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  deleted_entry_id uuid;
  deleted_position smallint;
  deleted_storage_path text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select photo.entry_id
  into deleted_entry_id
  from public.cl_entry_photos as photo
  where photo.id = p_photo_id
    and photo.owner_id = current_user_id;

  if not found then
    return;
  end if;

  perform photo.id
  from public.cl_entry_photos as photo
  where photo.entry_id = deleted_entry_id
    and photo.owner_id = current_user_id
  order by photo.position
  for update;

  select photo.position, photo.storage_path
  into deleted_position, deleted_storage_path
  from public.cl_entry_photos as photo
  where photo.id = p_photo_id
    and photo.owner_id = current_user_id;

  if not found then
    return;
  end if;

  set constraints public.cl_entry_photos_entry_position_key deferred;

  delete from public.cl_entry_photos as photo
  where photo.id = p_photo_id
    and photo.owner_id = current_user_id;

  update public.cl_entry_photos as photo
  set position = photo.position - 1
  where photo.entry_id = deleted_entry_id
    and photo.owner_id = current_user_id
    and photo.position > deleted_position;

  return query select deleted_storage_path;
end;
$function$;

revoke all on function public.cl_delete_my_entry_photo(p_photo_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_delete_my_entry_photo(p_photo_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_disable_my_push_device(p_expo_push_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  update public.cl_push_devices
  set is_enabled = false,
      updated_at = now()
  where user_id = current_user_id
    and expo_push_token = p_expo_push_token;
end;
$function$;

revoke all on function public.cl_disable_my_push_device(p_expo_push_token text) from public, anon, authenticated, service_role;

grant execute on function public.cl_disable_my_push_device(p_expo_push_token text) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_end_active_room()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  requesting_member_role text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.room_id, membership.role
  into target_room_id, requesting_member_role
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.user_id = current_user_id
    and membership.status = 'active'
  for update of membership, room;

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  update public.cl_rooms
  set status = 'ended', ended_at = now()
  where id = target_room_id;

  update public.cl_room_members
  set status = 'left', left_at = now()
  where room_id = target_room_id
    and status = 'active';

  update public.cl_room_invites
  set revoked_at = now()
  where room_id = target_room_id
    and revoked_at is null;
end;
$function$;

revoke all on function public.cl_end_active_room() from public, anon, authenticated, service_role;

grant execute on function public.cl_end_active_room() to authenticated;

CREATE OR REPLACE FUNCTION public.cl_end_room(p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  requesting_member_role text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.role
  into requesting_member_role
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active'
  for update of membership, room;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  update public.cl_rooms
  set status = 'ended', ended_at = now()
  where id = p_room_id;

  update public.cl_room_members
  set status = 'left', left_at = now()
  where room_id = p_room_id
    and status = 'active';

  update public.cl_room_invites
  set revoked_at = now()
  where room_id = p_room_id
    and revoked_at is null;
end;
$function$;

revoke all on function public.cl_end_room(p_room_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_end_room(p_room_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_ensure_room_daily_mission(p_room_id uuid, p_challenge_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  mission_id uuid;
  room_time_zone text;
begin
  select room.timezone
  into room_time_zone
  from public.cl_rooms as room
  where room.id = p_room_id
    and room.status in ('draft', 'active');

  if not found then
    raise exception 'room_not_available' using errcode = 'P0001';
  end if;

  if p_challenge_date > cl_private.current_date_in_time_zone(room_time_zone) then
    raise exception 'future_room_mission_not_allowed' using errcode = '22023';
  end if;

  select mission.id into mission_id
  from public.cl_get_daily_mission(p_challenge_date) as mission;

  insert into public.cl_room_daily_missions (room_id, challenge_date, mission_id)
  values (p_room_id, p_challenge_date, mission_id)
  on conflict (room_id, challenge_date) do nothing;

  select room_mission.mission_id into mission_id
  from public.cl_room_daily_missions as room_mission
  where room_mission.room_id = p_room_id
    and room_mission.challenge_date = p_challenge_date;

  return mission_id;
end;
$function$;

revoke all on function public.cl_ensure_room_daily_mission(p_room_id uuid, p_challenge_date date) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cl_get_active_room()
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, room_status text, max_members smallint, member_user_id uuid, member_nickname text, member_role text, member_joined_at timestamp with time zone, invite_code text, invite_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  return query
  select
    room.id,
    room.name,
    room.emoji,
    room.status,
    room.max_members,
    member.user_id,
    coalesce(profile.nickname, '친구'),
    member.role,
    member.joined_at,
    case when current_member.role = 'owner' then invite.display_code else null end,
    case when current_member.role = 'owner' then invite.expires_at else null end
  from public.cl_room_members as current_member
  join public.cl_rooms as room
    on room.id = current_member.room_id
    and room.status in ('draft', 'active')
  join public.cl_room_members as member
    on member.room_id = room.id
    and member.status = 'active'
  left join public.cl_profiles as profile on profile.id = member.user_id
  left join lateral (
    select active_invite.display_code, active_invite.expires_at
    from public.cl_room_invites as active_invite
    where active_invite.room_id = room.id
      and active_invite.revoked_at is null
      and active_invite.expires_at > now()
      and active_invite.use_count < active_invite.max_uses
    order by active_invite.created_at desc
    limit 1
  ) as invite on true
  where current_member.user_id = current_user_id
    and current_member.status = 'active'
  order by member.joined_at;
end;
$function$;

revoke all on function public.cl_get_active_room() from public, anon, authenticated, service_role;

grant execute on function public.cl_get_active_room() to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_active_room_day_board(p_date_key date)
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, date_key date, mission_id uuid, mission_title_ko text, mission_prompt_ko text, color_name_ko text, color_name_en text, color_hex text, member_user_id uuid, member_nickname text, member_role text, member_joined_at timestamp with time zone, entry_id uuid, photo_id uuid, storage_path text, photo_position smallint, photo_caption text, photo_captured_at timestamp with time zone, photo_width integer, photo_height integer, photo_byte_size bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  current_member_joined_at timestamptz;
  today_date date := (now() at time zone 'Asia/Seoul')::date;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_date_key is null or p_date_key > today_date then
    return;
  end if;

  select membership.room_id, membership.joined_at
  into target_room_id, current_member_joined_at
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.user_id = current_user_id
    and membership.status = 'active'
  limit 1;

  if not found
    or (current_member_joined_at at time zone 'Asia/Seoul')::date > p_date_key then
    return;
  end if;

  return query
  select
    room.id,
    room.name,
    room.emoji,
    room_mission.challenge_date,
    mission.id,
    mission.title_ko,
    mission.prompt_ko,
    palette.name_ko,
    palette.name_en,
    palette.hex,
    member.user_id,
    coalesce(profile.nickname, '친구'),
    member.role,
    member.joined_at,
    entry.id,
    photo.id,
    photo.storage_path,
    photo.position,
    photo.caption,
    photo.captured_at,
    photo.width,
    photo.height,
    photo.byte_size
  from public.cl_rooms as room
  join public.cl_room_daily_missions as room_mission
    on room_mission.room_id = room.id
    and room_mission.challenge_date = p_date_key
  join public.cl_daily_missions as mission
    on mission.id = room_mission.mission_id
    and mission.challenge_date = room_mission.challenge_date
  join public.cl_color_palette as palette on palette.id = mission.color_id
  join public.cl_room_members as member
    on member.room_id = room.id
    and member.status = 'active'
    and (member.joined_at at time zone 'Asia/Seoul')::date <= p_date_key
  left join public.cl_profiles as profile on profile.id = member.user_id
  left join public.cl_entry_room_shares as share
    on share.room_id = room.id
    and share.shared_by = member.user_id
    and share.revoked_at is null
  left join public.cl_daily_entries as entry
    on entry.id = share.entry_id
    and entry.user_id = member.user_id
    and entry.date_key = p_date_key
    and entry.mission_id = room_mission.mission_id
  left join public.cl_entry_photos as photo on photo.entry_id = entry.id
  where room.id = target_room_id
    and room.status in ('draft', 'active')
  order by member.joined_at, photo.position nulls last;
end;
$function$;

revoke all on function public.cl_get_active_room_day_board(p_date_key date) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_active_room_day_board(p_date_key date) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_active_room_history()
 RETURNS TABLE(date_key date, mission_id uuid, mission_title_ko text, mission_prompt_ko text, color_name_ko text, color_name_en text, color_hex text, participant_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  current_member_joined_at timestamptz;
  today_date date := (now() at time zone 'Asia/Seoul')::date;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.room_id, membership.joined_at
  into target_room_id, current_member_joined_at
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.user_id = current_user_id
    and membership.status = 'active'
  limit 1;

  if not found then
    return;
  end if;

  return query
  select
    room_mission.challenge_date,
    mission.id,
    mission.title_ko,
    mission.prompt_ko,
    palette.name_ko,
    palette.name_en,
    palette.hex,
    count(distinct case when entry.id is not null then share.shared_by end)::integer
  from public.cl_room_daily_missions as room_mission
  join public.cl_daily_missions as mission
    on mission.id = room_mission.mission_id
    and mission.challenge_date = room_mission.challenge_date
  join public.cl_color_palette as palette on palette.id = mission.color_id
  left join public.cl_entry_room_shares as share
    on share.room_id = room_mission.room_id
    and share.revoked_at is null
  left join public.cl_daily_entries as entry
    on entry.id = share.entry_id
    and entry.user_id = share.shared_by
    and entry.date_key = room_mission.challenge_date
    and entry.mission_id = room_mission.mission_id
  where room_mission.room_id = target_room_id
    and room_mission.challenge_date >= (current_member_joined_at at time zone 'Asia/Seoul')::date
    and room_mission.challenge_date <= today_date
  group by
    room_mission.challenge_date,
    mission.id,
    mission.title_ko,
    mission.prompt_ko,
    palette.name_ko,
    palette.name_en,
    palette.hex
  order by room_mission.challenge_date desc;
end;
$function$;

revoke all on function public.cl_get_active_room_history() from public, anon, authenticated, service_role;

grant execute on function public.cl_get_active_room_history() to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_active_room_today_board()
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, date_key date, mission_id uuid, mission_title_ko text, mission_prompt_ko text, color_name_ko text, color_name_en text, color_hex text, member_user_id uuid, member_nickname text, member_role text, member_joined_at timestamp with time zone, entry_id uuid, photo_id uuid, storage_path text, photo_position smallint, photo_caption text, photo_captured_at timestamp with time zone, photo_width integer, photo_height integer, photo_byte_size bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  target_date date := (now() at time zone 'Asia/Seoul')::date;
  target_mission_id uuid;
  current_member_joined_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.room_id, membership.joined_at
  into target_room_id, current_member_joined_at
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.user_id = current_user_id
    and membership.status = 'active'
  limit 1;

  if not found
    or (current_member_joined_at at time zone 'Asia/Seoul')::date > target_date then
    return;
  end if;

  target_mission_id := public.cl_ensure_room_daily_mission(target_room_id, target_date);

  return query
  select
    room.id,
    room.name,
    room.emoji,
    target_date,
    mission.id,
    mission.title_ko,
    mission.prompt_ko,
    palette.name_ko,
    palette.name_en,
    palette.hex,
    member.user_id,
    coalesce(profile.nickname, '친구'),
    member.role,
    member.joined_at,
    entry.id,
    photo.id,
    photo.storage_path,
    photo.position,
    photo.caption,
    photo.captured_at,
    photo.width,
    photo.height,
    photo.byte_size
  from public.cl_rooms as room
  join public.cl_room_daily_missions as room_mission
    on room_mission.room_id = room.id
    and room_mission.challenge_date = target_date
    and room_mission.mission_id = target_mission_id
  join public.cl_daily_missions as mission
    on mission.id = room_mission.mission_id
    and mission.challenge_date = room_mission.challenge_date
  join public.cl_color_palette as palette on palette.id = mission.color_id
  join public.cl_room_members as member
    on member.room_id = room.id
    and member.status = 'active'
  left join public.cl_profiles as profile on profile.id = member.user_id
  left join public.cl_entry_room_shares as share
    on share.room_id = room.id
    and share.shared_by = member.user_id
    and share.revoked_at is null
  left join public.cl_daily_entries as entry
    on entry.id = share.entry_id
    and entry.user_id = member.user_id
    and entry.date_key = target_date
    and entry.mission_id = room_mission.mission_id
  left join public.cl_entry_photos as photo on photo.entry_id = entry.id
  where room.id = target_room_id
    and room.status in ('draft', 'active')
  order by member.joined_at, photo.position nulls last;
end;
$function$;

revoke all on function public.cl_get_active_room_today_board() from public, anon, authenticated, service_role;

grant execute on function public.cl_get_active_room_today_board() to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_daily_mission(p_challenge_date date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, challenge_date date, mission_type text, title_ko text, prompt_ko text, published_at timestamp with time zone, source text, color_id uuid, color_slug text, color_name_ko text, color_name_en text, color_hex text, color_tint_hex text, color_shade_hex text, color_on_color_hex text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  profile_time_zone text;
  target_date date;
  latest_allowed_date date;
  active_color_count integer;
  selected_color public.cl_color_palette%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select coalesce(profile.timezone, 'Asia/Seoul')
  into profile_time_zone
  from (select 1) as seed
  left join public.cl_profiles as profile on profile.id = current_user_id;

  target_date := coalesce(p_challenge_date, cl_private.current_date_in_time_zone(profile_time_zone));
  latest_allowed_date := cl_private.latest_current_date_for_user(current_user_id);
  if target_date > latest_allowed_date then
    raise exception 'Future daily missions cannot be created';
  end if;

  select count(*) into active_color_count
  from public.cl_color_palette
  where is_active;

  if active_color_count = 0 then
    raise exception 'No active colors are available';
  end if;

  select * into selected_color
  from public.cl_color_palette
  where is_active
  order by slug
  offset (('x' || substr(md5(target_date::text), 1, 4))::bit(16)::integer % active_color_count)
  limit 1;

  insert into public.cl_daily_missions (challenge_date, mission_type, color_id, title_ko, prompt_ko, source)
  values (
    target_date,
    'color',
    selected_color.id,
    format('오늘의 %s', selected_color.name_ko),
    selected_color.prompt_ko,
    'scheduled'
  )
  on conflict do nothing;

  return query
  select
    mission.id,
    mission.challenge_date,
    mission.mission_type,
    mission.title_ko,
    mission.prompt_ko,
    mission.published_at,
    mission.source,
    palette.id,
    palette.slug,
    palette.name_ko,
    palette.name_en,
    palette.hex,
    palette.tint_hex,
    palette.shade_hex,
    palette.on_color_hex
  from public.cl_daily_missions as mission
  join public.cl_color_palette as palette on palette.id = mission.color_id
  where mission.challenge_date = target_date;
end;
$function$;

revoke all on function public.cl_get_daily_mission(p_challenge_date date) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_daily_mission(p_challenge_date date) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_diary_month(p_month_start date)
 RETURNS TABLE(entry_id uuid, mission_id uuid, date_key date, note text, color_id uuid, color_slug text, color_name_ko text, color_name_en text, color_hex text, color_tint_hex text, color_shade_hex text, color_on_color_hex text, photo_id uuid, storage_path text, photo_position smallint, photo_caption text, captured_at timestamp with time zone, width integer, height integer, byte_size bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    entry.id as entry_id,
    entry.mission_id,
    entry.date_key,
    entry.note,
    palette.id as color_id,
    palette.slug as color_slug,
    palette.name_ko as color_name_ko,
    palette.name_en as color_name_en,
    palette.hex as color_hex,
    palette.tint_hex as color_tint_hex,
    palette.shade_hex as color_shade_hex,
    palette.on_color_hex as color_on_color_hex,
    photo.id as photo_id,
    photo.storage_path,
    photo.position as photo_position,
    photo.caption as photo_caption,
    photo.captured_at,
    photo.width,
    photo.height,
    photo.byte_size
  from public.cl_daily_entries as entry
  join public.cl_daily_missions as mission
    on mission.id = entry.mission_id
    and mission.challenge_date = entry.date_key
  join public.cl_color_palette as palette
    on palette.id = mission.color_id
  left join public.cl_entry_photos as photo
    on photo.entry_id = entry.id
  where entry.user_id = (select auth.uid())
    and (select auth.uid()) is not null
    and entry.date_key >= p_month_start
    and entry.date_key < (p_month_start + interval '1 month')::date
  order by entry.date_key desc, photo.position asc nulls last;
$function$;

revoke all on function public.cl_get_diary_month(p_month_start date) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_diary_month(p_month_start date) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_diary_month_v2(p_month_start date)
 RETURNS TABLE(entry_id uuid, mission_id uuid, date_key date, note text, color_id uuid, color_slug text, color_name_ko text, color_name_en text, color_hex text, color_tint_hex text, color_shade_hex text, color_on_color_hex text, shared_rooms jsonb, photo_id uuid, storage_path text, photo_position smallint, photo_caption text, captured_at timestamp with time zone, width integer, height integer, byte_size bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    entry.id,
    entry.mission_id,
    entry.date_key,
    entry.note,
    palette.id,
    palette.slug,
    palette.name_ko,
    palette.name_en,
    palette.hex,
    palette.tint_hex,
    palette.shade_hex,
    palette.on_color_hex,
    coalesce(shared_room_list.items, '[]'::jsonb),
    photo.id,
    photo.storage_path,
    photo.position,
    photo.caption,
    photo.captured_at,
    photo.width,
    photo.height,
    photo.byte_size
  from public.cl_daily_entries as entry
  join public.cl_daily_missions as mission
    on mission.id = entry.mission_id
    and mission.challenge_date = entry.date_key
  join public.cl_color_palette as palette on palette.id = mission.color_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', room.id,
        'name', room.name,
        'emoji', room.emoji,
        'can_open',
          share.revoked_at is null
          and room.status in ('draft', 'active')
          and exists (
            select 1
            from public.cl_room_members as membership
            where membership.room_id = room.id
              and membership.user_id = (select auth.uid())
              and membership.status = 'active'
              and (membership.joined_at at time zone room.timezone)::date <= entry.date_key
          )
      ) order by share.shared_at, room.id
    ) as items
    from public.cl_entry_room_shares as share
    join public.cl_rooms as room on room.id = share.room_id
    where share.entry_id = entry.id
      and share.shared_by = (select auth.uid())
  ) as shared_room_list on true
  left join public.cl_entry_photos as photo on photo.entry_id = entry.id
  where entry.user_id = (select auth.uid())
    and (select auth.uid()) is not null
    and entry.date_key >= p_month_start
    and entry.date_key < (p_month_start + interval '1 month')::date
  order by entry.date_key desc, photo.position asc nulls last;
$function$;

revoke all on function public.cl_get_diary_month_v2(p_month_start date) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_diary_month_v2(p_month_start date) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_mission_reveal_palette(p_challenge_date date DEFAULT NULL::date)
 RETURNS TABLE(wheel_position integer, color_id uuid, color_slug text, color_name_ko text, color_name_en text, color_hex text, color_on_color_hex text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  profile_time_zone text;
  target_date date;
  target_color_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select coalesce(profile.timezone, 'Asia/Seoul')
  into profile_time_zone
  from (select 1) as seed
  left join public.cl_profiles as profile on profile.id = current_user_id;

  target_date := coalesce(p_challenge_date, cl_private.current_date_in_time_zone(profile_time_zone));
  if target_date > cl_private.latest_current_date_for_user(current_user_id) then
    raise exception 'Future mission reveal palettes cannot be created';
  end if;

  select mission.color_id
  into target_color_id
  from public.cl_daily_missions as mission
  where mission.challenge_date = target_date;

  if target_color_id is null then
    perform public.cl_get_daily_mission(target_date);
    select mission.color_id into target_color_id
    from public.cl_daily_missions as mission
    where mission.challenge_date = target_date;
  end if;

  if target_color_id is null then
    raise exception 'Daily mission is missing';
  end if;

  if (select count(*) from public.cl_color_palette where is_active) < 10 then
    raise exception 'At least ten active colors are required';
  end if;

  return query
  with target_color as (
    select palette.id, palette.slug, palette.name_ko, palette.name_en, palette.hex, palette.on_color_hex
    from public.cl_color_palette as palette
    where palette.id = target_color_id
  ),
  decoys as (
    select palette.id, palette.slug, palette.name_ko, palette.name_en, palette.hex, palette.on_color_hex
    from public.cl_color_palette as palette
    where palette.is_active
      and palette.id <> target_color_id
    order by md5(target_date::text || ':' || palette.slug)
    limit 9
  ),
  wheel_colors as (
    select 0 as wheel_position, * from target_color
    union all
    select row_number() over (order by decoys.slug)::integer as wheel_position, * from decoys
  )
  select
    wheel_colors.wheel_position,
    wheel_colors.id,
    wheel_colors.slug,
    wheel_colors.name_ko,
    wheel_colors.name_en,
    wheel_colors.hex,
    wheel_colors.on_color_hex
  from wheel_colors
  order by wheel_colors.wheel_position;
end;
$function$;

revoke all on function public.cl_get_mission_reveal_palette(p_challenge_date date) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_mission_reveal_palette(p_challenge_date date) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_my_rooms()
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, room_status text, max_members smallint, member_user_id uuid, member_nickname text, member_role text, member_joined_at timestamp with time zone, invite_code text, invite_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  return query
  select
    room.id,
    room.name,
    room.emoji,
    room.status,
    room.max_members,
    member.user_id,
    coalesce(profile.nickname, '친구'),
    member.role,
    member.joined_at,
    case when current_member.role = 'owner' then invite.display_code else null end,
    case when current_member.role = 'owner' then invite.expires_at else null end
  from public.cl_room_members as current_member
  join public.cl_rooms as room
    on room.id = current_member.room_id
    and room.status in ('draft', 'active')
  join public.cl_room_members as member
    on member.room_id = room.id
    and member.status = 'active'
  left join public.cl_profiles as profile on profile.id = member.user_id
  left join lateral (
    select active_invite.display_code, active_invite.expires_at
    from public.cl_room_invites as active_invite
    where active_invite.room_id = room.id
      and active_invite.revoked_at is null
      and active_invite.expires_at > now()
      and active_invite.use_count < active_invite.max_uses
    order by active_invite.created_at desc
    limit 1
  ) as invite on true
  where current_member.user_id = current_user_id
    and current_member.status = 'active'
  order by current_member.joined_at desc, member.joined_at;
end;
$function$;

revoke all on function public.cl_get_my_rooms() from public, anon, authenticated, service_role;

grant execute on function public.cl_get_my_rooms() to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_my_rooms_v2()
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, room_status text, room_timezone text, max_members smallint, member_user_id uuid, member_nickname text, member_role text, member_joined_at timestamp with time zone, invite_code text, invite_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return query
  select
    room.id, room.name, room.emoji, room.status, room.timezone, room.max_members,
    member.user_id, coalesce(profile.nickname, '친구'), member.role, member.joined_at,
    case when current_member.role = 'owner' then invite.display_code else null end,
    case when current_member.role = 'owner' then invite.expires_at else null end
  from public.cl_room_members as current_member
  join public.cl_rooms as room
    on room.id = current_member.room_id
    and room.status in ('draft', 'active')
  join public.cl_room_members as member
    on member.room_id = room.id
    and member.status = 'active'
  left join public.cl_profiles as profile on profile.id = member.user_id
  left join lateral (
    select active_invite.display_code, active_invite.expires_at
    from public.cl_room_invites as active_invite
    where active_invite.room_id = room.id
      and active_invite.revoked_at is null
      and active_invite.expires_at > now()
      and active_invite.use_count < active_invite.max_uses
    order by active_invite.created_at desc
    limit 1
  ) as invite on true
  where current_member.user_id = current_user_id
    and current_member.status = 'active'
  order by current_member.joined_at desc, member.joined_at;
end;
$function$;

revoke all on function public.cl_get_my_rooms_v2() from public, anon, authenticated, service_role;

grant execute on function public.cl_get_my_rooms_v2() to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_or_create_daily_entry(p_entry_id uuid, p_mission_id uuid, p_date_key date)
 RETURNS TABLE(id uuid, user_id uuid, mission_id uuid, date_key date, note text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_date_key > cl_private.latest_current_date_for_user(current_user_id) then
    raise exception 'Future daily entries cannot be created';
  end if;

  insert into public.cl_daily_entries (id, user_id, mission_id, date_key)
  values (p_entry_id, current_user_id, p_mission_id, p_date_key)
  on conflict on constraint cl_daily_entries_user_date_key do nothing;

  if not exists (
    select 1
    from public.cl_daily_entries as existing_entry
    where existing_entry.user_id = current_user_id
      and existing_entry.date_key = p_date_key
      and existing_entry.mission_id = p_mission_id
  ) then
    raise exception 'The entry mission does not match the daily mission';
  end if;

  return query
  select entry.id, entry.user_id, entry.mission_id, entry.date_key, entry.note, entry.created_at, entry.updated_at
  from public.cl_daily_entries as entry
  where entry.user_id = current_user_id
    and entry.date_key = p_date_key;
end;
$function$;

revoke all on function public.cl_get_or_create_daily_entry(p_entry_id uuid, p_mission_id uuid, p_date_key date) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_or_create_daily_entry(p_entry_id uuid, p_mission_id uuid, p_date_key date) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_room(p_room_id uuid)
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, room_status text, max_members smallint, member_user_id uuid, member_nickname text, member_role text, member_joined_at timestamp with time zone, invite_code text, invite_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  return query
  select
    room.id,
    room.name,
    room.emoji,
    room.status,
    room.max_members,
    member.user_id,
    coalesce(profile.nickname, '친구'),
    member.role,
    member.joined_at,
    case when current_member.role = 'owner' then invite.display_code else null end,
    case when current_member.role = 'owner' then invite.expires_at else null end
  from public.cl_room_members as current_member
  join public.cl_rooms as room
    on room.id = current_member.room_id
    and room.status in ('draft', 'active')
  join public.cl_room_members as member
    on member.room_id = room.id
    and member.status = 'active'
  left join public.cl_profiles as profile on profile.id = member.user_id
  left join lateral (
    select active_invite.display_code, active_invite.expires_at
    from public.cl_room_invites as active_invite
    where active_invite.room_id = room.id
      and active_invite.revoked_at is null
      and active_invite.expires_at > now()
      and active_invite.use_count < active_invite.max_uses
    order by active_invite.created_at desc
    limit 1
  ) as invite on true
  where current_member.room_id = p_room_id
    and current_member.user_id = current_user_id
    and current_member.status = 'active'
  order by member.joined_at;
end;
$function$;

revoke all on function public.cl_get_room(p_room_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_room(p_room_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_room_day_board(p_room_id uuid, p_date_key date)
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, date_key date, mission_id uuid, mission_title_ko text, mission_prompt_ko text, color_name_ko text, color_name_en text, color_hex text, member_user_id uuid, member_nickname text, member_role text, member_joined_at timestamp with time zone, entry_id uuid, photo_id uuid, storage_path text, photo_position smallint, photo_caption text, photo_captured_at timestamp with time zone, photo_width integer, photo_height integer, photo_byte_size bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  current_member_joined_at timestamptz;
  room_time_zone text;
  target_mission_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.joined_at, room.timezone
  into current_member_joined_at, room_time_zone
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active';

  if not found
    or p_date_key is null
    or p_date_key > cl_private.current_date_in_time_zone(room_time_zone)
    or (current_member_joined_at at time zone room_time_zone)::date > p_date_key then
    return;
  end if;

  target_mission_id := public.cl_ensure_room_daily_mission(p_room_id, p_date_key);

  return query
  select
    room.id,
    room.name,
    room.emoji,
    room_mission.challenge_date,
    mission.id,
    mission.title_ko,
    mission.prompt_ko,
    palette.name_ko,
    palette.name_en,
    palette.hex,
    member.user_id,
    coalesce(profile.nickname, '친구'),
    member.role,
    member.joined_at,
    entry.id,
    photo.id,
    photo.storage_path,
    photo.position,
    photo.caption,
    photo.captured_at,
    photo.width,
    photo.height,
    photo.byte_size
  from public.cl_rooms as room
  join public.cl_room_daily_missions as room_mission
    on room_mission.room_id = room.id
    and room_mission.challenge_date = p_date_key
    and room_mission.mission_id = target_mission_id
  join public.cl_daily_missions as mission
    on mission.id = room_mission.mission_id
    and mission.challenge_date = room_mission.challenge_date
  join public.cl_color_palette as palette on palette.id = mission.color_id
  join public.cl_room_members as member
    on member.room_id = room.id
    and member.status = 'active'
    and (member.joined_at at time zone room.timezone)::date <= p_date_key
  left join public.cl_profiles as profile on profile.id = member.user_id
  left join public.cl_entry_room_shares as share
    on share.room_id = room.id
    and share.shared_by = member.user_id
    and share.revoked_at is null
  left join public.cl_daily_entries as entry
    on entry.id = share.entry_id
    and entry.user_id = member.user_id
    and entry.date_key = p_date_key
    and entry.mission_id = room_mission.mission_id
  left join public.cl_entry_photos as photo on photo.entry_id = entry.id
  where room.id = p_room_id
    and room.status in ('draft', 'active')
  order by member.joined_at, photo.position nulls last;
end;
$function$;

revoke all on function public.cl_get_room_day_board(p_room_id uuid, p_date_key date) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_room_day_board(p_room_id uuid, p_date_key date) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_room_history(p_room_id uuid)
 RETURNS TABLE(date_key date, mission_id uuid, mission_title_ko text, mission_prompt_ko text, color_name_ko text, color_name_en text, color_hex text, participant_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  current_member_joined_at timestamptz;
  room_time_zone text;
  today_date date;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.joined_at, room.timezone
  into current_member_joined_at, room_time_zone
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active';

  if not found then return; end if;
  today_date := cl_private.current_date_in_time_zone(room_time_zone);
  perform public.cl_ensure_room_daily_mission(p_room_id, today_date);

  return query
  select
    room_mission.challenge_date,
    mission.id,
    mission.title_ko,
    mission.prompt_ko,
    palette.name_ko,
    palette.name_en,
    palette.hex,
    count(distinct case when entry.id is not null then share.shared_by end)::integer
  from public.cl_room_daily_missions as room_mission
  join public.cl_daily_missions as mission
    on mission.id = room_mission.mission_id
    and mission.challenge_date = room_mission.challenge_date
  join public.cl_color_palette as palette on palette.id = mission.color_id
  left join public.cl_entry_room_shares as share
    on share.room_id = room_mission.room_id
    and share.revoked_at is null
  left join public.cl_daily_entries as entry
    on entry.id = share.entry_id
    and entry.user_id = share.shared_by
    and entry.date_key = room_mission.challenge_date
    and entry.mission_id = room_mission.mission_id
  where room_mission.room_id = p_room_id
    and room_mission.challenge_date >= (current_member_joined_at at time zone room_time_zone)::date
    and room_mission.challenge_date <= today_date
  group by room_mission.challenge_date, mission.id, mission.title_ko, mission.prompt_ko,
    palette.name_ko, palette.name_en, palette.hex
  order by room_mission.challenge_date desc;
end;
$function$;

revoke all on function public.cl_get_room_history(p_room_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_room_history(p_room_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_room_invite_preview(p_display_code text)
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, owner_nickname text, member_count integer, max_members smallint, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  return query
  select
    room.id,
    room.name,
    room.emoji,
    coalesce(owner_profile.nickname, '친구'),
    count(member.user_id)::integer,
    room.max_members,
    invite.expires_at
  from public.cl_room_invites as invite
  join public.cl_rooms as room on room.id = invite.room_id
  join public.cl_room_members as owner_membership
    on owner_membership.room_id = room.id
    and owner_membership.role = 'owner'
    and owner_membership.status = 'active'
  left join public.cl_profiles as owner_profile on owner_profile.id = owner_membership.user_id
  left join public.cl_room_members as member
    on member.room_id = room.id
    and member.status = 'active'
  where invite.display_code = btrim(coalesce(p_display_code, ''))
    and invite.revoked_at is null
    and invite.expires_at > now()
    and invite.use_count < invite.max_uses
    and room.status in ('draft', 'active')
  group by room.id, room.name, room.emoji, owner_profile.nickname, room.max_members, invite.expires_at;
end;
$function$;

revoke all on function public.cl_get_room_invite_preview(p_display_code text) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_room_invite_preview(p_display_code text) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_room_photo_reactions(p_room_id uuid, p_photo_id uuid)
 RETURNS TABLE(emoji text, reaction_count integer, reacted_by_me boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  can_view boolean := false;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select true into can_view
  from public.cl_entry_photos as photo
  join public.cl_daily_entries as entry on entry.id = photo.entry_id
  join public.cl_entry_room_shares as share
    on share.entry_id = entry.id
    and share.room_id = p_room_id
    and share.revoked_at is null
  join public.cl_room_members as viewer_membership
    on viewer_membership.room_id = p_room_id
    and viewer_membership.user_id = current_user_id
    and viewer_membership.status = 'active'
  join public.cl_rooms as room
    on room.id = p_room_id
    and room.status in ('draft', 'active')
  where photo.id = p_photo_id
    and (viewer_membership.joined_at at time zone room.timezone)::date <= entry.date_key;

  if not coalesce(can_view, false) then
    raise exception 'room_photo_reaction_not_available' using errcode = '42501';
  end if;

  return query
  select
    choices.emoji,
    count(reaction.user_id)::integer,
    coalesce(bool_or(reaction.user_id = current_user_id), false)
  from (
    values ('heart'::text), ('sparkles'::text), ('wow'::text), ('palette'::text)
  ) as choices(emoji)
  left join public.cl_room_photo_reactions as reaction
    on reaction.room_id = p_room_id
    and reaction.photo_id = p_photo_id
    and reaction.emoji = choices.emoji
  group by choices.emoji
  order by choices.emoji;
end;
$function$;

revoke all on function public.cl_get_room_photo_reactions(p_room_id uuid, p_photo_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_room_photo_reactions(p_room_id uuid, p_photo_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_room_today_board(p_room_id uuid)
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, date_key date, mission_id uuid, mission_title_ko text, mission_prompt_ko text, color_name_ko text, color_name_en text, color_hex text, member_user_id uuid, member_nickname text, member_role text, member_joined_at timestamp with time zone, entry_id uuid, photo_id uuid, storage_path text, photo_position smallint, photo_caption text, photo_captured_at timestamp with time zone, photo_width integer, photo_height integer, photo_byte_size bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  room_time_zone text;
  target_date date;
begin
  select room.timezone into room_time_zone
  from public.cl_rooms as room
  where room.id = p_room_id
    and room.status in ('draft', 'active');
  if not found then return; end if;
  target_date := cl_private.current_date_in_time_zone(room_time_zone);
  return query select * from public.cl_get_room_day_board(p_room_id, target_date);
end;
$function$;

revoke all on function public.cl_get_room_today_board(p_room_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_room_today_board(p_room_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_get_room_v2(p_room_id uuid)
 RETURNS TABLE(room_id uuid, room_name text, room_emoji text, room_status text, room_timezone text, max_members smallint, member_user_id uuid, member_nickname text, member_role text, member_joined_at timestamp with time zone, invite_code text, invite_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return query
  select
    room.id, room.name, room.emoji, room.status, room.timezone, room.max_members,
    member.user_id, coalesce(profile.nickname, '친구'), member.role, member.joined_at,
    case when current_member.role = 'owner' then invite.display_code else null end,
    case when current_member.role = 'owner' then invite.expires_at else null end
  from public.cl_room_members as current_member
  join public.cl_rooms as room
    on room.id = current_member.room_id
    and room.status in ('draft', 'active')
  join public.cl_room_members as member
    on member.room_id = room.id
    and member.status = 'active'
  left join public.cl_profiles as profile on profile.id = member.user_id
  left join lateral (
    select active_invite.display_code, active_invite.expires_at
    from public.cl_room_invites as active_invite
    where active_invite.room_id = room.id
      and active_invite.revoked_at is null
      and active_invite.expires_at > now()
      and active_invite.use_count < active_invite.max_uses
    order by active_invite.created_at desc
    limit 1
  ) as invite on true
  where current_member.room_id = p_room_id
    and current_member.user_id = current_user_id
    and current_member.status = 'active'
  order by member.joined_at;
end;
$function$;

revoke all on function public.cl_get_room_v2(p_room_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_get_room_v2(p_room_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_join_room_by_code(p_display_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  target_invite public.cl_room_invites%rowtype;
  target_room public.cl_rooms%rowtype;
  active_member_count integer;
  today_date date;
  today_entry_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  perform public.cl_assert_active_room_capacity(current_user_id);

  select invite.* into target_invite
  from public.cl_room_invites as invite
  where invite.display_code = btrim(coalesce(p_display_code, ''))
    and invite.revoked_at is null
    and invite.expires_at > now()
    and invite.use_count < invite.max_uses
  for update;

  if not found then
    raise exception 'room_invite_not_available' using errcode = 'P0001';
  end if;
  if target_invite.inviter_id = current_user_id then
    raise exception 'room_invite_cannot_join_self' using errcode = 'P0001';
  end if;

  select room.* into target_room
  from public.cl_rooms as room
  where room.id = target_invite.room_id
    and room.status in ('draft', 'active')
  for update;

  if not found then
    raise exception 'room_not_available' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.cl_room_members as membership
    where membership.room_id = target_room.id
      and membership.user_id = current_user_id
      and membership.status = 'active'
  ) then
    raise exception 'room_already_joined' using errcode = 'P0001';
  end if;

  select count(*)::integer into active_member_count
  from public.cl_room_members as membership
  where membership.room_id = target_room.id
    and membership.status = 'active';

  if active_member_count >= target_room.max_members then
    raise exception 'room_member_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.cl_room_members (room_id, user_id, role, status)
  values (target_room.id, current_user_id, 'member', 'active');

  update public.cl_rooms set status = 'active' where id = target_room.id;
  update public.cl_room_invites set use_count = use_count + 1 where id = target_invite.id;
  insert into public.cl_room_invite_uses (invite_id, user_id) values (target_invite.id, current_user_id);

  today_date := cl_private.current_date_in_time_zone(target_room.timezone);
  perform public.cl_ensure_room_daily_mission(target_room.id, today_date);

  select entry.id into today_entry_id
  from public.cl_daily_entries as entry
  where entry.user_id = current_user_id
    and entry.date_key = today_date;

  if today_entry_id is not null then
    perform public.cl_share_entry_to_active_room(today_entry_id);
  end if;

  return target_room.id;
end;
$function$;

revoke all on function public.cl_join_room_by_code(p_display_code text) from public, anon, authenticated, service_role;

grant execute on function public.cl_join_room_by_code(p_display_code text) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_leave_active_room()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  requesting_member_role text;
  active_member_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.room_id, membership.role
  into target_room_id, requesting_member_role
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.user_id = current_user_id
    and membership.status = 'active'
  for update of membership, room;

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role = 'owner' then
    raise exception 'room_owner_cannot_leave' using errcode = 'P0001';
  end if;

  update public.cl_room_members
  set status = 'left', left_at = now()
  where room_id = target_room_id
    and user_id = current_user_id
    and status = 'active';

  select count(*)::integer
  into active_member_count
  from public.cl_room_members as membership
  where membership.room_id = target_room_id
    and membership.status = 'active';

  if active_member_count = 0 then
    update public.cl_rooms
    set status = 'ended', ended_at = now()
    where id = target_room_id;
  elsif active_member_count = 1 then
    update public.cl_rooms
    set status = 'draft'
    where id = target_room_id;
  end if;
end;
$function$;

revoke all on function public.cl_leave_active_room() from public, anon, authenticated, service_role;

grant execute on function public.cl_leave_active_room() to authenticated;

CREATE OR REPLACE FUNCTION public.cl_leave_room(p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  requesting_member_role text;
  active_member_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.role
  into requesting_member_role
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active'
  for update of membership, room;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role = 'owner' then
    raise exception 'room_owner_cannot_leave' using errcode = 'P0001';
  end if;

  update public.cl_room_members
  set status = 'left', left_at = now()
  where room_id = p_room_id
    and user_id = current_user_id
    and status = 'active';

  select count(*)::integer
  into active_member_count
  from public.cl_room_members as membership
  where membership.room_id = p_room_id
    and membership.status = 'active';

  if active_member_count = 0 then
    update public.cl_rooms
    set status = 'ended', ended_at = now()
    where id = p_room_id;
  elsif active_member_count = 1 then
    update public.cl_rooms
    set status = 'draft'
    where id = p_room_id;
  end if;
end;
$function$;

revoke all on function public.cl_leave_room(p_room_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_leave_room(p_room_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_prepare_account_deletion(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  room_record record;
  successor_user_id uuid;
begin
  if p_user_id is null or (select auth.role()) <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  for room_record in
    select membership.room_id
    from public.cl_room_members as membership
    join public.cl_rooms as room
      on room.id = membership.room_id
      and room.status in ('draft', 'active')
    where membership.user_id = p_user_id
      and membership.status = 'active'
      and membership.role = 'owner'
    for update of membership, room
  loop
    perform 1
    from public.cl_room_members as membership
    where membership.room_id = room_record.room_id
      and membership.status = 'active'
    for update;

    select membership.user_id
    into successor_user_id
    from public.cl_room_members as membership
    where membership.room_id = room_record.room_id
      and membership.status = 'active'
      and membership.user_id <> p_user_id
    order by membership.joined_at
    limit 1;

    update public.cl_room_invites
    set revoked_at = now()
    where room_id = room_record.room_id
      and revoked_at is null;

    if successor_user_id is not null then
      update public.cl_room_members
      set role = 'member'
      where room_id = room_record.room_id
        and user_id = p_user_id
        and status = 'active'
        and role = 'owner';

      update public.cl_room_members
      set role = 'owner'
      where room_id = room_record.room_id
        and user_id = successor_user_id
        and status = 'active'
        and role = 'member';
    else
      update public.cl_rooms
      set status = 'ended', ended_at = now()
      where id = room_record.room_id
        and status in ('draft', 'active');

      update public.cl_room_members
      set status = 'left', left_at = now()
      where room_id = room_record.room_id
        and user_id = p_user_id
        and status = 'active';
    end if;
  end loop;
end;
$function$;

revoke all on function public.cl_prepare_account_deletion(p_user_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_prepare_account_deletion(p_user_id uuid) to service_role;

CREATE OR REPLACE FUNCTION public.cl_register_my_push_device(p_expo_push_token text, p_platform text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_expo_push_token is null
    or p_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\\[[^]]+\\]$'
    or p_platform not in ('android', 'ios') then
    raise exception 'push_device_invalid' using errcode = '22023';
  end if;

  insert into public.cl_push_devices (user_id, expo_push_token, platform, is_enabled)
  values (current_user_id, p_expo_push_token, p_platform, true)
  on conflict (expo_push_token)
  do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    is_enabled = true,
    updated_at = now();
end;
$function$;

revoke all on function public.cl_register_my_push_device(p_expo_push_token text, p_platform text) from public, anon, authenticated, service_role;

grant execute on function public.cl_register_my_push_device(p_expo_push_token text, p_platform text) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_remove_room_member(p_room_id uuid, p_member_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  requesting_member_role text;
  target_role text;
  active_member_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_room_id is null or p_member_user_id is null or p_member_user_id = current_user_id then
    raise exception 'room_member_remove_target_invalid' using errcode = '22023';
  end if;

  select membership.role
  into requesting_member_role
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active'
  for update of membership, room;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  select membership.role
  into target_role
  from public.cl_room_members as membership
  where membership.room_id = p_room_id
    and membership.user_id = p_member_user_id
    and membership.status = 'active'
  for update;

  if not found then
    raise exception 'room_member_remove_target_invalid' using errcode = '22023';
  end if;

  if target_role = 'owner' then
    raise exception 'room_member_remove_owner_forbidden' using errcode = '22023';
  end if;

  update public.cl_room_members
  set status = 'removed',
      left_at = now()
  where room_id = p_room_id
    and user_id = p_member_user_id
    and status = 'active';

  -- A removed member must not be able to reuse a code they already received.
  -- The owner can issue a fresh code if they want to invite someone again.
  update public.cl_room_invites
  set revoked_at = now()
  where room_id = p_room_id
    and revoked_at is null;

  select count(*)::integer
  into active_member_count
  from public.cl_room_members as membership
  where membership.room_id = p_room_id
    and membership.status = 'active';

  update public.cl_rooms
  set status = case when active_member_count = 1 then 'draft' else 'active' end
  where id = p_room_id
    and status in ('draft', 'active');
end;
$function$;

revoke all on function public.cl_remove_room_member(p_room_id uuid, p_member_user_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_remove_room_member(p_room_id uuid, p_member_user_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_reorder_my_entry_photos(p_photo_ids uuid[], p_positions integer[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  requested_count integer := coalesce(cardinality(p_photo_ids), 0);
  selected_count integer;
  selected_entry_count integer;
  entry_photo_count integer;
  selected_entry_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if requested_count = 0 or requested_count <> coalesce(cardinality(p_positions), 0) then
    raise exception 'invalid_photo_reorder_request' using errcode = '22023';
  end if;

  if (select count(distinct requested.photo_id) from unnest(p_photo_ids) as requested(photo_id)) <> requested_count
    or (select count(distinct requested.position) from unnest(p_positions) as requested(position)) <> requested_count
    or exists (
      select 1
      from unnest(p_positions) as requested(position)
      where requested.position < 1 or requested.position > 9
    ) then
    raise exception 'invalid_photo_reorder_request' using errcode = '22023';
  end if;

  perform photo.id
  from public.cl_entry_photos as photo
  where photo.id = any(p_photo_ids)
    and photo.owner_id = current_user_id
  order by photo.id
  for update;

  select count(*), count(distinct photo.entry_id)
  into selected_count, selected_entry_count
  from public.cl_entry_photos as photo
  where photo.id = any(p_photo_ids)
    and photo.owner_id = current_user_id;

  if selected_count <> requested_count or selected_entry_count <> 1 then
    raise exception 'photo_reorder_not_allowed' using errcode = '42501';
  end if;

  select photo.entry_id
  into selected_entry_id
  from public.cl_entry_photos as photo
  where photo.id = any(p_photo_ids)
    and photo.owner_id = current_user_id
  order by photo.id
  limit 1;

  select count(*)
  into entry_photo_count
  from public.cl_entry_photos as photo
  where photo.entry_id = selected_entry_id
    and photo.owner_id = current_user_id;

  if entry_photo_count <> requested_count then
    raise exception 'photo_reorder_requires_complete_entry' using errcode = '22023';
  end if;

  set constraints public.cl_entry_photos_entry_position_key deferred;

  with requested as (
    select
      item.photo_id,
      item.position
    from unnest(p_photo_ids, p_positions) as item(photo_id, position)
  )
  update public.cl_entry_photos as photo
  set position = requested.position::smallint
  from requested
  where photo.id = requested.photo_id
    and photo.owner_id = current_user_id;
end;
$function$;

revoke all on function public.cl_reorder_my_entry_photos(p_photo_ids uuid[], p_positions integer[]) from public, anon, authenticated, service_role;

grant execute on function public.cl_reorder_my_entry_photos(p_photo_ids uuid[], p_positions integer[]) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_revoke_active_room_invites()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  requesting_member_role text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.room_id, membership.role
  into target_room_id, requesting_member_role
  from public.cl_room_members as membership
  where membership.user_id = current_user_id
    and membership.status = 'active'
  for update;

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  perform 1
  from public.cl_room_invites as invite
  where invite.room_id = target_room_id
    and invite.revoked_at is null
  for update;

  if not exists (
    select 1
    from public.cl_rooms as room
    where room.id = target_room_id
      and room.status in ('draft', 'active')
    for update
  ) then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  update public.cl_room_invites
  set revoked_at = now()
  where room_id = target_room_id
    and revoked_at is null;
end;
$function$;

revoke all on function public.cl_revoke_active_room_invites() from public, anon, authenticated, service_role;

grant execute on function public.cl_revoke_active_room_invites() to authenticated;

CREATE OR REPLACE FUNCTION public.cl_revoke_room_invites(p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  requesting_member_role text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select membership.role
  into requesting_member_role
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active'
  for update of membership, room;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  update public.cl_room_invites
  set revoked_at = now()
  where room_id = p_room_id
    and revoked_at is null;
end;
$function$;

revoke all on function public.cl_revoke_room_invites(p_room_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_revoke_room_invites(p_room_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_set_daily_entries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.cl_set_daily_entries_updated_at() from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cl_set_profiles_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.cl_set_profiles_updated_at() from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cl_share_entry_to_active_room(p_entry_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  target_entry public.cl_daily_entries%rowtype;
  membership_record record;
  room_mission_id uuid;
  did_share boolean := false;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select entry.* into target_entry
  from public.cl_daily_entries as entry
  where entry.id = p_entry_id
    and entry.user_id = current_user_id;

  if not found then
    raise exception 'daily_entry_not_found' using errcode = 'P0001';
  end if;

  for membership_record in
    select membership.room_id
    from public.cl_room_members as membership
    join public.cl_rooms as room
      on room.id = membership.room_id
      and room.status in ('draft', 'active')
    where membership.user_id = current_user_id
      and membership.status = 'active'
      and (membership.joined_at at time zone room.timezone)::date <= target_entry.date_key
      and target_entry.date_key <= cl_private.current_date_in_time_zone(room.timezone)
  loop
    room_mission_id := public.cl_ensure_room_daily_mission(membership_record.room_id, target_entry.date_key);
    if room_mission_id <> target_entry.mission_id then
      raise exception 'entry_room_share_mission_mismatch' using errcode = '23514';
    end if;

    insert into public.cl_entry_room_shares (entry_id, room_id, shared_by)
    values (target_entry.id, membership_record.room_id, current_user_id)
    on conflict on constraint cl_entry_room_shares_pkey do nothing;
    did_share := true;
  end loop;

  return did_share;
end;
$function$;

revoke all on function public.cl_share_entry_to_active_room(p_entry_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_share_entry_to_active_room(p_entry_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_toggle_room_photo_reaction(p_room_id uuid, p_photo_id uuid, p_emoji text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  photo_owner_id uuid;
  existing_emoji text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_emoji not in ('heart', 'sparkles', 'wow', 'palette') then
    raise exception 'room_photo_reaction_emoji_invalid' using errcode = '22023';
  end if;

  select photo.owner_id into photo_owner_id
  from public.cl_entry_photos as photo
  join public.cl_daily_entries as entry on entry.id = photo.entry_id
  join public.cl_entry_room_shares as share
    on share.entry_id = entry.id
    and share.room_id = p_room_id
    and share.revoked_at is null
  join public.cl_room_members as viewer_membership
    on viewer_membership.room_id = p_room_id
    and viewer_membership.user_id = current_user_id
    and viewer_membership.status = 'active'
  join public.cl_rooms as room
    on room.id = p_room_id
    and room.status in ('draft', 'active')
  where photo.id = p_photo_id
    and (viewer_membership.joined_at at time zone room.timezone)::date <= entry.date_key;

  if not found or photo_owner_id = current_user_id then
    raise exception 'room_photo_reaction_not_available' using errcode = '42501';
  end if;

  select reaction.emoji into existing_emoji
  from public.cl_room_photo_reactions as reaction
  where reaction.room_id = p_room_id
    and reaction.photo_id = p_photo_id
    and reaction.user_id = current_user_id
  for update;

  if existing_emoji = p_emoji then
    delete from public.cl_room_photo_reactions
    where room_id = p_room_id
      and photo_id = p_photo_id
      and user_id = current_user_id;
    return false;
  end if;

  insert into public.cl_room_photo_reactions (room_id, photo_id, user_id, emoji)
  values (p_room_id, p_photo_id, current_user_id, p_emoji)
  on conflict (room_id, photo_id, user_id)
  do update set emoji = excluded.emoji, updated_at = now();

  return true;
end;
$function$;

revoke all on function public.cl_toggle_room_photo_reaction(p_room_id uuid, p_photo_id uuid, p_emoji text) from public, anon, authenticated, service_role;

grant execute on function public.cl_toggle_room_photo_reaction(p_room_id uuid, p_photo_id uuid, p_emoji text) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_touch_room_entry_shares_for_photo_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_entry_id uuid;
begin
  target_entry_id := case
    when tg_op = 'DELETE' then old.entry_id
    else new.entry_id
  end;

  update public.cl_entry_room_shares as share
  set updated_at = now()
  where share.entry_id = target_entry_id
    and share.revoked_at is null
    and exists (
      select 1
      from public.cl_room_members as membership
      join public.cl_rooms as room
        on room.id = membership.room_id
        and room.status in ('draft', 'active')
      where membership.room_id = share.room_id
        and membership.user_id = share.shared_by
        and membership.status = 'active'
    );

  return null;
end;
$function$;

revoke all on function public.cl_touch_room_entry_shares_for_photo_change() from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cl_transfer_active_room_ownership(p_new_owner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  requesting_member_role text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_new_owner_id is null or p_new_owner_id = current_user_id then
    raise exception 'room_owner_transfer_target_invalid' using errcode = '22023';
  end if;

  select membership.room_id, membership.role
  into target_room_id, requesting_member_role
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.user_id = current_user_id
    and membership.status = 'active'
  for update of membership, room;

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  perform 1
  from public.cl_room_members as membership
  where membership.room_id = target_room_id
    and membership.status = 'active'
  for update;

  if not exists (
    select 1
    from public.cl_room_members as membership
    where membership.room_id = target_room_id
      and membership.user_id = p_new_owner_id
      and membership.status = 'active'
  ) then
    raise exception 'room_owner_transfer_target_invalid' using errcode = '22023';
  end if;

  update public.cl_room_members
  set role = 'member'
  where room_id = target_room_id
    and user_id = current_user_id
    and status = 'active'
    and role = 'owner';

  update public.cl_room_members
  set role = 'owner'
  where room_id = target_room_id
    and user_id = p_new_owner_id
    and status = 'active'
    and role = 'member';
end;
$function$;

revoke all on function public.cl_transfer_active_room_ownership(p_new_owner_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_transfer_active_room_ownership(p_new_owner_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_transfer_room_ownership(p_room_id uuid, p_new_owner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  requesting_member_role text;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_new_owner_id is null or p_new_owner_id = current_user_id then
    raise exception 'room_owner_transfer_target_invalid' using errcode = '22023';
  end if;

  select membership.role
  into requesting_member_role
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active'
  for update of membership, room;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  perform 1
  from public.cl_room_members as membership
  where membership.room_id = p_room_id
    and membership.status = 'active'
  for update;

  if not exists (
    select 1
    from public.cl_room_members as membership
    where membership.room_id = p_room_id
      and membership.user_id = p_new_owner_id
      and membership.status = 'active'
  ) then
    raise exception 'room_owner_transfer_target_invalid' using errcode = '22023';
  end if;

  update public.cl_room_members
  set role = 'member'
  where room_id = p_room_id
    and user_id = current_user_id
    and status = 'active'
    and role = 'owner';

  update public.cl_room_members
  set role = 'owner'
  where room_id = p_room_id
    and user_id = p_new_owner_id
    and status = 'active'
    and role = 'member';
end;
$function$;

revoke all on function public.cl_transfer_room_ownership(p_room_id uuid, p_new_owner_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.cl_transfer_room_ownership(p_room_id uuid, p_new_owner_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_update_active_room_settings(p_name text, p_emoji text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
  requesting_member_role text;
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 20 then
    raise exception 'room_name_invalid' using errcode = '22023';
  end if;

  if normalized_emoji is not null and char_length(normalized_emoji) > 8 then
    raise exception 'room_emoji_invalid' using errcode = '22023';
  end if;

  select membership.room_id, membership.role
  into target_room_id, requesting_member_role
  from public.cl_room_members as membership
  where membership.user_id = current_user_id
    and membership.status = 'active'
  for update;

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  update public.cl_rooms as room
  set name = normalized_name,
      emoji = normalized_emoji
  where room.id = target_room_id
    and room.status in ('draft', 'active');

  if not found then
    raise exception 'active_room_not_found' using errcode = 'P0001';
  end if;
end;
$function$;

revoke all on function public.cl_update_active_room_settings(p_name text, p_emoji text) from public, anon, authenticated, service_role;

grant execute on function public.cl_update_active_room_settings(p_name text, p_emoji text) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_update_room_settings(p_room_id uuid, p_name text, p_emoji text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  requesting_member_role text;
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 20 then
    raise exception 'room_name_invalid' using errcode = '22023';
  end if;

  if normalized_emoji is not null and char_length(normalized_emoji) > 8 then
    raise exception 'room_emoji_invalid' using errcode = '22023';
  end if;

  select membership.role
  into requesting_member_role
  from public.cl_room_members as membership
  join public.cl_rooms as room
    on room.id = membership.room_id
    and room.status in ('draft', 'active')
  where membership.room_id = p_room_id
    and membership.user_id = current_user_id
    and membership.status = 'active'
  for update of membership, room;

  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  if requesting_member_role <> 'owner' then
    raise exception 'room_owner_required' using errcode = '42501';
  end if;

  update public.cl_rooms
  set name = normalized_name,
      emoji = normalized_emoji
  where id = p_room_id
    and status in ('draft', 'active');
end;
$function$;

revoke all on function public.cl_update_room_settings(p_room_id uuid, p_name text, p_emoji text) from public, anon, authenticated, service_role;

grant execute on function public.cl_update_room_settings(p_room_id uuid, p_name text, p_emoji text) to authenticated;

CREATE OR REPLACE FUNCTION public.cl_validate_entry_room_share()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  entry_owner_id uuid;
  entry_mission_id uuid;
  entry_date_key date;
begin
  select entry.user_id, entry.mission_id, entry.date_key
  into entry_owner_id, entry_mission_id, entry_date_key
  from public.cl_daily_entries as entry
  where entry.id = new.entry_id;

  if entry_owner_id is null or entry_owner_id <> new.shared_by then
    raise exception 'entry_room_share_owner_mismatch' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.cl_room_members as membership
    join public.cl_rooms as room on room.id = membership.room_id
    where membership.room_id = new.room_id
      and membership.user_id = new.shared_by
      and membership.status = 'active'
      and (membership.joined_at at time zone room.timezone)::date <= entry_date_key
  ) then
    raise exception 'entry_room_share_requires_active_membership' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.cl_room_daily_missions as room_mission
    where room_mission.room_id = new.room_id
      and room_mission.challenge_date = entry_date_key
      and room_mission.mission_id = entry_mission_id
  ) then
    raise exception 'entry_room_share_mission_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.cl_validate_entry_room_share() from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cl_validate_room_daily_mission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (
    select 1
    from public.cl_daily_missions as mission
    where mission.id = new.mission_id
      and mission.challenge_date = new.challenge_date
  ) then
    raise exception 'room_daily_mission_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.cl_validate_room_daily_mission() from public, anon, authenticated, service_role;

CREATE TRIGGER cl_daily_entries_set_updated_at BEFORE UPDATE ON public.cl_daily_entries FOR EACH ROW EXECUTE FUNCTION cl_set_daily_entries_updated_at();

CREATE TRIGGER cl_entry_photos_touch_room_shares AFTER INSERT OR DELETE OR UPDATE ON public.cl_entry_photos FOR EACH ROW EXECUTE FUNCTION cl_touch_room_entry_shares_for_photo_change();

CREATE TRIGGER cl_entry_room_shares_validate BEFORE INSERT OR UPDATE ON public.cl_entry_room_shares FOR EACH ROW EXECUTE FUNCTION cl_validate_entry_room_share();

CREATE TRIGGER cl_profiles_set_updated_at BEFORE UPDATE ON public.cl_profiles FOR EACH ROW EXECUTE FUNCTION cl_set_profiles_updated_at();

CREATE TRIGGER cl_profiles_validate_timezone BEFORE INSERT OR UPDATE OF timezone ON public.cl_profiles FOR EACH ROW EXECUTE FUNCTION cl_private.validate_iana_timezone_column();

CREATE TRIGGER cl_room_daily_missions_validate_mission BEFORE INSERT OR UPDATE ON public.cl_room_daily_missions FOR EACH ROW EXECUTE FUNCTION cl_validate_room_daily_mission();

CREATE TRIGGER cl_rooms_validate_timezone BEFORE INSERT OR UPDATE OF timezone ON public.cl_rooms FOR EACH ROW EXECUTE FUNCTION cl_private.validate_iana_timezone_column();

create policy "cl_daily_entries_delete_own" on public.cl_daily_entries as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "cl_daily_entries_insert_own" on public.cl_daily_entries as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "cl_daily_entries_select_own" on public.cl_daily_entries as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "cl_daily_entries_select_shared_room" on public.cl_daily_entries as PERMISSIVE for SELECT to authenticated using (cl_private.can_view_shared_entry(id));

create policy "cl_daily_entries_update_own" on public.cl_daily_entries as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "cl_entry_photos_delete_own" on public.cl_entry_photos as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = owner_id));

create policy "cl_entry_photos_insert_own" on public.cl_entry_photos as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "cl_entry_photos_select_own" on public.cl_entry_photos as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = owner_id));

create policy "cl_entry_photos_select_shared_room" on public.cl_entry_photos as PERMISSIVE for SELECT to authenticated using (cl_private.can_view_shared_entry(entry_id));

create policy "cl_entry_photos_update_own" on public.cl_entry_photos as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = owner_id)) with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "cl_entry_room_shares_select_author_or_active_member" on public.cl_entry_room_shares as PERMISSIVE for SELECT to authenticated using (((shared_by = ( SELECT auth.uid() AS uid)) OR cl_private.can_view_shared_entry(entry_id)));

create policy "cl_profiles_insert_own" on public.cl_profiles as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = id));

create policy "cl_profiles_select_own" on public.cl_profiles as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = id));

create policy "cl_profiles_update_own" on public.cl_profiles as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));

create policy "cl_push_devices_select_own" on public.cl_push_devices as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "cl_room_daily_missions_select_active_member" on public.cl_room_daily_missions as PERMISSIVE for SELECT to authenticated using (cl_private.can_view_room_day(room_id, challenge_date));

create policy "cl_room_members_select_own" on public.cl_room_members as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "cl_room_photo_reactions_select_active_members" on public.cl_room_photo_reactions as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM ((((cl_entry_photos photo
     JOIN cl_daily_entries entry ON ((entry.id = photo.entry_id)))
     JOIN cl_entry_room_shares share ON (((share.entry_id = entry.id) AND (share.room_id = cl_room_photo_reactions.room_id) AND (share.revoked_at IS NULL))))
     JOIN cl_room_members viewer_membership ON (((viewer_membership.room_id = cl_room_photo_reactions.room_id) AND (viewer_membership.user_id = ( SELECT auth.uid() AS uid)) AND (viewer_membership.status = 'active'::text))))
     JOIN cl_rooms room ON (((room.id = cl_room_photo_reactions.room_id) AND (room.status = ANY (ARRAY['draft'::text, 'active'::text])))))
  WHERE ((photo.id = cl_room_photo_reactions.photo_id) AND (((viewer_membership.joined_at AT TIME ZONE room.timezone))::date <= entry.date_key)))));

create policy "cl_rooms_select_active_member" on public.cl_rooms as PERMISSIVE for SELECT to authenticated using (cl_private.has_active_room_membership(id));

create policy "cl_entry_photos_storage_delete_own" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'cl-entry-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "cl_entry_photos_storage_insert_own" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'cl-entry-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "cl_entry_photos_storage_select_own" on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'cl-entry-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "cl_entry_photos_storage_select_shared_room" on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'cl-entry-photos'::text) AND cl_private.can_view_shared_storage_path(name)));

create policy "cl_entry_photos_storage_update_own" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'cl-entry-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))) with check (((bucket_id = 'cl-entry-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

revoke all on table public.cl_profiles from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE on table public.cl_profiles to authenticated;

grant all on table public.cl_profiles to service_role;

revoke all on table public.cl_color_palette from public, anon, authenticated, service_role;

grant all on table public.cl_color_palette to service_role;

revoke all on table public.cl_daily_missions from public, anon, authenticated, service_role;

grant all on table public.cl_daily_missions to service_role;

revoke all on table public.cl_daily_entries from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public.cl_daily_entries to authenticated;

grant all on table public.cl_daily_entries to service_role;

revoke all on table public.cl_entry_photos from public, anon, authenticated, service_role;

grant SELECT, INSERT, UPDATE, DELETE on table public.cl_entry_photos to authenticated;

grant all on table public.cl_entry_photos to service_role;

revoke all on table public.cl_rooms from public, anon, authenticated, service_role;

grant SELECT on table public.cl_rooms to authenticated;

grant all on table public.cl_rooms to service_role;

revoke all on table public.cl_room_members from public, anon, authenticated, service_role;

grant SELECT on table public.cl_room_members to authenticated;

grant all on table public.cl_room_members to service_role;

revoke all on table public.cl_room_invites from public, anon, authenticated, service_role;

grant all on table public.cl_room_invites to service_role;

revoke all on table public.cl_room_invite_uses from public, anon, authenticated, service_role;

grant all on table public.cl_room_invite_uses to service_role;

revoke all on table public.cl_room_daily_missions from public, anon, authenticated, service_role;

grant SELECT on table public.cl_room_daily_missions to authenticated;

grant all on table public.cl_room_daily_missions to service_role;

revoke all on table public.cl_entry_room_shares from public, anon, authenticated, service_role;

grant SELECT on table public.cl_entry_room_shares to authenticated;

grant all on table public.cl_entry_room_shares to service_role;

revoke all on table public.cl_room_photo_reactions from public, anon, authenticated, service_role;

grant SELECT on table public.cl_room_photo_reactions to authenticated;

grant all on table public.cl_room_photo_reactions to service_role;

revoke all on table public.cl_push_devices from public, anon, authenticated, service_role;

grant SELECT on table public.cl_push_devices to authenticated;

grant all on table public.cl_push_devices to service_role;

revoke all on table public.cl_room_photo_push_deliveries from public, anon, authenticated, service_role;

grant all on table public.cl_room_photo_push_deliveries to service_role;

insert into public.cl_color_palette (slug, name_ko, name_en, hex, tint_hex, shade_hex, on_color_hex, prompt_ko) values
  ('clear-blue', '클리어 블루', 'Clear Blue', '#1976D2', '#E1EEFB', '#0D4F96', '#FFFFFF', '눈에 또렷한 파랑을 찾아보세요.'),
  ('coral-pink', '코랄 핑크', 'Coral Pink', '#F06278', '#FDE8EC', '#B83B50', '#1D1C1A', '따뜻하게 물든 코랄빛을 찾아보세요.'),
  ('leaf-green', '리프 그린', 'Leaf Green', '#43A047', '#E5F4E6', '#246D2A', '#FFFFFF', '오늘 곁의 선명한 초록을 찾아보세요.'),
  ('lemon-yellow', '레몬 옐로', 'Lemon Yellow', '#FDD835', '#FFF9D8', '#A98400', '#1D1C1A', '햇살처럼 밝은 노랑을 찾아보세요.'),
  ('lime-green', '라임 그린', 'Lime Green', '#8BC34A', '#EEF8DF', '#568C18', '#1D1C1A', '싱그러운 연두빛을 찾아보세요.'),
  ('mint-green', '민트 그린', 'Mint Green', '#26A69A', '#DFF5F2', '#117268', '#1D1C1A', '시원하게 보이는 민트빛을 찾아보세요.'),
  ('rose-pink', '로즈 핑크', 'Rose Pink', '#EC407A', '#FCE5ED', '#B91F56', '#FFFFFF', '기분 좋게 눈에 들어온 분홍을 찾아보세요.'),
  ('sky-blue', '스카이 블루', 'Sky Blue', '#29B6F6', '#DDF4FF', '#087EBC', '#1D1C1A', '맑고 가벼운 하늘빛을 찾아보세요.'),
  ('tangerine-orange', '탠저린 오렌지', 'Tangerine Orange', '#F57C00', '#FFF0DF', '#A85000', '#1D1C1A', '일상에서 반짝이는 귤빛을 찾아보세요.'),
  ('tomato-red', '토마토 레드', 'Tomato Red', '#E53935', '#FDE8E7', '#A91F1C', '#FFFFFF', '오늘 스쳐 간 또렷한 빨강을 찾아보세요.')
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cl-entry-photos', 'cl-entry-photos', false, 8388608, array['image/jpeg']);

alter publication supabase_realtime add table public.cl_entry_room_shares;

alter publication supabase_realtime add table public.cl_room_photo_reactions;

-- These restrictive guards apply only to this bucket. A permissive policy
-- added by another app later cannot expose Color Log photos.
create policy cl_storage_deny_anonymous on storage.objects
as restrictive for all to anon
using (bucket_id <> 'cl-entry-photos')
with check (bucket_id <> 'cl-entry-photos');

create policy cl_storage_read_boundary on storage.objects
as restrictive for select to authenticated
using (bucket_id <> 'cl-entry-photos' or (
  (storage.foldername(name))[1] = (select auth.uid())::text
  or cl_private.can_view_shared_storage_path(name)
));

create policy cl_storage_insert_boundary on storage.objects
as restrictive for insert to authenticated
with check (bucket_id <> 'cl-entry-photos' or (
  (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.cl_profiles where id = (select auth.uid()))
));

create policy cl_storage_update_boundary on storage.objects
as restrictive for update to authenticated
using (bucket_id <> 'cl-entry-photos' or (
  (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.cl_profiles where id = (select auth.uid()))
))
with check (bucket_id <> 'cl-entry-photos' or (
  (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.cl_profiles where id = (select auth.uid()))
));

create policy cl_storage_delete_boundary on storage.objects
as restrictive for delete to authenticated
using (bucket_id <> 'cl-entry-photos' or (storage.foldername(name))[1] = (select auth.uid())::text);

-- Auth identities are shared by other applications. Delete only this app's
-- profile and cascading app data after transferring room ownership.
create function public.cl_delete_account_data(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id is null or coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  perform 1 from public.cl_profiles where id = p_user_id for update;
  if not found then return; end if;
  perform public.cl_prepare_account_deletion(p_user_id);
  delete from public.cl_profiles where id = p_user_id;
end;
$$;
revoke all on function public.cl_delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.cl_delete_account_data(uuid) to service_role;

-- Color Log owns its migration ledger; do not alter another app's shared
-- supabase_migrations history when installing this standalone baseline.
create table cl_private.schema_migrations (
  version text primary key,
  installed_at timestamptz not null default now()
);
alter table cl_private.schema_migrations enable row level security;
revoke all on cl_private.schema_migrations from public, anon, authenticated;
insert into cl_private.schema_migrations (version) values ('20261019130440');

notify pgrst, 'reload schema';
commit;
