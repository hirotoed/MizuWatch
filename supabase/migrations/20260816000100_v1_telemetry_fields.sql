alter table public.telemetry_readings
  alter column latitude drop not null,
  alter column longitude drop not null,
  add column gnss_timestamp timestamptz,
  add column fix_status text,
  add column hdop real,
  add column ph real,
  add column ec real,
  add column communication_status text,
  add column water_temperature_sensor_id text,
  add column ph_sensor_id text,
  add column ec_sensor_id text,
  add column water_temperature_calibration_id text,
  add column ph_calibration_id text,
  add column ec_calibration_id text,
  add column measurement_status text,
  add column quality_flag text;

alter table public.telemetry_readings
  add constraint telemetry_coordinates_pair
    check ((latitude is null) = (longitude is null)),
  add constraint telemetry_fix_status_values
    check (fix_status is null or fix_status in ('valid', 'no_fix')),
  add constraint telemetry_fix_location_consistency
    check (
      fix_status is null
      or (fix_status = 'valid' and latitude is not null and longitude is not null)
      or (fix_status = 'no_fix' and latitude is null and longitude is null)
    ),
  add constraint telemetry_hdop_range
    check (hdop is null or hdop between 0 and 99.99),
  add constraint telemetry_ph_range
    check (ph is null or ph between 0 and 14),
  add constraint telemetry_ec_range
    check (ec is null or ec between 1 and 2000),
  add constraint telemetry_communication_status_values
    check (
      communication_status is null
      or communication_status in ('online', 'buffered', 'unknown')
    ),
  add constraint telemetry_measurement_status_values
    check (
      measurement_status is null
      or measurement_status in ('ok', 'stabilizing', 'partial', 'sensor_error')
    ),
  add constraint telemetry_quality_flag_values
    check (quality_flag is null or quality_flag in ('A', 'B', 'C')),
  add constraint telemetry_water_temperature_sensor_id_length
    check (
      water_temperature_sensor_id is null
      or char_length(water_temperature_sensor_id) between 1 and 64
    ),
  add constraint telemetry_ph_sensor_id_length
    check (ph_sensor_id is null or char_length(ph_sensor_id) between 1 and 64),
  add constraint telemetry_ec_sensor_id_length
    check (ec_sensor_id is null or char_length(ec_sensor_id) between 1 and 64),
  add constraint telemetry_water_temperature_calibration_id_length
    check (
      water_temperature_calibration_id is null
      or char_length(water_temperature_calibration_id) between 1 and 64
    ),
  add constraint telemetry_ph_calibration_id_length
    check (
      ph_calibration_id is null
      or char_length(ph_calibration_id) between 1 and 64
    ),
  add constraint telemetry_ec_calibration_id_length
    check (
      ec_calibration_id is null
      or char_length(ec_calibration_id) between 1 and 64
    );

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
      gnss_timestamp timestamptz,
      fix_status text,
      hdop real,
      water_temperature real,
      ph real,
      ec real,
      air_pressure real,
      air_temperature real,
      humidity real,
      battery_voltage real,
      communication_status text,
      water_temperature_sensor_id text,
      ph_sensor_id text,
      ec_sensor_id text,
      water_temperature_calibration_id text,
      ph_calibration_id text,
      ec_calibration_id text,
      measurement_status text
    )
    where item.observed_at < device_created_at
       or item.observed_at > clock_timestamp() + interval '5 minutes'
  ) then
    raise exception 'telemetry observation time is invalid';
  end if;

  insert into public.telemetry_readings (
    device_id, message_id, observed_at, latitude, longitude, altitude,
    satellites, gnss_timestamp, fix_status, hdop,
    water_temperature, ph, ec, air_pressure, air_temperature, humidity,
    battery_voltage, communication_status,
    water_temperature_sensor_id, ph_sensor_id, ec_sensor_id,
    water_temperature_calibration_id, ph_calibration_id, ec_calibration_id,
    measurement_status, schema_version
  )
  select target_device_id,
         item.message_id,
         item.observed_at,
         item.latitude,
         item.longitude,
         item.altitude,
         item.satellites,
         item.gnss_timestamp,
         item.fix_status,
         item.hdop,
         item.water_temperature,
         item.ph,
         item.ec,
         item.air_pressure,
         item.air_temperature,
         item.humidity,
         item.battery_voltage,
         item.communication_status,
         item.water_temperature_sensor_id,
         item.ph_sensor_id,
         item.ec_sensor_id,
         item.water_temperature_calibration_id,
         item.ph_calibration_id,
         item.ec_calibration_id,
         item.measurement_status,
         target_schema_version
  from jsonb_to_recordset(readings) as item(
    message_id uuid,
    observed_at timestamptz,
    latitude double precision,
    longitude double precision,
    altitude real,
    satellites smallint,
    gnss_timestamp timestamptz,
    fix_status text,
    hdop real,
    water_temperature real,
    ph real,
    ec real,
    air_pressure real,
    air_temperature real,
    humidity real,
    battery_voltage real,
    communication_status text,
    water_temperature_sensor_id text,
    ph_sensor_id text,
    ec_sensor_id text,
    water_temperature_calibration_id text,
    ph_calibration_id text,
    ec_calibration_id text,
    measurement_status text
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
