create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  vehicle_code text not null unique
    check (vehicle_code ~ '^[A-Z0-9][A-Z0-9_-]{1,63}$'),
  display_name text not null check (char_length(display_name) between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.telemetry_readings (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices(id),
  message_id uuid not null,
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  altitude real check (altitude between -500 and 10000),
  satellites smallint check (satellites between 0 and 100),
  water_temperature real not null check (water_temperature between -10 and 80),
  air_pressure real not null check (air_pressure between 300 and 1200),
  air_temperature real not null check (air_temperature between -60 and 80),
  humidity real check (humidity between 0 and 100),
  battery_voltage real check (battery_voltage between 0 and 20),
  schema_version smallint not null check (schema_version = 1),
  constraint telemetry_message_id_is_uuid_v7
    check (substring(replace(message_id::text, '-', '') from 13 for 1) = '7'),
  constraint telemetry_device_message_unique unique (device_id, message_id)
);

create index telemetry_device_observed_idx
  on public.telemetry_readings (device_id, observed_at desc, id desc);

create table public.user_device_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  role text not null check (role in ('viewer', 'admin')),
  primary key (user_id, device_id)
);

create index user_device_access_device_idx
  on public.user_device_access (device_id, user_id);

create table private.device_credentials (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  check (expires_at is null or expires_at > created_at)
);

create index device_credentials_active_idx
  on private.device_credentials (device_id, expires_at)
  where revoked_at is null;

create table private.device_rate_limits (
  device_id uuid not null references public.devices(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (device_id, window_started_at)
);

alter table public.devices enable row level security;
alter table public.telemetry_readings enable row level security;
alter table public.user_device_access enable row level security;

create or replace function private.user_has_device_role(
  target_device_id uuid,
  allowed_roles text[] default array['viewer', 'admin']::text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_device_access access
    where access.user_id = (select auth.uid())
      and access.device_id = target_device_id
      and access.role = any(allowed_roles)
  );
$$;

revoke all on function private.user_has_device_role(uuid, text[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.user_has_device_role(uuid, text[]) to authenticated;

create policy "users select assigned devices"
on public.devices for select
to authenticated
using ((select private.user_has_device_role(id)));

create policy "admins update assigned devices"
on public.devices for update
to authenticated
using ((select private.user_has_device_role(id, array['admin']::text[])))
with check ((select private.user_has_device_role(id, array['admin']::text[])));

create policy "users select assigned telemetry"
on public.telemetry_readings for select
to authenticated
using ((select private.user_has_device_role(device_id)));

create policy "users select own access rows"
on public.user_device_access for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.get_active_device_credentials()
returns table (
  credential_id uuid,
  device_id uuid,
  token_hash_hex text,
  vehicle_code text,
  device_created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select credentials.id,
         credentials.device_id,
         encode(credentials.token_hash, 'hex'),
         devices.vehicle_code,
         devices.created_at
  from private.device_credentials credentials
  join public.devices devices on devices.id = credentials.device_id
  where devices.is_active
    and credentials.revoked_at is null
    and (credentials.expires_at is null or credentials.expires_at > now());
$$;

revoke all on function public.get_active_device_credentials() from public, anon, authenticated;
grant execute on function public.get_active_device_credentials() to service_role;

create or replace function public.mark_device_credential_used(target_credential_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.device_credentials
  set last_used_at = now()
  where id = target_credential_id;
$$;

revoke all on function public.mark_device_credential_used(uuid) from public, anon, authenticated;
grant execute on function public.mark_device_credential_used(uuid) to service_role;

create or replace function public.claim_device_request_slot(target_device_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz := date_trunc('minute', clock_timestamp());
  updated_count integer;
begin
  insert into private.device_rate_limits (device_id, window_started_at, request_count)
  values (target_device_id, current_window, 1)
  on conflict (device_id, window_started_at)
  do update set request_count = private.device_rate_limits.request_count + 1
  returning request_count into updated_count;

  delete from private.device_rate_limits
  where window_started_at < current_window - interval '2 minutes';

  return jsonb_build_object(
    'allowed', updated_count <= 60,
    'retryAfter', greatest(1, 60 - extract(second from clock_timestamp())::integer)
  );
end;
$$;

revoke all on function public.claim_device_request_slot(uuid) from public, anon, authenticated;
grant execute on function public.claim_device_request_slot(uuid) to service_role;

create or replace function public.ingest_telemetry_batch(
  target_device_id uuid,
  target_schema_version smallint,
  readings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  device_created_at timestamptz;
  reading_count integer;
  inserted_count integer;
begin
  if target_schema_version <> 1 or jsonb_typeof(readings) <> 'array' then
    raise exception 'invalid telemetry batch';
  end if;

  reading_count := jsonb_array_length(readings);
  if reading_count > 200 then
    raise exception 'telemetry batch too large';
  end if;

  select created_at into device_created_at
  from public.devices
  where id = target_device_id and is_active
  for share;

  if device_created_at is null then
    raise exception 'device is not active';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(readings) as item(
      message_id uuid,
      observed_at timestamptz,
      latitude double precision,
      longitude double precision,
      altitude real,
      satellites smallint,
      water_temperature real,
      air_pressure real,
      air_temperature real,
      humidity real,
      battery_voltage real
    )
    where item.observed_at < device_created_at
       or item.observed_at > clock_timestamp() + interval '5 minutes'
  ) then
    raise exception 'telemetry observation time is invalid';
  end if;

  insert into public.telemetry_readings (
    device_id, message_id, observed_at, latitude, longitude, altitude,
    satellites, water_temperature, air_pressure, air_temperature, humidity,
    battery_voltage, schema_version
  )
  select target_device_id,
         item.message_id,
         item.observed_at,
         item.latitude,
         item.longitude,
         item.altitude,
         item.satellites,
         item.water_temperature,
         item.air_pressure,
         item.air_temperature,
         item.humidity,
         item.battery_voltage,
         target_schema_version
  from jsonb_to_recordset(readings) as item(
    message_id uuid,
    observed_at timestamptz,
    latitude double precision,
    longitude double precision,
    altitude real,
    satellites smallint,
    water_temperature real,
    air_pressure real,
    air_temperature real,
    humidity real,
    battery_voltage real
  )
  on conflict (device_id, message_id) do nothing;

  get diagnostics inserted_count = row_count;

  return jsonb_build_object(
    'accepted', inserted_count,
    'duplicate', reading_count - inserted_count
  );
end;
$$;

revoke all on function public.ingest_telemetry_batch(uuid, smallint, jsonb)
  from public, anon, authenticated;
grant execute on function public.ingest_telemetry_batch(uuid, smallint, jsonb)
  to service_role;

revoke all on table public.devices from anon;
revoke all on table public.telemetry_readings from anon;
revoke all on table public.user_device_access from anon;
grant select on table public.devices to authenticated;
grant select on table public.telemetry_readings to authenticated;
grant select on table public.user_device_access to authenticated;
grant update (display_name) on table public.devices to authenticated;
