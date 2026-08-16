create extension if not exists pgtap with schema extensions;

begin;
set local search_path = extensions, public;
select plan(21);

select has_table('public', 'devices', 'devices table exists');
select has_table('public', 'telemetry_readings', 'telemetry_readings table exists');
select has_table('public', 'user_device_access', 'user_device_access table exists');
select has_table('private', 'device_credentials', 'private device_credentials table exists');
select has_table('private', 'device_rate_limits', 'private rate-limit state exists');

select col_is_pk('public', 'devices', 'id', 'devices has an id primary key');
select col_is_pk('public', 'telemetry_readings', 'id', 'telemetry has an identity primary key');
select col_is_pk('public', 'user_device_access', array['user_id', 'device_id'], 'access rows use a composite primary key');
select has_index('public', 'telemetry_readings', 'telemetry_device_observed_idx', 'track lookup index exists');
select col_is_unique('public', 'telemetry_readings', array['device_id', 'message_id'], 'device/message idempotency constraint exists');

select ok((select relrowsecurity from pg_class where oid = 'public.devices'::regclass), 'devices RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.telemetry_readings'::regclass), 'telemetry RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.user_device_access'::regclass), 'access RLS is enabled');

select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'devices'), 2, 'devices has select and admin update policies');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'telemetry_readings'), 1, 'telemetry has one select policy');
select ok(not has_function_privilege('anon', 'public.ingest_telemetry_batch(uuid,smallint,jsonb)', 'EXECUTE'), 'anon cannot execute ingestion RPC');
select ok(has_function_privilege('service_role', 'public.ingest_telemetry_batch(uuid,smallint,jsonb)', 'EXECUTE'), 'service role can execute ingestion RPC');

insert into public.devices (id, vehicle_code, display_name)
values ('11111111-1111-4111-8111-111111111111', 'TEST_001', 'Test device');

select is(
  public.ingest_telemetry_batch(
    '11111111-1111-4111-8111-111111111111',
    1::smallint,
    jsonb_build_array(jsonb_build_object(
      'message_id', '0198d24c-ef42-7b9b-a9ce-9ca004ae9602',
      'observed_at', clock_timestamp(),
      'latitude', 33,
      'longitude', 130,
      'water_temperature', 24.8,
      'air_pressure', 1012.4,
      'air_temperature', 28.4
    ))
  )->>'accepted',
  '1',
  'first ingestion accepts a new reading'
);

select is(
  public.ingest_telemetry_batch(
    '11111111-1111-4111-8111-111111111111',
    1::smallint,
    jsonb_build_array(jsonb_build_object(
      'message_id', '0198d24c-ef42-7b9b-a9ce-9ca004ae9602',
      'observed_at', clock_timestamp(),
      'latitude', 33,
      'longitude', 130,
      'water_temperature', 24.8,
      'air_pressure', 1012.4,
      'air_temperature', 28.4
    ))
  )->>'duplicate',
  '1',
  'replayed message is reported as a duplicate'
);

select is(
  (select count(*)::integer from public.telemetry_readings where device_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'replayed message creates only one database row'
);

select throws_ok(
  $$
    insert into public.telemetry_readings (
      device_id, message_id, observed_at, latitude, longitude,
      water_temperature, air_pressure, air_temperature, schema_version
    ) values (
      '11111111-1111-4111-8111-111111111111',
      '0198d24c-ef42-7b9b-a9ce-9ca004ae9603',
      clock_timestamp(), 91, 130, 24.8, 1012.4, 28.4, 1
    )
  $$,
  '23514',
  null,
  'database rejects an out-of-range telemetry value'
);

select * from finish();
rollback;
