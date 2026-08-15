import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  constantTimeHexEqual,
  isUuidV7,
  sha256Hex,
  validateTelemetryReading,
} from "./validation.ts";

const registeredAt = new Date("2026-08-15T00:00:00Z");
const now = new Date("2026-08-15T01:00:00Z");

Deno.test("accepts and maps a valid telemetry reading", () => {
  const result = validateTelemetryReading(
    {
      messageId: "0198d24c-ef42-7b9b-a9ce-9ca004ae9602",
      observedAt: "2026-08-15T00:30:00Z",
      latitude: 33,
      longitude: 130,
      altitude: 1.8,
      satellites: 10,
      waterTemperature: 24.8,
      airPressure: 1012.4,
      airTemperature: 28.4,
      humidity: 70.2,
      batteryVoltage: 3.9,
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
  assertEquals(result.error, undefined);
});

Deno.test("rejects null, out-of-range, non-v7, and future values per row", () => {
  const result = validateTelemetryReading(
    {
      messageId: "0198d24c-ef42-4b9b-a9ce-9ca004ae9602",
      observedAt: "2026-08-15T01:06:00Z",
      latitude: null,
      longitude: 181,
      waterTemperature: -11,
      airPressure: 299,
      airTemperature: 81,
      humidity: null,
    },
    7,
    registeredAt,
    now,
  );

  assert(result.error);
  assertEquals(result.error.index, 7);
  assert(result.error.reasons.length >= 7);
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
