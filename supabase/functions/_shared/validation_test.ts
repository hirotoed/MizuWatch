import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  constantTimeHexEqual,
  isUuidV7,
  sha256Hex,
  validateTelemetryReading,
} from "./validation.ts";

const registeredAt = new Date("2026-08-15T00:00:00Z");
const now = new Date("2026-08-15T01:00:00Z");

Deno.test("accepts and maps a valid v1 telemetry reading", () => {
  const result = validateTelemetryReading(
    {
      messageId: "0198d24c-ef42-7b9b-a9ce-9ca004ae9602",
      observedAt: "2026-08-15T00:30:00Z",
      latitude: 33,
      longitude: 130,
      altitude: 1.8,
      satellites: 10,
      gnssTimestamp: "2026-08-15T00:30:00Z",
      fixStatus: "valid",
      hdop: 0.9,
      waterTemperature: 24.8,
      ph: 7.12,
      ec: 326.4,
      airPressure: 1012.4,
      airTemperature: 28.4,
      humidity: 70.2,
      batteryVoltage: 3.9,
      communicationStatus: "online",
      waterTemperatureSensorId: "ds18b20-01",
      phSensorId: "sen0169v2-01",
      ecSensorId: "sen0706-01",
      phCalibrationId: "ph-cal-20260816-01",
      ecCalibrationId: "ec-cal-20260816-01",
      measurementStatus: "ok",
    },
    0,
    registeredAt,
    now,
  );

  assert(result.reading);
  assertEquals(
    result.reading.message_id,
    "0198d24c-ef42-7b9b-a9ce-9ca004ae9602",
  );
  assertEquals(result.reading.water_temperature, 24.8);
  assertEquals(result.reading.ph, 7.12);
  assertEquals(result.reading.ec, 326.4);
  assertEquals(result.reading.fix_status, "valid");
  assertEquals(result.error, undefined);
});

Deno.test("accepts a reading without coordinates when GNSS has no fix", () => {
  const result = validateTelemetryReading(
    {
      messageId: "0198d24c-ef42-7b9b-a9ce-9ca004ae9604",
      observedAt: "2026-08-15T00:30:00Z",
      fixStatus: "no_fix",
      satellites: 0,
      waterTemperature: 24.8,
      airPressure: 1012.4,
      airTemperature: 28.4,
      communicationStatus: "buffered",
      measurementStatus: "partial",
    },
    0,
    registeredAt,
    now,
  );

  assert(result.reading);
  assertEquals(result.reading.latitude, undefined);
  assertEquals(result.reading.longitude, undefined);
  assertEquals(result.reading.fix_status, "no_fix");
  assertEquals(result.error, undefined);
});

Deno.test("rejects null, out-of-range, non-v7, and future values per row", () => {
  const result = validateTelemetryReading(
    {
      messageId: "0198d24c-ef42-4b9b-a9ce-9ca004ae9602",
      observedAt: "2026-08-15T01:06:00Z",
      latitude: null,
      longitude: 181,
      fixStatus: "valid",
      hdop: 100,
      waterTemperature: -11,
      ph: 15,
      ec: 0,
      airPressure: 299,
      airTemperature: 81,
      humidity: null,
      qualityFlag: "A",
    },
    7,
    registeredAt,
    now,
  );

  assert(result.error);
  assertEquals(result.error.index, 7);
  assert(result.error.reasons.length >= 10);
  assertEquals(result.reading, undefined);
});

Deno.test("validates UUID v7 and compares hashes without early return", async () => {
  assert(isUuidV7("0198d24c-ef42-7b9b-a9ce-9ca004ae9602"));
  assertEquals(isUuidV7("0198d24c-ef42-4b9b-a9ce-9ca004ae9602"), false);
  const digest = await sha256Hex("device-token");
  assertEquals(digest.length, 64);
  assert(constantTimeHexEqual(digest, digest));
  assertEquals(
    constantTimeHexEqual(digest, `${digest.slice(0, -1)}0`),
    digest.endsWith("0"),
  );
  assertEquals(constantTimeHexEqual(digest, digest.slice(1)), false);
});
